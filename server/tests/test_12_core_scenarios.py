"""The 12 Core Test Scenarios from PDF section 9.

Each test drives the real HTTP API end to end and asserts the mentor's stated
expected result. Where a scenario describes a failure mode (ML down, storm on
route) the dependency is patched at its boundary rather than the assertion being
weakened.

    #   Scenario                            Expected result
    1   Valid shipment submission           Shipment created with SUBMITTED status
    2   Required field missing              Validation error
    3   Route calculation success           Distance and ETA stored
    4   ML prediction success               AI price stored
    5   ML service unavailable              Fallback to rule price
    6   High weather risk                   Risk alert added
    7   Missing customs document            Customs flag/action required
    8   High composite risk                 Stronger human review required
    9   Agent modifies price                Reason and audit record stored
    10  Agent approves quote                Final quote sent to customer
    11  Customer accesses another quote     Access denied
    12  Customer accepts quote              Status updated to ACCEPTED
"""

import pytest
from rest_framework.test import APIClient

from accounts.tokens import create_token
from audit.models import AuditLog
from notifications.models import Notification
from pricing.ml_service import MLPricingService
from quotes.models import Quote, Shipment
from risk.models import RiskAlert
from weather.models import WeatherAlert
from weather.provider import WeatherProviderAdapter

# Chennai -> Rotterdam, 5,000 kg, 12 CBM, 40FT ocean (PDF section 8 test data).
MENTOR_SHIPMENT = {
    "origin": "Chennai",
    "destination": "Rotterdam",
    "cargoType": "Electronics",
    "weight": 5000.0,
    "volume": 12.0,
    "transportMode": "ocean",
    "containerType": "40FT",
}


def _headers(user_id, role, email):
    return {
        "HTTP_AUTHORIZATION": f"Bearer {create_token(user_id)}",
        "HTTP_X_CUSTOMER_ID": user_id,
        "HTTP_X_USER_ROLE": role,
        "HTTP_X_USER_EMAIL": email,
    }


