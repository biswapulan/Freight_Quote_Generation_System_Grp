"""M4 booking workflow endpoints. Phase 2: the company offers a customer compares."""

from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from companies.access import is_platform_wide, memberships_for
from quotes.auth_helper import get_current_user_and_role
from quotes.models import Quote

from .models import CompanyQuote
from .offer_engine import generate_company_quotes
from .serializers import CompanyQuoteSerializer

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
