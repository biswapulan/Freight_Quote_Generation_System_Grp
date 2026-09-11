"""A quote and its shipment say what the company workflow says.

My Quotes and My Shipments read the quote and shipment records, while M4 moves
a separate selection through verification to a booking. These tests pin the
two together: each M4 outcome shows on the quote and shipment, and the quote
carries the ids that connect it to its selection, request and booking.
"""

import pytest
from rest_framework.test import APIClient

from accounts.tokens import create_token
from booking.models import Booking
from companies.models import CompanyAgent, CompanyRateCard, FreightCompany
from quotes.models import Quote
from quotes.serializers import QuoteSerializer

SHIPMENT = {
    "origin": "Chennai, India",
    "destination": "Rotterdam, Netherlands",
    "cargoType": "Electronics",
    "weight": 5000.0,
    "volume": 18.0,
    "transportMode": "ocean",
    "containerType": "40FT",
    "hsCode": "8471.30",
}


def _headers(user_id, role, email):
    return {
        "HTTP_AUTHORIZATION": f"Bearer {create_token(user_id)}",
        "HTTP_X_CUSTOMER_ID": user_id,
        "HTTP_X_USER_ROLE": role,
        "HTTP_X_USER_EMAIL": email,
    }


def _company(code, name, agent_email):
    company = FreightCompany.objects.create(
        code=code,
        name=name,
        modes=["ocean"],
        service_name=f"{name} service",
        on_time_performance=90.0,
        average_response_hours=6.0,
        status="ACTIVE",
    )
    CompanyRateCard.objects.create(
        company=company,
        mode="ocean",
        base_booking_fee=8000.0,
        rate_per_km=20.0,
        rate_per_kg=1.5,
        fuel_surcharge_pct=10.0,
        handling_fee=20000.0,
        documentation_fee=3000.0,
        minimum_charge=40000.0,
        validity_days=14,
        currency="INR",
    )
    CompanyAgent.objects.create(
        company=company, user_email=agent_email, display_name=name, role="AGENT", is_active=True
    )
    return company


@pytest.mark.django_db
class TestQuoteFollowsTheCompanyWorkflow:
    def setup_method(self):
        self.client = APIClient()
        self.customer = _headers("CUST-S1", "customer", "owner@acme.example")
        _company("alpha", "Alpha Line", "agent.alpha@x.example")
        _company("beta", "Beta Freight", "agent.beta@x.example")
        self.agent_a = _headers("AGT-A", "agent", "agent.alpha@x.example")

    def _select(self, company="Alpha Line", quote_id=None):
        if quote_id is None:
            shipment = self.client.post("/api/shipments", SHIPMENT, format="json", **self.customer)
            quote_id = self.client.post(
                f"/api/shipments/{shipment.data['id']}/quote", **self.customer
            ).data["id"]
        offers = self.client.get(
            f"/api/quotes/{quote_id}/company-quotes", **self.customer
        ).data["results"]
        offer = next(o for o in offers if o["companyName"] == company)
        chosen = self.client.post(
            f"/api/quotes/{quote_id}/select-carrier",
            {"company_quote_id": offer["id"]},
            format="json",
            **self.customer,
        )
        assert chosen.status_code == 200, chosen.data
        return quote_id, chosen.data["selection"], chosen.data["verification"]

    def _decide(self, reference, payload):
        response = self.client.post(
            f"/api/verification-requests/{reference}/decision",
            payload,
            format="json",
            **self.agent_a,
        )
        assert response.status_code == 200, response.data
        return response

    def _state(self, quote_id):
        quote = Quote.objects.select_related("shipment").get(id=quote_id)
        return quote.status, quote.shipment.status

    def test_choosing_a_company_puts_the_quote_under_review(self):
        quote_id, _, _ = self._select()
        assert self._state(quote_id) == ("PENDING_REVIEW", "QUOTED")

    def test_a_booking_closes_the_quote_and_shipment_and_links_every_id(self):
        quote_id, selection, verification = self._select()
        self._decide(verification["reference"], {"action": "APPROVE", "reason": "Space held."})
        assert self._state(quote_id) == ("ACCEPTED", "CLOSED")

        m4 = QuoteSerializer(Quote.objects.get(id=quote_id)).data["m4"]
        booking = Booking.objects.get(selection__reference=selection["reference"])
        assert m4["selectionReference"] == selection["reference"]
        assert m4["verificationReference"] == verification["reference"]
        assert m4["bookingReference"] == booking.reference
        assert m4["status"] == "BOOKING_CONFIRMED"
        assert m4["companyName"] == "Alpha Line"
        assert m4["offer"]["fuelSurcharge"] > 0

    def test_a_revision_goes_to_the_customer_and_acceptance_books_it(self):
        quote_id, selection, verification = self._select()
        revised = selection["selectedTotalPrice"] + 5000
        self._decide(
            verification["reference"],
            {"action": "MODIFY", "reason": "Surcharge.", "revision": {"total_price": revised}},
        )
        assert self._state(quote_id)[0] == "SENT"

        accepted = self.client.post(
            f"/api/selections/{selection['reference']}/revision-response",
            {"decision": "ACCEPT"},
            format="json",
            **self.customer,
        )
        assert accepted.status_code == 200, accepted.data
        assert self._state(quote_id) == ("ACCEPTED", "CLOSED")

    def test_a_rejection_shows_until_another_company_is_chosen(self):
        quote_id, _, verification = self._select("Alpha Line")
        self._decide(verification["reference"], {"action": "REJECT", "reason": "No space."})
        assert self._state(quote_id) == ("REJECTED", "QUOTED")

        self._select("Beta Freight", quote_id=quote_id)
        assert self._state(quote_id) == ("PENDING_REVIEW", "QUOTED")
        m4 = QuoteSerializer(Quote.objects.get(id=quote_id)).data["m4"]
        assert m4["companyName"] == "Beta Freight"

    def test_cancelling_the_booking_cancels_the_shipment(self):
        quote_id, selection, verification = self._select()
        self._decide(verification["reference"], {"action": "APPROVE", "reason": "Space held."})
        booking = Booking.objects.get(selection__reference=selection["reference"])

        cancelled = self.client.post(
            f"/api/bookings/{booking.reference}/cancel",
            {"reason": "Plans changed."},
            format="json",
            **self.customer,
        )
        assert cancelled.status_code == 200, cancelled.data
        assert self._state(quote_id) == ("REJECTED", "CANCELLED")

    def test_the_old_accept_button_cannot_bypass_the_company(self):
        quote_id, _, verification = self._select()
        self._decide(
            verification["reference"],
            {"action": "MODIFY", "reason": "Surcharge.", "revision": {"total_price": 99999}},
        )
        # The quote now reads SENT, which the legacy customer decision accepts.
        response = self.client.post(
            f"/api/quotes/{quote_id}/decision",
            {"decision": "ACCEPTED"},
            format="json",
            **self.customer,
        )
        assert response.status_code == 409
        assert "Selected Quotes" in response.data["error"]
        assert self._state(quote_id) == ("SENT", "QUOTED")
