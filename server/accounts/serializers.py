"""Request serializers for Mongo-backed authentication endpoints."""

from rest_framework import serializers

# Roles a user may hold. Admin is deliberately excluded from the public
# signup choices below — admins are promoted via the create_admin management
# command, never self-registered.
ACCOUNT_ROLES = ("retail", "business", "admin")
SELF_SIGNUP_ROLES = ("retail", "business")


class SignupSerializer(serializers.Serializer):
    """Validate the payload needed to create a Mongo user document.

    Retail accounts only need name/email/password. Business accounts also
    require a company name; GST/tax id is optional. Role is restricted to
    the values in SELF_SIGNUP_ROLES — nobody can sign themselves up as admin.
    """

    full_name = serializers.CharField(min_length=2, max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    role = serializers.ChoiceField(choices=SELF_SIGNUP_ROLES, default="retail")
    company_name = serializers.CharField(
        max_length=150, required=False, allow_blank=True, default=""
    )
    gst_number = serializers.CharField(
        max_length=30, required=False, allow_blank=True, default=""
    )

    def validate(self, attrs):
        if attrs.get("role") == "business" and not attrs.get("company_name", "").strip():
            raise serializers.ValidationError(
                {"company_name": "Company name is required for a business account."}
            )
        return attrs


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


class ProfileUpdateSerializer(serializers.Serializer):
    """Validate the account details a signed-in user may change."""

    email = serializers.EmailField(required=False)
    current_password = serializers.CharField(required=False, write_only=True)
    new_password = serializers.CharField(required=False, min_length=8, write_only=True)

    def validate(self, attrs):
        has_current_password = bool(attrs.get("current_password"))
        has_new_password = bool(attrs.get("new_password"))

        if has_current_password != has_new_password:
            raise serializers.ValidationError(
                {"current_password": "Enter your current password and a new password."}
            )

        if not attrs:
            raise serializers.ValidationError("Provide an email address or password change.")

        return attrs


class AdminCreateUserSerializer(serializers.Serializer):
    """Validate a new user created directly from the admin panel.

    Unlike public signup, an admin may create a user with any role,
    including 'admin' — this is the in-app alternative to the
    create_admin CLI command.
    """

    full_name = serializers.CharField(min_length=2, max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    role = serializers.ChoiceField(choices=ACCOUNT_ROLES, default="admin")
    company_name = serializers.CharField(
        max_length=150, required=False, allow_blank=True, default=""
    )

    def validate(self, attrs):
        if attrs.get("role") == "business" and not attrs.get("company_name", "").strip():
            raise serializers.ValidationError(
                {"company_name": "Company name is required for a business account."}
            )
        return attrs


class AdminUpdateUserSerializer(serializers.Serializer):
    """Validate the fields an admin may change on another user's account.

    All fields are optional here — the view passes partial=True and only
    the keys actually supplied get applied as a Mongo $set.
    """

    full_name = serializers.CharField(min_length=2, max_length=150, required=False)
    role = serializers.ChoiceField(choices=ACCOUNT_ROLES, required=False)
    is_active = serializers.BooleanField(required=False)
    company_name = serializers.CharField(max_length=150, required=False, allow_blank=True)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("Provide at least one field to update.")
        return attrs


class SavedAddressSerializer(serializers.Serializer):
    """Validate a saved pickup or delivery address."""

    label = serializers.CharField(min_length=2, max_length=150)
    type = serializers.ChoiceField(
        choices=("Pickup (Origin)", "Delivery (Destination)", "Both (Origin & Destination)")
    )
    contact = serializers.CharField(min_length=2, max_length=150)
    phone = serializers.CharField(min_length=5, max_length=40)
    email = serializers.EmailField()
    street = serializers.CharField(min_length=3, max_length=300)
    city = serializers.CharField(min_length=2, max_length=120)
    state = serializers.CharField(min_length=2, max_length=120)
    postal = serializers.CharField(min_length=2, max_length=30)
    country = serializers.CharField(min_length=2, max_length=120)
    hours = serializers.CharField(required=False, allow_blank=True, max_length=150, default="")
    notes = serializers.CharField(required=False, allow_blank=True, max_length=500, default="")
    is_default = serializers.BooleanField(required=False, default=False)


class SupportTicketSerializer(serializers.Serializer):
    category = serializers.ChoiceField(choices=("Quote issue", "Shipment tracking", "Billing", "Account", "Other"))
    reference = serializers.CharField(required=False, allow_blank=True, max_length=100, default="")
    subject = serializers.CharField(min_length=3, max_length=200)
    message = serializers.CharField(min_length=10, max_length=5000)
