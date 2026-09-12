"""Which of a shipment's required papers are on file, and who has checked them.

The quote keeps the customs checklist as it stood when the quote was
generated, so read on its own it goes on calling a paper "outstanding" after
the customer has uploaded it. These helpers read the uploads as they are now.

Two reviewers check every paper and neither verdict is automatic: the chosen
company's agent reads it for carriage before approving, and customs reads it
for compliance before clearing.
"""

from .models import ShipmentDocument

COMPANY = "company"
CUSTOMS = "customs"

# A required paper takes the best verdict among its uploads.
_ORDER = ("VERIFIED", "PENDING", "REJECTED")


def _key(text):
    return "".join(ch for ch in (text or "").lower() if ch.isalnum())


def required_names(quote):
    """The papers M3's customs check requires for this quote's lane and cargo."""
    customs = ((quote.analysis or {}).get("customs") or {}) if quote else {}
    names = [
        item.get("item_name")
        for item in customs.get("checklist_items") or []
        if item.get("item_name")
    ]
    return names or list(customs.get("missing_documents") or [])


def _matches(document, name):
    # Customers name uploads in their own words ("Bill of Lading" for
    # "Bill of Lading / Sea Waybill (B/L)"), so match loosely.
    upload, wanted = _key(document.document_type), _key(name)
    return bool(upload) and (upload in wanted or wanted in upload)


def _verdict(document, reviewer, company_code):
    if reviewer == COMPANY:
        return document.company_status(company_code)
    return document.verification_status


def _best(verdicts):
    for verdict in _ORDER:
        if verdict in verdicts:
            return verdict
    return "MISSING"


def paperwork(quote, *, shipment_id=None, company_code=""):
    """Each required paper: whether it is on file, and each reviewer's verdict."""
    shipment_id = shipment_id or getattr(quote, "shipment_id", None)
    documents = (
        list(ShipmentDocument.objects.filter(shipment_id=shipment_id))
        if shipment_id
        else []
    )
    rows = []
    for name in required_names(quote):
        matched = [d for d in documents if _matches(d, name)]
        rows.append(
            {
                "name": name,
                "onFile": bool(matched),
                "companyStatus": _best({_verdict(d, COMPANY, company_code) for d in matched}),
                "customsStatus": _best({_verdict(d, CUSTOMS, company_code) for d in matched}),
                # Any company's verdict, for alerts that are not about one company.
                "companyAnyStatus": _best({d.agent_status for d in matched}),
            }
        )
    return rows, documents


def readiness(quote, reviewer, *, shipment_id=None, company_code=""):
    """How far one reviewer has got through the papers, and what is left.

    Ready means every required paper is on file and verified by this reviewer,
    and no uploaded paper is still waiting for them to open it.
    """
    rows, documents = paperwork(quote, shipment_id=shipment_id, company_code=company_code)
    field = "companyStatus" if reviewer == COMPANY else "customsStatus"
    names = [r["name"] for r in rows]

    missing = [r["name"] for r in rows if not r["onFile"]]
    rejected = [r["name"] for r in rows if r["onFile"] and r[field] == "REJECTED"]
    to_check = [r["name"] for r in rows if r["onFile"] and r[field] == "PENDING"]

    # Anything else the customer uploaded has to be looked at too.
    seen = {_key(n) for n in to_check}
    for document in documents:
        if _verdict(document, reviewer, company_code) != "PENDING":
            continue
        if any(_matches(document, n) for n in names) or _key(document.document_type) in seen:
            continue
        to_check.append(document.document_type)
        seen.add(_key(document.document_type))

    return {
        "required": len(rows),
        "verified": sum(1 for r in rows if r[field] == "VERIFIED"),
        "missing": missing,
        "rejected": rejected,
        "toCheck": to_check,
        "ready": not missing and not rejected and not to_check,
    }


def readiness_problem(quote, reviewer, *, shipment_id=None, company_code=""):
    """Why this reviewer cannot sign off yet, as one sentence, or ""."""
    state = readiness(quote, reviewer, shipment_id=shipment_id, company_code=company_code)
    if state["ready"]:
        return ""
    parts = []
    if state["missing"]:
        parts.append("not uploaded yet: " + ", ".join(state["missing"]))
    if state["rejected"]:
        parts.append("rejected, waiting for a new upload: " + ", ".join(state["rejected"]))
    if state["toCheck"]:
        parts.append("still to open and verify: " + ", ".join(state["toCheck"]))
    return "The documents are not ready (" + "; ".join(parts) + ")."
