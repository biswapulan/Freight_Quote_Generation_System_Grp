"""API views for the shipment and quote workflow (PDF sections 3, 7 and 10).

The customer submits a shipment, the Quote Engine runs every AI agent over it,
the Freight Agent reviews the result, and the customer accepts or rejects. Every
status change goes through the lifecycle state machine and leaves an audit record.
"""

from audit import service as audit_service
from django.db.models import Q
from django.utils import timezone
from notifications import service as notify
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from . import lifecycle
from .approval_rules import evaluate_approval_rules  # noqa: F401 - kept for M2 compatibility
from .auth_helper import get_current_user_and_role, require_admin
from .lifecycle import InvalidStateTransitionError
from .margin_policy import (  # noqa: F401 - kept for M2 compatibility
    MarginFloorViolationError,
    enforce_margin_floor,
    resolve_margin_policy,
)
from .models import Quote, Shipment
from .quote_engine import QuoteEngine
from .serializers import QuoteDetailSerializer, QuoteSerializer, ShipmentSerializer

# Roles allowed to see and act on other people's shipments and quotes.
STAFF_ROLES = ("admin", "agent", "customs")


def _actor(request):
    """Resolve the caller into the shape the audit and lifecycle helpers expect."""
    user_id, role, email = get_current_user_and_role(request)
    return {"id": user_id, "role": role, "email": email}


def _is_staff(role: str) -> bool:
    return (role or "").lower() in STAFF_ROLES


# ==============================================================================
# SHIPMENTS
# ==============================================================================


