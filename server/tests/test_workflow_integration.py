"""Integration tests for the connected M1-M3 workflow.

Covers the pieces the PDF describes as joining the milestones together: the AI
Orchestrator, the customs decision returning to the risk workflow, notifications,
the audit trail, and real document upload.
"""

import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from accounts.tokens import create_token
from audit.models import AuditLog
from customs.models import CustomsComplianceCheck, ShipmentDocument
from notifications.models import Notification
from orchestrator.models import AgentInvocation, OrchestrationRun
from orchestrator.service import AIOrchestrator
from quotes.models import Quote, Shipment
from risk.models import ShipmentRiskAssessment


def _headers(user_id, role, email):
    return {
        "HTTP_AUTHORIZATION": f"Bearer {create_token(user_id)}",
        "HTTP_X_CUSTOMER_ID": user_id,
        "HTTP_X_USER_ROLE": role,
        "HTTP_X_USER_EMAIL": email,
    }


CUSTOMER = _headers("CUST-7001", "customer", "customer@freightai.com")
AGENT = _headers("AGENT-7002", "agent", "agent@freightai.com")
OFFICER = _headers("OFFICER-7003", "customs", "officer@freightai.com")
ADMIN = _headers("ADMIN-7004", "admin", "admin@freightai.com")

SHIPMENT_PAYLOAD = {
    "origin": "Chennai",
    "destination": "Rotterdam",
    "cargoType": "Electronics",
    "weight": 5000.0,
    "volume": 12.0,
    "transportMode": "ocean",
    "containerType": "40FT",
}


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def quoted_shipment(client):
    """A shipment taken through the full pipeline to a PENDING_REVIEW quote."""
    res = client.post("/shipments", SHIPMENT_PAYLOAD, format="json", **CUSTOMER)
    assert res.status_code == 201
    shipment_id = res.json()["id"]

    res = client.post(f"/shipments/{shipment_id}/quote", {}, format="json", **CUSTOMER)
    assert res.status_code == 201
    return shipment_id, res.json()


@pytest.mark.django_db
class TestOrchestrator:
    def test_every_agent_runs_and_is_recorded(self, quoted_shipment):
        shipment_id, _quote = quoted_shipment

        run = OrchestrationRun.objects.filter(shipment_id=shipment_id).first()
        assert run is not None
        assert run.status in ("COMPLETED", "DEGRADED")

        agents = set(
            AgentInvocation.objects.filter(run=run).values_list("agent", flat=True)
        )
        assert agents == {"ROUTE", "PRICING", "WEATHER", "CUSTOMS", "RISK"}

    def test_risk_is_fed_by_weather_and_customs_not_defaults(self, quoted_shipment):
        """The wiring the spec requires: risk consumes the other agents' output."""
        shipment_id, quote = quoted_shipment
        analysis = Quote.objects.get(id=quote["id"]).analysis

        assert analysis["risk"]["weather_score"] == analysis["weather"]["risk_score"]
        assert analysis["risk"]["customs_score"] == analysis["customs"]["risk_score"]

        # And it is genuinely computed, not the engine's 20/15 fallback defaults.
        assessment = ShipmentRiskAssessment.objects.get(shipment_id=shipment_id)
        assert assessment.weather_score == analysis["weather"]["risk_score"]
        assert assessment.customs_score == analysis["customs"]["risk_score"]

    def test_a_failing_agent_degrades_rather_than_breaking_the_quote(
        self, client, monkeypatch
    ):
        def boom(cls, context):
            raise RuntimeError("weather provider exploded")

        monkeypatch.setattr(AIOrchestrator, "_weather_agent", classmethod(boom))

        res = client.post("/shipments", SHIPMENT_PAYLOAD, format="json", **CUSTOMER)
        shipment_id = res.json()["id"]
        res = client.post(f"/shipments/{shipment_id}/quote", {}, format="json", **CUSTOMER)

        # The customer still gets a quote.
        assert res.status_code == 201
        quote = Quote.objects.get(id=res.json()["id"])
        assert quote.total_price > 0
        assert "WEATHER" in quote.analysis["degraded_agents"]

        run = OrchestrationRun.objects.filter(shipment_id=shipment_id).first()
        assert run.status == "DEGRADED"
        assert (
            AgentInvocation.objects.get(run=run, agent="WEATHER").status == "FAILED"
        )

    def test_agent_monitor_reports_measured_telemetry(self, client, quoted_shipment):
        res = client.get("/api/v1/orchestrator/agents", **ADMIN)
        assert res.status_code == 200
        body = res.json()

        assert body["orchestrator"]["total_runs"] >= 1
        by_name = {a["agent"]: a for a in body["agents"]}
        assert set(by_name) == {"ROUTE", "PRICING", "WEATHER", "CUSTOMS", "RISK"}
        assert by_name["ROUTE"]["invocations"] >= 1
        assert by_name["ROUTE"]["status"] in ("HEALTHY", "DEGRADED", "ERROR")

    def test_transit_estimate_reflects_distance_for_unlisted_lanes(self):
        # Chennai to Rotterdam is not in the route dataset; a flat 7-day default
        # would be wrong for a ~10,000 km ocean haul.
        long_haul = AIOrchestrator.estimate_transit_days(10687, "ocean")
        short_haul = AIOrchestrator.estimate_transit_days(3000, "ocean")

        assert long_haul > short_haul
        assert 18 <= long_haul <= 30
        assert AIOrchestrator.estimate_transit_days(10687, "air") < long_haul


