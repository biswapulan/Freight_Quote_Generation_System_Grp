"""M4 booking workflow endpoints. Phase 2: the company offers a customer compares."""

from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from companies.access import can_access_company, is_platform_wide, memberships_for
from quotes.auth_helper import get_current_user_and_role
from quotes.models import Quote

from . import lifecycle
from .models import CompanyQuote, VerificationRequest
from .offer_engine import generate_company_quotes
from .serializers import (
    CompanyQuoteSerializer,
    StatusHistorySerializer,
    VerificationRequestSerializer,
)
from .services import move_selection

STAFF_ROLES = ("admin", "agent", "customs", "customs_officer")


def _actor(request):
    user_id, role, email = get_current_user_and_role(request)
    return {"id": user_id, "role": (role or "").lower(), "email": email or ""}


class QuoteCompanyOptionsView(APIView):
    """GET /quotes/<id>/company-quotes -> every company's offer for this quote.

    Offers are created on first request and reused afterwards, so the prices a
    customer is comparing do not move under them on a page refresh.
    """

    authentication_classes = []
    permission_classes = []

    def get(self, request, quote_id):
        actor = _actor(request)

        try:
            quote = Quote.objects.select_related("shipment").get(id=quote_id)
        except Quote.DoesNotExist:
            raise NotFound("Quote not found.")

        is_staff = actor["role"] in STAFF_ROLES
        if not is_staff and quote.customer_id != actor["id"]:
            raise PermissionDenied("You cannot view another customer's quote options.")

        refresh = request.query_params.get("refresh") in ("1", "true", "True")
        offers = generate_company_quotes(quote, replace=refresh)

        # Expiry is a business rule, not a display detail: mark lapsed offers so
        # the customer cannot select one and the agent cannot confirm it.
        now = timezone.now()
        lapsed = [
            o for o in offers
            if o.valid_until and o.valid_until <= now and o.status == "AVAILABLE"
        ]
        for offer in lapsed:
            offer.status = "EXPIRED"
        if lapsed:
            CompanyQuote.objects.bulk_update(lapsed, ["status"])

        # A company agent comparing offers sees only their own company's, so a
        # competitor's pricing is never exposed through this endpoint.
        if actor["role"] == "agent" and not is_platform_wide(actor["role"]):
            own = set(memberships_for(actor["email"]).values_list("company_id", flat=True))
            if own:
                offers = [o for o in offers if o.company_id in own]

        return Response(
            {
                "quoteId": quote.id,
                "shipmentId": quote.shipment_id,
                "count": len(offers),
                "results": CompanyQuoteSerializer(offers, many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class VerificationQueueView(APIView):
    """GET /verification-requests -> the caller's company verification queue.

    An agent sees their own companies' requests and nothing else. This is the
    M4 isolation rule at its sharpest: the queue is the customer's shipment,
    cargo and commercial terms, so a competitor reading it would be reading a
    customer relationship they have no part in.
    """

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        actor = _actor(request)
        role = actor["role"]

        if role not in STAFF_ROLES:
            raise PermissionDenied("Only company agents and staff may view this queue.")

        requests = VerificationRequest.objects.select_related(
            "company", "selection", "selection__company", "selection__shipment"
        ).prefetch_related("checks")

        if not is_platform_wide(role):
            company_ids = list(
                memberships_for(actor["email"]).values_list("company_id", flat=True)
            )
            if not company_ids:
                # An agent with no company membership has no queue, rather than
                # falling back to the whole platform.
                return Response(
                    {"count": 0, "results": [], "detail": "No company membership."},
                    status=status.HTTP_200_OK,
                )
            requests = requests.filter(company_id__in=company_ids)

        status_filter = request.query_params.get("status")
        if status_filter:
            requests = requests.filter(status=status_filter.upper())

        if request.query_params.get("pending") in ("1", "true", "True"):
            requests = requests.filter(status__in=sorted(lifecycle.AGENT_ACTIONABLE))

        requests = list(requests[:200])
        return Response(
            {
                "count": len(requests),
                "results": VerificationRequestSerializer(requests, many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class VerificationDetailView(APIView):
    """GET /verification-requests/<ref> -> one request, if it is yours.

    Opening a request records who picked it up and when, which is what makes
    response time measurable and stops two agents deciding the same request.
    """

    authentication_classes = []
    permission_classes = []

    def get(self, request, reference):
        actor = _actor(request)

        vr = (
            VerificationRequest.objects.select_related(
                "company", "selection", "selection__shipment", "selection__quote"
            )
            .prefetch_related("checks", "selection__history")
            .filter(reference=reference)
            .first()
        )
        if not vr:
            raise NotFound("Verification request not found.")

        is_owner_agent = can_access_company(actor["email"], actor["role"], vr.company_id)
        is_the_customer = vr.selection.customer_id == actor["id"]

        if not is_owner_agent and not is_the_customer:
            # Milestone test scenario 3: another company's agent is refused.
            raise PermissionDenied(
                "This verification request belongs to another company."
            )

        # First open by an agent of the owning company starts the clock.
        if is_owner_agent and actor["role"] == "agent" and not vr.opened_at:
            vr.opened_at = timezone.now()
            vr.assigned_agent_email = vr.assigned_agent_email or actor["email"]
            vr.save(update_fields=["opened_at", "assigned_agent_email", "updated_at"])

            if vr.status == lifecycle.PENDING_COMPANY_VERIFICATION:
                move_selection(
                    vr.selection,
                    lifecycle.UNDER_VERIFICATION,
                    actor=actor,
                    reason=f"Opened by {actor['email']}.",
                )
                vr.refresh_from_db()

        payload = VerificationRequestSerializer(vr).data
        payload["history"] = StatusHistorySerializer(
            vr.selection.history.all(), many=True
        ).data
        return Response(payload, status=status.HTTP_200_OK)
