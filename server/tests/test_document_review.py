"""Documents are verified by people who have opened them, never automatically.

The customer uploads each paper the lane requires. The chosen company's agent
opens and verifies each one before approving, and customs does the same
before clearing. An upload never verifies itself, a verdict from someone who
has not opened the file is refused, and the AI analysis stops calling a paper
outstanding once it has been uploaded.
"""

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from accounts.tokens import create_token
from booking import lifecycle
from booking.models import CustomsClearance, QuoteSelection
from companies.models import CompanyAgent, CompanyRateCard, FreightCompany
from customs.models import ShipmentDocument
from customs.paperwork import required_names
from notifications.models import Notification
from tests.paperwork_steps import company_verifies, customs_verifies, upload_papers

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

UPLOAD = "/api/v1/customs/documents/upload/"


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


def _pdf(name="paper.pdf", body=b"%PDF-1.4 paper"):
    return SimpleUploadedFile(name, body, content_type="application/pdf")


@pytest.mark.django_db
class TestManualDocumentReview:
    def setup_method(self):
        self.client = APIClient()
        self.customer_id = "CUST-D1"
        self.customer = _headers(self.customer_id, "customer", "owner@acme.example")
        self.stranger = _headers("CUST-D2", "customer", "stranger@acme.example")
        self.customs = _headers("CUSTOMS-D", "customs", "customs@freightai.com")
        _company("alpha", "Alpha Line", "agent.alpha@x.example")
        _company("beta", "Beta Freight", "agent.beta@x.example")
        self.agent_a = _headers("AGT-A", "agent", "agent.alpha@x.example")
        self.agent_b = _headers("AGT-B", "agent", "agent.beta@x.example")

    # -- helpers ------------------------------------------------------------

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
        return quote_id, chosen.data["selection"]["reference"], chosen.data["verification"]["reference"]

    def _docs(self, sel_ref):
        selection = QuoteSelection.objects.get(reference=sel_ref)
        return list(ShipmentDocument.objects.filter(shipment_id=selection.shipment_id))

    def _open(self, doc, who):
        return self.client.get(f"/api/v1/customs/documents/{doc.id}/file/", **who)

    def _review(self, vr_ref, doc, decision, remarks="", who=None):
        return self.client.post(
            f"/api/verification-requests/{vr_ref}/documents/{doc.id}/review",
            {"decision": decision, "remarks": remarks},
            format="json",
            **(who or self.agent_a),
        )

    def _approve(self, vr_ref, who=None):
        return self.client.post(
            f"/api/verification-requests/{vr_ref}/decision",
            {"action": "APPROVE", "reason": "Capacity and route confirmed."},
            format="json",
            **(who or self.agent_a),
        )

    def _detail(self, vr_ref, who=None):
        return self.client.get(f"/api/verification-requests/{vr_ref}", **(who or self.agent_a)).data

    # -- An upload waits for review -------------------------------------------

    def test_an_upload_waits_for_review_and_stops_being_outstanding(self):
        _, sel_ref, vr_ref = self._select()
        selection = QuoteSelection.objects.select_related("quote").get(reference=sel_ref)
        names = required_names(selection.quote)
        assert len(names) >= 2, names

        uploaded = self.client.post(
            UPLOAD,
            {"shipment_id": selection.shipment_id, "document_type": names[0], "file": _pdf()},
            format="multipart",
            **self.customer,
        )
        assert uploaded.status_code == 201, uploaded.data
        assert uploaded.data["document"]["verification_status"] == "PENDING"
        assert uploaded.data["document"]["agent_status"] == "PENDING"

        detail = self._detail(vr_ref)
        row = next(r for r in detail["requiredDocuments"] if r["name"] == names[0])
        assert row["onFile"] is True
        assert (row["companyStatus"], row["customsStatus"]) == ("PENDING", "PENDING")

        # The AI analysis reads the uploads as they are now.
        outstanding = " ".join(a for a in detail["aiInsights"]["alerts"] if "outstanding" in a)
        assert names[0] not in outstanding
        assert names[1] in outstanding

    def test_a_verdict_needs_the_file_opened_first(self):
        _, sel_ref, vr_ref = self._select()
        upload_papers(self.client, sel_ref, self.customer)
        doc = self._docs(sel_ref)[0]

        early = self._review(vr_ref, doc, "VERIFIED")
        assert early.status_code == 409
        assert "open the document" in early.data["error"].lower()

        opened = self._open(doc, self.agent_a)
        assert opened.status_code == 200
        assert b"".join(opened.streaming_content).startswith(b"%PDF")

        assert self._review(vr_ref, doc, "VERIFIED").status_code == 200
        doc.refresh_from_db()
        assert doc.agent_status == "VERIFIED"
        assert doc.agent_reviewed_by == "agent.alpha@x.example"
        # The company's verdict is its own; customs has not looked yet.
        assert doc.verification_status == "PENDING"

    # -- The company approves only once every paper is verified ---------------

    def test_the_agent_cannot_approve_until_every_paper_is_verified(self):
        _, sel_ref, vr_ref = self._select()
        blocked = self._approve(vr_ref)
        assert blocked.status_code == 409
        assert "not uploaded yet" in blocked.data["error"]

        upload_papers(self.client, sel_ref, self.customer)
        docs = self._docs(sel_ref)
        for doc in docs[:-1]:
            self._open(doc, self.agent_a)
            assert self._review(vr_ref, doc, "VERIFIED").status_code == 200

        blocked = self._approve(vr_ref)
        assert blocked.status_code == 409
        assert "still to open and verify" in blocked.data["error"]
        assert self._detail(vr_ref)["documentReadiness"]["ready"] is False

        self._open(docs[-1], self.agent_a)
        self._review(vr_ref, docs[-1], "VERIFIED")
        approved = self._approve(vr_ref)
        assert approved.status_code == 200, approved.data
        assert approved.data["status"] == lifecycle.PENDING_CUSTOMS_REVIEW

    def test_a_rejected_paper_needs_remarks_and_a_new_upload(self):
        _, sel_ref, vr_ref = self._select()
        upload_papers(self.client, sel_ref, self.customer)
        bad, *rest = self._docs(sel_ref)

        self._open(bad, self.agent_a)
        bare = self._review(vr_ref, bad, "REJECTED")
        assert bare.status_code == 409
        assert "wrong" in bare.data["error"]
        rejected = self._review(
            vr_ref, bad, "REJECTED", remarks="Invoice total does not match the packing list."
        )
        assert rejected.status_code == 200, rejected.data
        assert Notification.objects.filter(
            recipient_id=self.customer_id, title__contains="rejected your"
        ).exists()

        for doc in rest:
            self._open(doc, self.agent_a)
            self._review(vr_ref, doc, "VERIFIED")
        blocked = self._approve(vr_ref)
        assert blocked.status_code == 409
        assert "rejected" in blocked.data["error"]
        alerts = self._detail(vr_ref)["aiInsights"]["alerts"]
        assert any("Rejected and waiting for a new upload" in a for a in alerts)

        # The customer uploads a corrected copy; the agent opens and verifies it.
        selection = QuoteSelection.objects.get(reference=sel_ref)
        fresh = self.client.post(
            UPLOAD,
            {
                "shipment_id": selection.shipment_id,
                "document_type": bad.document_type,
                "file": _pdf("corrected.pdf", b"%PDF-1.4 corrected"),
            },
            format="multipart",
            **self.customer,
        )
        corrected = ShipmentDocument.objects.get(id=fresh.data["document"]["id"])
        self._open(corrected, self.agent_a)
        assert self._review(vr_ref, corrected, "VERIFIED").status_code == 200
        assert self._approve(vr_ref).status_code == 200

    def test_another_companys_review_does_not_count(self):
        quote_id, sel_ref, _ = self._select("Alpha Line")
        upload_papers(self.client, sel_ref, self.customer)
        company_verifies(self.client, sel_ref, self.agent_a)

        # The customer moves to Beta Freight before Alpha approves.
        _, beta_ref, beta_vr = self._select("Beta Freight", quote_id=quote_id)
        detail = self._detail(beta_vr, self.agent_b)
        assert {r["companyStatus"] for r in detail["requiredDocuments"]} == {"PENDING"}
        assert self._approve(beta_vr, self.agent_b).status_code == 409

        company_verifies(self.client, beta_ref, self.agent_b)
        assert self._approve(beta_vr, self.agent_b).status_code == 200

    # -- Customs clears only once every paper is verified ---------------------

    def test_customs_must_open_and_verify_each_paper_before_clearing(self):
        _, sel_ref, vr_ref = self._select()
        upload_papers(self.client, sel_ref, self.customer)
        company_verifies(self.client, sel_ref, self.agent_a)
        assert self._approve(vr_ref).status_code == 200

        clearance = CustomsClearance.objects.get(selection__reference=sel_ref)
        clear = f"/api/customs-clearances/{clearance.reference}/decision"
        early = self.client.post(clear, {"decision": "CLEAR"}, format="json", **self.customs)
        assert early.status_code == 409
        assert "still to open and verify" in early.data["error"]

        doc = self._docs(sel_ref)[0]
        unopened = self.client.post(
            f"/api/v1/customs/documents/{doc.id}/verify/",
            {"decision": "VERIFIED"},
            format="json",
            **self.customs,
        )
        assert unopened.status_code == 409

        customs_verifies(self.client, sel_ref, self.customs)
        cleared = self.client.post(clear, {"decision": "CLEAR"}, format="json", **self.customs)
        assert cleared.status_code == 200, cleared.data
        assert QuoteSelection.objects.get(reference=sel_ref).status == lifecycle.CUSTOMS_CLEARED

    # -- Who may open a paper ---------------------------------------------------

    def test_only_people_entitled_to_the_papers_can_open_them(self):
        _, sel_ref, _ = self._select("Alpha Line")
        upload_papers(self.client, sel_ref, self.customer)
        doc = self._docs(sel_ref)[0]

        assert self._open(doc, self.stranger).status_code == 404
        assert self._open(doc, self.agent_b).status_code == 404
        assert self._open(doc, self.customer).status_code == 200
        assert self._open(doc, self.customs).status_code == 200

        doc.refresh_from_db()
        assert {v["email"] for v in doc.viewed_by} == {"owner@acme.example", "customs@freightai.com"}
