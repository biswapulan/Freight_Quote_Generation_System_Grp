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
    QuoteRevision,
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


# --- Agent decisions (milestone document section 5) -------------------------
#
# Each action maps to exactly one status, and every one of them requires a
# reason. "No silent changes" and "every modification needs a reason" are
# stated business rules, so the reason is validated here rather than left to
# whichever screen happens to call in.

ACTION_APPROVE = "APPROVE"
ACTION_MODIFY = "MODIFY"
ACTION_REJECT = "REJECT"
ACTION_REQUEST_INFO = "REQUEST_INFO"
ACTION_ESCALATE = "ESCALATE"

ACTION_TARGETS = {
    ACTION_APPROVE: lifecycle.APPROVED,
    ACTION_MODIFY: lifecycle.REVISION_PENDING_CUSTOMER,
    ACTION_REJECT: lifecycle.REJECTED,
    ACTION_REQUEST_INFO: lifecycle.AWAITING_CUSTOMER_INFO,
    ACTION_ESCALATE: lifecycle.ESCALATED,
}


class DecisionError(ValueError):
    """A decision the workflow will not accept, with a reason for the agent."""


@transaction.atomic
def submit_decision(request_obj, *, action, actor, reason="", revision=None,
                    requested_information=None):
    """Record one agent decision on a verification request.

    `revision` carries the new commercial terms for a MODIFY. The original
    terms are never touched: they stay on the selection, and the counter-offer
    becomes a QuoteRevision the customer can accept or decline.
    """
    action = (action or "").upper()
    if action not in ACTION_TARGETS:
        raise DecisionError(
            f"Unknown action '{action}'. Expected one of: "
            + ", ".join(sorted(ACTION_TARGETS))
        )

    reason = (reason or "").strip()
    if not reason:
        raise DecisionError(
            "A reason is required. It is shown to the customer and kept in the "
            "audit trail."
        )

    selection = request_obj.selection

    # Duplicate prevention (milestone test scenario 11). A request that has
    # already been decided is not quietly overwritten by a second agent.
    if request_obj.decided_at and request_obj.status not in lifecycle.AGENT_ACTIONABLE:
        raise DecisionError(
            f"This request was already decided as {request_obj.status} by "
            f"{request_obj.decided_by_email or 'another agent'}."
        )

    # An agent deciding straight from the queue has not hit the detail view, so
    # the request is still merely pending. Open it here rather than refusing the
    # decision with a state-machine message they cannot act on.
    if selection.status == lifecycle.PENDING_COMPANY_VERIFICATION:
        selection.status = lifecycle.UNDER_VERIFICATION
        selection.save(update_fields=["status", "updated_at"])
        record_status(
            selection,
            old=lifecycle.PENDING_COMPANY_VERIFICATION,
            new=lifecycle.UNDER_VERIFICATION,
            actor=actor,
            reason=f"Opened by {actor.get('email', 'agent')} to decide.",
        )

    target = ACTION_TARGETS[action]
    try:
        lifecycle.assert_transition(selection.status, target)
    except lifecycle.InvalidSelectionTransitionError as exc:
        raise DecisionError(str(exc)) from exc

    created_revision = None
    if action == ACTION_MODIFY:
        created_revision = _create_revision(
            selection, request_obj, revision or {}, actor=actor, reason=reason
        )

    if action == ACTION_REQUEST_INFO:
        items = [str(i).strip() for i in (requested_information or []) if str(i).strip()]
        if not items:
            raise DecisionError(
                "List what the customer must provide, so they know what is missing."
            )
        request_obj.requested_information = items

    now = timezone.now()
    request_obj.decided_at = now
    request_obj.decided_by_email = actor.get("email", "")
    request_obj.decision_reason = reason
    request_obj.status = target
    if not request_obj.opened_at:
        request_obj.opened_at = now
    request_obj.save(
        update_fields=[
            "decided_at",
            "decided_by_email",
            "decision_reason",
            "status",
            "opened_at",
            "requested_information",
            "updated_at",
        ]
    )

    context = {"action": action, "agent": actor.get("email", "")}
    if created_revision:
        context.update(
            {
                "revision": created_revision.reference,
                "price_from": created_revision.original_total_price,
                "price_to": created_revision.revised_total_price,
            }
        )
    if action == ACTION_REQUEST_INFO:
        context["requested"] = request_obj.requested_information

    old = selection.status
    selection.status = target
    selection.save(update_fields=["status", "updated_at"])
    record_status(
        selection, old=old, new=target, actor=actor, reason=reason, context=context
    )

    return request_obj, created_revision


