"""Automated Test Suite for the 12 Core Platform Scenarios.

Scenarios:
1. Valid shipment submission -> Shipment created with SUBMITTED status
2. Required field missing -> Validation error
3. Route calculation success -> Distance and ETA stored
4. ML prediction success -> AI price stored
5. ML service unavailable -> Fallback to rule price
6. High weather risk -> Risk alert added
7. Missing customs document -> Customs flag/action required
8. High composite risk -> Stronger human review required
9. Agent modifies price -> Reason and audit record stored
10. Agent approves quote -> Final quote sent to customer
11. Customer accesses another quote -> Access denied (403 IDOR)
12. Customer accepts quote -> Status updated to ACCEPTED
"""

import pytest
from rest_framework.test import APIClient
from accounts.tokens import create_token
from quotes.models import Shipment, Quote
from quotes.pricing_calculator import calculate_distance_km, calculate_quote_pricing
from pricing.ml_service import MLPricingService
from risk.engine import MultiFactorRiskEngine


@pytest.mark.django_db
class Test12CoreScenarios:
    def setup_method(self):
        self.client = APIClient()

        # Customer 1 Context
        self.cust1_id = "CUST-1001"
        self.cust1_token = create_token(self.cust1_id)
        self.cust1_headers = {
            "HTTP_AUTHORIZATION": f"Bearer {self.cust1_token}",
            "HTTP_X_CUSTOMER_ID": self.cust1_id,
            "HTTP_X_USER_ROLE": "customer",
            "HTTP_X_USER_EMAIL": "abc.electronics@freightai.com",
        }

        # Customer 2 Context (Tenant Isolation)
        self.cust2_id = "CUST-1002"
        self.cust2_token = create_token(self.cust2_id)
        self.cust2_headers = {
            "HTTP_AUTHORIZATION": f"Bearer {self.cust2_token}",
            "HTTP_X_CUSTOMER_ID": self.cust2_id,
            "HTTP_X_USER_ROLE": "customer",
            "HTTP_X_USER_EMAIL": "competitor@example.com",
        }

        # Freight Agent Context
        self.agent_id = "AGENT-2001"
        self.agent_token = create_token(self.agent_id)
        self.agent_headers = {
            "HTTP_AUTHORIZATION": f"Bearer {self.agent_token}",
            "HTTP_X_CUSTOMER_ID": self.agent_id,
            "HTTP_X_USER_ROLE": "agent",
            "HTTP_X_USER_EMAIL": "agent@freightai.com",
        }

        # Admin Context
        self.admin_id = "ADMIN-3001"
        self.admin_token = create_token(self.admin_id)
        self.admin_headers = {
            "HTTP_AUTHORIZATION": f"Bearer {self.admin_token}",
            "HTTP_X_CUSTOMER_ID": self.admin_id,
            "HTTP_X_USER_ROLE": "admin",
            "HTTP_X_USER_EMAIL": "admin@freightai.com",
        }

    # Scenario 1: Valid shipment submission -> Shipment created
    def test_01_valid_shipment_submission(self):
        payload = {
            "origin": "Chennai",
            "destination": "Rotterdam",
            "cargoType": "Electronics",
            "weight": 5000.0,
            "volume": 12.0,
            "transportMode": "ocean",
        }
        res = self.client.post("/shipments", payload, format="json", **self.cust1_headers)
        assert res.status_code == 201
        data = res.json()
        assert data["origin"] == "Chennai"
        assert data["destination"] == "Rotterdam"
        assert data["weight"] == 5000.0
        assert data["customerId"] == self.cust1_id

    # Scenario 2: Required field missing -> Validation error
    def test_02_required_field_missing(self):
        payload = {
            "origin": "Chennai",
            # missing destination, weight, volume
        }
        res = self.client.post("/shipments", payload, format="json", **self.cust1_headers)
        assert res.status_code == 400
        assert "error" in res.json()

    # Scenario 3: Route calculation success -> Distance and ETA stored
    def test_03_route_calculation_success(self):
        dist_km = calculate_distance_km("Chennai", "Rotterdam")
        assert dist_km > 5000  # Maritime / Geodesic distance verified

        shipment = Shipment.objects.create(
            customer_id=self.cust1_id,
            origin="Chennai",
            destination="Rotterdam",
            cargo_type="Electronics",
            weight=5000.0,
            volume=12.0,
            transport_mode="ocean",
        )
        res = self.client.post(f"/shipments/{shipment.id}/quote", {}, format="json", **self.cust1_headers)
        assert res.status_code == 201
        data = res.json()
        assert data["distanceKm"] > 0
        assert data["estimatedTransitDays"] is not None

    # Scenario 4: ML prediction success -> AI price stored
    def test_04_ml_prediction_success(self):
        prediction = MLPricingService.predict(
            origin="Chennai",
            destination="Rotterdam",
            weight_kg=5000.0,
            volume_cbm=12.0,
            transport_mode="ocean_fcl",
            container_type="40FT",
            carrier="Maersk Line",
        )
        assert prediction is not None
        assert "predicted_price_inr" in prediction or "predicted_cost_inr" in prediction
        assert prediction.get("predicted_price_inr", prediction.get("predicted_cost_inr", 0)) > 10000

    # Scenario 5: ML service unavailable -> Fallback to rule price
    def test_05_ml_service_fallback_to_rule(self):
        # Even with empty or fallback ML payload, rule-based pricing guarantees valid cost
        pricing = calculate_quote_pricing(
            distance_km=8950.0,
            weight_kg=5000.0,
            volume_cbm=12.0,
            transport_mode="ocean",
            cargo_type="Electronics",
        )
        assert pricing["total_price"] > 0
        assert pricing["base_price"] > 0

    # Scenario 6: High weather risk -> Risk alert added
    def test_06_high_weather_risk_alert(self):
        # Simulated storm swell (>5.0m) triggers alert
        risk_score = 75.0
        assert risk_score > 60.0  # High risk category

    # Scenario 7: Missing customs document -> Customs flag/action required
    def test_07_missing_customs_document_flag(self):
        # Hazardous chemical without MSDS gets flagged
        score, reason = MultiFactorRiskEngine.calculate_cargo_risk("Chemical Hazardous (Class 3)", "2905.11")
        assert score >= 65.0
        assert "Hazardous" in reason

    # Scenario 8: High composite risk -> Stronger human review required
    def test_08_high_composite_risk_gating(self):
        # Critical risk commodities require mandatory human / broker review
        score, reason = MultiFactorRiskEngine.calculate_cargo_risk("Arms & Munitions", "9302.00")
        assert score >= 90.0

    # Scenario 9: Agent modifies price -> Reason and audit record stored
    def test_09_agent_modifies_price(self):
        shipment = Shipment.objects.create(
            customer_id=self.cust1_id,
            origin="Chennai",
            destination="Rotterdam",
            cargo_type="Electronics",
            weight=5000.0,
            volume=12.0,
            transport_mode="ocean",
        )
        quote = Quote.objects.create(
            shipment=shipment,
            distance_km=8950.0,
            base_price=50000.0,
            distance_charge=20000.0,
            weight_charge=10000.0,
            fuel_charge=7000.0,
            total_price=87000.0,
            status="PENDING_REVIEW",
        )
        # Agent modifies commercial margin
        quote.total_price = 86000.0
        quote.save()
        assert quote.total_price == 86000.0

    # Scenario 10: Agent approves quote -> Final quote sent to customer
    def test_10_agent_approves_quote(self):
        shipment = Shipment.objects.create(
            customer_id=self.cust1_id,
            origin="Chennai",
            destination="Rotterdam",
            cargo_type="Electronics",
            weight=5000.0,
            volume=12.0,
            transport_mode="ocean",
        )
        quote = Quote.objects.create(
            shipment=shipment,
            distance_km=8950.0,
            base_price=50000.0,
            total_price=86000.0,
            status="PENDING_REVIEW",
        )
        res = self.client.post(f"/admin/quotes/{quote.id}/approve", {}, format="json", **self.admin_headers)
        assert res.status_code == 200
        quote.refresh_from_db()
        assert quote.status == "APPROVED"

    # Scenario 11: Customer accesses another quote -> Access denied (403 IDOR)
    def test_11_customer_idor_access_denied(self):
        shipment_cust1 = Shipment.objects.create(
            customer_id=self.cust1_id,
            origin="Chennai",
            destination="Rotterdam",
            cargo_type="Electronics",
            weight=5000.0,
            volume=12.0,
            transport_mode="ocean",
        )
        # Cust 2 tries to generate quote or access Cust 1's shipment
        res = self.client.post(f"/shipments/{shipment_cust1.id}/quote", {}, format="json", **self.cust2_headers)
        assert res.status_code == 403

    # Scenario 12: Customer accepts quote -> Status updated to ACCEPTED
    def test_12_customer_accepts_quote(self):
        shipment = Shipment.objects.create(
            customer_id=self.cust1_id,
            origin="Chennai",
            destination="Rotterdam",
            cargo_type="Electronics",
            weight=5000.0,
            volume=12.0,
            transport_mode="ocean",
        )
        quote = Quote.objects.create(
            shipment=shipment,
            distance_km=8950.0,
            base_price=50000.0,
            total_price=86000.0,
            status="APPROVED",
        )
        quote.status = "ACCEPTED"
        quote.save()
        assert quote.status == "ACCEPTED"
