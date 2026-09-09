"""Serializers for freight company administration (M4 phase 7, admin side)."""

from rest_framework import serializers

from .models import CompanyAgent, CompanyRateCard, FreightCompany


class CompanyRateCardSerializer(serializers.ModelSerializer):
    baseBookingFee = serializers.FloatField(source="base_booking_fee", required=False)
    ratePerKm = serializers.FloatField(source="rate_per_km", required=False)
    ratePerKg = serializers.FloatField(source="rate_per_kg", required=False)
    fuelSurchargePct = serializers.FloatField(source="fuel_surcharge_pct", required=False)
    handlingFee = serializers.FloatField(source="handling_fee", required=False)
    documentationFee = serializers.FloatField(source="documentation_fee", required=False)
    minimumCharge = serializers.FloatField(source="minimum_charge", required=False)
    transitDaysDelta = serializers.IntegerField(source="transit_days_delta", required=False)
    validityDays = serializers.IntegerField(source="validity_days", required=False)
    isActive = serializers.BooleanField(source="is_active", required=False)

    class Meta:
        model = CompanyRateCard
        fields = [
            "id",
            "mode",
            "baseBookingFee",
            "ratePerKm",
            "ratePerKg",
            "fuelSurchargePct",
            "handlingFee",
            "documentationFee",
            "minimumCharge",
            "transitDaysDelta",
            "validityDays",
            "currency",
            "isActive",
        ]


class CompanyAgentSerializer(serializers.ModelSerializer):
    companyId = serializers.UUIDField(source="company_id", read_only=True)
    companyName = serializers.CharField(source="company.name", read_only=True)
    companyCode = serializers.CharField(source="company.code", read_only=True)
    userEmail = serializers.EmailField(source="user_email")
    userId = serializers.CharField(source="user_id", read_only=True)
    displayName = serializers.CharField(source="display_name", required=False, allow_blank=True)
    isActive = serializers.BooleanField(source="is_active", required=False)

    class Meta:
        model = CompanyAgent
        fields = [
            "id",
            "companyId",
            "companyName",
            "companyCode",
            "userEmail",
            "userId",
            "displayName",
            "role",
            "isActive",
            "created_at",
        ]


class FreightCompanySerializer(serializers.ModelSerializer):
    """A company with the numbers an administrator needs to judge it."""

    rateCards = CompanyRateCardSerializer(source="rate_cards", many=True, read_only=True)
    agentCount = serializers.SerializerMethodField()
    onTimePerformance = serializers.FloatField(
        source="on_time_performance", required=False, allow_null=True
    )
    averageResponseHours = serializers.FloatField(
        source="average_response_hours", required=False, allow_null=True
    )
    serviceName = serializers.CharField(
        source="service_name", required=False, allow_blank=True
    )
    legalName = serializers.CharField(
        source="legal_name", required=False, allow_blank=True
    )
    contactEmail = serializers.EmailField(
        source="contact_email", required=False, allow_blank=True
    )
    isBookable = serializers.BooleanField(source="is_bookable", read_only=True)

    class Meta:
        model = FreightCompany
        fields = [
            "id",
            "code",
            "name",
            "legalName",
            "modes",
            "serviceName",
            "headquarters",
            "contactEmail",
            "onTimePerformance",
            "averageResponseHours",
            "status",
            "isBookable",
            "agentCount",
            "rateCards",
            "created_at",
        ]

    def get_agentCount(self, obj):
        return obj.agents.filter(is_active=True).count()
