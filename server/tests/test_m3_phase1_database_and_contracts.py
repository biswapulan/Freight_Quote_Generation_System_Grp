import pytest
from django.utils import timezone
from weather.models import WeatherAssessment, WeatherObservation, WeatherAlert
from customs.models import (
    HSCodeReference,
    RegulationDocument,
    RegulationChunk,
    CustomsRequirement,
    CustomsComplianceCheck,
    CustomsChecklistItem,
    ShipmentDocument,
)
from risk.models import ShipmentRiskAssessment, RiskFactor, RiskAlert
from integrations.models import DataFreshness, IntegrationSyncLog, AlertSubscription
from rest_framework.test import APIClient


@pytest.mark.django_db
class TestMilestone3Phase1DatabaseAndContracts:

    def test_weather_models_and_relationships(self):
        assessment = WeatherAssessment.objects.create(
            shipment_id="SHP-TEST-001",
            route_id="ROUTE-TEST-001",
            risk_score=42.5,
            risk_level="MEDIUM",
            storm_risk=20.0,
            wind_risk=35.0,
            wave_risk=45.0,
            delay_probability=0.38,
            assessment_status="COMPLETED",
        )
        assert assessment.id is not None
        assert assessment.risk_level == "MEDIUM"

        obs = WeatherObservation.objects.create(
            route_id="ROUTE-TEST-001",
            weather_assessment=assessment,
            latitude=13.0827,
            longitude=80.2707,
            temperature=28.5,
            wind_speed=22.0,
            wave_height=2.8,
            weather_condition="Moderate Swell",
        )
        assert obs.weather_assessment == assessment
        assert assessment.observations.count() == 1

        alert = WeatherAlert.objects.create(
            shipment_id="SHP-TEST-001",
            route_id="ROUTE-TEST-001",
            alert_type="GALE_WARNING",
            severity="HIGH",
            title="High Gale Warning in Bay of Bengal",
            message="Sustained winds over 35 knots expected.",
        )
        assert alert.severity == "HIGH"
        assert alert.status == "ACTIVE"

    def test_customs_models_and_relationships(self):
        hs = HSCodeReference.objects.create(
            hs_code="850440",
            description="Static converters; power supplies",
            chapter="85",
            heading="04",
            commodity_type="Electronics",
            restricted=False,
            prohibited=False,
        )
        assert hs.hs_code == "850440"

        reg_doc = RegulationDocument.objects.create(
            title="EU Union Customs Code Tariff Guide",
            country="EU",
            authority="EU_TAXUD",
            document_type="TARIFF_SCHEDULE",
            content="Import guidelines for electronic machinery and converters into the European Single Market.",
        )
        chunk = RegulationChunk.objects.create(
            regulation_document=reg_doc,
            chunk_index=0,
            content="Article 44: Conformity certificates and CE marking mandatory for power electronics.",
        )
        assert reg_doc.chunks.count() == 1

        check = CustomsComplianceCheck.objects.create(
            shipment_id="SHP-TEST-002",
            origin_country="India",
            destination_country="Netherlands",
            hs_code="850440",
            commodity="Power Supply Inverters",
            incoterm="CIF",
            readiness_score=90.0,
            risk_level="LOW",
            status="APPROVED",
        )
        item = CustomsChecklistItem.objects.create(
            compliance_check=check,
            item_name="Certificate of Conformity (CE)",
            mandatory=True,
            status="VERIFIED",
            citation="EU TAXUD Section 4.2",
        )
        assert check.checklist_items.count() == 1

        doc = ShipmentDocument.objects.create(
            shipment_id="SHP-TEST-002",
            customs_check=check,
            checklist_item=item,
            document_type="CE_CERTIFICATE",
            file_name="ce_cert_850440.pdf",
            file_url="https://storage.local/docs/ce_cert_850440.pdf",
            verification_status="VERIFIED",
        )
        assert check.documents.count() == 1

    def test_risk_models_and_explainability(self):
        risk = ShipmentRiskAssessment.objects.create(
            shipment_id="SHP-TEST-003",
            weather_score=30.0,
            customs_score=20.0,
            route_score=25.0,
            port_score=15.0,
            cargo_score=10.0,
            overall_score=22.5,
            risk_level="LOW",
            explanation={"summary": "Low overall risk profile.", "dominant_factor": "Weather"},
        )
        assert risk.overall_score == 22.5

        factor = RiskFactor.objects.create(
            risk_assessment=risk,
            factor_type="WEATHER",
            factor_name="Marine Weather",
            score=30.0,
            weight=0.30,
            contribution=9.0,
            severity="LOW",
            reason="Mild seasonal monsoon conditions.",
        )
        assert risk.factors.count() == 1

        alert = RiskAlert.objects.create(
            shipment_id="SHP-TEST-003",
            risk_assessment=risk,
            severity="LOW",
            title="Standard Route Assessment",
            message="No critical risk thresholds breached.",
        )
        assert alert.status == "ACTIVE"

    def test_integrations_and_freshness_models(self):
        freshness = DataFreshness.objects.create(
            provider="open-meteo",
            data_type="WEATHER_FORECAST",
            status="HEALTHY",
            freshness_seconds=120,
        )
        assert freshness.provider == "open-meteo"

        log = IntegrationSyncLog.objects.create(
            provider="open-meteo",
            integration_type="HOURLY_SYNC",
            status="SUCCESS",
            records_processed=150,
        )
        assert log.status == "SUCCESS"

    def test_weather_api_contracts(self):
        client = APIClient()
        payload = {
            "shipment_id": "SHP-API-001",
            "route_id": "RT-API-001",
            "waypoints": [{"lat": 13.08, "lon": 80.27}, {"lat": 12.92, "lon": 81.15}],
        }
        res = client.post("/api/v1/weather/assess/", payload, format="json")
        assert res.status_code == 201
        assert res.data["shipment_id"] == "SHP-API-001"
        assert "risk_score" in res.data
        assert "delay_probability" in res.data

        get_res = client.get(f"/api/v1/weather/assess/SHP-API-001/")
        assert get_res.status_code == 200
        assert get_res.data["shipment_id"] == "SHP-API-001"

    def test_customs_api_contracts(self):
        client = APIClient()
        payload = {
            "shipment_id": "SHP-API-002",
            "origin_country": "India",
            "destination_country": "Netherlands",
            "hs_code": "850440",
            "commodity": "Electrical Converters",
            "incoterm": "CIF",
        }
        res = client.post("/api/v1/customs/validate/", payload, format="json")
        assert res.status_code == 201
        assert res.data["shipment_id"] == "SHP-API-002"
        assert "checklist_items" in res.data
        assert len(res.data["checklist_items"]) >= 2

        check_id = res.data["id"]
        sign_off_res = client.post(
            f"/api/v1/customs/{check_id}/sign-off/",
            {"decision": "APPROVED", "officer_name": "Senior Officer Jane Doe", "comments": "All items verified"},
            format="json",
        )
        assert sign_off_res.status_code == 200
        assert sign_off_res.data["compliance_check"]["status"] == "APPROVED"

    def test_risk_api_contracts(self):
        client = APIClient()
        payload = {
            "shipment_id": "SHP-API-003",
            "quote_id": "QT-003",
            "weather_score": 40.0,
            "customs_score": 20.0,
            "route_score": 30.0,
            "port_score": 25.0,
            "cargo_score": 15.0,
        }
        res = client.post("/api/v1/risk/assess/", payload, format="json")
        assert res.status_code == 201
        assert res.data["shipment_id"] == "SHP-API-003"
        assert "overall_score" in res.data
        assert "factors" in res.data
        assert len(res.data["factors"]) >= 3
