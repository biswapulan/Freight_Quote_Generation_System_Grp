"""Upload a shipment's required papers and review them, as the M4 tests need.

Nothing about a document is automatic: the customer uploads each paper, and
the chosen company's agent and customs each open and verify it. Tests that
take a request through approval or clearance do those steps first.
"""

from django.core.files.uploadedfile import SimpleUploadedFile

from booking.models import QuoteSelection
from customs.models import ShipmentDocument
from customs.paperwork import required_names


def upload_papers(client, selection_ref, customer):
    """The customer uploads every paper the lane requires."""
    selection = QuoteSelection.objects.select_related("quote").get(reference=selection_ref)
    for name in required_names(selection.quote) or ["Commercial Invoice"]:
        slug = "".join(ch for ch in name if ch.isalnum())[:40] or "paper"
        response = client.post(
            "/api/v1/customs/documents/upload/",
            {
                "shipment_id": selection.shipment_id,
                "document_type": name,
                "file": SimpleUploadedFile(
                    f"{slug}.pdf", b"%PDF-1.4 test paper", content_type="application/pdf"
                ),
            },
            format="multipart",
            **customer,
        )
        assert response.status_code == 201, response.data


def company_verifies(client, selection_ref, agent):
    """The company's agent opens each paper and verifies it."""
    selection = QuoteSelection.objects.select_related("verification").get(reference=selection_ref)
    reference = selection.verification.reference
    for doc in ShipmentDocument.objects.filter(shipment_id=selection.shipment_id):
        opened = client.get(f"/api/v1/customs/documents/{doc.id}/file/", **agent)
        assert opened.status_code == 200, getattr(opened, "data", opened.status_code)
        reviewed = client.post(
            f"/api/verification-requests/{reference}/documents/{doc.id}/review",
            {"decision": "VERIFIED"},
            format="json",
            **agent,
        )
        assert reviewed.status_code == 200, reviewed.data


def customs_verifies(client, selection_ref, officer):
    """A customs officer opens each paper and verifies it."""
    selection = QuoteSelection.objects.get(reference=selection_ref)
    for doc in ShipmentDocument.objects.filter(shipment_id=selection.shipment_id):
        opened = client.get(f"/api/v1/customs/documents/{doc.id}/file/", **officer)
        assert opened.status_code == 200, getattr(opened, "data", opened.status_code)
        verified = client.post(
            f"/api/v1/customs/documents/{doc.id}/verify/",
            {"decision": "VERIFIED", "officer_name": "Customs officer"},
            format="json",
            **officer,
        )
        assert verified.status_code == 200, verified.data


def papers_ready_for_company(client, selection_ref, customer, agent):
    """Uploaded by the customer, then opened and verified by the company's agent."""
    upload_papers(client, selection_ref, customer)
    company_verifies(client, selection_ref, agent)
