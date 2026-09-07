from rest_framework import serializers

from .models import Quote, Shipment


class ShipmentSerializer(serializers.ModelSerializer):
    customerId = serializers.CharField(source="customer_id", required=False)
    cargoType = serializers.CharField(source="cargo_type", required=False)
    transportMode = serializers.CharField(source="transport_mode", required=False)
    containerType = serializers.CharField(source="container_type", required=False)
    hsCode = serializers.CharField(source="hs_code", required=False)

    class Meta:
        model = Shipment
        fields = [
            "id",
            "customerId",
            "customer_id",
            "customer_email",
            "origin",
            "destination",
            "cargoType",
            "cargo_type",
            "weight",
            "volume",
            "transportMode",
            "transport_mode",
            "containerType",
            "container_type",
            "hsCode",
            "hs_code",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def create(self, validated_data):
        # Support both camelCase and snake_case inputs
        return super().create(validated_data)


class QuoteSerializer(serializers.ModelSerializer):
    shipmentId = serializers.CharField(source="shipment_id", read_only=True)
    basePrice = serializers.FloatField(source="base_price", read_only=True)
    distanceCharge = serializers.FloatField(source="distance_charge", read_only=True)
    weightCharge = serializers.FloatField(source="weight_charge", read_only=True)
    fuelCharge = serializers.FloatField(source="fuel_charge", read_only=True)
    totalPrice = serializers.FloatField(source="total_price", read_only=True)
    shipmentDetails = ShipmentSerializer(source="shipment", read_only=True)

    # ---- M1 route intelligence ----
    distanceKm = serializers.FloatField(source="distance", read_only=True)
    estimatedTransitDays = serializers.IntegerField(source="estimated_transit_days", read_only=True)
    routeId = serializers.CharField(source="route_id", read_only=True)
    routePath = serializers.CharField(source="route_path", read_only=True)

    # ---- M2 pricing intelligence (PDF section 8) ----
    rulePrice = serializers.FloatField(source="total_price", read_only=True)
    aiPredictedPrice = serializers.FloatField(source="ai_predicted_price", read_only=True)
    recommendedPrice = serializers.FloatField(source="recommended_price", read_only=True)
    mlStatus = serializers.CharField(source="ml_status", read_only=True)

    # ---- M3 risk intelligence (PDF section 8) ----
    weatherRisk = serializers.FloatField(source="weather_risk_score", read_only=True)
    customsRisk = serializers.FloatField(source="customs_risk_score", read_only=True)
    routeRisk = serializers.FloatField(source="route_risk_score", read_only=True)
    overallRiskScore = serializers.FloatField(source="overall_risk_score", read_only=True)
    overallRisk = serializers.CharField(source="overall_risk_level", read_only=True)
    requiresHumanReview = serializers.BooleanField(source="requires_human_review", read_only=True)

    class Meta:
        model = Quote
        fields = [
            "id",
            "shipmentId",
            "shipment_id",
            "customer_id",
            "distance",
            "distanceKm",
            "basePrice",
            "base_price",
            "distanceCharge",
            "distance_charge",
            "weightCharge",
            "weight_charge",
            "fuelCharge",
            "fuel_charge",
            "totalPrice",
            "total_price",
            "currency",
            "status",
            "admin_notes",
            # M1
            "estimatedTransitDays",
            "estimated_transit_days",
            "routeId",
            "route_id",
            "routePath",
            "route_path",
            "carrier",
            # M2
            "rulePrice",
            "aiPredictedPrice",
            "ai_predicted_price",
            "recommendedPrice",
            "recommended_price",
            "pricing_strategy",
            "mlStatus",
            "ml_status",
            # M3
            "weatherRisk",
            "weather_risk_score",
            "customsRisk",
            "customs_risk_score",
            "routeRisk",
            "route_risk_score",
            "overallRiskScore",
            "overall_risk_score",
            "overallRisk",
            "overall_risk_level",
            "policy_action",
            "requiresHumanReview",
            "requires_human_review",
            # Human review
            "reviewed_by",
            "review_reason",
            "original_total_price",
            "shipmentDetails",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class QuoteDetailSerializer(QuoteSerializer):
    """Quote plus the full orchestrator output, for the review and analysis screens."""

    class Meta(QuoteSerializer.Meta):
        fields = QuoteSerializer.Meta.fields + ["analysis"]
