"""Caller identity resolution for the M1-M3 service endpoints.

Roles are read from the signed JWT or from the user's stored record. Two
weaker sources used to be consulted and have been removed:

  * the client-supplied ``X-User-Role`` header, which let any caller claim
    ``admin`` simply by setting it; and
  * substring matching on the user id/email, which granted admin to anyone
    whose address happened to contain "admin".

The header fallback is still available, but only when ``ALLOW_HEADER_ROLE_AUTH``
is enabled, which the test settings do and production does not.
"""

import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied

from accounts.tokens import decode_token

logger = logging.getLogger(__name__)

User = get_user_model()

DEFAULT_ROLE = "customer"


def _header_auth_allowed() -> bool:
    """Header-supplied identity is a test affordance, never a production one."""
    return bool(getattr(settings, "ALLOW_HEADER_ROLE_AUTH", False))


def _role_from_store(user_id: str) -> str | None:
    """Look the role up on the stored user document, the authoritative source."""
    try:
        from bson import ObjectId

        from accounts.mongo import users_collection

        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if user:
            return (user.get("role") or DEFAULT_ROLE).lower()
    except Exception:
        # An unreachable or non-ObjectId subject simply has no stored role.
        logger.debug("Could not resolve stored role for %s", user_id, exc_info=True)
    return None


def get_current_user_and_role(request):
    """Resolve the caller's id, role and email.

    Returns:
        tuple: (user_id: str, role: str, email: str)
    """
    # 1. Signed bearer token — the role travels inside the signature.
    auth_header = request.META.get("HTTP_AUTHORIZATION", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
        try:
            payload = decode_token(token)
        except Exception as exc:
            raise AuthenticationFailed("Invalid or expired token.") from exc

        user_id = str(payload.get("user_id", ""))
        email = payload.get("email", "")
        role = (payload.get("role") or "").lower()

        if not role:
            role = _role_from_store(user_id) or ""

        if not role and _header_auth_allowed():
            role = (request.META.get("HTTP_X_USER_ROLE") or "").lower()

        if not email:
            email = (
                request.META.get("HTTP_X_USER_EMAIL", "")
                if _header_auth_allowed()
                else ""
            )

        return user_id, role or DEFAULT_ROLE, email

    # 2. A Django session user (the /admin site).
    if hasattr(request, "user") and request.user and request.user.is_authenticated:
        role = "admin" if request.user.is_staff or request.user.is_superuser else DEFAULT_ROLE
        return str(request.user.id), role, request.user.email

    # 3. Header-supplied identity, for the test suite only.
    if _header_auth_allowed() and "HTTP_X_CUSTOMER_ID" in request.META:
        user_id = request.META["HTTP_X_CUSTOMER_ID"]
        role = (request.META.get("HTTP_X_USER_ROLE") or DEFAULT_ROLE).lower()
        email = request.META.get("HTTP_X_USER_EMAIL", f"{user_id}@example.com")
        return user_id, role, email

    raise AuthenticationFailed("Authentication required. Please provide a valid Bearer token.")


def require_admin(request):
    """Enforces that the requester has the 'admin' role."""
    user_id, role, email = get_current_user_and_role(request)
    if role.lower() != "admin":
        raise PermissionDenied("Access forbidden: Admin privilege required.")
    return user_id, role, email
