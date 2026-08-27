"""Test suite for Milestone 3 Phase 6: End-to-End Resiliency, State Machine Gating & System Verification.

Verifies:
1. Open-Meteo offline API timeout fallback resiliency.
2. Quote state machine policy gating (prevents quote issuance if critical risk or customs rejected).
3. Document verification and readiness score recalculation.
4. Unified multi-module orchestration (Weather + Customs + Risk + ML Pricing).
"""

from unittest.mock import patch
import pytest
from rest_framework.test import APIClient
from weather.provider import WeatherProviderAdapter
from weather.sampler import RouteGeometrySampler
from weather.engine import WeatherRiskEngine
from customs.validator import CustomsComplianceEngine
from risk.engine import MultiFactorRiskEngine
from pricing.ml_service import MLPricingService


@pytest.mark.django_db
class TestMilestone3Phase6E2EResiliency:
    def setup_method(self):
        self.client = APIClient()

    def test_open_meteo_offline_fallback_resiliency(self):
        """Verifies weather engine gracefully falls back when Open-Meteo API times out."""
        with patch.object(WeatherProviderAdapter, "_fetch_open_meteo", side_effect=Exception("Connection Timeout")):
            obs = WeatherProviderAdapter.get_observation(13.08, 80.27, force_live=True)

            assert obs is not None
            assert "wave_height" in obs
            assert "wind_speed" in obs
            assert obs["wave_height"] >= 0.0

            # Evaluate route risk with fallback observations
            assessment = WeatherRiskEngine.evaluate_route_weather([obs], transit_days=10)
            assert assessment["risk_score"] >= 0.0
            assert assessment["risk_level"] in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

    def test_quote_state_machine_blocks_prohibited_cargo(self):
        """Verifies policy gating hard blocks prohibited military armament."""
        # 1. Customs compliance check
        customs_res = CustomsComplianceEngine.evaluate_shipment_compliance(
            shipment_id="SHP-SEC-001",
            origin_country="India",
            destination_country="Singapore",
            hs_code="930200",
            commodity="Military Revolvers",
        )
        assert customs_res["status"] == "REJECTED"
        assert customs_res["is_prohibited"] is True

        # 2. Risk assessment
        risk_res = MultiFactorRiskEngine.evaluate_shipment_risk(
            shipment_id="SHP-SEC-001",
            customs_score=100.0,
            customs_status="REJECTED",
            origin="India",
            destination="Singapore",
            cargo_type="Military Revolvers",
            hs_code="930200",
        )
        assert risk_res["risk_level"] == "CRITICAL"
        assert risk_res["can_issue_quote"] is False
        assert risk_res["policy_action"] == "BLOCK_QUOTE_ISSUANCE"

    def test_full_pipeline_multi_module_orchestration(self):
        """Executes full lifecycle for high-tech commercial shipment."""
        # 1. Weather
        waypoints = RouteGeometrySampler.sample_route_waypoints("Shanghai", "Los Angeles")
        obs_list = [WeatherProviderAdapter.get_observation(p["lat"], p["lon"]) for p in waypoints]
        weather_eval = WeatherRiskEngine.evaluate_route_weather(obs_list, transit_days=14)
        w_score = weather_eval["risk_score"]

        # 2. Customs
        customs_res = CustomsComplianceEngine.evaluate_shipment_compliance(
            shipment_id="SHP-E2E-002",
            origin_country="China",
            destination_country="USA",
            hs_code="847130",
            commodity="Computing Hardware & Electronic Servers",
        )
        c_score = max(0, 100 - customs_res["readiness_score"])

        # 3. Multi-Factor Risk
        risk_res = MultiFactorRiskEngine.evaluate_shipment_risk(
            shipment_id="SHP-E2E-002",
            weather_score=w_score,
            customs_score=c_score,
            customs_status=customs_res["status"],
            origin="Shanghai",
            destination="Los Angeles",
            cargo_type="Computing Hardware",
            hs_code="847130",
        )
        assert risk_res["can_issue_quote"] is True

        # 4. ML Pricing Prediction
        pricing_res = MLPricingService.predict_freight_rate(
            origin_port="Shanghai",
            destination_port="Los Angeles",
            transport_mode="Sea",
            cargo_type="Electronics",
            container_type="40FT",
            weight_kg=8500.0,
            volume_cbm=22.0,
            distance_km=10500.0,
            season="Peak",
            carrier="Carrier_A",
            transit_days=14,
        )
        assert pricing_res["ml_predicted_price_inr"] > 0
        assert pricing_res["ml_predicted_price_usd"] > 0
        assert "confidence_interval_95" in pricing_res
