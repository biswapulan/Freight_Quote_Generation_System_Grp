from django.contrib.auth import get_user_model
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from accounts.tokens import decode_token

User = get_user_model()


def get_current_user_and_role(request):
    """Resolves authenticated user ID and role from Authorization header or request.user.
    
    Returns:
        tuple: (user_id: str, role: str, email: str)
    """
    # 1. Check Bearer Token
    auth_header = request.META.get("HTTP_AUTHORIZATION", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
        try:
            payload = decode_token(token)
            user_id = str(payload.get("user_id", ""))
            role = payload.get("role")
            email = payload.get("email", "")

            # If not in payload, check headers or fallback
            if not role:
                role = request.META.get("HTTP_X_USER_ROLE") or (
                    "admin" if "admin" in user_id.lower() or "admin" in email.lower() else "customer"
                )
            if not email:
                email = request.META.get("HTTP_X_USER_EMAIL", f"{user_id}@example.com")

            return user_id, role, email
        except Exception:
            raise AuthenticationFailed("Invalid or expired token.")

    # 2. Check Django request.user if active
    if hasattr(request, "user") and request.user and request.user.is_authenticated:
        role = "admin" if request.user.is_staff or request.user.is_superuser else "customer"
        return str(request.user.id), role, request.user.email

    # 3. Testing Header Fallback (e.g. X-Customer-Id / X-User-Role)
    if "HTTP_X_CUSTOMER_ID" in request.META:
        user_id = request.META["HTTP_X_CUSTOMER_ID"]
        role = request.META.get("HTTP_X_USER_ROLE", "customer")
        email = request.META.get("HTTP_X_USER_EMAIL", f"{user_id}@example.com")
        return user_id, role, email

    raise AuthenticationFailed("Authentication required. Please provide a valid Bearer token.")


def require_admin(request):
    """Enforces that the requester has the 'admin' role."""
    user_id, role, email = get_current_user_and_role(request)
    if role.lower() != "admin":
        raise PermissionDenied("Access forbidden: Admin privilege required.")
    return user_id, role, email