@pytest.mark.django_db
class TestCustomsReturnsToRiskWorkflow:
    """PDF section 7: Approve/Flag -> Result returns to Risk workflow."""

    def test_officer_rejection_recomputes_composite_risk(self, client, quoted_shipment):
        shipment_id, quote = quoted_shipment
        before = Quote.objects.get(id=quote["id"])

        check = CustomsComplianceCheck.objects.get(shipment_id=shipment_id)
        res = client.post(
            f"/api/v1/customs/{check.id}/sign-off/",
            {
                "decision": "REJECTED",
                "officer_name": "Officer Sharma",
                "comments": "Dual-use export licence missing.",
            },
            format="json",
            **OFFICER,
        )
        assert res.status_code == 200, res.json()

        reassessment = res.json()["risk_reassessment"]
        assert reassessment["risk_level"] == "CRITICAL"
        assert reassessment["can_issue_quote"] is False

        # The quote itself was updated, not just the customs record.
        after = Quote.objects.get(id=quote["id"])
        assert after.overall_risk_level == "CRITICAL"
        assert after.requires_human_review is True
        assert after.overall_risk_score > before.overall_risk_score

        assert AuditLog.objects.filter(
            action="CUSTOMS_SIGN_OFF", entity_type="CUSTOMS_CHECK"
        ).exists()

    def test_officer_approval_lowers_customs_risk(self, client, quoted_shipment):
        shipment_id, quote = quoted_shipment
        before = Quote.objects.get(id=quote["id"])

        check = CustomsComplianceCheck.objects.get(shipment_id=shipment_id)
        res = client.post(
            f"/api/v1/customs/{check.id}/sign-off/",
            {
                "decision": "APPROVED",
                "officer_name": "Officer Sharma",
                "comments": "All paperwork sighted and in order.",
            },
            format="json",
            **OFFICER,
        )
        assert res.status_code == 200

        after = Quote.objects.get(id=quote["id"])
        assert after.customs_risk_score < before.customs_risk_score
        assert res.json()["risk_reassessment"]["can_issue_quote"] is True


