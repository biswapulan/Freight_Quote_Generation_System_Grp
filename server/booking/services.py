"""Selection and verification services for M4.

Creating a selection is not a single write. It freezes the commercial terms,
stands the other offers down, opens a verification request in exactly one
company's queue, lays out that company's checklist, records the status move and
tells the agent. Doing it in one place keeps those from drifting apart.
"""

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from companies.models import CompanyAgent

from . import lifecycle
from .models import (
    CompanyQuote,
    QuoteSelection,
    StatusHistory,
    VerificationCheck,
    VerificationRequest,
)

# The agent's checklist from milestone document section 5. Every request gets
# the same nine lines, so a decision is never recorded against a blank one.
CHECKLIST = [
    ("SHIPMENT", "Origin, destination, cargo description and requested date"),
    ("CARGO", "Weight, volume and any special handling requirement"),
    ("CAPACITY", "Container, vehicle or vessel space available for these dates"),
    ("ROUTE", "Route is operationally feasible for this company"),
    ("SCHEDULE", "Pickup window and arrival estimate can be met"),
    ("DOCUMENTS", "Invoice, packing list and regulatory paperwork present"),
    ("COMMERCIAL", "Base rate, fuel and handling charges still hold"),
    ("RISK", "Weather, customs and route alerts from the risk analysis"),
    ("VALIDITY", "Offer is still within its validity period"),
]

# How long a company has to respond before the request is flagged as overdue.
DEFAULT_SLA_HOURS = 6.0


def record_status(selection, *, old, new, actor=None, reason="", context=None):
    """Write one line of the selection's audit trail."""
    actor = actor or {}
    return StatusHistory.objects.create(
        selection=selection,
        old_status=old or "",
        new_status=new,
        changed_by_email=actor.get("email", "") or "",
        changed_by_role=(actor.get("role") or "") or "",
        reason=reason or "",
        context=context,
    )


def primary_agent_for(company):
    """The membership that should receive this company's work.

    Managers first, then the longest-standing agent, so a request always lands
    with somebody rather than sitting in an unassigned pile.
    """
    return (
        CompanyAgent.objects.filter(company=company, is_active=True)
        .order_by("-role", "created_at")
        .first()
    )


@transaction.atomic
def create_selection(*, quote, company_quote, actor):
    """Record the customer's choice and open the company's verification.

    Raises ValueError when the offer cannot be taken forward, so the caller can
    turn that into a useful message rather than a generic failure.
    """
    if company_quote.quote_id != quote.id:
        raise ValueError("That offer does not belong to this quote.")
    if company_quote.is_expired:
        raise ValueError(
            f"{company_quote.company.name}'s offer expired on "
            f"{company_quote.valid_until:%d %b %Y}. Refresh the options for a current price."
        )

    company = company_quote.company
    if not company.is_bookable:
        raise ValueError(f"{company.name} is not currently accepting bookings.")

    # One live selection per shipment. An earlier one is stood down rather than
    # deleted, so the history of what the customer tried survives.
    superseded = QuoteSelection.objects.filter(
        shipment=quote.shipment, is_active=True
    ).exclude(company_quote=company_quote)
    for old in superseded:
        old.is_active = False
        old.save(update_fields=["is_active", "updated_at"])
        record_status(
            old,
            old=old.status,
            new=lifecycle.RESELECT_QUOTE,
            actor=actor,
            reason="Customer selected a different company.",
        )

    selection, created = QuoteSelection.objects.get_or_create(
        company_quote=company_quote,
        defaults={
            "shipment": quote.shipment,
            "quote": quote,
            "company": company,
            "customer_id": actor.get("id", ""),
            "customer_email": actor.get("email", ""),
            "selected_total_price": company_quote.total_price,
            "selected_currency": company_quote.currency,
            "selected_transit_days": company_quote.transit_days,
            "selected_valid_until": company_quote.valid_until,
            "status": lifecycle.SELECTED,
        },
    )

    if not created:
        # Re-selecting the same offer revives it rather than making a duplicate.
        selection.is_active = True
        selection.save(update_fields=["is_active", "updated_at"])
        return selection, getattr(selection, "verification", None), False

    record_status(
        selection,
        old=lifecycle.OPTIONS_AVAILABLE,
        new=lifecycle.SELECTED,
        actor=actor,
        reason=f"Customer selected {company.name}.",
        context={
            "company": company.code,
            "price": company_quote.total_price,
            "currency": company_quote.currency,
        },
    )

    # Mark the offers so the customer's comparison reflects the decision.
    CompanyQuote.objects.filter(quote=quote).exclude(id=company_quote.id).update(
        status="NOT_SELECTED"
    )
    company_quote.status = "SELECTED"
    company_quote.save(update_fields=["status", "updated_at"])

    membership = primary_agent_for(company)
    sla_hours = company.average_response_hours or DEFAULT_SLA_HOURS

    request = VerificationRequest.objects.create(
        selection=selection,
        company=company,
        assigned_agent_email=(membership.user_email if membership else ""),
        assigned_agent_name=(
            membership.display_name or membership.user_email if membership else ""
        ),
        status=lifecycle.PENDING_COMPANY_VERIFICATION,
        sla_due_at=timezone.now() + timedelta(hours=sla_hours),
    )

    VerificationCheck.objects.bulk_create(
        [
            VerificationCheck(request=request, area=area, prompt=prompt)
            for area, prompt in CHECKLIST
        ]
    )

    selection.status = lifecycle.PENDING_COMPANY_VERIFICATION
    selection.save(update_fields=["status", "updated_at"])
    record_status(
        selection,
        old=lifecycle.SELECTED,
        new=lifecycle.PENDING_COMPANY_VERIFICATION,
        actor={"email": "system", "role": "system"},
        reason=f"Sent to {company.name} for verification.",
        context={"verification_reference": request.reference},
    )

    return selection, request, True


@transaction.atomic
def move_selection(selection, target, *, actor, reason="", context=None):
    """Move a selection to a new status, refusing anything off the workflow."""
    lifecycle.assert_transition(selection.status, target)

    old = selection.status
    selection.status = target
    selection.save(update_fields=["status", "updated_at"])

    request = getattr(selection, "verification", None)
    if request:
        request.status = target
        request.save(update_fields=["status", "updated_at"])

    record_status(
        selection, old=old, new=target, actor=actor, reason=reason, context=context
    )
    return selection
