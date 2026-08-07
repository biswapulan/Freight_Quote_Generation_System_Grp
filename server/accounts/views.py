"""API views for Mongo-backed signup, login, and password reset."""

from datetime import datetime, timedelta
import hashlib
import hmac
import uuid

from django.contrib.auth.hashers import check_password, make_password
from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .mongo import saved_addresses_collection, support_tickets_collection, users_collection
from .permissions import IsAuthenticatedMongoUser
from .serializers import (
    ForgotPasswordSerializer,
    LoginSerializer,
    ProfileUpdateSerializer,
    ResetPasswordSerializer,
    SavedAddressSerializer,
    SupportTicketSerializer,
    SignupSerializer,
)
from .tokens import create_token


def public_profile(user_doc):
    """Shape a Mongo user document into the profile payload sent to clients.

    Never includes password/reset-token fields.
    """

    return {
        "id": str(user_doc["_id"]),
        "full_name": user_doc.get("full_name", ""),
        "email": user_doc.get("email", ""),
        "role": user_doc.get("role", "retail"),
        "company_name": user_doc.get("company_name", ""),
        "gst_number": user_doc.get("gst_number", ""),
    }


def public_address(address_doc):
    """Shape an address document for the client without exposing ownership."""

    return {
        "id": str(address_doc["_id"]),
        "label": address_doc["label"],
        "type": address_doc["type"],
        "contact": address_doc["contact"],
        "phone": address_doc["phone"],
        "email": address_doc["email"],
        "street": address_doc["street"],
        "city": address_doc["city"],
        "state": address_doc["state"],
        "postal": address_doc["postal"],
        "country": address_doc["country"],
        "hours": address_doc.get("hours", ""),
        "notes": address_doc.get("notes", ""),
        "isDefault": address_doc.get("is_default", False),
    }


