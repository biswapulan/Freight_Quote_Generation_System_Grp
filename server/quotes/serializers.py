from rest_framework import serializers
from .models import Shipment, Quote


class ShipmentSerializer(serializers.ModelSerializer):
    customerId = serializers.CharField(source="customer_id", required=False)
    cargoType = serializers.CharField(source="cargo_type", required=False)
    transportMode = serializers.CharField(source="transport_mode", required=False)

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

    class Meta:
        model = Quote
        fields = [
            "id",
            "shipmentId",
            "shipment_id",
            "customer_id",
            "distance",
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
            "status",
            "admin_notes",
            "shipmentDetails",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
