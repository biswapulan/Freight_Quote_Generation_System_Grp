from rest_framework import serializers

from .insights import ai_insights
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

    # ---- Customs summary ----
    # The full orchestrator output lives on QuoteDetailSerializer only, because
    # it is large. The customs desk lists many quotes at once and needs to know
    # which are missing paperwork, so the compact summary below rides along on
    # every quote. Without it the officer queue could not tell a consignment
    # with no documents from a fully documented one.
    customsSummary = serializers.SerializerMethodField()

    def get_customsSummary(self, obj):
        customs = (obj.analysis or {}).get("customs") or {}
        return {
            "status": customs.get("status"),
            "check_id": customs.get("check_id"),
            "hs_code": customs.get("hs_code"),
            "advisory": customs.get("advisory"),
            "missing_documents": customs.get("missing_documents") or [],
            "checklist_items": customs.get("checklist_items") or [],
        }

    # ---- M2 price and M3 risk, in rupees, for the M4 screens ----
    aiInsights = serializers.SerializerMethodField()

    def get_aiInsights(self, obj):
        return ai_insights(obj)

    # ---- M4: the company selection, verification and booking it led to ----
    # My Quotes shows the quote, Selected Quotes the selection and the agent the
    # request, each under its own id. This ties them together on the quote.
    m4 = serializers.SerializerMethodField()

    def get_m4(self, obj):
        from booking.models import QuoteSelection

        selections = QuoteSelection.objects.filter(quote=obj).select_related(
            "company", "company_quote"
        ).prefetch_related("revisions")
        selection = (
            selections.filter(is_active=True).order_by("-created_at").first()
            or selections.order_by("-created_at").first()
        )
        if selection is None:
            return None

        request = getattr(selection, "verification", None)
        clearance = getattr(selection, "customs_clearance", None)
        booking = getattr(selection, "booking", None)
        offer = selection.company_quote

        # The latest counter-offer, whatever became of it. Both a pending and an
        # accepted one matter here: one is the price the customer is being asked
        # about, the other is the price they settled on.
        revisions = list(selection.revisions.all())
        revision = max(revisions, key=lambda r: r.revision_number, default=None)

        # What the customer is deciding on. A booking carries the terms actually
        # agreed; before there is one, the price on the table is the offer's own
        # total, which accepting a revision moves. Reading only the booking left
        # this null until the booking existed, so the record fell back to the
        # frozen snapshot and showed a customer revising the original amount
        # while asking them to confirm the revised one.
        if booking is not None:
            agreed_total = booking.agreed_total_price
        elif offer is not None:
            agreed_total = offer.total_price
        else:
            agreed_total = None

        # An agent prices a revision from a total, so the offer's own fee lines
        # can still sum to the original amount. This is the difference that
        # makes the record's lines add up to its total.
        adjustment = 0.0
        if offer is not None:
            adjustment = round(
                offer.total_price
                - (
                    offer.base_freight
                    + offer.fuel_surcharge
                    + offer.handling_fee
                    + offer.documentation_fee
                ),
                2,
            )

        return {
            "selectionReference": selection.reference,
            "status": selection.status,
            "companyName": selection.company.name,
            "verificationReference": request.reference if request else None,
            "verificationStatus": request.status if request else None,
            "customsReference": clearance.reference if clearance else None,
            "customsStatus": clearance.status if clearance else None,
            "customsReason": clearance.reason if clearance else "",
            # The officer who decided the clearance. `CustomsClearance` is the
            # authority on this and the quote carries no officer of its own, so
            # the screens that name one (the customs desk) read it here instead
            # of issuing a second request for the clearance queue.
            "customsOfficerEmail": clearance.officer_email if clearance else "",
            "bookingReference": booking.reference if booking else None,
            "bookingStatus": booking.status if booking else None,
            "currency": selection.selected_currency,
            "selectedTotal": selection.selected_total_price,
            "agreedTotal": agreed_total,
            # A revision the customer accepted counts even before the booking
            # that records it, so the record can say the terms moved.
            "wasRevised": bool(
                any(r.status == "ACCEPTED" for r in revisions)
                or (booking and booking.was_revised)
            ),
            "revision": {
                "reference": revision.reference,
                "originalTotal": revision.original_total_price,
                "revisedTotal": revision.revised_total_price,
                "currency": revision.currency,
                "reason": revision.reason,
                "accepted": revision.status == "ACCEPTED",
            }
            if revision
            else None,
            "offer": {
                "baseFreight": offer.base_freight,
                "fuelSurcharge": offer.fuel_surcharge,
                "handlingFee": offer.handling_fee,
                "documentationFee": offer.documentation_fee,
                "totalPrice": offer.total_price,
                "adjustment": adjustment,
            }
            if offer
            else None,
        }

    # ---- Carrier selection & agent assignment ----
    selectedCarrier = serializers.CharField(source="selected_carrier", read_only=True)
    assignedAgentEmail = serializers.CharField(source="assigned_agent_email", read_only=True)
    assignedAgentName = serializers.CharField(source="assigned_agent_name", read_only=True)
    carrierSelectedAt = serializers.DateTimeField(source="carrier_selected_at", read_only=True)

    class Meta:
        model = Quote
        fields = [
            "customsSummary",
            "aiInsights",
            "m4",
            "selectedCarrier",
            "selected_carrier",
            "assignedAgentEmail",
            "assigned_agent_email",
            "assignedAgentName",
            "assigned_agent_name",
            "carrierSelectedAt",
            "carrier_selected_at",
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
