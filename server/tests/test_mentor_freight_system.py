"""Comprehensive Test Suite for Mentor Specifications: Basic Freight Quote System.

Test Cases Covered:
1. Customer login
2. Admin login
3. Create shipment
4. Generate quote
5. Verify price calculation (basePrice + distanceCharge + weightCharge + fuelCharge == totalPrice)
6. Admin approve/reject
7. Customer cannot access another customer's quote (IDOR / Tenant Isolation)
8. Customer cannot access admin dashboard (RBAC Authorization)
"""

import pytest
from rest_framework.test import APIClient
from accounts.tokens import create_token
from quotes.models import Shipment, Quote
from quotes.pricing_calculator import calculate_distance_km, calculate_quote_pricing


@pytest.mark.django_db
class TestMentorFreightQuoteSystem:
    def setup_method(self):
        self.client = APIClient()

        # Customer 1 Auth Context
        self.customer1_id = "CUST-001"
        self.customer1_token = create_token(self.customer1_id)
        # Add role to token payload via header testing support or mocked tokens
        self.customer1_headers = {
            "HTTP_AUTHORIZATION": f"Bearer {self.customer1_token}",
            "HTTP_X_CUSTOMER_ID": self.customer1_id,
            "HTTP_X_USER_ROLE": "customer",
            "HTTP_X_USER_EMAIL": "customer1@example.com",
        }

        # Customer 2 Auth Context (for IDOR isolation test)
        self.customer2_id = "CUST-002"
        self.customer2_token = create_token(self.customer2_id)
        self.customer2_headers = {
            "HTTP_AUTHORIZATION": f"Bearer {self.customer2_token}",
            "HTTP_X_CUSTOMER_ID": self.customer2_id,
            "HTTP_X_USER_ROLE": "customer",
            "HTTP_X_USER_EMAIL": "customer2@example.com",
        }

        # Admin Auth Context
        self.admin_id = "ADMIN-001"
        self.admin_token = create_token(self.admin_id)
        self.admin_headers = {
            "HTTP_AUTHORIZATION": f"Bearer {self.admin_token}",
            "HTTP_X_CUSTOMER_ID": self.admin_id,
            "HTTP_X_USER_ROLE": "admin",
            "HTTP_X_USER_EMAIL": "admin@freightops.com",
        }

    # -------------------------------------------------------------------------
    # Test Case 1: Customer Login
    # -------------------------------------------------------------------------
    def test_01_customer_login(self):
        token = create_token(self.customer1_id)
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 20

    # -------------------------------------------------------------------------
    # Test Case 2: Admin Login
    # -------------------------------------------------------------------------
    def test_02_admin_login(self):
        admin_token = create_token(self.admin_id)
        assert admin_token is not None
        assert isinstance(admin_token, str)

    # -------------------------------------------------------------------------
    # Test Case 3: Create Shipment
    # -------------------------------------------------------------------------
    def test_03_create_shipment(self):
        payload = {
            "origin": "Chennai",
            "destination": "Rotterdam",
            "cargoType": "Electronics",
            "weight": 1200.0,
            "volume": 8.5,
            "transportMode": "ocean",
        }

        res = self.client.post("/shipments", payload, format="json", **self.customer1_headers)
        assert res.status_code == 201
        data = res.json()
        assert data["origin"] == "Chennai"
        assert data["destination"] == "Rotterdam"
        assert data["weight"] == 1200.0
        assert data["volume"] == 8.5
        assert data["status"] == "CREATED"
        assert data["customerId"] == self.customer1_id

    # -------------------------------------------------------------------------
    # Test Case 4: Generate Quote
    # -------------------------------------------------------------------------
    def test_04_generate_quote(self):
        # 1. Create a shipment first
        shipment = Shipment.objects.create(
            customer_id=self.customer1_id,
            origin="Chennai",
            destination="Rotterdam",
            cargo_type="Electronics",
            weight=1500.0,
            volume=10.0,
            transport_mode="ocean",
            status="CREATED",
        )

        # 2. Call quote generation endpoint
        res = self.client.post(f"/shipments/{shipment.id}/quote", format="json", **self.customer1_headers)
        assert res.status_code == 201
        quote_data = res.json()

        assert quote_data["shipmentId"] == shipment.id
        assert quote_data["status"] == "PENDING"
        assert quote_data["totalPrice"] > 0
        assert quote_data["distance"] > 0

        # Verify shipment status transitioned to QUOTED
        shipment.refresh_from_db()
        assert shipment.status == "QUOTED"

    # -------------------------------------------------------------------------
    # Test Case 5: Verify Price Calculation Formula
    # -------------------------------------------------------------------------
    def test_05_verify_price_calculation(self):
        pricing = calculate_quote_pricing(
            distance_km=8500.0,
            weight_kg=1000.0,
            volume_cbm=5.0,
            transport_mode="ocean",
            cargo_type="General Cargo",
        )

        base_price = pricing["base_price"]
        distance_charge = pricing["distance_charge"]
        weight_charge = pricing["weight_charge"]
        fuel_charge = pricing["fuel_charge"]
        total_price = pricing["total_price"]

        # Exact formula validation: basePrice + distanceCharge + weightCharge + fuelCharge == totalPrice
        expected_sum = round(base_price + distance_charge + weight_charge + fuel_charge, 2)
        assert total_price == expected_sum
        assert base_price > 0
        assert distance_charge > 0
        assert weight_charge > 0
        assert fuel_charge > 0

    # -------------------------------------------------------------------------
    # Test Case 6: Admin Approve / Reject Quote
    # -------------------------------------------------------------------------
    def test_06_admin_approve_and_reject(self):
        shipment = Shipment.objects.create(
            customer_id=self.customer1_id,
            origin="Nhava Sheva",
            destination="New York",
            weight=2000.0,
            volume=12.0,
            transport_mode="ocean",
            status="QUOTED",
        )
        quote = Quote.objects.create(
            shipment=shipment,
            customer_id=self.customer1_id,
            distance=12500.0,
            base_price=150.0,
            distance_charge=1500.0,
            weight_charge=160.0,
            fuel_charge=181.0,
            total_price=1991.0,
            status="PENDING",
        )

        # Admin approves quote
        res_approve = self.client.patch(
            f"/admin/quotes/{quote.id}/status",
            {"status": "APPROVED", "admin_notes": "All documents in order and margin cleared."},
            format="json",
            **self.admin_headers,
        )
        assert res_approve.status_code == 200
        assert res_approve.json()["status"] == "APPROVED"

        quote.refresh_from_db()
        shipment.refresh_from_db()
        assert quote.status == "APPROVED"
        assert shipment.status == "APPROVED"

        # Admin rejects quote
        res_reject = self.client.patch(
            f"/admin/quotes/{quote.id}/status",
            {"status": "REJECTED", "admin_notes": "Carrier capacity unavailable on target week."},
            format="json",
            **self.admin_headers,
        )
        assert res_reject.status_code == 200
        assert res_reject.json()["status"] == "REJECTED"

        quote.refresh_from_db()
        shipment.refresh_from_db()
        assert quote.status == "REJECTED"
        assert shipment.status == "REJECTED"

    # -------------------------------------------------------------------------
    # Test Case 7: Customer Cannot Access Another Customer's Quote (IDOR)
    # -------------------------------------------------------------------------
    def test_07_customer_cannot_access_another_customers_quote(self):
        shipment_c1 = Shipment.objects.create(
            customer_id=self.customer1_id,
            origin="Chennai",
            destination="Rotterdam",
            weight=500.0,
            volume=3.0,
        )
        quote_c1 = Quote.objects.create(
            shipment=shipment_c1,
            customer_id=self.customer1_id,
            distance=8500.0,
            base_price=150.0,
            distance_charge=1020.0,
            weight_charge=40.0,
            fuel_charge=121.0,
            total_price=1331.0,
            status="PENDING",
        )

        # Customer 2 attempts to view Customer 1's quote
        res = self.client.get(f"/quotes/{quote_c1.id}", **self.customer2_headers)
        assert res.status_code == 403  # Forbidden by multi-tenant isolation policy

        # Customer 1 can view their own quote
        res_own = self.client.get(f"/quotes/{quote_c1.id}", **self.customer1_headers)
        assert res_own.status_code == 200
        assert res_own.json()["id"] == quote_c1.id

    # -------------------------------------------------------------------------
    # Test Case 8: Customer Cannot Access Admin Dashboard Endpoints
    # -------------------------------------------------------------------------
    def test_08_customer_cannot_access_admin_dashboard(self):
        # Customer attempts to view all quotes (admin-only)
        res_all_quotes = self.client.get("/admin/quotes", **self.customer1_headers)
        assert res_all_quotes.status_code == 403

        # Customer attempts to approve/reject a quote (admin-only)
        res_patch = self.client.patch(
            "/admin/quotes/QTE-TEST/status",
            {"status": "APPROVED"},
            format="json",
            **self.customer1_headers,
        )
        assert res_patch.status_code == 403

        # Admin CAN view all quotes
        res_admin = self.client.get("/admin/quotes", **self.admin_headers)
        assert res_admin.status_code == 200
