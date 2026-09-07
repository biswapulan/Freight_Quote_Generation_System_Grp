from rest_framework import serializers

from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = [
            "id",
            "actor_id",
            "actor_role",
            "actor_email",
            "action",
            "entity_type",
            "entity_id",
            "reason",
            "changes",
            "context",
            "created_at",
        ]
        read_only_fields = fields
