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
from .permissions import IsAdminRole, IsAuthenticatedMongoUser
from .serializers import (
    ACCOUNT_ROLES,
    AdminCreateUserSerializer,
    AdminUpdateUserSerializer,
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

        if user.get('is_active', True) is False:
            return Response(
                {'detail': 'This account has been deactivated. Contact an administrator.'},
                status=status.HTTP_403_FORBIDDEN,
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
    """Update or delete an address only when it belongs to the signed-in user."""

    permission_classes = [IsAuthenticatedMongoUser]

    def _get_address(self, request, address_id):
        from bson import ObjectId
        from bson.errors import InvalidId

        try:
            object_id = ObjectId(address_id)
        except InvalidId:
            return None

        return saved_addresses_collection.find_one(
            {"_id": object_id, "user_id": request.user["_id"]}
        )

    def patch(self, request, address_id):
        address = self._get_address(request, address_id)
        if not address:
            return Response({"detail": "Address not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = SavedAddressSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updates = serializer.validated_data
        updates["is_default"] = updates.pop("is_default")

        if updates["is_default"]:
            saved_addresses_collection.update_many(
                {"user_id": request.user["_id"], "_id": {"$ne": address["_id"]}},
                {"$set": {"is_default": False}},
            )

        saved_addresses_collection.update_one({"_id": address["_id"]}, {"$set": updates})
        return Response(public_address(saved_addresses_collection.find_one({"_id": address["_id"]})))

    def delete(self, request, address_id):
        address = self._get_address(request, address_id)
        if not address:
            return Response({"detail": "Address not found."}, status=status.HTTP_404_NOT_FOUND)

        result = saved_addresses_collection.delete_one(
            {"_id": address["_id"], "user_id": request.user["_id"]}
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


def admin_user_summary(user_doc):
    """Shape a Mongo user document for the admin User Management views.

    Includes fields a regular profile response wouldn't need (status,
    timestamps) but still never includes password/reset-token fields.
    """

    return {
        "id": str(user_doc["_id"]),
        "full_name": user_doc.get("full_name", ""),
        "email": user_doc.get("email", ""),
        "role": user_doc.get("role", "retail"),
        "company_name": user_doc.get("company_name", ""),
        "gst_number": user_doc.get("gst_number", ""),
        "is_active": user_doc.get("is_active", True),
        "created_at": user_doc["created_at"].isoformat() if user_doc.get("created_at") else None,
        "last_login_at": user_doc["last_login_at"].isoformat() if user_doc.get("last_login_at") else None,
    }


class AdminUsersView(APIView):
    """List every account or create a new one — admin only.

    This is the in-app view of every retail/business/admin account.
    Creating a user here is also how a second/third admin gets added,
    as an alternative to the create_admin management command.
    """

    permission_classes = [IsAdminRole]

    def get(self, request):
        query = {}

        role = request.query_params.get("role")
        if role in ACCOUNT_ROLES:
            query["role"] = role

        status_param = request.query_params.get("status")
        if status_param == "active":
            query["is_active"] = {"$ne": False}
        elif status_param == "inactive":
            query["is_active"] = False

        search = request.query_params.get("search", "").strip()
        if search:
            query["$or"] = [
                {"full_name": {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}},
            ]

        users = users_collection.find(query).sort("created_at", -1)
        return Response({"results": [admin_user_summary(u) for u in users]})

    def post(self, request):
        serializer = AdminCreateUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        email = data["email"].lower()
        if users_collection.find_one({"email": email}):
            return Response(
                {"detail": "Email is already registered"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user_doc = {
            "full_name": data["full_name"],
            "email": email,
            "password": make_password(data["password"]),
            "role": data["role"],
            "company_name": data.get("company_name", ""),
            "gst_number": "",
            "is_active": True,
            "created_at": datetime.utcnow(),
            "created_by": str(request.user["_id"]),
        }
        result = users_collection.insert_one(user_doc)
        user_doc["_id"] = result.inserted_id
        return Response(admin_user_summary(user_doc), status=status.HTTP_201_CREATED)


class AdminUserDetailView(APIView):
    """Retrieve, update, or deactivate a single user — admin only."""

    permission_classes = [IsAdminRole]

    def _get_user(self, user_id):
        from bson import ObjectId
        from bson.errors import InvalidId

        try:
            object_id = ObjectId(user_id)
        except InvalidId:
            return None

        return users_collection.find_one({"_id": object_id})

    def get(self, request, user_id):
        user = self._get_user(user_id)
        if not user:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(admin_user_summary(user))

    def patch(self, request, user_id):
        user = self._get_user(user_id)
        if not user:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminUpdateUserSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updates = serializer.validated_data

        # An admin can't change their own role or deactivate themselves —
        # avoids a mis-click locking every admin out of the panel.
        is_self = str(user["_id"]) == str(request.user["_id"])
        if is_self and updates.get("role") and updates["role"] != "admin":
            return Response(
                {"detail": "You can't change your own role."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if is_self and updates.get("is_active") is False:
            return Response(
                {"detail": "You can't deactivate your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        users_collection.update_one({"_id": user["_id"]}, {"$set": updates})
        return Response(admin_user_summary(users_collection.find_one({"_id": user["_id"]})))

    def delete(self, request, user_id):
        """Soft-deactivate — sets is_active False rather than deleting the document,
        so quote/shipment history tied to this user id stays intact.
        """

        user = self._get_user(user_id)
        if not user:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if str(user["_id"]) == str(request.user["_id"]):
            return Response(
                {"detail": "You can't deactivate your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        users_collection.update_one({"_id": user["_id"]}, {"$set": {"is_active": False}})
        return Response(status=status.HTTP_204_NO_CONTENT)