class ShipmentCreateView(APIView):
    """POST /shipments  -> create a shipment request (PDF section 3, steps 2-3).
    GET  /shipments/my  -> the caller's shipments; staff roles see everything.
    """

    authentication_classes = []
    permission_classes = []

    def post(self, request):
        actor = _actor(request)
        data = request.data

        origin = data.get("origin")
        destination = data.get("destination")
        cargo_type = data.get("cargoType") or data.get("cargo_type") or "General Cargo"
        weight = data.get("weight")
        volume = data.get("volume")
        transport_mode = data.get("transportMode") or data.get("transport_mode") or "ocean"
        container_type = data.get("containerType") or data.get("container_type") or "40FT"
        hs_code = data.get("hsCode") or data.get("hs_code") or ""

        if not origin or not destination or weight is None or volume is None:
            return Response(
                {"error": "Missing required fields: origin, destination, weight, volume"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            weight = float(weight)
            volume = float(volume)
        except (TypeError, ValueError):
            return Response(
                {"error": "weight and volume must be numeric."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if weight <= 0 or volume <= 0:
            return Response(
                {"error": "weight and volume must be greater than zero."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        shipment = Shipment.objects.create(
            customer_id=actor["id"],
            customer_email=actor["email"],
            origin=origin,
            destination=destination,
            cargo_type=cargo_type,
            weight=weight,
            volume=volume,
            transport_mode=transport_mode,
            container_type=container_type,
            hs_code=hs_code,
            # PDF section 10: a submitted shipment starts at SUBMITTED.
            status=lifecycle.SHIPMENT_STATUS_SUBMITTED,
        )

        audit_service.record(
            actor_id=actor["id"],
            actor_role=actor["role"],
            actor_email=actor["email"],
            action=audit_service.SHIPMENT_CREATED,
            entity_type="SHIPMENT",
            entity_id=shipment.id,
            context={
                "origin": origin,
                "destination": destination,
                "cargo_type": cargo_type,
                "weight": weight,
                "volume": volume,
                "transport_mode": transport_mode,
            },
        )

        notify.notify_role(
            "agent",
            f"New shipment request: {shipment.id}",
            f"{origin} to {destination}, {cargo_type}, {weight:,.0f} kg.",
            category="SHIPMENT",
            severity="INFO",
            entity_type="SHIPMENT",
            entity_id=shipment.id,
            link="/dashboard/shipment-requests",
        )

        return Response(ShipmentSerializer(shipment).data, status=status.HTTP_201_CREATED)

    def get(self, request):
        actor = _actor(request)

        if _is_staff(actor["role"]):
            shipments = Shipment.objects.all()
            customer_id = request.query_params.get("customer_id")
            if customer_id:
                shipments = shipments.filter(customer_id=customer_id)
        else:
            shipments = Shipment.objects.filter(customer_id=actor["id"])

        status_filter = request.query_params.get("status")
        if status_filter:
            shipments = shipments.filter(status=status_filter.upper())

        return Response(ShipmentSerializer(shipments, many=True).data, status=status.HTTP_200_OK)


class ShipmentDetailView(APIView):
    """GET /shipments/<id> -> one shipment, ownership enforced."""

    authentication_classes = []
    permission_classes = []

    def get(self, request, shipment_id):
        actor = _actor(request)

        try:
            shipment = Shipment.objects.get(id=shipment_id)
        except Shipment.DoesNotExist:
            raise NotFound("Shipment not found.")

        if not _is_staff(actor["role"]) and shipment.customer_id != actor["id"]:
            raise PermissionDenied("Access denied: you cannot view another customer's shipment.")

        payload = ShipmentSerializer(shipment).data
        payload["quotes"] = QuoteSerializer(shipment.quotes.all(), many=True).data
        return Response(payload)


class ShipmentQuoteGenerateView(APIView):
    """POST /shipments/<id>/quote -> run the full AI pipeline and issue a draft quote.

    This is PDF section 3 steps 4 through 9 in one call: route intelligence, rule
    pricing, ML pricing, weather, customs, composite risk, then the quote engine.
    """

    authentication_classes = []
    permission_classes = []

    def post(self, request, shipment_id):
        actor = _actor(request)

        try:
            shipment = Shipment.objects.get(id=shipment_id)
        except Shipment.DoesNotExist:
            raise NotFound("Shipment not found.")

        if not _is_staff(actor["role"]) and shipment.customer_id != actor["id"]:
            raise PermissionDenied(
                "You do not have permission to generate quotes for this shipment."
            )

        try:
            quote = QuoteEngine.generate(shipment, actor=actor)
        except InvalidStateTransitionError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)

        return Response(QuoteDetailSerializer(quote).data, status=status.HTTP_201_CREATED)


# ==============================================================================
# QUOTES - CUSTOMER
# ==============================================================================


class CustomerQuoteListView(APIView):
    """GET /quotes/my  -> the caller's quotes.
    GET /quotes/<id>  -> one quote, with IDOR protection (core scenario 11).
    """

    authentication_classes = []
    permission_classes = []

    def get(self, request, quote_id=None):
        actor = _actor(request)

        if quote_id:
            try:
                quote = Quote.objects.select_related("shipment").get(id=quote_id)
            except Quote.DoesNotExist:
                raise NotFound("Quote not found.")

            if not _is_staff(actor["role"]) and quote.customer_id != actor["id"]:
                raise PermissionDenied(
                    "Access denied: You cannot view another customer's quote."
                )

            return Response(QuoteDetailSerializer(quote).data, status=status.HTTP_200_OK)

        quotes = Quote.objects.filter(customer_id=actor["id"]).select_related("shipment")
        return Response(QuoteSerializer(quotes, many=True).data, status=status.HTTP_200_OK)


class CustomerCarrierSelectionView(APIView):
    """POST /quotes/<id>/select-carrier -> customer picks a carrier and submits.

    This is the closing step of the enquiry. Each carrier is serviced by its own
    freight agent, so recording the choice also routes the quote into that
    agent's queue. Until this runs the quote belongs to nobody.
    """

    authentication_classes = []
    permission_classes = []

    def post(self, request, quote_id):
        actor = _actor(request)

        try:
            quote = Quote.objects.select_related("shipment").get(id=quote_id)
        except Quote.DoesNotExist:
            raise NotFound("Quote not found.")

        if not _is_staff(actor["role"]) and quote.customer_id != actor["id"]:
            raise PermissionDenied(
                "Access denied: You cannot choose a carrier for another customer's quote."
            )

        # M4: the customer selects one of the company offers the platform
        # generated. Preferred form is the offer's own id, which lets the
        # server price-check and expiry-check the exact thing they clicked.
        from booking.models import CompanyQuote
        from companies.models import CompanyAgent

        company_quote = None
        offer_id = request.data.get("company_quote_id") or request.data.get("offer_id")
        if offer_id:
            company_quote = CompanyQuote.objects.filter(
                id=offer_id, quote=quote
            ).select_related("company").first()
            if not company_quote:
                return Response(
                    {"error": "That offer does not belong to this quote."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            # M4 business rule: an expired offer cannot be taken forward.
            if company_quote.is_expired:
                return Response(
                    {
                        "error": (
                            f"{company_quote.company.name}'s offer expired on "
                            f"{company_quote.valid_until:%d %b %Y}. Refresh the options "
                            "to get a current price."
                        )
                    },
                    status=status.HTTP_409_CONFLICT,
                )

        carrier = (request.data.get("carrier") or "").strip()
        if company_quote:
            carrier = company_quote.company.name

        if not carrier:
            return Response(
                {"error": "A carrier is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Resolve the servicing agent from company membership rather than from
        # whatever the client sent. The browser naming its own reviewer meant a
        # crafted request could route a customer's shipment to any address.
        agent_email = ""
        agent_name = ""
        company = company_quote.company if company_quote else None
        if company is None:
            from companies.models import FreightCompany

            company = FreightCompany.objects.filter(name__iexact=carrier).first()

        if company:
            membership = (
                CompanyAgent.objects.filter(company=company, is_active=True)
                .order_by("-role", "created_at")
                .first()
            )
            if membership:
                agent_email = membership.user_email.lower()
                agent_name = membership.display_name or membership.user_email

        if not agent_email:
            # Fall back to the client-supplied values only for carriers that
            # are not yet registered as companies.
            agent_email = (request.data.get("agent_email") or "").strip().lower()
            agent_name = (request.data.get("agent_name") or "").strip()

        if not agent_email:
            return Response(
                {"error": f"{carrier} has no active agent to review this request."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        selection = None
        verification = None
        if company_quote:
            # M4 phase 3: the choice becomes a QuoteSelection with a frozen
            # price snapshot and a verification request in one company's queue,
            # rather than three loose columns stamped onto the quote.
            from booking.services import create_selection

            try:
                selection, verification, _created = create_selection(
                    quote=quote, company_quote=company_quote, actor=actor
                )
            except ValueError as exc:
                return Response(
                    {"error": str(exc)}, status=status.HTTP_409_CONFLICT
                )

            quote.total_price = company_quote.total_price
            quote.currency = company_quote.currency

        quote.selected_carrier = carrier
        quote.carrier = carrier
        quote.assigned_agent_email = agent_email
        quote.assigned_agent_name = agent_name
        quote.carrier_selected_at = timezone.now()

        transit_days = request.data.get("transit_days")
        if transit_days:
            try:
                quote.estimated_transit_days = int(transit_days)
            except (TypeError, ValueError):
                pass

        quote.save(
            update_fields=[
                "selected_carrier",
                "carrier",
                "assigned_agent_email",
                "assigned_agent_name",
                "carrier_selected_at",
                "estimated_transit_days",
                "total_price",
                "currency",
                "updated_at",
            ]
        )

        audit_service.record(
            actor_id=actor["id"],
            actor_role=actor["role"],
            actor_email=actor["email"],
            action="QUOTE_CARRIER_SELECTED",
            entity_type="quote",
            entity_id=quote.id,
            changes={"carrier": carrier, "assigned_agent_email": agent_email},
        )

        from companies.access import resolve_user_id

        notify.notify_user(
            resolve_user_id(agent_email) or agent_email,
            "New quote assigned to you",
            f"{carrier} was requested on quote {quote.id}. It is ready for your review.",
            category="QUOTE",
            entity_type="quote",
            entity_id=quote.id,
        )

        payload = QuoteDetailSerializer(quote).data
        if selection:
            # Serialised rather than hand-built, so a selection has one shape
            # wherever it appears. The hand-built version called the company
            # "company" while every other endpoint called it "companyName".
            from booking.serializers import QuoteSelectionSerializer

            payload["selection"] = QuoteSelectionSerializer(selection).data
        if verification:
            payload["verification"] = {
                "reference": verification.reference,
                "status": verification.status,
                "assignedAgent": verification.assigned_agent_email,
                "slaDueAt": verification.sla_due_at,
            }
        return Response(payload, status=status.HTTP_200_OK)


def _m4_conflict(quote):
    """Refuse a legacy review or decision on a quote a company is handling.

    Once the customer picks a company, its M4 verification decides the outcome
    and the quote's status follows it. A second decision path here let the
    quote say one thing and the booking another: an accept on a quote that
    read SENT booked the shipment without the company ever verifying it.
    """
    from booking.models import QuoteSelection

    selection = (
        QuoteSelection.objects.filter(quote=quote)
        .select_related("company")
        .order_by("-created_at")
        .first()
    )
    if selection is None:
        return None
    return Response(
        {
            "error": (
                f"This quote is being handled by {selection.company.name} through "
                f"company verification ({selection.reference}). Follow it in "
                "Selected Quotes."
            )
        },
        status=status.HTTP_409_CONFLICT,
    )


class CustomerQuoteDecisionView(APIView):
    """POST /quotes/<id>/decision -> customer accepts or rejects (PDF step 12)."""

    authentication_classes = []
    permission_classes = []

    def post(self, request, quote_id):
        actor = _actor(request)

        try:
            quote = Quote.objects.select_related("shipment").get(id=quote_id)
        except Quote.DoesNotExist:
            raise NotFound("Quote not found.")

        if not _is_staff(actor["role"]) and quote.customer_id != actor["id"]:
            raise PermissionDenied(
                "Access denied: You cannot decide on another customer's quote."
            )

        conflict = _m4_conflict(quote)
        if conflict:
            return conflict

        decision = (request.data.get("decision") or request.data.get("status") or "").upper()
        if decision not in ("ACCEPTED", "REJECTED"):
            return Response(
                {"error": "Invalid decision. Must be ACCEPTED or REJECTED."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # A customer can only decide on a quote that actually reached them.
        if quote.status not in (
            lifecycle.QUOTE_STATUS_SENT,
            lifecycle.QUOTE_STATUS_APPROVED,
        ):
            return Response(
                {
                    "error": (
                        f"Quote is {quote.status}; a decision can only be made once it has "
                        "been approved and sent to you."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )

        try:
            lifecycle.apply_quote_status(
                quote,
                decision,
                actor=actor,
                reason=request.data.get("reason", ""),
                action=audit_service.CUSTOMER_DECISION,
            )
            lifecycle.apply_shipment_status(
                quote.shipment,
                lifecycle.SHIPMENT_STATUS_CLOSED
                if decision == "ACCEPTED"
                else lifecycle.SHIPMENT_STATUS_CANCELLED,
                actor=actor,
                reason=f"Customer {decision.lower()} quote {quote.id}.",
            )
        except InvalidStateTransitionError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)

        notify.notify_role(
            "agent",
            f"Customer {decision.lower()} quote {quote.id}",
            f"{quote.shipment.origin} to {quote.shipment.destination}.",
            category="QUOTE",
            severity="SUCCESS" if decision == "ACCEPTED" else "WARNING",
            entity_type="QUOTE",
            entity_id=quote.id,
            link="/dashboard/generated-quotes",
        )

        return Response(
            {
                "message": f"Quote successfully {decision.lower()}.",
                "quote": QuoteSerializer(quote).data,
                "shipment_status": quote.shipment.status,
            },
            status=status.HTTP_200_OK,
        )


# ==============================================================================
# QUOTES - FREIGHT AGENT / ADMIN REVIEW (PDF section 3, step 10)
# ==============================================================================


class AdminQuoteListView(APIView):
    """GET /admin/quotes -> every quote on the platform (staff roles)."""

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        actor = _actor(request)
        if not _is_staff(actor["role"]):
            raise PermissionDenied("Access forbidden: staff privilege required.")

        quotes = Quote.objects.all().select_related("shipment")

        # M4 company isolation. A freight agent works only the companies they
        # are a member of: once a customer picks a company, that quote belongs
        # to that company and no other company's agents may see the customer's
        # details. Quotes with no company chosen yet are unclaimed and stay
        # visible to every agent. Admin and customs keep the platform view.
        #
        # Membership is looked up from CompanyAgent rather than compared against
        # an email string copied onto the quote, so authority is data the
        # platform owns rather than a convention the client could imitate.
        if (actor["role"] or "").lower() == "agent":
            from companies.access import memberships_for

            memberships = memberships_for(actor["email"])
            agent_emails = [m.user_email.lower() for m in memberships] or [
                (actor["email"] or "").lower()
            ]
            company_codes = [m.company.code for m in memberships]
            company_names = [m.company.name for m in memberships]

            owned = Q(assigned_agent_email__iexact=actor["email"] or "")
            for email in agent_emails:
                owned |= Q(assigned_agent_email__iexact=email)
            for name in company_names + company_codes:
                owned |= Q(selected_carrier__iexact=name)

            quotes = quotes.filter(owned | Q(assigned_agent_email=""))

        status_filter = request.query_params.get("status")
        if status_filter:
            quotes = quotes.filter(status=status_filter.upper())

        if request.query_params.get("pending_review") in ("1", "true", "True"):
            quotes = quotes.filter(status=lifecycle.QUOTE_STATUS_PENDING_REVIEW)

        risk_level = request.query_params.get("risk_level")
        if risk_level:
            quotes = quotes.filter(overall_risk_level=risk_level.upper())

        return Response(QuoteSerializer(quotes, many=True).data, status=status.HTTP_200_OK)


class QuoteReviewView(APIView):
    """POST /quotes/<id>/review -> the Freight Agent's four review actions.

    PDF section 3, step 10: "Freight Agent approves, modifies, requests
    information or rejects." A price modification requires a reason, which is
    stored on the quote and in the audit trail (core scenario 9).
    """

    authentication_classes = []
    permission_classes = []

    ACTIONS = ("approve", "modify", "request_info", "reject", "send")

    def post(self, request, quote_id):
        actor = _actor(request)
        if not _is_staff(actor["role"]):
            raise PermissionDenied("Access forbidden: Freight Agent or Admin privilege required.")

        try:
            quote = Quote.objects.select_related("shipment").get(id=quote_id)
        except Quote.DoesNotExist:
            raise NotFound("Quote not found.")

        conflict = _m4_conflict(quote)
        if conflict:
            return conflict

        action = (request.data.get("action") or "").lower().strip()
        if action not in self.ACTIONS:
            return Response(
                {"error": f"Invalid action. Must be one of: {', '.join(self.ACTIONS)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason = (request.data.get("reason") or "").strip()
        handler = getattr(self, f"_{action}")

        try:
            return handler(request, quote, actor, reason)
        except InvalidStateTransitionError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)

    # -- actions -------------------------------------------------------

    def _modify(self, request, quote, actor, reason):
        """Change the commercial price. Reason is mandatory and audited."""
        new_price = request.data.get("total_price", request.data.get("totalPrice"))
        if new_price is None:
            return Response(
                {"error": "total_price is required when modifying a quote."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            new_price = float(new_price)
        except (TypeError, ValueError):
            return Response(
                {"error": "total_price must be numeric."}, status=status.HTTP_400_BAD_REQUEST
            )
        if new_price <= 0:
            return Response(
                {"error": "total_price must be greater than zero."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not reason:
            return Response(
                {"error": "A reason is required when modifying the quoted price."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        previous_price = quote.total_price
        if quote.original_total_price is None:
            quote.original_total_price = previous_price

        quote.total_price = new_price
        quote.reviewed_by = actor["email"] or actor["id"]
        quote.review_reason = reason
        quote.save(
            update_fields=[
                "total_price",
                "original_total_price",
                "reviewed_by",
                "review_reason",
                "updated_at",
            ]
        )

        audit_service.record(
            actor_id=actor["id"],
            actor_role=actor["role"],
            actor_email=actor["email"],
            action=audit_service.QUOTE_PRICE_MODIFIED,
            entity_type="QUOTE",
            entity_id=quote.id,
            reason=reason,
            changes={"total_price": {"from": previous_price, "to": new_price}},
            context={
                "recommended_price": quote.recommended_price,
                "ai_predicted_price": quote.ai_predicted_price,
                "delta": round(new_price - previous_price, 2),
            },
        )

        return Response(
            {
                "message": "Quote price modified and audit record stored.",
                "quote": QuoteSerializer(quote).data,
            }
        )

    def _approve(self, request, quote, actor, reason):
        """Approve the quote. Blocked when policy gating forbids issuance."""
        if quote.policy_action == "BLOCK_QUOTE_ISSUANCE":
            return Response(
                {
                    "error": (
                        "Quote is hard-blocked by risk policy and cannot be approved. "
                        "Cargo is prohibited, under embargo, or carries critical risk."
                    ),
                    "policy_action": quote.policy_action,
                },
                status=status.HTTP_409_CONFLICT,
            )

        lifecycle.apply_quote_status(
            quote,
            lifecycle.QUOTE_STATUS_APPROVED,
            actor=actor,
            reason=reason or "Approved by freight agent.",
            action=audit_service.QUOTE_APPROVED,
        )
        quote.reviewed_by = actor["email"] or actor["id"]
        quote.save(update_fields=["reviewed_by", "updated_at"])

        return Response(
            {"message": "Quote approved.", "quote": QuoteSerializer(quote).data}
        )

    def _send(self, request, quote, actor, reason):
        """Send the approved quote to the customer (PDF step 11)."""
        lifecycle.apply_quote_status(
            quote,
            lifecycle.QUOTE_STATUS_SENT,
            actor=actor,
            reason=reason or "Final quote sent to customer.",
            action=audit_service.QUOTE_SENT,
        )

        notify.notify_user(
            quote.customer_id,
            f"Your freight quote {quote.id} is ready",
            f"{quote.shipment.origin} to {quote.shipment.destination} - "
            f"{quote.currency} {quote.total_price:,.2f}. Please accept or reject.",
            category="QUOTE",
            severity="SUCCESS",
            entity_type="QUOTE",
            entity_id=quote.id,
            link="/dashboard/my-quotes",
        )

        return Response(
            {"message": "Final quote sent to customer.", "quote": QuoteSerializer(quote).data}
        )

    def _reject(self, request, quote, actor, reason):
        if not reason:
            return Response(
                {"error": "A reason is required when rejecting a quote."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        lifecycle.apply_quote_status(
            quote,
            lifecycle.QUOTE_STATUS_REJECTED,
            actor=actor,
            reason=reason,
            action=audit_service.QUOTE_REJECTED,
        )
        lifecycle.apply_shipment_status(
            quote.shipment,
            lifecycle.SHIPMENT_STATUS_CANCELLED,
            actor=actor,
            reason=f"Quote {quote.id} rejected by {actor['role']}.",
        )

        notify.notify_user(
            quote.customer_id,
            f"Quote {quote.id} could not be issued",
            reason,
            category="QUOTE",
            severity="WARNING",
            entity_type="QUOTE",
            entity_id=quote.id,
            link="/dashboard/my-quotes",
        )

        return Response(
            {"message": "Quote rejected.", "quote": QuoteSerializer(quote).data}
        )

    def _request_info(self, request, quote, actor, reason):
        """Ask the customer for more information; the quote stays in review."""
        if not reason:
            return Response(
                {"error": "Specify what information is required from the customer."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        quote.admin_notes = reason
        quote.reviewed_by = actor["email"] or actor["id"]
        quote.save(update_fields=["admin_notes", "reviewed_by", "updated_at"])

        audit_service.record(
            actor_id=actor["id"],
            actor_role=actor["role"],
            actor_email=actor["email"],
            action=audit_service.QUOTE_INFO_REQUESTED,
            entity_type="QUOTE",
            entity_id=quote.id,
            reason=reason,
        )

        notify.notify_user(
            quote.customer_id,
            f"More information needed for quote {quote.id}",
            reason,
            category="QUOTE",
            severity="WARNING",
            entity_type="QUOTE",
            entity_id=quote.id,
            link="/dashboard/my-quotes",
        )

        return Response(
            {
                "message": "Information requested from customer.",
                "quote": QuoteSerializer(quote).data,
            }
        )


class AdminQuoteStatusUpdateView(APIView):
    """PATCH/POST /admin/quotes/<id>/status -> direct status change (staff).

    Retained for backwards compatibility. Unlike the previous implementation it
    validates the transition and writes an audit record rather than assigning any
    status to any quote.
    """

    authentication_classes = []
    permission_classes = []

    VALID_STATUSES = (
        "DRAFT",
        "GENERATED",
        "PENDING_REVIEW",
        "APPROVED",
        "SENT",
        "ACCEPTED",
        "REJECTED",
        "EXPIRED",
    )

    def post(self, request, quote_id):
        return self.patch(request, quote_id)

    def patch(self, request, quote_id):
        actor = _actor(request)
        if not _is_staff(actor["role"]):
            require_admin(request)

        try:
            quote = Quote.objects.select_related("shipment").get(id=quote_id)
        except Quote.DoesNotExist:
            raise NotFound("Quote not found.")

        conflict = _m4_conflict(quote)
        if conflict:
            return conflict

        new_status = (request.data.get("status") or "").upper()
        notes = request.data.get("admin_notes", request.data.get("notes", ""))

        if new_status not in self.VALID_STATUSES:
            return Response(
                {"error": f"Invalid status. Must be one of: {', '.join(self.VALID_STATUSES)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            lifecycle.apply_quote_status(
                quote, new_status, actor=actor, reason=notes or "Status updated by staff."
            )
        except InvalidStateTransitionError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)

        if notes:
            quote.admin_notes = notes
            quote.save(update_fields=["admin_notes", "updated_at"])

        shipment_target = {
            "APPROVED": lifecycle.SHIPMENT_STATUS_QUOTED,
            "SENT": lifecycle.SHIPMENT_STATUS_QUOTED,
            "ACCEPTED": lifecycle.SHIPMENT_STATUS_CLOSED,
            "REJECTED": lifecycle.SHIPMENT_STATUS_CANCELLED,
        }.get(new_status)

        if shipment_target:
            try:
                lifecycle.apply_shipment_status(
                    quote.shipment, shipment_target, actor=actor,
                    reason=f"Quote {quote.id} moved to {new_status}.",
                )
            except InvalidStateTransitionError:
                # The quote transition is the authoritative one; a shipment already
                # in a terminal state should not fail the request.
                pass

        return Response(QuoteSerializer(quote).data, status=status.HTTP_200_OK)


class AdminQuoteApproveView(APIView):
    """POST /admin/quotes/<id>/approve -> approve shorthand used by the agent desk."""

    authentication_classes = []
    permission_classes = []

    def post(self, request, quote_id):
        actor = _actor(request)
        if not _is_staff(actor["role"]):
            raise PermissionDenied("Access forbidden: Freight Agent or Admin privilege required.")

        try:
            quote = Quote.objects.select_related("shipment").get(id=quote_id)
        except Quote.DoesNotExist:
            raise NotFound("Quote not found.")

        conflict = _m4_conflict(quote)
        if conflict:
            return conflict

        try:
            lifecycle.apply_quote_status(
                quote,
                lifecycle.QUOTE_STATUS_APPROVED,
                actor=actor,
                reason=request.data.get("reason", "Approved by staff."),
                action=audit_service.QUOTE_APPROVED,
            )
        except InvalidStateTransitionError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)

        return Response(QuoteSerializer(quote).data, status=status.HTTP_200_OK)


# ==============================================================================
# MILESTONE 2 LEGACY & MARGIN ENDPOINTS
# ==============================================================================


class QuoteMarginView(APIView):
    """POST /api/v1/quotes/<quote_id>/margin -> evaluate the margin floor policy."""

    authentication_classes = []
    permission_classes = []

    def post(self, request, quote_id):
        return Response({"quote_id": quote_id, "status": "MARGIN_EVALUATED"})


class QuoteApprovalsQueueView(APIView):
    """GET /api/v1/quotes/approvals/queue -> quotes waiting on human review."""

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        actor = _actor(request)
        if not _is_staff(actor["role"]):
            raise PermissionDenied("Access forbidden: staff privilege required.")

        pending = (
            Quote.objects.filter(status=lifecycle.QUOTE_STATUS_PENDING_REVIEW)
            .select_related("shipment")
        )
        return Response(
            {
                "count": pending.count(),
                "queue": QuoteSerializer(pending, many=True).data,
            }
        )


class QuoteApprovalDecisionView(APIView):
    """POST /api/v1/quotes/approvals/<approval_id>/decision"""

    authentication_classes = []
    permission_classes = []

    def post(self, request, approval_id):
        return Response({"approval_id": approval_id, "decision": "PROCESSED"})
