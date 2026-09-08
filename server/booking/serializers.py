"""Serializers for the M4 booking workflow."""

from rest_framework import serializers

from .models import CompanyQuote


class CompanyQuoteSerializer(serializers.ModelSerializer):
    """One company's offer, with enough company context to compare on service."""

    companyId = serializers.UUIDField(source="company_id", read_only=True)
    companyCode = serializers.CharField(source="company.code", read_only=True)
    companyName = serializers.CharField(source="company.name", read_only=True)
    onTimePerformance = serializers.FloatField(
        source="company.on_time_performance", read_only=True
    )
    averageResponseHours = serializers.FloatField(
        source="company.average_response_hours", read_only=True
    )

    shipmentId = serializers.CharField(source="shipment_id", read_only=True)
    quoteId = serializers.CharField(source="quote_id", read_only=True)

    baseFreight = serializers.FloatField(source="base_freight", read_only=True)
    fuelSurcharge = serializers.FloatField(source="fuel_surcharge", read_only=True)
    handlingFee = serializers.FloatField(source="handling_fee", read_only=True)
    documentationFee = serializers.FloatField(source="documentation_fee", read_only=True)
    totalPrice = serializers.FloatField(source="total_price", read_only=True)

    transitDays = serializers.IntegerField(source="transit_days", read_only=True)
    serviceName = serializers.CharField(source="service_name", read_only=True)
    isRecommended = serializers.BooleanField(source="is_recommended", read_only=True)
    riskLevel = serializers.CharField(source="risk_level", read_only=True)
    riskScore = serializers.FloatField(source="risk_score", read_only=True)
    validUntil = serializers.DateTimeField(source="valid_until", read_only=True)
    isExpired = serializers.BooleanField(source="is_expired", read_only=True)

    class Meta:
        model = CompanyQuote
        fields = [
            "id",
            "reference",
            "shipmentId",
            "quoteId",
            "companyId",
            "companyCode",
            "companyName",
            "onTimePerformance",
            "averageResponseHours",
            "serviceName",
            "baseFreight",
            "fuelSurcharge",
            "handlingFee",
            "documentationFee",
            "totalPrice",
            "currency",
            "transitDays",
            "isRecommended",
            "riskLevel",
            "riskScore",
            "validUntil",
            "isExpired",
            "status",
            "created_at",
        ]