@pytest.mark.django_db
class TestDocumentUpload:
    def test_real_file_is_stored_and_retrievable(self, client, quoted_shipment):
        shipment_id, _quote = quoted_shipment

        upload = SimpleUploadedFile(
            "commercial_invoice.pdf",
            b"%PDF-1.4 fake invoice bytes",
            content_type="application/pdf",
        )
        res = client.post(
            "/api/v1/customs/documents/upload/",
            {
                "shipment_id": shipment_id,
                "document_type": "Commercial Invoice",
                "file": upload,
            },
            format="multipart",
            **CUSTOMER,
        )
        assert res.status_code == 201, res.json()

        doc = ShipmentDocument.objects.get(shipment_id=shipment_id)
        assert doc.file, "the uploaded bytes must actually be stored"
        assert doc.file_size == len(b"%PDF-1.4 fake invoice bytes")
        assert doc.file.read() == b"%PDF-1.4 fake invoice bytes"

        listing = client.get(
            f"/api/v1/customs/documents/?shipment_id={shipment_id}", **OFFICER
        )
        assert listing.status_code == 200
        assert listing.json()["count"] == 1

    def test_oversized_and_unsupported_files_are_rejected(self, client, quoted_shipment, settings):
        shipment_id, _quote = quoted_shipment
        settings.MAX_DOCUMENT_UPLOAD_BYTES = 100

        too_big = SimpleUploadedFile("big.pdf", b"x" * 500, content_type="application/pdf")
        res = client.post(
            "/api/v1/customs/documents/upload/",
            {"shipment_id": shipment_id, "file": too_big},
            format="multipart",
            **CUSTOMER,
        )
        assert res.status_code == 413

        bad_type = SimpleUploadedFile("payload.exe", b"MZ", content_type="application/x-msdownload")
        res = client.post(
            "/api/v1/customs/documents/upload/",
            {"shipment_id": shipment_id, "file": bad_type},
            format="multipart",
            **CUSTOMER,
        )
        assert res.status_code == 400

    def test_an_upload_waits_for_an_officer_who_has_opened_it(self, client, quoted_shipment):
        shipment_id, _quote = quoted_shipment

        upload = SimpleUploadedFile("coo.pdf", b"%PDF-1.4", content_type="application/pdf")
        res = client.post(
            "/api/v1/customs/documents/upload/",
            {
                "shipment_id": shipment_id,
                "document_type": "Certificate of Origin",
                "file": upload,
            },
            format="multipart",
            **CUSTOMER,
        )
        document = res.json()["document"]
        document_id = document["id"]
        # Arriving is not being verified.
        assert document["verification_status"] == "PENDING"

        verify = f"/api/v1/customs/documents/{document_id}/verify/"

        # Rejecting requires remarks.
        res = client.post(
            verify, {"decision": "REJECTED", "officer_name": "Officer Sharma"}, format="json", **OFFICER
        )
        assert res.status_code == 400

        rejection = {
            "decision": "REJECTED",
            "officer_name": "Officer Sharma",
            "remarks": "Chamber of Commerce stamp is illegible.",
        }
        # And no verdict at all from an officer who has not opened the file.
        assert client.post(verify, rejection, format="json", **OFFICER).status_code == 409

        opened = client.get(f"/api/v1/customs/documents/{document_id}/file/", **OFFICER)
        assert opened.status_code == 200
        assert b"".join(opened.streaming_content) == b"%PDF-1.4"

        assert client.post(verify, rejection, format="json", **OFFICER).status_code == 200

        doc = ShipmentDocument.objects.get(id=document_id)
        assert doc.verification_status == "REJECTED"
        assert doc.rejection_reason
        assert doc.was_viewed_by("officer@freightai.com")


@pytest.mark.django_db
class TestNotificationsAndAudit:
    def test_notifications_reach_the_right_inbox(self, client, quoted_shipment):
        _shipment_id, quote = quoted_shipment

        customer_inbox = client.get("/api/v1/notifications", **CUSTOMER)
        assert customer_inbox.status_code == 200
        assert customer_inbox.json()["unread_count"] >= 1

        agent_inbox = client.get("/api/v1/notifications", **AGENT)
        titles = [n["title"] for n in agent_inbox.json()["results"]]
        assert any(quote["id"] in title for title in titles)

        # A customer must not see the agent desk's broadcast feed.
        customer_titles = [n["title"] for n in customer_inbox.json()["results"]]
        assert not any("awaiting review" in t for t in customer_titles)

    def test_marking_read_clears_the_badge(self, client, quoted_shipment):
        res = client.post("/api/v1/notifications/read-all", {}, format="json", **CUSTOMER)
        assert res.status_code == 200
        assert client.get("/api/v1/notifications", **CUSTOMER).json()["unread_count"] == 0

    def test_audit_log_is_admin_only(self, client, quoted_shipment):
        assert client.get("/api/v1/audit/logs", **CUSTOMER).status_code == 403
        assert client.get("/api/v1/audit/logs", **AGENT).status_code == 403

        res = client.get("/api/v1/audit/logs", **ADMIN)
        assert res.status_code == 200
        assert res.json()["count"] >= 1

    def test_entity_trail_shows_the_full_history_of_a_quote(self, client, quoted_shipment):
        _shipment_id, quote = quoted_shipment

        res = client.get(f"/api/v1/audit/trail/QUOTE/{quote['id']}", **AGENT)
        assert res.status_code == 200
        actions = [row["action"] for row in res.json()["results"]]
        assert "QUOTE_GENERATED" in actions