def _create_revision(selection, request_obj, payload, *, actor, reason):
    """Build the counter-offer, leaving the selected terms untouched."""
    offer = selection.company_quote

    try:
        revised_price = float(payload.get("total_price"))
    except (TypeError, ValueError):
        raise DecisionError("A revised total price is required to modify an offer.")

    if revised_price <= 0:
        raise DecisionError("The revised price must be greater than zero.")

    revised_transit = payload.get("transit_days")
    try:
        revised_transit = int(revised_transit) if revised_transit is not None else None
    except (TypeError, ValueError):
        revised_transit = None

    # Prices are shown rounded, so an agent retyping the figure they can see
    # must not create a revision worth a few paise. Anything under one unit of
    # currency is the same offer.
    price_moved = abs(revised_price - selection.selected_total_price) >= 1.0
    transit_moved = (
        revised_transit is not None
        and revised_transit != selection.selected_transit_days
    )
    unchanged = not price_moved and not transit_moved
    if unchanged:
        raise DecisionError(
            "Nothing changed. Approve the request instead of modifying it."
        )

    # Earlier counter-offers stop being the live one, but are kept.
    selection.revisions.filter(status="PENDING_CUSTOMER").update(status="SUPERSEDED")

    next_number = (
        selection.revisions.order_by("-revision_number")
        .values_list("revision_number", flat=True)
        .first()
        or 0
    ) + 1

    def _num(key, fallback):
        try:
            return float(payload[key])
        except (KeyError, TypeError, ValueError):
            return fallback

    return QuoteRevision.objects.create(
        selection=selection,
        request=request_obj,
        revision_number=next_number,
        original_total_price=selection.selected_total_price,
        original_transit_days=selection.selected_transit_days,
        revised_total_price=round(revised_price, 2),
        revised_transit_days=revised_transit,
        revised_base_freight=_num("base_freight", offer.base_freight),
        revised_fuel_surcharge=_num("fuel_surcharge", offer.fuel_surcharge),
        revised_handling_fee=_num("handling_fee", offer.handling_fee),
        revised_documentation_fee=_num("documentation_fee", offer.documentation_fee),
        currency=selection.selected_currency,
        reason=reason,
        created_by_email=actor.get("email", ""),
        status="PENDING_CUSTOMER",
    )


def notify_customer_of_decision(request_obj, revision=None):
    """Tell the customer what the company decided, and what it means for them.

    A decision the customer never sees is the same as no decision: they would
    sit waiting on a request that had already been rejected or revised.
    """
    from notifications import service as notify

    selection = request_obj.selection
    company = request_obj.company.name
    ref = selection.reference
    status_now = request_obj.status
    reason = request_obj.decision_reason

    if status_now == lifecycle.APPROVED:
        title = f"{company} approved your shipment"
        body = (
            f"Your selected quote {ref} has been verified and approved. "
            "Confirm the booking to secure the space."
        )
        severity = "SUCCESS"
    elif status_now == lifecycle.REVISION_PENDING_CUSTOMER and revision:
        direction = "increased" if revision.price_delta > 0 else "reduced"
        title = f"{company} revised your quote"
        body = (
            f"The price has {direction} from {revision.currency} "
            f"{revision.original_total_price:,.0f} to {revision.currency} "
            f"{revision.revised_total_price:,.0f} "
            f"({revision.price_delta_pct:+.1f}%). Reason: {reason} "
            "Accept the revision or choose another company."
        )
        severity = "WARNING"
    elif status_now == lifecycle.REJECTED:
        title = f"{company} could not take this shipment"
        body = f"Reason: {reason} You can select another company's offer."
        severity = "WARNING"
    elif status_now == lifecycle.AWAITING_CUSTOMER_INFO:
        items = ", ".join(request_obj.requested_information or [])
        title = f"{company} needs more information"
        body = f"Please provide: {items}. {reason}"
        severity = "WARNING"
    elif status_now == lifecycle.ESCALATED:
        title = f"{company} is reviewing your request further"
        body = f"This shipment needs manager approval. {reason}"
        severity = "INFO"
    else:
        return None

    return notify.notify_user(
        selection.customer_id,
        title,
        body,
        category="QUOTE",
        severity=severity,
        entity_type="QUOTE_SELECTION",
        entity_id=str(selection.id),
        link="/dashboard/my-quotes",
    )