class SignupView(APIView):
    """Create a user document in MongoDB and return a JWT."""

    authentication_classes = []

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        email = data['email'].lower()
        if users_collection.find_one({'email': email}):
            return Response(
                {'detail': 'Email is already registered'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user_doc = {
            'full_name': data['full_name'],
            'email': email,
            'password': make_password(data['password']),
            # role is restricted by SignupSerializer to retail/business —
            # admin accounts are never created through public signup.
            'role': data.get('role', 'retail'),
            'company_name': data.get('company_name', ''),
            'gst_number': data.get('gst_number', ''),
            'created_at': datetime.utcnow(),
        }
        result = users_collection.insert_one(user_doc)
        user_doc['_id'] = result.inserted_id
        token = create_token(result.inserted_id)

        return Response(
            {'token': token, **public_profile(user_doc)},
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    """Validate credentials against MongoDB and return a JWT."""

    authentication_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = users_collection.find_one({'email': data['email'].lower()})
        if not user or not check_password(data['password'], user.get('password', '')):
            return Response(
                {'detail': 'Invalid email or password'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        token = create_token(user['_id'])
        return Response({'token': token, **public_profile(user)})


class MeView(APIView):
    """Return the authenticated user's profile (used to rehydrate a session)."""

    permission_classes = [IsAuthenticatedMongoUser]

    def get(self, request):
        return Response(public_profile(request.user))

    def patch(self, request):
        serializer = ProfileUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user_id = request.user["_id"]
        updates = {}

        if "email" in data:
            email = data["email"].lower()
            existing_user = users_collection.find_one({"email": email})
            if existing_user and existing_user["_id"] != user_id:
                return Response(
                    {"detail": "Email is already registered"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            updates["email"] = email

        if "new_password" in data:
            user = users_collection.find_one({"_id": user_id})
            if not user or not check_password(data["current_password"], user.get("password", "")):
                return Response(
                    {"detail": "Your current password is incorrect"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            updates["password"] = make_password(data["new_password"])

        users_collection.update_one({"_id": user_id}, {"$set": updates})
        updated_user = users_collection.find_one({"_id": user_id})
        return Response(public_profile(updated_user))


class SavedAddressesView(APIView):
    """List and create addresses owned by the signed-in user."""

    permission_classes = [IsAuthenticatedMongoUser]

    def get(self, request):
        addresses = saved_addresses_collection.find({"user_id": request.user["_id"]}).sort(
            [("is_default", -1), ("created_at", -1)]
        )
        return Response([public_address(address) for address in addresses])

    def post(self, request):
        serializer = SavedAddressSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        address = {**serializer.validated_data, "user_id": request.user["_id"], "created_at": datetime.utcnow()}
        address["is_default"] = address.pop("is_default")

        if address["is_default"]:
            saved_addresses_collection.update_many(
                {"user_id": request.user["_id"]}, {"$set": {"is_default": False}}
            )

        result = saved_addresses_collection.insert_one(address)
        address["_id"] = result.inserted_id
        return Response(public_address(address), status=status.HTTP_201_CREATED)


class SavedAddressDetailView(APIView):
    """Delete an address only when it belongs to the signed-in user."""

    permission_classes = [IsAuthenticatedMongoUser]

    def delete(self, request, address_id):
        from bson import ObjectId
        from bson.errors import InvalidId

        try:
            object_id = ObjectId(address_id)
        except InvalidId:
            return Response({"detail": "Address not found."}, status=status.HTTP_404_NOT_FOUND)

        result = saved_addresses_collection.delete_one(
            {"_id": object_id, "user_id": request.user["_id"]}
        )
        if not result.deleted_count:
            return Response({"detail": "Address not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


def public_ticket(ticket):
    return {
        "ticket_number": ticket["ticket_number"],
        "category": ticket["category"],
        "reference": ticket.get("reference", ""),
        "subject": ticket["subject"],
        "message": ticket["message"],
        "status": ticket["status"],
        "created_at": ticket["created_at"].isoformat(),
    }


class SupportTicketsView(APIView):
    permission_classes = [IsAuthenticatedMongoUser]

    def get(self, request):
        tickets = support_tickets_collection.find({"user_id": request.user["_id"]}).sort("created_at", -1)
        return Response({"results": [public_ticket(ticket) for ticket in tickets]})

    def post(self, request):
        serializer = SupportTicketSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ticket = {
            **serializer.validated_data,
            "ticket_number": f"TCK-{uuid.uuid4().hex[:8].upper()}",
            "user_id": request.user["_id"],
            "user_name": request.user.get("full_name", ""),
            "user_email": request.user.get("email", ""),
            "status": "pending",
            "created_at": datetime.utcnow(),
        }
        support_tickets_collection.insert_one(ticket)
        return Response(public_ticket(ticket), status=status.HTTP_201_CREATED)


class TawkIdentityView(APIView):
    permission_classes = [IsAuthenticatedMongoUser]

    def get(self, request):
        api_key = getattr(settings, "TAWK_API_KEY", "")
        if not api_key:
            return Response({"detail": "Tawk secure identity is not configured."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        user_id = str(request.user["_id"])
        signature = hmac.new(api_key.encode(), user_id.encode(), hashlib.sha256).hexdigest()
        return Response({"userId": user_id, "name": request.user.get("full_name", ""), "email": request.user.get("email", ""), "hash": signature})


class ForgotPasswordView(APIView):
    """Generate a reset token without revealing whether the email exists."""

    authentication_classes = []
    success_message = 'If that email is registered, a reset link has been sent.'

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].lower()

        user = users_collection.find_one({'email': email})
        if user:
            reset_token = uuid.uuid4().hex
            users_collection.update_one(
                {'_id': user['_id']},
                {
                    '$set': {
                        'reset_token': reset_token,
                        'reset_token_expires': datetime.utcnow() + timedelta(hours=1),
                    }
                },
            )
            # TODO: send email containing the reset link with reset_token.

        return Response({'detail': self.success_message})


class ResetPasswordView(APIView):
    """Replace a password when a valid, unexpired reset token is supplied."""

    authentication_classes = []

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = users_collection.find_one({'reset_token': data['token']})
        if not user:
            return Response(
                {'detail': 'Invalid or expired reset token'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        expires_at = user.get('reset_token_expires')
        if not expires_at or expires_at < datetime.utcnow():
            return Response(
                {'detail': 'Invalid or expired reset token'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        users_collection.update_one(
            {'_id': user['_id']},
            {
                '$set': {'password': make_password(data['new_password'])},
                '$unset': {'reset_token': '', 'reset_token_expires': ''},
            },
        )

        return Response({'detail': 'Password has been reset successfully'})
