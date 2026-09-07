from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id",
            "recipient_id",
            "recipient_role",
            "title",
            "message",
            "category",
            "severity",
            "entity_type",
            "entity_id",
            "link",
            "read",
            "read_at",
            "created_at",
        ]
        read_only_fields = fields