@pytest.mark.django_db
class TestRoleAuthorisation:
    """A caller must not be able to choose their own role."""

    def test_header_role_is_ignored_in_production_config(self, client, settings, quoted_shipment):
        # Production leaves header identity off.
        settings.ALLOW_HEADER_ROLE_AUTH = False

        forged = {
            "HTTP_AUTHORIZATION": f"Bearer {create_token('CUST-7001')}",
            "HTTP_X_CUSTOMER_ID": "CUST-7001",
            "HTTP_X_USER_ROLE": "admin",
            "HTTP_X_USER_EMAIL": "attacker@example.com",
        }

        # Claiming admin via a header must not open the audit log.
        assert client.get("/api/v1/audit/logs", **forged).status_code == 403

        # Nor the staff-only quote list.
        assert client.get("/admin/quotes", **forged).status_code == 403

    def test_role_is_taken_from_the_signed_token(self, client, settings, quoted_shipment):
        settings.ALLOW_HEADER_ROLE_AUTH = False

        signed_admin = {
            "HTTP_AUTHORIZATION": f"Bearer {create_token('ADMIN-9', role='admin', email='a@b.c')}",
            # Even a contradicting header cannot downgrade a signed claim.
            "HTTP_X_USER_ROLE": "customer",
        }
        assert client.get("/api/v1/audit/logs", **signed_admin).status_code == 200

    def test_unauthenticated_requests_are_rejected(self, client):
        assert client.get("/api/v1/notifications").status_code in (401, 403)
        assert client.post("/shipments", SHIPMENT_PAYLOAD, format="json").status_code in (401, 403)


class TestUrlRouting:
    """The quotes and pricing apps share the /api/ and /api/v1/ prefixes.

    A bare <str:quote_id> catch-all used to swallow the pricing app's verbs,
    so /quotes/estimate/ resolved to "fetch the quote called estimate" and
    404ed. These assert the specific routes stay reachable.
    """

    @pytest.mark.parametrize(
        "path,expected_view",
        [
            ("/api/quotes/estimate/", "EstimateQuoteView"),
            ("/api/v1/quotes/estimate/", "EstimateQuoteView"),
            ("/api/quotes/cost-breakdown/", "CostBreakdownView"),
            ("/api/quotes/my", "CustomerQuoteListView"),
            ("/api/quotes/QTE-123", "CustomerQuoteListView"),
            ("/api/quotes/QTE-123/decision", "CustomerQuoteDecisionView"),
            ("/api/quotes/QTE-123/review", "QuoteReviewView"),
            ("/api/quotes/QTE-123/confirm/", "QuoteConfirmView"),
            ("/api/admin/quotes/QTE-123/approve", "AdminQuoteApproveView"),
        ],
    )
    def test_route_resolves_to_expected_view(self, path, expected_view):
        from django.urls import resolve

        match = resolve(path)
        assert match.func.cls.__name__ == expected_view


@pytest.mark.django_db
class TestLifecycleEnforcement:
    def test_illegal_status_jumps_are_refused(self, client, quoted_shipment):
        _shipment_id, quote = quoted_shipment

        # PENDING_REVIEW -> ACCEPTED skips agent approval and delivery.
        res = client.patch(
            f"/admin/quotes/{quote['id']}/status",
            {"status": "ACCEPTED"},
            format="json",
            **ADMIN,
        )
        assert res.status_code == 409
        assert Quote.objects.get(id=quote["id"]).status == "PENDING_REVIEW"

    def test_shipment_walks_the_documented_status_flow(self, client, quoted_shipment):
        shipment_id, _quote = quoted_shipment

        transitions = list(
            AuditLog.objects.filter(
                entity_type="SHIPMENT",
                entity_id=shipment_id,
                action="SHIPMENT_STATUS_CHANGED",
            )
            .order_by("created_at")
            .values_list("changes", flat=True)
        )
        reached = [t["status"]["to"] for t in transitions]

        # PDF section 10: SUBMITTED -> PROCESSING -> ANALYZED -> QUOTED
        assert reached == ["PROCESSING", "ANALYZED", "QUOTED"]
        assert Shipment.objects.get(id=shipment_id).status == "QUOTED"
