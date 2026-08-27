from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from .models import ShipmentRiskAssessment, RiskFactor, RiskAlert
from .serializers import (
    ShipmentRiskAssessmentSerializer,
    RiskAssessRequestSerializer,
    RiskAlertSerializer,
)
from .engine import MultiFactorRiskEngine


class RiskAssessView(APIView):
    """Calculate multi-factor composite risk and factor explainability."""
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = RiskAssessRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        result = MultiFactorRiskEngine.evaluate_shipment_risk(
            shipment_id=data["shipment_id"],
            quote_id=data.get("quote_id"),
            weather_score=data.get("weather_score", 20.0),
            customs_score=data.get("customs_score", 15.0),
            customs_status=data.get("customs_status", "APPROVED"),
            origin=data.get("origin", "Chennai"),
            destination=data.get("destination", "Rotterdam"),
            cargo_type=data.get("cargo_type", "General Cargo"),
            hs_code=data.get("hs_code", "850440"),
        )

        return Response(result, status=status.HTTP_201_CREATED)

    def get(self, request, shipment_id=None):
        if not shipment_id:
            shipment_id = request.query_params.get("shipment_id")
        if not shipment_id:
            return Response({"error": "shipment_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        assessment = ShipmentRiskAssessment.objects.filter(shipment_id=shipment_id).first()
        if not assessment:
            # Fallback evaluation
            result = MultiFactorRiskEngine.evaluate_shipment_risk(
                shipment_id=shipment_id,
            )
            return Response(result)

        return Response(ShipmentRiskAssessmentSerializer(assessment).data)


class RiskAlertListView(APIView):
    """List risk alerts and acknowledge them."""
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        alerts = RiskAlert.objects.all()
        return Response(RiskAlertSerializer(alerts, many=True).data)


class RiskAlertAcknowledgeView(APIView):
    """Acknowledge a specific alert."""
    authentication_classes = []
    permission_classes = []

    def post(self, request, alert_id):
        alert = RiskAlert.objects.filter(id=alert_id).first()
        if not alert:
            return Response({"error": "Alert not found"}, status=status.HTTP_404_NOT_FOUND)

        alert.status = "ACKNOWLEDGED"
        alert.acknowledged_at = timezone.now()
        alert.acknowledged_by = request.data.get("user_id", "Operations Manager")
        alert.save()

        return Response({"message": "Alert acknowledged successfully", "alert": RiskAlertSerializer(alert).data})
