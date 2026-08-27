import pytest
from rest_framework.test import APIClient
from customs.rag_engine import CustomsRAGEngine
from customs.validator import CustomsComplianceEngine
from customs.models import (
    CustomsComplianceCheck,
    CustomsChecklistItem,
    RegulationDocument,
    HSCodeReference,
    ShipmentDocument,
)


@pytest.mark.django_db
class TestMilestone3Phase3CustomsRAG:

    def test_rag_knowledge_base_seeding_and_search(self):
        CustomsRAGEngine.initialize_knowledge_base()
        assert RegulationDocument.objects.count() >= 4
        assert HSCodeReference.objects.count() >= 5

        # Hybrid RAG search for Netherlands / EU electronics
        results = CustomsRAGEngine.search_regulations(
            query="electronic power converters CE declaration of conformity",
            country="Netherlands",
            hs_code="850440",
            top_k=3,
        )
        assert len(results) >= 1
        top_match = results[0]
        assert "EU_TAXUD" in top_match["authority"] or "Netherlands" in top_match["country"]
        assert "citation" in top_match
        assert top_match["hybrid_score"] > 0.1

    def test_compliance_engine_standard_cargo(self):
        result = CustomsComplianceEngine.evaluate_shipment_compliance(
            shipment_id="SHP-CUST-01",
            origin_country="India",
            destination_country="Netherlands",
            hs_code="850440",
            commodity="Static Inverters",
            incoterm="CIF",
        )
        assert result["status"] == "APPROVED"
        assert result["readiness_score"] >= 80.0
        assert result["is_prohibited"] is False

        item_names = [item["item_name"] for item in result["checklist_items"]]
        assert any("Commercial Invoice" in n for n in item_names)
        assert any("Certificate of Origin" in n for n in item_names)
        assert any("Conformity" in n for n in item_names)

    def test_compliance_engine_hazardous_chemical(self):
        result = CustomsComplianceEngine.evaluate_shipment_compliance(
            shipment_id="SHP-CUST-02",
            origin_country="India",
            destination_country="USA",
            hs_code="290511",
            commodity="Methanol Chemical Solvent",
            incoterm="FOB",
        )
        assert result["is_restricted"] is True
        assert result["status"] == "NEEDS_REVIEW"
        item_names = [item["item_name"] for item in result["checklist_items"]]
        assert any("Safety Data Sheet" in n or "MSDS" in n for n in item_names)

    def test_compliance_engine_prohibited_munitions(self):
        result = CustomsComplianceEngine.evaluate_shipment_compliance(
            shipment_id="SHP-CUST-03",
            origin_country="India",
            destination_country="Singapore",
            hs_code="930200",
            commodity="Pistols & Handguns",
            incoterm="CIF",
        )
        assert result["is_prohibited"] is True
        assert result["status"] == "REJECTED"
        assert result["readiness_score"] == 0.0

    def test_customs_validate_api_endpoint(self):
        client = APIClient()
        payload = {
            "shipment_id": "SHP-API-CUST-01",
            "origin_country": "India",
            "destination_country": "Netherlands",
            "hs_code": "850440",
            "commodity": "Solar Power Converters",
            "incoterm": "CIF",
        }
        res = client.post("/api/v1/customs/validate/", payload, format="json")
        assert res.status_code == 201
        assert res.data["shipment_id"] == "SHP-API-CUST-01"
        assert "checklist_items" in res.data
        assert "regulatory_evidence" in res.data

    def test_customs_document_upload_and_readiness_recalc(self):
        client = APIClient()
        # First validate shipment
        val_res = client.post(
            "/api/v1/customs/validate/",
            {"shipment_id": "SHP-DOC-01", "origin_country": "India", "destination_country": "UAE", "hs_code": "850440"},
            format="json",
        )
        assert val_res.status_code == 201
        item_id = val_res.data["checklist_items"][0]["id"]

        # Upload document against first item
        upload_res = client.post(
            "/api/v1/customs/documents/upload/",
            {
                "shipment_id": "SHP-DOC-01",
                "checklist_item_id": item_id,
                "document_type": "COMMERCIAL_INVOICE",
                "file_name": "invoice_1001.pdf",
            },
            format="json",
        )
        assert upload_res.status_code == 201
        assert upload_res.data["document"]["verification_status"] == "VERIFIED"
        assert upload_res.data["compliance_check"]["readiness_score"] > 70.0

    def test_customs_sign_off_api_endpoint(self):
        client = APIClient()
        val_res = client.post(
            "/api/v1/customs/validate/",
            {"shipment_id": "SHP-SIGNOFF-01", "origin_country": "India", "destination_country": "Netherlands", "hs_code": "850440"},
            format="json",
        )
        check_id = val_res.data["id"]

        sign_off_res = client.post(
            f"/api/v1/customs/{check_id}/sign-off/",
            {"decision": "APPROVED", "officer_name": "Officer Smith", "comments": "All documentation verified"},
            format="json",
        )
        assert sign_off_res.status_code == 200
        assert sign_off_res.data["compliance_check"]["status"] == "APPROVED"
        assert sign_off_res.data["compliance_check"]["readiness_score"] >= 95.0

    def test_regulation_search_and_hs_codes_endpoints(self):
        client = APIClient()
        search_res = client.post(
            "/api/v1/regulations/search/",
            {"query": "Entry Summary Declaration ENS 24 hours", "country": "Netherlands"},
            format="json",
        )
        assert search_res.status_code == 200
        assert search_res.data["total_matches"] >= 1

        hs_res = client.get("/api/v1/customs/hs-codes/")
        assert hs_res.status_code == 200
        assert len(hs_res.data) >= 5
