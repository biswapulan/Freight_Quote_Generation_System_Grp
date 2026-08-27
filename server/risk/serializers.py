from rest_framework import serializers
from .models import ShipmentRiskAssessment, RiskFactor, RiskAlert


class RiskFactorSerializer(serializers.ModelSerializer):
    class Meta:
        model = RiskFactor
        fields = "__all__"


class RiskAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = RiskAlert
        fields = "__all__"


class ShipmentRiskAssessmentSerializer(serializers.ModelSerializer):
    factors = RiskFactorSerializer(many=True, read_only=True)
    alerts = RiskAlertSerializer(many=True, read_only=True)

    class Meta:
        model = ShipmentRiskAssessment
        fields = "__all__"


class RiskAssessRequestSerializer(serializers.Serializer):
    shipment_id = serializers.CharField(required=True)
    quote_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    weather_score = serializers.FloatField(required=False, default=20.0)
    customs_score = serializers.FloatField(required=False, default=15.0)
    customs_status = serializers.CharField(required=False, default="APPROVED")
    origin = serializers.CharField(required=False, default="Chennai")
    destination = serializers.CharField(required=False, default="Rotterdam")
    cargo_type = serializers.CharField(required=False, default="General Cargo")
    hs_code = serializers.CharField(required=False, default="850440")
