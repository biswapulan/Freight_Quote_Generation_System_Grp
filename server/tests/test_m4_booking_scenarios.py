"""The fifteen M4 test scenarios from the milestone document, section 14.

Each test is named for the scenario it covers and asserts the expected result
the document states. These rules were verified by hand while the milestone was
built, but a manual check protects nothing once the session ends: the point of
writing them down is that company isolation, the state machine and the
never-overwrite rule stay enforced when somebody changes this code later.
"""

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.tokens import create_token
from booking import lifecycle
from booking.models import (
    Booking,
    CompanyQuote,
    CustomsClearance,
    QuoteRevision,
    QuoteSelection,
)
from companies.models import CompanyAgent, CompanyRateCard, FreightCompany

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


def _company(code, name, *, per_km, per_kg, agent_email, role="AGENT"):
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
        rate_per_km=per_km,
        rate_per_kg=per_kg,
        fuel_surcharge_pct=10.0,
        handling_fee=20000.0,
        documentation_fee=3000.0,
        minimum_charge=40000.0,
        validity_days=14,
        currency="INR",
    )
    CompanyAgent.objects.create(
        company=company,
        user_email=agent_email,
        display_name=f"{name} agent",
        role=role,
        is_active=True,
    )
    return company


@pytest.mark.django_db
class TestM4BookingScenarios:
    def setup_method(self):
        self.client = APIClient()

        self.customer_id = "CUST-M4-1"
        self.customer = _headers(self.customer_id, "customer", "buyer@acme.example")
        self.other_customer = _headers(
            "CUST-M4-2", "customer", "someone.else@acme.example"
        )
        self.admin = _headers("ADMIN-M4", "admin", "admin@freightai.com")
        self.customs = _headers("CUSTOMS-M4", "customs", "customs@freightai.com")

        # Two companies so isolation can actually be tested: A must never see B.
        self.company_a = _company(
            "alpha-line",
            "Alpha Line",
            per_km=20.0,
            per_kg=1.5,
            agent_email="agent.alpha@freightai.com",
            role="MANAGER",
        )
        self.company_b = _company(
            "beta-freight",
            "Beta Freight",
            per_km=16.0,
            per_kg=1.1,
            agent_email="agent.beta@freightai.com",
        )
        self.agent_a = _headers("AGT-A", "agent", "agent.alpha@freightai.com")
        self.agent_b = _headers("AGT-B", "agent", "agent.beta@freightai.com")

    # -- helpers ------------------------------------------------------------

    def _quote(self):
        shipment = self.client.post(
            "/api/shipments", SHIPMENT, format="json", **self.customer
        )
        assert shipment.status_code == 201, shipment.data
        response = self.client.post(
            f"/api/shipments/{shipment.data['id']}/quote", **self.customer
        )
        assert response.status_code in (200, 201), response.data
        return response.data["id"]

    def _offers(self, quote_id):
        response = self.client.get(
            f"/api/quotes/{quote_id}/company-quotes", **self.customer
        )
        assert response.status_code == 200, response.data
        return response.data["results"]

    def _offer_for(self, quote_id, company_name):
        return next(o for o in self._offers(quote_id) if o["companyName"] == company_name)

    def _select(self, quote_id, offer_id, headers=None):
        return self.client.post(
            f"/api/quotes/{quote_id}/select-carrier",
            {"company_quote_id": offer_id},
            format="json",
            **(headers or self.customer),
        )

    def _selected(self, company_name="Beta Freight"):
        """A quote selected with the given company, ready for verification."""
        quote_id = self._quote()
        offer = self._offer_for(quote_id, company_name)
        response = self._select(quote_id, offer["id"])
        assert response.status_code == 200, response.data
        return quote_id, response.data["selection"], response.data["verification"]

    def _decide(self, reference, payload, headers):
        return self.client.post(
            f"/api/verification-requests/{reference}/decision",
            payload,
            format="json",
            **headers,
        )

    def _book(self, selection_ref):
        """Customs clears the approved request and the customer confirms it."""
        clearance = CustomsClearance.objects.get(selection__reference=selection_ref)
        cleared = self.client.post(
            f"/api/customs-clearances/{clearance.reference}/decision",
            {"decision": "CLEAR"},
            format="json",
            **self.customs,
        )
        assert cleared.status_code == 200, cleared.data
        booked = self.client.post(
            f"/api/selections/{selection_ref}/final-decision",
            {"decision": "ACCEPT"},
            format="json",
            **self.customer,
        )
        assert booked.status_code == 200, booked.data
        return booked

    # -- 1. Customer selects valid quote -> selection and company stored -----

    def test_01_customer_selects_valid_quote(self):
        quote_id, selection, verification = self._selected("Beta Freight")

        stored = QuoteSelection.objects.get(reference=selection["reference"])
        assert stored.company == self.company_b
        assert stored.customer_id == self.customer_id
        assert stored.status == lifecycle.PENDING_COMPANY_VERIFICATION
        # The offer the customer clicked is the one recorded, and the others
        # are stood down rather than left looking available.
        assert stored.company_quote.status == "SELECTED"
        assert CompanyQuote.objects.filter(
            quote_id=quote_id, status="NOT_SELECTED"
        ).exists()
        assert verification["assignedAgent"] == "agent.beta@freightai.com"

    # -- 2. Expired quote selected -> blocked, refresh required -------------

    def test_02_expired_offer_cannot_be_selected(self):
        quote_id = self._quote()
        offer = self._offer_for(quote_id, "Beta Freight")

        CompanyQuote.objects.filter(id=offer["id"]).update(
            valid_until=timezone.now() - timedelta(days=1)
        )

        response = self._select(quote_id, offer["id"])
        assert response.status_code == 409, response.data
        assert "expired" in response.data["error"].lower()
        assert not QuoteSelection.objects.filter(company_quote_id=offer["id"]).exists()

    # -- 3. Company A accesses Company B's request -> access denied ---------

    def test_03_company_a_cannot_see_company_b_request(self):
        _, _, verification = self._selected("Beta Freight")
        reference = verification["reference"]

        denied = self.client.get(
            f"/api/verification-requests/{reference}", **self.agent_a
        )
        assert denied.status_code == 403, denied.data

        allowed = self.client.get(
            f"/api/verification-requests/{reference}", **self.agent_b
        )
        assert allowed.status_code == 200

        # And it never appears in the other company's queue at all.
        queue_a = self.client.get("/api/verification-requests", **self.agent_a)
        assert all(r["reference"] != reference for r in queue_a.data["results"])

    # -- 4. Agent approves -> booking workflow starts -----------------------

    def test_04_agent_approval_starts_the_booking(self):
        _, selection, verification = self._selected("Beta Freight")

        response = self._decide(
            verification["reference"],
            {"action": "APPROVE", "reason": "Capacity confirmed for these dates."},
            self.agent_b,
        )
        assert response.status_code == 200, response.data

        stored = QuoteSelection.objects.get(reference=selection["reference"])
        # The approval starts it, but a booking needs customs to clear it and
        # the customer to confirm it, so there is none yet.
        assert stored.status == lifecycle.PENDING_CUSTOMS_REVIEW
        assert not Booking.objects.filter(selection=stored).exists()

        self._book(selection["reference"])
        stored.refresh_from_db()
        assert stored.status == lifecycle.BOOKING_CONFIRMED

        booking = Booking.objects.get(selection=stored)
        assert booking.status == "CONFIRMED"
        assert booking.reference.startswith("BK-")
        assert booking.agreed_total_price == stored.selected_total_price

    # -- 5. Agent modifies price -> revision created, original retained -----

    def test_05_modification_keeps_the_original_terms(self):
        _, selection, verification = self._selected("Beta Freight")
        stored = QuoteSelection.objects.get(reference=selection["reference"])
        original_price = stored.selected_total_price

        response = self._decide(
            verification["reference"],
            {
                "action": "MODIFY",
                "reason": "Bunker surcharge rose after the quote was issued.",
                "revision": {"total_price": original_price + 9000, "transit_days": 26},
            },
            self.agent_b,
        )
        assert response.status_code == 200, response.data

        stored.refresh_from_db()
        assert stored.status == lifecycle.REVISION_PENDING_CUSTOMER
        # The whole point of the rule: the selected terms are untouched.
        assert stored.selected_total_price == original_price

        revision = QuoteRevision.objects.get(selection=stored)
        assert revision.original_total_price == original_price
        assert revision.revised_total_price == original_price + 9000
        assert revision.status == "PENDING_CUSTOMER"
        assert revision.reason

    def test_05b_modification_without_a_reason_is_refused(self):
        _, _, verification = self._selected("Beta Freight")
        response = self._decide(
            verification["reference"],
            {"action": "MODIFY", "revision": {"total_price": 999999}},
            self.agent_b,
        )
        assert response.status_code == 409
        assert "reason" in response.data["error"].lower()

    # -- 6. Customer accepts revision -> booking proceeds -------------------

    def test_06_customer_accepts_revision(self):
        _, selection, verification = self._selected("Beta Freight")
        stored = QuoteSelection.objects.get(reference=selection["reference"])
        revised = stored.selected_total_price + 9000

        self._decide(
            verification["reference"],
            {
                "action": "MODIFY",
                "reason": "Peak season surcharge.",
                "revision": {"total_price": revised},
            },
            self.agent_b,
        )

        response = self.client.post(
            f"/api/selections/{selection['reference']}/revision-response",
            {"decision": "ACCEPT", "note": "Understood."},
            format="json",
            **self.customer,
        )
        assert response.status_code == 200, response.data

        stored.refresh_from_db()
        assert stored.status == lifecycle.PENDING_CUSTOMS_REVIEW

        self._book(selection["reference"])
        stored.refresh_from_db()
        assert stored.status == lifecycle.BOOKING_CONFIRMED

        booking = Booking.objects.get(selection=stored)
        # The booking is for the agreed revised price, and says it was revised.
        assert booking.agreed_total_price == revised
        assert booking.was_revised is True

    # -- 7. Customer rejects revision -> alternate quote allowed ------------

    def test_07_customer_declines_revision_and_may_reselect(self):
        quote_id, selection, verification = self._selected("Beta Freight")
        stored = QuoteSelection.objects.get(reference=selection["reference"])

        self._decide(
            verification["reference"],
            {
                "action": "MODIFY",
                "reason": "Rate increase.",
                "revision": {"total_price": stored.selected_total_price + 50000},
            },
            self.agent_b,
        )

        response = self.client.post(
            f"/api/selections/{selection['reference']}/revision-response",
            {"decision": "DECLINE", "note": "Too expensive."},
            format="json",
            **self.customer,
        )
        assert response.status_code == 200, response.data
        assert response.data["canReselect"] is True

        stored.refresh_from_db()
        assert stored.status == lifecycle.RESELECT_QUOTE
        assert stored.is_active is False
        assert not Booking.objects.filter(selection=stored).exists()

        # Declining is not cancelling: another company can still be chosen.
        alternative = self._offer_for(quote_id, "Alpha Line")
        again = self._select(quote_id, alternative["id"])
        assert again.status_code == 200, again.data
        assert again.data["selection"]["companyName"] == "Alpha Line"
        assert again.data["selection"]["status"] == lifecycle.PENDING_COMPANY_VERIFICATION

    # -- 8. Agent rejects, no capacity -> reason stored + notification ------

    def test_08_rejection_stores_the_reason_and_tells_the_customer(self):
        from notifications.models import Notification

        _, selection, verification = self._selected("Beta Freight")
        reason = "No vessel capacity on this rotation until 20 October."

        response = self._decide(
            verification["reference"],
            {"action": "REJECT", "reason": reason},
            self.agent_b,
        )
        assert response.status_code == 200, response.data
        assert response.data["decision_reason"] == reason

        stored = QuoteSelection.objects.get(reference=selection["reference"])
        assert stored.status == lifecycle.REJECTED
        # A company that cannot carry it stops being selectable.
        stored.company_quote.refresh_from_db()
        assert stored.company_quote.status == "WITHDRAWN"

        told = Notification.objects.filter(recipient_id=self.customer_id)
        assert told.exists()
        assert any(reason in n.message for n in told)

    def test_08b_rejection_without_a_reason_is_refused(self):
        _, _, verification = self._selected("Beta Freight")
        response = self._decide(
            verification["reference"], {"action": "REJECT"}, self.agent_b
        )
        assert response.status_code == 409
        assert "reason" in response.data["error"].lower()

    # -- 9. Document missing -> AWAITING_CUSTOMER_INFO ----------------------

    def test_09_missing_documents_moves_to_awaiting_customer_info(self):
        _, selection, verification = self._selected("Beta Freight")

        response = self._decide(
            verification["reference"],
            {
                "action": "REQUEST_INFO",
                "reason": "Cannot confirm stowage without the packing details.",
                "requested_information": ["Commercial invoice", "Packing list"],
            },
            self.agent_b,
        )
        assert response.status_code == 200, response.data
        assert response.data["status"] == lifecycle.AWAITING_CUSTOMER_INFO
        assert response.data["requestedInformation"] == [
            "Commercial invoice",
            "Packing list",
        ]

        stored = QuoteSelection.objects.get(reference=selection["reference"])
        assert stored.status == lifecycle.AWAITING_CUSTOMER_INFO

    def test_09b_request_info_must_say_what_is_missing(self):
        _, _, verification = self._selected("Beta Freight")
        response = self._decide(
            verification["reference"],
            {"action": "REQUEST_INFO", "reason": "Need paperwork."},
            self.agent_b,
        )
        assert response.status_code == 409
        assert "list" in response.data["error"].lower()

    # -- 10. Customer supplies it -> returns to verification ---------------

    def test_10_customer_response_returns_it_to_verification(self):
        _, selection, verification = self._selected("Beta Freight")
        self._decide(
            verification["reference"],
            {
                "action": "REQUEST_INFO",
                "reason": "Documents missing.",
                "requested_information": ["Commercial invoice"],
            },
            self.agent_b,
        )

        response = self.client.post(
            f"/api/selections/{selection['reference']}/information",
            {"note": "Invoice uploaded to Documents."},
            format="json",
            **self.customer,
        )
        assert response.status_code == 200, response.data
        assert response.data["status"] == lifecycle.UNDER_VERIFICATION

        # It is decidable again rather than stuck on the earlier decision.
        approve = self._decide(
            verification["reference"],
            {"action": "APPROVE", "reason": "Paperwork received."},
            self.agent_b,
        )
        assert approve.status_code == 200, approve.data

    # -- 11. Duplicate decision -> prevention works ------------------------

    def test_11_a_decided_request_cannot_be_decided_again(self):
        _, _, verification = self._selected("Beta Freight")

        first = self._decide(
            verification["reference"],
            {"action": "REJECT", "reason": "No capacity."},
            self.agent_b,
        )
        assert first.status_code == 200

        second = self._decide(
            verification["reference"],
            {"action": "APPROVE", "reason": "Changed my mind."},
            self.agent_b,
        )
        assert second.status_code == 409
        assert "already" in second.data["error"].lower()

    # -- 12. Unauthorised booking change -> denied + audit -----------------

    def test_12_only_the_customer_or_carrier_may_cancel_a_booking(self):
        from audit.models import AuditLog

        _, selection, verification = self._selected("Beta Freight")
        self._decide(
            verification["reference"],
            {"action": "APPROVE", "reason": "Confirmed."},
            self.agent_b,
        )
        self._book(selection["reference"])
        booking = Booking.objects.get(selection__reference=selection["reference"])

        # A different customer, and a different company's agent, are both out.
        for headers in (self.other_customer, self.agent_a):
            denied = self.client.post(
                f"/api/bookings/{booking.reference}/cancel",
                {"reason": "not mine"},
                format="json",
                **headers,
            )
            assert denied.status_code == 403, denied.data

        assert AuditLog.objects.filter(
            action="BOOKING_CANCEL_DENIED", entity_id=booking.reference
        ).exists()

        booking.refresh_from_db()
        assert booking.status == "CONFIRMED"

        allowed = self.client.post(
            f"/api/bookings/{booking.reference}/cancel",
            {"reason": "Buyer postponed the order."},
            format="json",
            **self.customer,
        )
        assert allowed.status_code == 200, allowed.data
        booking.refresh_from_db()
        assert booking.status == "CANCELLED"
        assert booking.cancellation_reason

    def test_12b_cancelling_without_a_reason_is_refused(self):
        _, selection, verification = self._selected("Beta Freight")
        self._decide(
            verification["reference"],
            {"action": "APPROVE", "reason": "Confirmed."},
            self.agent_b,
        )
        self._book(selection["reference"])
        booking = Booking.objects.get(selection__reference=selection["reference"])

        response = self.client.post(
            f"/api/bookings/{booking.reference}/cancel", {}, format="json", **self.customer
        )
        assert response.status_code == 409
        assert "reason" in response.data["error"].lower()

    # -- 13. Notification fails -> workflow still saved ---------------------

    def test_13_a_failed_notification_does_not_lose_the_decision(self, monkeypatch):
        import notifications.service as notify_service

        _, selection, verification = self._selected("Beta Freight")

        def explode(*args, **kwargs):
            raise RuntimeError("notification backend unavailable")

        # The decision is the record that matters; telling people about it is
        # best effort. Losing the decision because the mailer fell over would
        # be far worse than a missed message, and the decision runs inside a
        # transaction, so an escaping exception would roll the booking back.
        monkeypatch.setattr(notify_service, "notify_user", explode)

        response = self._decide(
            verification["reference"],
            {"action": "APPROVE", "reason": "Capacity confirmed."},
            self.agent_b,
        )
        assert response.status_code == 200, response.data

        stored = QuoteSelection.objects.get(reference=selection["reference"])
        assert stored.status == lifecycle.PENDING_CUSTOMS_REVIEW

        # Customs' decision and the customer's confirmation survive it too.
        self._book(selection["reference"])
        stored.refresh_from_db()
        assert stored.status == lifecycle.BOOKING_CONFIRMED
        assert Booking.objects.filter(selection=stored).exists()

    # -- 14. Agent response delayed -> SLA alert ---------------------------

    def test_14_an_overdue_request_is_flagged(self):
        _, _, verification = self._selected("Beta Freight")

        from booking.models import VerificationRequest

        vr = VerificationRequest.objects.get(reference=verification["reference"])
        assert vr.sla_due_at is not None
        assert vr.is_overdue is False

        vr.sla_due_at = timezone.now() - timedelta(hours=2)
        vr.save(update_fields=["sla_due_at"])
        vr.refresh_from_db()
        assert vr.is_overdue is True

        queue = self.client.get("/api/verification-requests", **self.agent_b)
        row = next(
            r for r in queue.data["results"] if r["reference"] == verification["reference"]
        )
        assert row["isOverdue"] is True

    # -- 15. Booking confirmed -> reference visible to the customer --------

    def test_15_customer_sees_the_booking_reference(self):
        _, _, verification = self._selected("Beta Freight")
        self._decide(
            verification["reference"],
            {"action": "APPROVE", "reason": "Confirmed."},
            self.agent_b,
        )
        self._book(
            QuoteSelection.objects.get(
                verification__reference=verification["reference"]
            ).reference
        )

        response = self.client.get("/api/bookings", **self.customer)
        assert response.status_code == 200, response.data
        assert response.data["count"] == 1

        booking = response.data["results"][0]
        assert booking["reference"].startswith("BK-")
        assert booking["status"] == "CONFIRMED"
        assert booking["companyName"] == "Beta Freight"
        assert booking["agreedTotalPrice"] > 0

    # -- Supporting rules the scenarios depend on ---------------------------

    def test_offers_differ_between_companies(self):
        """Each company prices from its own card, not a shared multiplier."""
        quote_id = self._quote()
        prices = {o["companyName"]: o["totalPrice"] for o in self._offers(quote_id)}
        assert len(prices) == 2
        assert prices["Alpha Line"] != prices["Beta Freight"]

    def test_an_agent_only_sees_their_own_company_offer(self):
        quote_id = self._quote()
        response = self.client.get(
            f"/api/quotes/{quote_id}/company-quotes", **self.agent_a
        )
        assert response.status_code == 200
        names = {o["companyName"] for o in response.data["results"]}
        assert names == {"Alpha Line"}

    def test_a_booking_cannot_appear_without_verification(self):
        """The success definition: no booking without the company's approval."""
        _, selection, _ = self._selected("Beta Freight")
        stored = QuoteSelection.objects.get(reference=selection["reference"])

        from booking.services import BookingError, confirm_booking

        with pytest.raises(BookingError):
            confirm_booking(stored, actor={"email": "x", "role": "customer"})

        assert not Booking.objects.filter(selection=stored).exists()

    # -- M2 and M3 carry through into M4 ------------------------------------

    def test_offers_are_priced_from_the_ai_market_rate(self):
        from quotes.insights import market_factor
        from quotes.models import Quote

        quote_id = self._quote()
        factor = market_factor(Quote.objects.get(id=quote_id))
        assert factor is not None

        for offer in self._offers(quote_id):
            assert offer["aiMarketFactor"] == factor
            assert offer["riskLevel"]

    def test_the_agent_sees_the_ai_price_and_risk(self):
        _, _, verification = self._selected("Beta Freight")
        response = self.client.get(
            f"/api/verification-requests/{verification['reference']}", **self.agent_b
        )
        assert response.status_code == 200

        insights = response.data["aiInsights"]
        assert insights["recommendedPrice"] > 0
        assert insights["offerAdjustmentPct"] is not None
        assert insights["risk"]["overallLevel"]
        assert insights["risk"]["customs"]["score"] is not None
