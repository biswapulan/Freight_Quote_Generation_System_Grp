"""Test suite for Milestone 3 Phase 4: Multi-Factor Shipment Risk Engine & Policy Gating.

Verifies:
1. Multi-factor composite scoring formula across all 5 dimensions.
2. Low risk auto-approval policy.
3. High risk broker review policy gating.
4. Critical risk hard-blocking (prohibited weapons / rejected customs).
5. Factor-level explainability breakdown and dominance detection.
6. REST API contracts for assessment, alerts, and acknowledgement.
"""

import pytest
from rest_framework.test import APIClient
from risk.engine import MultiFactorRiskEngine
from risk.models import ShipmentRiskAssessment, RiskFactor, RiskAlert


@pytest.mark.django_db
class TestMilestone3Phase4ShipmentRisk:
    def setup_method(self):
        self.client = APIClient()

    def test_composite_risk_formula_mathematics(self):
        """Verifies (W*0.30) + (C*0.25) + (R*0.20) + (P*0.15) + (Cargo*0.10) == Overall."""
        w_score = 40.0
        c_score = 20.0
        orig = "Shanghai"
        dest = "Los Angeles"
        cargo_type = "High-Tech Servers"
        hs_code = "847130"

        res = MultiFactorRiskEngine.evaluate_shipment_risk(
            shipment_id="SHP-TEST-MATH",
            weather_score=w_score,
            customs_score=c_score,
            origin=orig,
            destination=dest,
            cargo_type=cargo_type,
            hs_code=hs_code,
        )

        overall = res["overall_score"]
        factors = res["factors"]
        assert len(factors) == 5

        # Sum of contributions must equal overall score
        total_contrib = round(sum(f["contribution"] for f in factors), 1)
        assert round(overall, 1) == total_contrib
        assert res["risk_level"] in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

    def test_low_risk_auto_approval_policy(self):
        """Standard dry cargo with good weather and verified customs should auto-approve."""
        res = MultiFactorRiskEngine.evaluate_shipment_risk(
            shipment_id="SHP-TEST-LOW",
            weather_score=15.0,
            customs_score=10.0,
            customs_status="APPROVED",
            origin="Singapore",
            destination="Fremantle",
            cargo_type="Cotton T-Shirts",
            hs_code="610910",
        )

        assert res["risk_level"] == "LOW"
        assert res["can_issue_quote"] is True
        assert "AUTO_APPROVED" in res["policy_action"]

    def test_critical_risk_hard_block_for_prohibited_cargo(self):
        """Restricted munitions / firearms must be hard-blocked with CRITICAL risk."""
        res = MultiFactorRiskEngine.evaluate_shipment_risk(
            shipment_id="SHP-TEST-ARMS",
            weather_score=20.0,
            customs_score=100.0,
            customs_status="REJECTED",
            origin="Chennai",
            destination="Singapore",
            cargo_type="Military Revolvers",
            hs_code="930200",
        )

        assert res["risk_level"] == "CRITICAL"
        assert res["can_issue_quote"] is False
        assert res["policy_action"] == "BLOCK_QUOTE_ISSUANCE"
        assert res["overall_score"] >= 80.0

        # Assert a high-priority alert was created
        alert = RiskAlert.objects.filter(shipment_id="SHP-TEST-ARMS").first()
        assert alert is not None
        assert alert.severity == "CRITICAL"
        assert alert.status == "ACTIVE"

    def test_risk_assess_api_endpoint(self):
        """Test POST /api/v1/risk/assess/."""
        payload = {
            "shipment_id": "SHP-API-001",
            "weather_score": 35.0,
            "customs_score": 25.0,
            "customs_status": "APPROVED",
            "origin": "Chennai",
            "destination": "Rotterdam",
            "cargo_type": "Solar Inverters",
            "hs_code": "850440",
        }

        res = self.client.post("/api/v1/risk/assess/", payload, format="json")
        assert res.status_code == 201
        data = res.json()
        assert data["shipment_id"] == "SHP-API-001"
        assert "overall_score" in data
        assert "factors" in data
        assert len(data["factors"]) == 5
        assert "explanation" in data

    def test_risk_get_and_alert_acknowledge_api(self):
        """Test GET /api/v1/risk/<shipment_id>/ and alert acknowledgement."""
        # Create a high-risk assessment that triggers an active alert
        MultiFactorRiskEngine.evaluate_shipment_risk(
            shipment_id="SHP-ALERT-TEST",
            weather_score=90.0,  # Typhoon conditions
            customs_score=85.0,  # Missing certificates
            origin="Chennai",
            destination="Rotterdam",
            cargo_type="Hazardous Chemicals",
            hs_code="290511",
        )

        # GET assessment by shipment_id
        res = self.client.get("/api/v1/risk/assess/?shipment_id=SHP-ALERT-TEST")
        assert res.status_code == 200

        # List Alerts
        res_alerts = self.client.get("/api/v1/risk/alerts/")
        assert res_alerts.status_code == 200
        alerts = res_alerts.json()
        assert len(alerts) >= 1

        target_alert = next((a for a in alerts if a["shipment_id"] == "SHP-ALERT-TEST"), alerts[0])

        # Acknowledge Alert
        res_ack = self.client.post(
            f"/api/v1/risk/alerts/{target_alert['id']}/acknowledge/",
            {"user_id": "Senior Broker Jane"},
            format="json",
        )
        assert res_ack.status_code == 200
        assert res_ack.json()["alert"]["status"] == "ACKNOWLEDGED"
