"""Serializers for the M4 booking workflow."""

from rest_framework import serializers

from quotes.insights import ai_insights

from .models import (
    Booking,
    CompanyQuote,
    QuoteRevision,
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
    aiMarketFactor = serializers.FloatField(source="ai_market_factor", read_only=True)
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
            "aiMarketFactor",
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


class QuoteRevisionSerializer(serializers.ModelSerializer):
    """A counter-offer, showing what changed against the selected terms."""

    revisionNumber = serializers.IntegerField(source="revision_number", read_only=True)
    originalTotalPrice = serializers.FloatField(
        source="original_total_price", read_only=True
    )
    originalTransitDays = serializers.IntegerField(
        source="original_transit_days", read_only=True
    )
    revisedTotalPrice = serializers.FloatField(
        source="revised_total_price", read_only=True
    )
    revisedTransitDays = serializers.IntegerField(
        source="revised_transit_days", read_only=True
    )
    priceDelta = serializers.FloatField(source="price_delta", read_only=True)
    priceDeltaPct = serializers.FloatField(source="price_delta_pct", read_only=True)
    transitDelta = serializers.IntegerField(source="transit_delta", read_only=True)
    createdBy = serializers.EmailField(source="created_by_email", read_only=True)

    class Meta:
        model = QuoteRevision
        fields = [
            "id",
            "reference",
            "revisionNumber",
            "originalTotalPrice",
            "originalTransitDays",
            "revisedTotalPrice",
            "revisedTransitDays",
            "priceDelta",
            "priceDeltaPct",
            "transitDelta",
            "currency",
            "reason",
            "createdBy",
            "status",
            "customer_response_note",
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
    revisions = QuoteRevisionSerializer(many=True, read_only=True)
    requestedInformation = serializers.JSONField(
        source="requested_information", read_only=True
    )
    aiInsights = serializers.SerializerMethodField()

    def get_aiInsights(self, obj):
        # The checklist asks the agent to weigh the commercial terms and the
        # weather, customs and route risk; this is the analysis behind them.
        insights = ai_insights(obj.selection.quote)
        if insights is not None:
            offer = obj.selection.company_quote
            factor = offer.ai_market_factor if offer else None
            # Offers priced before the AI rate applied carry no factor. Say
            # so, rather than claim an adjustment this offer never had.
            insights["offerAdjustmentPct"] = round((factor - 1.0) * 100.0, 1) if factor else None
        return insights

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
            "revisions",
            "requestedInformation",
            "aiInsights",
            "created_at",
        ]


class BookingSerializer(serializers.ModelSerializer):
    """A confirmed booking, as the customer and the company both see it."""

    companyName = serializers.CharField(source="company.name", read_only=True)
    companyCode = serializers.CharField(source="company.code", read_only=True)
    selectionReference = serializers.CharField(
        source="selection.reference", read_only=True
    )
    shipmentId = serializers.CharField(source="shipment_id", read_only=True)
    quoteId = serializers.CharField(source="quote_id", read_only=True)
    origin = serializers.CharField(source="shipment.origin", read_only=True)
    destination = serializers.CharField(source="shipment.destination", read_only=True)
    cargoType = serializers.CharField(source="shipment.cargo_type", read_only=True)

    agreedTotalPrice = serializers.FloatField(
        source="agreed_total_price", read_only=True
    )
    agreedCurrency = serializers.CharField(source="agreed_currency", read_only=True)
    agreedTransitDays = serializers.IntegerField(
        source="agreed_transit_days", read_only=True
    )
    wasRevised = serializers.BooleanField(source="was_revised", read_only=True)
    isCancellable = serializers.BooleanField(source="is_cancellable", read_only=True)
    confirmedAt = serializers.DateTimeField(source="confirmed_at", read_only=True)
    cancelledAt = serializers.DateTimeField(source="cancelled_at", read_only=True)
    cancelledBy = serializers.EmailField(source="cancelled_by_email", read_only=True)
    cancellationReason = serializers.CharField(
        source="cancellation_reason", read_only=True
    )

    class Meta:
        model = Booking
        fields = [
            "id",
            "reference",
            "selectionReference",
            "shipmentId",
            "quoteId",
            "companyName",
            "companyCode",
            "origin",
            "destination",
            "cargoType",
            "customer_email",
            "agreedTotalPrice",
            "agreedCurrency",
            "agreedTransitDays",
            "wasRevised",
            "status",
            "isCancellable",
            "confirmedAt",
            "cancelledAt",
            "cancelledBy",
            "cancellationReason",
        ]
