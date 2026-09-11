"""M4 roles and responsibilities, and the company data isolation rule.

The milestone gives each role a job and a boundary: customers act on their own
shipments, a company's agents on its requests, its managers on the special
cases, the administrator manages and monitors, and nobody else sees a
company's work. Customs officers are not an M4 role at all.
"""

import pytest
from rest_framework.test import APIClient

from accounts.tokens import create_token
from booking import lifecycle
from booking.models import Booking, QuoteSelection
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


def _company(code, name, *, members):
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
    # Members are created in order, so a manager listed first is the older one.
    for email, role in members:
        CompanyAgent.objects.create(
            company=company,
            user_email=email,
            display_name=email,
            role=role,
            is_active=True,
            user_id=f"UID-{email}",
        )
    return company


@pytest.mark.django_db
class TestM4Roles:
    def setup_method(self):
        self.client = APIClient()
        self.customer = _headers("CUST-R1", "customer", "owner@acme.example")
        self.stranger = _headers("CUST-R2", "customer", "stranger@acme.example")
        self.admin = _headers("ADMIN-R", "admin", "admin@freightai.com")
        self.customs = _headers("CUSTOMS-R", "customs", "customs@freightai.com")

        self.bravo = _company(
            "bravo",
            "Bravo Lines",
            members=[("mgr.bravo@x.example", "MANAGER"), ("agent.bravo@x.example", "AGENT")],
        )
        self.charlie = _company(
            "charlie", "Charlie Cargo", members=[("agent.charlie@x.example", "AGENT")]
        )
        self.agent_b = _headers("AGT-B", "agent", "agent.bravo@x.example")
        self.manager_b = _headers("MGR-B", "agent", "mgr.bravo@x.example")
        self.agent_c = _headers("AGT-C", "agent", "agent.charlie@x.example")

    # -- helpers ------------------------------------------------------------

    def _quote(self):
        shipment = self.client.post("/api/shipments", SHIPMENT, format="json", **self.customer)
        assert shipment.status_code == 201, shipment.data
        quote = self.client.post(f"/api/shipments/{shipment.data['id']}/quote", **self.customer)
        assert quote.status_code in (200, 201), quote.data
        return shipment.data["id"], quote.data["id"]

    def _selected(self, company_name="Bravo Lines"):
        shipment_id, quote_id = self._quote()
        offers = self.client.get(
            f"/api/quotes/{quote_id}/company-quotes", **self.customer
        ).data["results"]
        offer = next(o for o in offers if o["companyName"] == company_name)
        chosen = self.client.post(
            f"/api/quotes/{quote_id}/select-carrier",
            {"company_quote_id": offer["id"]},
            format="json",
            **self.customer,
        )
        assert chosen.status_code == 200, chosen.data
        return shipment_id, chosen.data["selection"], chosen.data["verification"]

    def _decide(self, reference, payload, who):
        return self.client.post(
            f"/api/verification-requests/{reference}/decision", payload, format="json", **who
        )

    def _set_rule(self, company, **fields):
        FreightCompany.objects.filter(id=company.id).update(**fields)

    # -- Routing ------------------------------------------------------------

    def test_routine_requests_go_to_an_agent_not_the_manager(self):
        _, _, verification = self._selected()
        assert verification["assignedAgent"] == "agent.bravo@x.example"

    # -- Customs officers and the administrator ------------------------------

    def test_customs_officers_have_no_access_to_company_requests(self):
        _, _, verification = self._selected()
        ref = verification["reference"]
        assert self.client.get("/api/verification-requests", **self.customs).status_code == 403
        assert self.client.get(f"/api/verification-requests/{ref}", **self.customs).status_code == 403
        assert self._decide(ref, {"action": "REJECT", "reason": "x"}, self.customs).status_code == 403

    def test_the_admin_monitors_but_does_not_act(self):
        _, selection, verification = self._selected()
        ref = verification["reference"]

        queue = self.client.get("/api/verification-requests", **self.admin)
        assert queue.status_code == 200
        assert any(r["reference"] == ref for r in queue.data["results"])
        detail = self.client.get(f"/api/verification-requests/{ref}", **self.admin)
        assert detail.status_code == 200
        assert detail.data["canDecide"] is False

        check = self.client.post(
            f"/api/verification-requests/{ref}/checks",
            {"area": "CARGO", "result": "PASS"},
            format="json",
            **self.admin,
        )
        assert check.status_code == 403
        assert self._decide(ref, {"action": "APPROVE", "reason": "x"}, self.admin).status_code == 403

        sel_ref = selection["reference"]
        assert self.client.get(f"/api/selections/{sel_ref}", **self.admin).status_code == 200
        answer = self.client.post(
            f"/api/selections/{sel_ref}/revision-response",
            {"decision": "ACCEPT"},
            format="json",
            **self.admin,
        )
        assert answer.status_code == 403

    def test_the_admin_sees_but_cannot_cancel_a_booking(self):
        _, selection, verification = self._selected()
        self._decide(verification["reference"], {"action": "APPROVE", "reason": "ok"}, self.agent_b)
        booking = Booking.objects.get(selection__reference=selection["reference"])

        assert self.client.get(f"/api/bookings/{booking.reference}", **self.admin).status_code == 200
        cancel = self.client.post(
            f"/api/bookings/{booking.reference}/cancel",
            {"reason": "Admin tidy-up."},
            format="json",
            **self.admin,
        )
        assert cancel.status_code == 403

    def test_an_agent_without_a_company_sees_no_offers(self):
        _, quote_id = self._quote()
        loner = _headers("AGT-X", "agent", "nobody@x.example")
        response = self.client.get(f"/api/quotes/{quote_id}/company-quotes", **loner)
        assert response.status_code == 200
        assert response.data["results"] == []

    # -- Company manager ------------------------------------------------------

    def test_an_approval_above_the_limit_goes_to_the_manager(self):
        _, selection, verification = self._selected()
        ref = verification["reference"]
        self._set_rule(self.bravo, manager_approval_threshold=1000.0)

        first = self._decide(ref, {"action": "APPROVE", "reason": "Capacity is fine."}, self.agent_b)
        assert first.status_code == 200, first.data
        assert first.data["status"] == lifecycle.ESCALATED
        assert "manager approval limit" in first.data["decision_reason"]
        assert not Booking.objects.filter(selection__reference=selection["reference"]).exists()

        # The agent cannot clear it, by approving or by revising.
        assert self._decide(ref, {"action": "APPROVE", "reason": "Again."}, self.agent_b).status_code == 403
        revise = {"action": "MODIFY", "reason": "x", "revision": {"total_price": 5}}
        assert self._decide(ref, revise, self.agent_b).status_code == 403

        seen = self.client.get(f"/api/verification-requests/{ref}", **self.manager_b)
        assert seen.data["viewerIsManager"] is True
        assert seen.data["canDecide"] is True

        signed = self._decide(ref, {"action": "APPROVE", "reason": "Signed off."}, self.manager_b)
        assert signed.status_code == 200, signed.data
        stored = QuoteSelection.objects.get(reference=selection["reference"])
        assert stored.status == lifecycle.BOOKING_CONFIRMED

    def test_the_manager_is_told_about_an_escalation(self):
        from notifications.models import Notification

        _, _, verification = self._selected()
        self._set_rule(self.bravo, manager_approval_threshold=1000.0)
        self._decide(verification["reference"], {"action": "APPROVE", "reason": "ok"}, self.agent_b)
        assert Notification.objects.filter(recipient_id="UID-mgr.bravo@x.example").exists()

    def test_an_approval_under_the_limit_books_straight_away(self):
        _, selection, verification = self._selected()
        self._set_rule(self.bravo, manager_approval_threshold=1e12)
        response = self._decide(verification["reference"], {"action": "APPROVE", "reason": "ok"}, self.agent_b)
        assert response.status_code == 200
        assert Booking.objects.filter(selection__reference=selection["reference"]).exists()

    def test_high_risk_shipments_need_the_manager_when_the_company_says_so(self):
        _, selection, verification = self._selected()
        self._set_rule(self.bravo, manager_approval_high_risk=True)
        offer = QuoteSelection.objects.get(reference=selection["reference"]).company_quote
        offer.risk_level = "HIGH"
        offer.save(update_fields=["risk_level"])

        response = self._decide(verification["reference"], {"action": "APPROVE", "reason": "ok"}, self.agent_b)
        assert response.data["status"] == lifecycle.ESCALATED
        assert "HIGH risk" in response.data["decision_reason"]

    def test_a_revision_above_the_limit_must_be_escalated(self):
        _, _, verification = self._selected()
        self._set_rule(self.bravo, manager_approval_threshold=1000.0)
        response = self._decide(
            verification["reference"],
            {"action": "MODIFY", "reason": "Surcharge.", "revision": {"total_price": 999999}},
            self.agent_b,
        )
        assert response.status_code == 409
        assert "Escalate" in response.data["error"]

    def test_a_company_without_a_manager_is_not_stranded(self):
        _, selection, verification = self._selected("Charlie Cargo")
        self._set_rule(self.charlie, manager_approval_threshold=1000.0)
        response = self._decide(verification["reference"], {"action": "APPROVE", "reason": "ok"}, self.agent_c)
        assert response.status_code == 200
        assert Booking.objects.filter(selection__reference=selection["reference"]).exists()

    # -- Documents ------------------------------------------------------------

    def _upload(self, shipment_id, who):
        return self.client.post(
            "/api/v1/customs/documents/upload/",
            {
                "shipment_id": shipment_id,
                "document_type": "Commercial Invoice",
                "file_name": "invoice.pdf",
                "file_url": "https://files.example/invoice.pdf",
            },
            format="json",
            **who,
        )

    def _listed(self, who):
        response = self.client.get("/api/v1/customs/documents/", **who)
        assert response.status_code == 200
        return {doc["shipment_id"] for doc in response.data["results"]}

    def test_documents_follow_the_shipment_and_the_chosen_company(self):
        shipment_id, _, verification = self._selected()
        assert self._upload(shipment_id, self.customer).status_code == 201

        assert shipment_id in self._listed(self.customer)
        assert shipment_id in self._listed(self.agent_b)
        assert shipment_id in self._listed(self.customs)
        assert shipment_id not in self._listed(self.stranger)
        assert shipment_id not in self._listed(self.agent_c)

        detail = self.client.get(
            f"/api/verification-requests/{verification['reference']}", **self.agent_b
        )
        assert [d["fileName"] for d in detail.data["documents"]] == ["invoice.pdf"]

    def test_only_the_owner_or_customs_may_add_remove_or_verify_documents(self):
        shipment_id, _, _ = self._selected()
        assert self._upload(shipment_id, self.stranger).status_code == 403
        assert self._upload(shipment_id, self.agent_c).status_code == 403

        created = self._upload(shipment_id, self.customer)
        assert created.status_code == 201
        doc_id = created.data["document"]["id"]

        verify = self.client.post(
            f"/api/v1/customs/documents/{doc_id}/verify/",
            {"decision": "REJECTED", "remarks": "Looks wrong."},
            format="json",
            **self.customer,
        )
        assert verify.status_code == 403
        assert self.client.delete(f"/api/v1/customs/documents/{doc_id}/", **self.agent_b).status_code == 403
