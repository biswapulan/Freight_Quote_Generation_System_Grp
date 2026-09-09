"""Serializers for the M4 booking workflow."""

from rest_framework import serializers

from .models import (
    CompanyQuote,
    QuoteSelection,
    StatusHistory,
    VerificationCheck,
    VerificationRequest,
)


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


class VerificationCheckSerializer(serializers.ModelSerializer):
    checkedBy = serializers.EmailField(source="checked_by_email", read_only=True)
    checkedAt = serializers.DateTimeField(source="checked_at", read_only=True)

    class Meta:
        model = VerificationCheck
        fields = ["id", "area", "prompt", "result", "remarks", "checkedBy", "checkedAt"]


class StatusHistorySerializer(serializers.ModelSerializer):
    oldStatus = serializers.CharField(source="old_status", read_only=True)
    newStatus = serializers.CharField(source="new_status", read_only=True)
    changedBy = serializers.EmailField(source="changed_by_email", read_only=True)
    changedByRole = serializers.CharField(source="changed_by_role", read_only=True)

    class Meta:
        model = StatusHistory
        fields = [
            "id",
            "oldStatus",
            "newStatus",
            "changedBy",
            "changedByRole",
            "reason",
            "context",
            "created_at",
        ]


class QuoteSelectionSerializer(serializers.ModelSerializer):
    """The customer's choice, with the snapshot they agreed to."""

    companyName = serializers.CharField(source="company.name", read_only=True)
    companyCode = serializers.CharField(source="company.code", read_only=True)
    shipmentId = serializers.CharField(source="shipment_id", read_only=True)
    quoteId = serializers.CharField(source="quote_id", read_only=True)
    companyQuoteId = serializers.UUIDField(source="company_quote_id", read_only=True)

    selectedTotalPrice = serializers.FloatField(
        source="selected_total_price", read_only=True
    )
    selectedCurrency = serializers.CharField(source="selected_currency", read_only=True)
    selectedTransitDays = serializers.IntegerField(
        source="selected_transit_days", read_only=True
    )
    priceChanged = serializers.BooleanField(source="price_changed", read_only=True)
    isActive = serializers.BooleanField(source="is_active", read_only=True)

    class Meta:
        model = QuoteSelection
        fields = [
            "id",
            "reference",
            "shipmentId",
            "quoteId",
            "companyQuoteId",
            "companyName",
            "companyCode",
            "customer_email",
            "selectedTotalPrice",
            "selectedCurrency",
            "selectedTransitDays",
            "priceChanged",
            "status",
            "isActive",
            "created_at",
        ]


class VerificationRequestSerializer(serializers.ModelSerializer):
    """What a company agent sees in their queue."""

    selection = QuoteSelectionSerializer(read_only=True)
    companyName = serializers.CharField(source="company.name", read_only=True)
    assignedAgent = serializers.EmailField(source="assigned_agent_email", read_only=True)
    responseHours = serializers.FloatField(source="response_hours", read_only=True)
    isOverdue = serializers.BooleanField(source="is_overdue", read_only=True)
    slaDueAt = serializers.DateTimeField(source="sla_due_at", read_only=True)
    openedAt = serializers.DateTimeField(source="opened_at", read_only=True)
    decidedAt = serializers.DateTimeField(source="decided_at", read_only=True)
    checks = VerificationCheckSerializer(many=True, read_only=True)

    class Meta:
        model = VerificationRequest
        fields = [
            "id",
            "reference",
            "companyName",
            "assignedAgent",
            "status",
            "decision_reason",
            "responseHours",
            "isOverdue",
            "slaDueAt",
            "openedAt",
            "decidedAt",
            "selection",
            "checks",
            "created_at",
        ]
