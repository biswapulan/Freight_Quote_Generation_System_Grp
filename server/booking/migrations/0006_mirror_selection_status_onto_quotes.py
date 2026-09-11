"""Bring every quote and shipment into line with its company selection.

Until M4 statuses were mirrored onto the quote, a quote the company had
verified and booked still said PENDING_REVIEW and its shipment QUOTED. This
applies booking.services' mapping once, to records made before. The mapping is
copied rather than imported, so this migration keeps its meaning if the
services module changes later.
"""

from django.db import migrations

QUOTE_STATUS_FOR = {
    "QUOTE_SELECTED": "PENDING_REVIEW",
    "PENDING_COMPANY_VERIFICATION": "PENDING_REVIEW",
    "UNDER_VERIFICATION": "PENDING_REVIEW",
    "AWAITING_CUSTOMER_INFO": "PENDING_REVIEW",
    "ESCALATED": "PENDING_REVIEW",
    "REVISION_PENDING_CUSTOMER": "SENT",
    "REVISION_ACCEPTED": "APPROVED",
    "APPROVED": "APPROVED",
    "BOOKING_CONFIRMED": "ACCEPTED",
    "REJECTED": "REJECTED",
    "RESELECT_QUOTE": "REJECTED",
    "BOOKING_CANCELLED": "REJECTED",
}
SHIPMENT_STATUS_FOR = {"BOOKING_CONFIRMED": "CLOSED", "BOOKING_CANCELLED": "CANCELLED"}


def mirror(apps, schema_editor):
    QuoteSelection = apps.get_model("booking", "QuoteSelection")
    Quote = apps.get_model("quotes", "Quote")
    Shipment = apps.get_model("quotes", "Shipment")

    speaking = {}
    for selection in QuoteSelection.objects.order_by("created_at"):
        current = speaking.get(selection.quote_id)
        # The live selection speaks for its quote; failing that, the newest.
        if current is None or selection.is_active or not current.is_active:
            speaking[selection.quote_id] = selection

    for quote_id, selection in speaking.items():
        quote_status = QUOTE_STATUS_FOR.get(selection.status)
        if quote_status:
            Quote.objects.filter(id=quote_id).update(status=quote_status)
        Shipment.objects.filter(id=selection.shipment_id).update(
            status=SHIPMENT_STATUS_FOR.get(selection.status, "QUOTED")
        )


class Migration(migrations.Migration):
    dependencies = [
        ("booking", "0005_company_quote_ai_market_factor"),
        ("quotes", "0003_quote_assigned_agent_email_quote_assigned_agent_name_and_more"),
    ]

    operations = [migrations.RunPython(mirror, migrations.RunPython.noop)]
