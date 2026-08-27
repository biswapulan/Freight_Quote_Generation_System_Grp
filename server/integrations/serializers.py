from rest_framework import serializers
from .models import DataFreshness, IntegrationSyncLog, AlertSubscription


class DataFreshnessSerializer(serializers.ModelSerializer):
    class Meta:
        model = DataFreshness
        fields = "__all__"


class IntegrationSyncLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = IntegrationSyncLog
        fields = "__all__"


class AlertSubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AlertSubscription
        fields = "__all__"
