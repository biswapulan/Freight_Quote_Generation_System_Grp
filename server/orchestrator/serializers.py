from rest_framework import serializers

from .models import AgentInvocation, OrchestrationRun


class AgentInvocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentInvocation
        fields = [
            "id",
            "agent",
            "status",
            "duration_ms",
            "summary",
            "error",
            "created_at",
        ]
        read_only_fields = fields


class OrchestrationRunSerializer(serializers.ModelSerializer):
    invocations = AgentInvocationSerializer(many=True, read_only=True)

    class Meta:
        model = OrchestrationRun
        fields = [
            "id",
            "shipment_id",
            "quote_id",
            "status",
            "duration_ms",
            "degraded_agents",
            "triggered_by",
            "created_at",
            "invocations",
        ]
        read_only_fields = fields
