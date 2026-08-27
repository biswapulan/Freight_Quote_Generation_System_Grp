from rest_framework.views import APIView
from rest_framework.response import Response
from .models import DataFreshness, IntegrationSyncLog, AlertSubscription
from .serializers import (
    DataFreshnessSerializer,
    IntegrationSyncLogSerializer,
    AlertSubscriptionSerializer,
)


class DataFreshnessListView(APIView):
    """List data freshness metrics for external services."""

    def get(self, request):
        records = DataFreshness.objects.all()
        return Response(DataFreshnessSerializer(records, many=True).data)


class IntegrationSyncLogListView(APIView):
    """List recent integration sync execution logs."""

    def get(self, request):
        logs = IntegrationSyncLog.objects.all()[:50]
        return Response(IntegrationSyncLogSerializer(logs, many=True).data)