@pytest.mark.django_db
class Test12CoreScenarios:
    def setup_method(self):
        self.client = APIClient()

        self.cust1_id = "CUST-1001"
        self.cust1_headers = _headers(self.cust1_id, "customer", "abc.electronics@freightai.com")

        self.cust2_id = "CUST-1002"
        self.cust2_headers = _headers(self.cust2_id, "customer", "competitor@example.com")

        self.agent_id = "AGENT-2001"
        self.agent_headers = _headers(self.agent_id, "agent", "agent@freightai.com")

        self.admin_id = "ADMIN-3001"
        self.admin_headers = _headers(self.admin_id, "admin", "admin@freightai.com")

    # -- helpers -------------------------------------------------------

    def _create_shipment(self, headers=None, **overrides):
        payload = {**MENTOR_SHIPMENT, **overrides}
        res = self.client.post(
            "/shipments", payload, format="json", **(headers or self.cust1_headers)
        )
        assert res.status_code == 201, res.json()
        return res.json()

    def _generate_quote(self, shipment_id, headers=None):
        res = self.client.post(
            f"/shipments/{shipment_id}/quote",
            {},
            format="json",
            **(headers or self.cust1_headers),
        )
        assert res.status_code == 201, res.json()
        return res.json()

    def _quote_ready_for_customer(self):
        """Drive a quote all the way to SENT so the customer can decide on it."""
        shipment = self._create_shipment()
        quote = self._generate_quote(shipment["id"])

        approve = self.client.post(
            f"/quotes/{quote['id']}/review",
            {"action": "approve", "reason": "Commercials verified."},
            format="json",
            **self.agent_headers,
        )
        assert approve.status_code == 200, approve.json()

        send = self.client.post(
            f"/quotes/{quote['id']}/review",
            {"action": "send"},
            format="json",
            **self.agent_headers,
        )
        assert send.status_code == 200, send.json()
        return shipment, send.json()["quote"]

    # ------------------------------------------------------------------
    # 1. Valid shipment submission -> Shipment created with SUBMITTED status
    # ------------------------------------------------------------------
    def test_01_valid_shipment_submission(self):
        data = self._create_shipment()

        assert data["origin"] == "Chennai"
        assert data["destination"] == "Rotterdam"
        assert data["weight"] == 5000.0
        assert data["customerId"] == self.cust1_id
        assert data["status"] == "SUBMITTED"

    # ------------------------------------------------------------------
    # 2. Required field missing -> Validation error
    # ------------------------------------------------------------------
    def test_02_required_field_missing(self):
        res = self.client.post(
            "/shipments", {"origin": "Chennai"}, format="json", **self.cust1_headers
        )
        assert res.status_code == 400
        assert "error" in res.json()
        assert not Shipment.objects.exists()

    # ------------------------------------------------------------------
    # 3. Route calculation success -> Distance and ETA stored
    # ------------------------------------------------------------------
    def test_03_route_calculation_success(self):
        shipment = self._create_shipment()
        quote = self._generate_quote(shipment["id"])

        assert quote["distanceKm"] > 5000
        assert quote["estimatedTransitDays"] is not None
        assert quote["estimatedTransitDays"] > 0
        assert quote["routePath"]

        # Persisted, not just returned.
        stored = Quote.objects.get(id=quote["id"])
        assert stored.distance > 5000
        assert stored.estimated_transit_days > 0

    # ------------------------------------------------------------------
    # 4. ML prediction success -> AI price stored
    # ------------------------------------------------------------------
    def test_04_ml_prediction_success(self):
        if MLPricingService.get_model() is None:
            pytest.skip("ML model artifact unavailable in this environment")

        shipment = self._create_shipment()
        quote = self._generate_quote(shipment["id"])

        stored = Quote.objects.get(id=quote["id"])
        assert stored.ml_status == "PREDICTED"
        assert stored.ai_predicted_price is not None
        assert stored.ai_predicted_price > 0
        assert stored.recommended_price is not None
        assert quote["aiPredictedPrice"] == stored.ai_predicted_price

    # ------------------------------------------------------------------
    # 5. ML service unavailable -> Fallback to rule price
    # ------------------------------------------------------------------
    def test_05_ml_service_unavailable_falls_back_to_rule(self, monkeypatch):
        # Simulate the model artifact being missing or unloadable.
        monkeypatch.setattr(MLPricingService, "get_model", classmethod(lambda cls: None))

        shipment = self._create_shipment()
        quote = self._generate_quote(shipment["id"])

        stored = Quote.objects.get(id=quote["id"])
        assert stored.ml_status == "FALLBACK_RULE"
        assert stored.ai_predicted_price == stored.total_price
        assert stored.total_price > 0
        # The customer still gets a usable quote.
        assert stored.recommended_price > 0

    # ------------------------------------------------------------------
    # 6. High weather risk -> Risk alert added
    # ------------------------------------------------------------------
    def test_06_high_weather_risk_raises_alert(self, monkeypatch):
        def storm(cls, lat, lon):
            return {
                "latitude": lat,
                "longitude": lon,
                "temperature": 24.0,
                "wind_speed": 68.0,
                "wind_direction": 210.0,
                "rainfall": 45.0,
                "wave_height": 7.8,
                "visibility": 1.2,
                "pressure": 968.0,
                "weather_condition": "Violent Storm",
                "storm_detected": True,
                "storm_type": "Tropical Cyclone",
                "storm_severity": "SEVERE",
                "provider": "test_storm_sim",
                "cached": False,
            }

        monkeypatch.setattr(
            WeatherProviderAdapter, "get_simulated_observation", classmethod(storm)
        )

        shipment = self._create_shipment()
        quote = self._generate_quote(shipment["id"])

        stored = Quote.objects.get(id=quote["id"])
        assert stored.weather_risk_score >= 60, "storm conditions must score as high weather risk"

        alerts = WeatherAlert.objects.filter(shipment_id=shipment["id"])
        assert alerts.exists(), "a severe weather alert should be recorded for the shipment"

        # The freight desk is told about it.
        assert Notification.objects.filter(
            recipient_role="agent", category="RISK", entity_id=quote["id"]
        ).exists()

    # ------------------------------------------------------------------
    # 7. Missing customs document -> Customs flag/action required
    # ------------------------------------------------------------------
    def test_07_missing_customs_document_raises_flag(self):
        shipment = self._create_shipment()
        quote = self._generate_quote(shipment["id"])

        customs = Quote.objects.get(id=quote["id"]).analysis["customs"]
        assert customs["documents_status"] == "MISSING"
        assert customs["missing_documents"], "mandatory documents should be listed as outstanding"
        assert customs["status"] == "NEEDS_DOCUMENTS"

        # The customs officer's queue is notified with an actionable item.
        assert Notification.objects.filter(
            recipient_role="customs", category="CUSTOMS", entity_id=shipment["id"]
        ).exists()

    # ------------------------------------------------------------------
    # 8. High composite risk -> Stronger human review required
    # ------------------------------------------------------------------
    def test_08_high_composite_risk_requires_stronger_review(self):
        shipment = self._create_shipment(
            cargoType="Arms & Munitions", hsCode="9302.00"
        )
        quote = self._generate_quote(shipment["id"])

        stored = Quote.objects.get(id=quote["id"])
        assert stored.overall_risk_level == "CRITICAL"
        assert stored.requires_human_review is True
        assert stored.policy_action == "BLOCK_QUOTE_ISSUANCE"

        # Approval is refused while the policy gate is closed.
        res = self.client.post(
            f"/quotes/{quote['id']}/review",
            {"action": "approve", "reason": "Attempting to push through."},
            format="json",
            **self.agent_headers,
        )
        assert res.status_code == 409
        stored.refresh_from_db()
        assert stored.status == "PENDING_REVIEW"

        assert RiskAlert.objects.filter(shipment_id=shipment["id"]).exists()

    # ------------------------------------------------------------------
    # 9. Agent modifies price -> Reason and audit record stored
    # ------------------------------------------------------------------
    def test_09_agent_modifies_price_stores_reason_and_audit(self):
        shipment = self._create_shipment()
        quote = self._generate_quote(shipment["id"])
        original_price = quote["totalPrice"]
        new_price = round(original_price * 0.95, 2)

        # A modification without a reason is refused.
        no_reason = self.client.post(
            f"/quotes/{quote['id']}/review",
            {"action": "modify", "total_price": new_price},
            format="json",
            **self.agent_headers,
        )
        assert no_reason.status_code == 400

        reason = "Matched competitor spot rate to retain the account."
        res = self.client.post(
            f"/quotes/{quote['id']}/review",
            {"action": "modify", "total_price": new_price, "reason": reason},
            format="json",
            **self.agent_headers,
        )
        assert res.status_code == 200, res.json()

        stored = Quote.objects.get(id=quote["id"])
        assert stored.total_price == new_price
        assert stored.original_total_price == original_price
        assert stored.review_reason == reason

        record = AuditLog.objects.filter(
            entity_type="QUOTE", entity_id=quote["id"], action="QUOTE_PRICE_MODIFIED"
        ).first()
        assert record is not None, "a price modification must leave an audit record"
        assert record.reason == reason
        assert record.actor_role == "agent"
        assert record.changes["total_price"]["from"] == original_price
        assert record.changes["total_price"]["to"] == new_price

    # ------------------------------------------------------------------
    # 10. Agent approves quote -> Final quote sent to customer
    # ------------------------------------------------------------------
    def test_10_agent_approves_quote_and_sends_it(self):
        shipment, quote = self._quote_ready_for_customer()

        stored = Quote.objects.get(id=quote["id"])
        assert stored.status == "SENT"
        assert stored.reviewed_by

        # The customer is told their quote is ready.
        assert Notification.objects.filter(
            recipient_id=self.cust1_id, entity_id=quote["id"], category="QUOTE"
        ).exists()

        # Both review actions are on the audit trail.
        actions = set(
            AuditLog.objects.filter(entity_type="QUOTE", entity_id=quote["id"]).values_list(
                "action", flat=True
            )
        )
        assert {"QUOTE_APPROVED", "QUOTE_SENT"} <= actions

    # ------------------------------------------------------------------
    # 11. Customer accesses another quote -> Access denied
    # ------------------------------------------------------------------
    def test_11_customer_cannot_access_another_customers_quote(self):
        shipment = self._create_shipment()
        quote = self._generate_quote(shipment["id"])

        # Reading someone else's quote.
        res = self.client.get(f"/quotes/{quote['id']}", **self.cust2_headers)
        assert res.status_code == 403

        # Generating against someone else's shipment.
        res = self.client.post(
            f"/shipments/{shipment['id']}/quote", {}, format="json", **self.cust2_headers
        )
        assert res.status_code == 403

        # Deciding on someone else's quote.
        res = self.client.post(
            f"/quotes/{quote['id']}/decision",
            {"decision": "ACCEPTED"},
            format="json",
            **self.cust2_headers,
        )
        assert res.status_code == 403

        # And a customer cannot use the agent review endpoint at all.
        res = self.client.post(
            f"/quotes/{quote['id']}/review",
            {"action": "approve"},
            format="json",
            **self.cust2_headers,
        )
        assert res.status_code == 403

    # ------------------------------------------------------------------
    # 12. Customer accepts quote -> Status updated to ACCEPTED
    # ------------------------------------------------------------------
    def test_12_customer_accepts_quote(self):
        shipment, quote = self._quote_ready_for_customer()

        res = self.client.post(
            f"/quotes/{quote['id']}/decision",
            {"decision": "ACCEPTED"},
            format="json",
            **self.cust1_headers,
        )
        assert res.status_code == 200, res.json()
        assert res.json()["quote"]["status"] == "ACCEPTED"

        stored = Quote.objects.get(id=quote["id"])
        assert stored.status == "ACCEPTED"

        # The shipment lifecycle closes out with it.
        assert Shipment.objects.get(id=shipment["id"]).status == "CLOSED"

        assert AuditLog.objects.filter(
            entity_type="QUOTE", entity_id=quote["id"], action="CUSTOMER_DECISION"
        ).exists()

    def test_12b_customer_cannot_accept_a_quote_still_in_review(self):
        """A quote that never reached the customer cannot be accepted."""
        shipment = self._create_shipment()
        quote = self._generate_quote(shipment["id"])

        res = self.client.post(
            f"/quotes/{quote['id']}/decision",
            {"decision": "ACCEPTED"},
            format="json",
            **self.cust1_headers,
        )
        assert res.status_code == 409
        assert Quote.objects.get(id=quote["id"]).status == "PENDING_REVIEW"
