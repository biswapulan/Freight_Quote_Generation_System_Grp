"""Request serializers for Mongo-backed authentication endpoints."""

from rest_framework import serializers


class SignupSerializer(serializers.Serializer):
    """Validate the payload needed to create a Mongo user document."""

    full_name = serializers.CharField(min_length=2, max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)


class LoginSerializer(serializers.Serializer):
    """Validate credentials supplied during login."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class ForgotPasswordSerializer(serializers.Serializer):
    """Validate the email address used to request a reset token."""

    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    """Validate a reset token and replacement password."""

    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8, write_only=True)
