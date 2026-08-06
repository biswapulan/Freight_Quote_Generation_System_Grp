"""Role-based DRF permissions for the Mongo-backed user documents.

`request.user` here is a plain dict returned by MongoJWTAuthentication
(see authentication.py), not a Django User instance, so these permission
classes read the `role` key directly instead of using Django's built-in
permission/group machinery.
"""

from rest_framework.permissions import BasePermission


class IsAuthenticatedMongoUser(BasePermission):
    """True if the request carries a valid Mongo-backed user document."""

    def has_permission(self, request, view):
        return isinstance(request.user, dict) and bool(request.user.get("_id"))


class IsAdminRole(BasePermission):
    """Restrict access to users whose stored role is 'admin'."""

    def has_permission(self, request, view):
        return (
            isinstance(request.user, dict)
            and request.user.get("role") == "admin"
        )
