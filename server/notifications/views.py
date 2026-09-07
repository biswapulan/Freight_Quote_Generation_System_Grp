"""Notification API — one inbox per user, merged with their role's broadcast feed."""

from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from quotes.auth_helper import get_current_user_and_role

from .models import Notification
from .serializers import NotificationSerializer

MAX_PAGE_SIZE = 100


def _inbox_for(user_id: str, role: str):
    """Everything addressed to this user personally, plus their role's broadcasts."""
    return Notification.objects.filter(
        Q(recipient_id=str(user_id)) | Q(recipient_role=(role or "").lower())
    )


class NotificationListView(APIView):
    """GET /api/v1/notifications -> the caller's inbox with an unread count."""

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        user_id, role, _email = get_current_user_and_role(request)

        qs = _inbox_for(user_id, role)

        if request.query_params.get("unread") in ("1", "true", "True"):
            qs = qs.filter(read=False)

        category = request.query_params.get("category")
        if category:
            qs = qs.filter(category=category.upper())

        try:
            limit = min(int(request.query_params.get("limit", 50)), MAX_PAGE_SIZE)
        except (TypeError, ValueError):
            limit = 50

        unread_count = _inbox_for(user_id, role).filter(read=False).count()
        rows = qs[:limit]

        return Response(
            {
                "count": qs.count(),
                "unread_count": unread_count,
                "results": NotificationSerializer(rows, many=True).data,
            }
        )


class NotificationReadView(APIView):
    """POST /api/v1/notifications/<id>/read -> mark one notification read."""

    authentication_classes = []
    permission_classes = []

    def post(self, request, notification_id):
        user_id, role, _email = get_current_user_and_role(request)

        notification = _inbox_for(user_id, role).filter(id=notification_id).first()
        if not notification:
            return Response(
                {"error": "Notification not found."}, status=status.HTTP_404_NOT_FOUND
            )

        if not notification.read:
            notification.read = True
            notification.read_at = timezone.now()
            notification.save(update_fields=["read", "read_at"])

        return Response(NotificationSerializer(notification).data)


class NotificationReadAllView(APIView):
    """POST /api/v1/notifications/read-all -> clear the caller's unread badge."""

    authentication_classes = []
    permission_classes = []

    def post(self, request):
        user_id, role, _email = get_current_user_and_role(request)

        updated = _inbox_for(user_id, role).filter(read=False).update(
            read=True, read_at=timezone.now()
        )
        return Response({"message": f"{updated} notification(s) marked as read.", "updated": updated})
