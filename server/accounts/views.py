"""API views for Mongo-backed signup, login, and password reset."""

from datetime import datetime, timedelta
import uuid

from django.contrib.auth.hashers import check_password, make_password
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .mongo import users_collection
from .serializers import (
    ForgotPasswordSerializer,
    LoginSerializer,
    ResetPasswordSerializer,
    SignupSerializer,
)
from .tokens import create_token


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
            'created_at': datetime.utcnow(),
        }
        result = users_collection.insert_one(user_doc)
        token = create_token(result.inserted_id)

        return Response(
            {'token': token, 'full_name': user_doc['full_name']},
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
        return Response({'token': token, 'full_name': user.get('full_name', '')})


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
