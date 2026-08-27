"""Test suite for Milestone 3 Phase 5: Machine Learning Pricing Model (Trained on Mentor Dataset).

Dataset: freight_pricing_training_dataset_5000.xlsx (5,000 rows)
Verifies:
1. ML model inference and price generation (INR and USD).
2. Rule-based cost-plus formula comparison and variance calculation.
3. 95% Confidence Interval band computation.
4. Pricing strategy recommendation logic.
5. REST API endpoints for real-time inference and benchmark reports.
"""

import pytest
from rest_framework.test import APIClient
from pricing.ml_service import MLPricingService


@pytest.mark.django_db
class TestMilestone3Phase5MLPricing:
    def setup_method(self):
        self.client = APIClient()

    def test_ml_service_prediction_and_variance(self):
        """Verifies ML spot rate prediction and comparison against rule baseline."""
        res = MLPricingService.predict_freight_rate(
            origin_port="Bengaluru",
            destination_port="Los Angeles",
            transport_mode="Sea",
            cargo_type="Electronics",
            container_type="40FT",
            weight_kg=3200.0,
            volume_cbm=8.0,
            distance_km=14000.0,
            fuel_price=95.0,
            season="Peak",
            carrier="Carrier_A",
            transit_days=20,
        )

        assert "ml_predicted_price_inr" in res
        assert res["ml_predicted_price_inr"] > 0
        assert "ml_predicted_price_usd" in res
        assert res["ml_predicted_price_usd"] > 0
        assert "rule_based_price_inr" in res
        assert res["rule_based_price_inr"] > 0
        assert "variance_percent" in res
        assert "confidence_interval_95" in res
        assert res["confidence_interval_95"]["lower_inr"] <= res["ml_predicted_price_inr"] <= res["confidence_interval_95"]["upper_inr"]
        assert res["strategy"] in ["INCREASE_MARGIN", "DISCOUNT_TO_WIN", "OPTIMAL_MARKET_PARITY"]
        assert len(res["pricing_recommendation"]) > 10

    def test_rule_based_cost_plus_calculator(self):
        """Verifies deterministic rule cost calculations."""
        breakdown = MLPricingService.calculate_rule_price(
            origin="Chennai",
            destination="Rotterdam",
            distance_km=10000.0,
            weight_kg=20000.0,
            volume_cbm=40.0,
            transport_mode="Sea",
            container_type="20FT",
            cargo_type="General",
        )

        assert breakdown["base_rate_inr"] == 45000.0
        assert breakdown["distance_charge_inr"] == 45000.0  # 10000 * 4.5
        assert breakdown["weight_charge_inr"] == 24000.0    # (20000 / 1000) * 1200.0
        assert breakdown["fuel_charge_inr"] == 12000.0      # 10000 * 1.2
        assert breakdown["total_rule_price_inr"] == 126000.0

    def test_pricing_strategy_surge_recommendation(self):
        """High distance peak season shipment produces valid strategy and confidence bounds."""
        res = MLPricingService.predict_freight_rate(
            origin_port="Mumbai",
            destination_port="New York",
            transport_mode="Sea",
            cargo_type="Chemicals",
            container_type="40FT_HC",
            weight_kg=12000.0,
            volume_cbm=25.0,
            distance_km=15000.0,
            fuel_price=105.0,
            season="Peak",
            carrier="Carrier_B",
            transit_days=25,
        )

        assert res["strategy"] in ["INCREASE_MARGIN", "DISCOUNT_TO_WIN", "OPTIMAL_MARKET_PARITY"]
        assert res["confidence_interval_95"]["margin_of_error_inr"] > 0

    def test_ml_pricing_api_endpoint(self):
        """Test POST /api/v1/pricing/ml-predict/ with mentor schema parameters."""
        payload = {
            "Origin": "Chennai",
            "Destination": "Rotterdam",
            "Transport_Mode": "Sea",
            "Cargo_Type": "Machinery",
            "Container_Type": "40FT",
            "Weight_KG": 4500,
            "Volume_CBM": 12.0,
            "Distance_KM": 11500,
            "Fuel_Price": 92.5,
            "Season": "Peak",
            "Carrier": "Carrier_A",
            "Transit_Days": 22,
        }

        res = self.client.post("/api/v1/pricing/ml-predict/", payload, format="json")
        assert res.status_code == 200
        data = res.json()
        assert "ml_predicted_price_inr" in data
        assert "ml_predicted_price_usd" in data
        assert "rule_based_price_inr" in data
        assert "variance_percent" in data
        assert "confidence_interval_95" in data
        assert "market_drivers" in data

    def test_ml_benchmarks_api_endpoint(self):
        """Test GET /api/v1/pricing/benchmarks/."""
        res = self.client.get("/api/v1/pricing/benchmarks/")
        assert res.status_code == 200
        data = res.json()
        assert data["champion_model"] == "Gradient_Boosting_Regressor"
        assert "champion_metrics" in data
        assert data["champion_metrics"]["R2_Score"] >= 0.95
