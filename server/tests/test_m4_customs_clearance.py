"""Customs clearance and the customer's final decision (M4, after approval).

A company's approval is not yet a booking. Customs checks the consignment and
clears or rejects it, and only then does the customer confirm or decline.
These tests pin that order down: no booking before customs clears and the
customer confirms, only a customs officer decides a clearance, and every
outcome reaches the people it concerns.
"""

import pytest
from rest_framework.test import APIClient

from accounts.tokens import create_token
from booking import lifecycle
from booking.models import Booking, CustomsClearance, QuoteSelection
from companies.models import CompanyAgent, CompanyRateCard, FreightCompany
from notifications.models import Notification
from tests.paperwork_steps import customs_verifies, papers_ready_for_company

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
class TestCustomsClearance:
    def setup_method(self):
        self.client = APIClient()
        self.customer_id = "CUST-C1"
        self.customer = _headers(self.customer_id, "customer", "owner@acme.example")
        self.stranger = _headers("CUST-C2", "customer", "stranger@acme.example")
        self.customs = _headers("CUSTOMS-C", "customs", "customs@freightai.com")
        self.admin = _headers("ADMIN-C", "admin", "admin@freightai.com")
        _company("alpha", "Alpha Line", "agent.alpha@x.example")
        _company("beta", "Beta Freight", "agent.beta@x.example")
        self.agent_a = _headers("AGT-A", "agent", "agent.alpha@x.example")

    # -- helpers ------------------------------------------------------------

    def _pick(self, quote_id, company):
        offers = self.client.get(
            f"/api/quotes/{quote_id}/company-quotes", **self.customer
        ).data["results"]
        offer = next(o for o in offers if o["companyName"] == company)
        return self.client.post(
            f"/api/quotes/{quote_id}/select-carrier",
            {"company_quote_id": offer["id"]},
            format="json",
            **self.customer,
        )

    def _approved(self):
        """A quote Alpha Line has approved, now waiting for customs."""
        shipment = self.client.post("/api/shipments", SHIPMENT, format="json", **self.customer)
        quote_id = self.client.post(
            f"/api/shipments/{shipment.data['id']}/quote", **self.customer
        ).data["id"]
        chosen = self._pick(quote_id, "Alpha Line")
        assert chosen.status_code == 200, chosen.data
        papers_ready_for_company(
            self.client, chosen.data["selection"]["reference"], self.customer, self.agent_a
        )
        approved = self.client.post(
            f"/api/verification-requests/{chosen.data['verification']['reference']}/decision",
            {"action": "APPROVE", "reason": "Capacity held for these dates."},
            format="json",
            **self.agent_a,
        )
        assert approved.status_code == 200, approved.data
        sel_ref = chosen.data["selection"]["reference"]
        return quote_id, sel_ref, CustomsClearance.objects.get(selection__reference=sel_ref)

    def _customs(self, clearance, decision, reason="", who=None):
        # Clearing needs every paper opened and verified by customs first.
        if decision == "CLEAR" and who is None:
            customs_verifies(self.client, clearance.selection.reference, self.customs)
        return self.client.post(
            f"/api/customs-clearances/{clearance.reference}/decision",
            {"decision": decision, "reason": reason},
            format="json",
            **(who or self.customs),
        )

    def _final(self, sel_ref, decision, note="", who=None):
        return self.client.post(
            f"/api/selections/{sel_ref}/final-decision",
            {"decision": decision, "note": note},
            format="json",
            **(who or self.customer),
        )

    def _status(self, sel_ref):
        return QuoteSelection.objects.get(reference=sel_ref).status

    def _booked(self, sel_ref):
        return Booking.objects.filter(selection__reference=sel_ref).exists()

    # -- The company's approval goes to customs -------------------------------

    def test_an_approval_goes_to_customs_not_to_a_booking(self):
        _, sel_ref, clearance = self._approved()
        assert self._status(sel_ref) == lifecycle.PENDING_CUSTOMS_REVIEW
        assert clearance.status == "PENDING"
        assert clearance.reference.startswith("CUS-")
        assert not self._booked(sel_ref)

        queue = self.client.get("/api/customs-clearances?status=PENDING", **self.customs)
        assert queue.status_code == 200, queue.data
        assert queue.data["canDecide"] is True
        row = next(r for r in queue.data["results"] if r["reference"] == clearance.reference)
        # The officer sees whom the company approved it for, why, and what moves.
        assert row["selection"]["reference"] == sel_ref
        assert row["verification"]["decidedBy"] == "agent.alpha@x.example"
        assert row["verification"]["decisionReason"]
        assert row["shipment"]["hsCode"] == "8471.30"

        # The desk is told there is work, and the customer that customs has it.
        assert Notification.objects.filter(
            recipient_role="customs", entity_id=clearance.reference
        ).exists()
        assert Notification.objects.filter(
            recipient_id=self.customer_id, title__contains="approved"
        ).exists()

    def test_only_a_customs_officer_decides_a_clearance(self):
        _, sel_ref, clearance = self._approved()
        for who in (self.agent_a, self.customer, self.admin):
            assert self._customs(clearance, "CLEAR", who=who).status_code == 403

        # Customers and company agents do not see the desk; the admin may watch.
        assert self.client.get("/api/customs-clearances", **self.customer).status_code == 403
        assert self.client.get("/api/customs-clearances", **self.agent_a).status_code == 403
        watched = self.client.get("/api/customs-clearances", **self.admin)
        assert watched.status_code == 200
        assert watched.data["canDecide"] is False

        assert self._status(sel_ref) == lifecycle.PENDING_CUSTOMS_REVIEW

    def test_the_customer_cannot_book_before_customs_clears(self):
        _, sel_ref, _ = self._approved()
        early = self._final(sel_ref, "ACCEPT")
        assert early.status_code == 409, early.data
        assert not self._booked(sel_ref)

    # -- Customs clears, the customer decides ---------------------------------

    def test_clearing_hands_the_final_decision_to_the_customer(self):
        _, sel_ref, clearance = self._approved()
        cleared = self._customs(clearance, "CLEAR", "Invoice and HS code agree.")
        assert cleared.status_code == 200, cleared.data
        assert cleared.data["status"] == "CLEARED"
        assert cleared.data["officerEmail"] == "customs@freightai.com"
        assert self._status(sel_ref) == lifecycle.CUSTOMS_CLEARED
        assert not self._booked(sel_ref)

        mine = self.client.get("/api/selections/my", **self.customer).data["results"]
        row = next(r for r in mine if r["reference"] == sel_ref)
        assert row["awaitingYou"] is True
        assert row["customs"]["status"] == "CLEARED"
        assert row["agreedTotalPrice"] > 0
        assert Notification.objects.filter(
            recipient_id=self.customer_id, title__contains="confirm your booking"
        ).exists()

    def test_the_customer_confirms_and_the_booking_is_made(self):
        _, sel_ref, clearance = self._approved()
        self._customs(clearance, "CLEAR")
        booked = self._final(sel_ref, "ACCEPT")
        assert booked.status_code == 200, booked.data
        assert booked.data["booking"]["reference"].startswith("BK-")
        assert self._status(sel_ref) == lifecycle.BOOKING_CONFIRMED

    def test_another_customer_cannot_confirm_it(self):
        _, sel_ref, clearance = self._approved()
        self._customs(clearance, "CLEAR")
        assert self._final(sel_ref, "ACCEPT", who=self.stranger).status_code == 403
        assert self._status(sel_ref) == lifecycle.CUSTOMS_CLEARED

    def test_the_customer_may_decline_and_choose_another_company(self):
        quote_id, sel_ref, clearance = self._approved()
        self._customs(clearance, "CLEAR")
        declined = self._final(sel_ref, "DECLINE", "Found an earlier sailing.")
        assert declined.status_code == 200, declined.data
        assert declined.data["canReselect"] is True
        assert self._status(sel_ref) == lifecycle.RESELECT_QUOTE
        assert not self._booked(sel_ref)
        assert Notification.objects.filter(title__contains="Booking declined").exists()

        again = self._pick(quote_id, "Beta Freight")
        assert again.status_code == 200, again.data

    # -- Customs rejects --------------------------------------------------------

    def test_a_rejection_needs_a_reason_and_frees_the_customer(self):
        _, sel_ref, clearance = self._approved()
        bare = self._customs(clearance, "REJECT")
        assert bare.status_code == 409
        assert "reason" in bare.data["error"].lower()

        rejected = self._customs(clearance, "REJECT", "HS code does not match the invoice.")
        assert rejected.status_code == 200, rejected.data
        assert self._status(sel_ref) == lifecycle.CUSTOMS_REJECTED
        assert self._final(sel_ref, "ACCEPT").status_code == 409
        assert not self._booked(sel_ref)

        told = Notification.objects.filter(
            recipient_id=self.customer_id, title__contains="could not clear"
        ).first()
        assert told is not None
        assert "HS code" in told.message

    def test_a_clearance_cannot_be_decided_twice(self):
        _, _, clearance = self._approved()
        assert self._customs(clearance, "CLEAR").status_code == 200
        again = self._customs(clearance, "REJECT", "Second thoughts.")
        assert again.status_code == 409
        assert "already" in again.data["error"].lower()

    def test_choosing_the_same_company_after_a_rejection_starts_afresh(self):
        quote_id, sel_ref, clearance = self._approved()
        self._customs(clearance, "REJECT", "Export licence missing.")

        again = self._pick(quote_id, "Alpha Line")
        assert again.status_code == 200, again.data
        fresh = again.data["selection"]["reference"]
        assert fresh != sel_ref
        assert self._status(sel_ref) == lifecycle.RESELECT_QUOTE
        assert self._status(fresh) == lifecycle.PENDING_COMPANY_VERIFICATION
