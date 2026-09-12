"""Selection and verification services for M4.

Creating a selection is not a single write. It freezes the commercial terms,
stands the other offers down, opens a verification request in exactly one
company's queue, lays out that company's checklist, records the status move and
tells the agent. Doing it in one place keeps those from drifting apart.
"""

import logging
from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from companies.models import CompanyAgent

logger = logging.getLogger(__name__)

from . import lifecycle
from .models import (
    Booking,
    CompanyQuote,
    CustomsClearance,
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


def safe_notify(send, *args, **kwargs):
    """Dispatch a notification without letting it undo the work it describes.

    Every decision here runs inside a transaction, so an exception raised while
    telling somebody about it would roll the decision back: a booking would
    vanish because the mailer was down. Milestone scenario 13 asks for the
    workflow to survive a notification failure, so a send that fails is logged
    and dropped rather than propagated.
    """
    try:
        return send(*args, **kwargs)
    except Exception:  # noqa: BLE001 - a message must never cost us the record
        logger.exception("Notification failed; the workflow change stands.")
        return None


def record_status(selection, *, old, new, actor=None, reason="", context=None):
    """Write one line of the selection's audit trail, and mirror it onto the quote."""
    actor = actor or {}
    entry = StatusHistory.objects.create(
        selection=selection,
        old_status=old or "",
        new_status=new,
        changed_by_email=actor.get("email", "") or "",
        changed_by_role=(actor.get("role") or "") or "",
        reason=reason or "",
        context=context,
    )
    mirror_onto_quote(selection, new, actor=actor)
    return entry


# How a selection's progress reads on the quote and shipment it came from. My
# Quotes and My Shipments show those two records, and nothing updated them
# once a company was chosen: a quote the company had verified and booked still
# said PENDING_REVIEW, and its shipment QUOTED.
QUOTE_STATUS_FOR = {
    lifecycle.SELECTED: "PENDING_REVIEW",
    lifecycle.PENDING_COMPANY_VERIFICATION: "PENDING_REVIEW",
    lifecycle.UNDER_VERIFICATION: "PENDING_REVIEW",
    lifecycle.AWAITING_CUSTOMER_INFO: "PENDING_REVIEW",
    lifecycle.ESCALATED: "PENDING_REVIEW",
    # A revised offer is with the customer to accept or decline.
    lifecycle.REVISION_PENDING_CUSTOMER: "SENT",
    lifecycle.REVISION_ACCEPTED: "APPROVED",
    lifecycle.APPROVED: "APPROVED",
    # Approved by the company and now with customs.
    lifecycle.PENDING_CUSTOMS_REVIEW: "APPROVED",
    # Cleared by customs: the final quote is with the customer to accept.
    lifecycle.CUSTOMS_CLEARED: "SENT",
    lifecycle.CUSTOMS_REJECTED: "REJECTED",
    lifecycle.BOOKING_CONFIRMED: "ACCEPTED",
    lifecycle.REJECTED: "REJECTED",
    lifecycle.RESELECT_QUOTE: "REJECTED",
    lifecycle.BOOKING_CANCELLED: "REJECTED",
}

# The shipment stays open while a company may still carry it, and closes the
# way the customer's own acceptance of a quote closes it.
SHIPMENT_STATUS_FOR = {
    lifecycle.BOOKING_CONFIRMED: "CLOSED",
    lifecycle.BOOKING_CANCELLED: "CANCELLED",
}


def mirror_onto_quote(selection, status, *, actor=None):
    """Make the quote and shipment say what the customer's selection says.

    Only the live selection speaks for a quote; one the customer has walked
    away from does not, unless nothing has replaced it. The quote's own
    transition graph is bypassed on purpose: the M4 state machine has already
    validated this move, and the legacy graph has no way back from REJECTED
    for a customer who picks another company after a rejection.
    """
    from audit import service as audit_service

    replaced = (
        QuoteSelection.objects.filter(quote_id=selection.quote_id, is_active=True)
        .exclude(pk=selection.pk)
        .exists()
    )
    if replaced:
        return

    quote = selection.quote
    actor = actor or {}
    targets = (
        (quote, QUOTE_STATUS_FOR.get(status), "QUOTE", audit_service.QUOTE_STATUS_CHANGED),
        (
            quote.shipment,
            SHIPMENT_STATUS_FOR.get(status, "QUOTED"),
            "SHIPMENT",
            audit_service.SHIPMENT_STATUS_CHANGED,
        ),
    )
    for record, target, kind, action in targets:
        if not target or record.status == target:
            continue
        previous = record.status
        record.status = target
        record.save(update_fields=["status", "updated_at"])
        audit_service.record(
            actor_id=actor.get("id") or actor.get("email") or "system",
            actor_role=actor.get("role") or "system",
            actor_email=actor.get("email", ""),
            action=action,
            entity_type=kind,
            entity_id=record.id,
            reason=f"Follows {selection.reference} ({status}).",
            changes={"status": {"from": previous, "to": target}},
        )


def primary_agent_for(company):
    """The membership that should receive this company's routine work.

    Agents first, the longest-standing one, because managers are there for the
    cases agents escalate to them. A company with only managers still gets its
    work, so a request never sits in an unassigned pile.
    """
    return (
        CompanyAgent.objects.filter(company=company, is_active=True)
        .order_by("role", "created_at")
        .first()
    )


def managers_for(company):
    """The company's active managers, who decide escalated requests."""
    return CompanyAgent.objects.filter(company=company, is_active=True, role="MANAGER")


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
    # A request customs rejected is closed even though its offer is not, so
    # choosing that company again stands it down and starts a fresh one.
    closed = sorted(lifecycle.TERMINAL | {lifecycle.CUSTOMS_REJECTED})
    superseded = QuoteSelection.objects.filter(
        shipment=quote.shipment, is_active=True
    ).exclude(Q(company_quote=company_quote) & ~Q(status__in=closed))
    for old in superseded:
        # Apply the move as well as recording it. Writing only the history line
        # left the status saying UNDER_VERIFICATION on a selection the customer
        # had already walked away from.
        previous = old.status
        old.is_active = False
        old.status = lifecycle.RESELECT_QUOTE
        old.save(update_fields=["is_active", "status", "updated_at"])
        record_status(
            old,
            old=previous,
            new=lifecycle.RESELECT_QUOTE,
            actor=actor,
            reason="Customer selected a different company.",
        )

    # Only reuse a selection that is still live. One that was rejected or
    # declined has reached a terminal status, so reviving it would drop the
    # customer back into a dead end; they get a fresh selection instead.
    existing = (
        QuoteSelection.objects.filter(company_quote=company_quote)
        .exclude(status__in=closed)
        .order_by("-created_at")
        .first()
    )
    if existing:
        existing.is_active = True
        existing.save(update_fields=["is_active", "updated_at"])
        return existing, getattr(existing, "verification", None), False

    selection = QuoteSelection.objects.create(
        shipment=quote.shipment,
        quote=quote,
        company=company,
        company_quote=company_quote,
        customer_id=actor.get("id", ""),
        customer_email=actor.get("email", ""),
        selected_total_price=company_quote.total_price,
        selected_currency=company_quote.currency,
        selected_transit_days=company_quote.transit_days,
        selected_valid_until=company_quote.valid_until,
        status=lifecycle.SELECTED,
    )

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


def manager_approval_reason(request_obj, actor, *, amount=None):
    """Why this commitment needs a company manager, or "" if the agent may make it.

    The company decides what counts as special (M4 roles: "optional approval
    for special/high-value cases"): a value above which a manager must approve,
    and whether high-risk shipments need one. A manager is never stopped, nor
    is a request already with a manager. A company with no active manager is
    not stopped either, because escalating would strand the request.
    """
    if request_obj.status == lifecycle.ESCALATED:
        return ""
    company = request_obj.company
    managers = managers_for(company)
    if not managers.exists():
        return ""
    if managers.filter(user_email__iexact=actor.get("email", "")).exists():
        return ""

    selection = request_obj.selection
    value = amount if amount is not None else selection.selected_total_price
    limit = company.manager_approval_threshold
    currency = selection.selected_currency
    if limit and value and value > limit:
        return (
            f"{currency} {value:,.0f} is above {company.name}'s manager approval "
            f"limit of {currency} {limit:,.0f}."
        )

    offer = selection.company_quote
    risk = ((offer.risk_level if offer else "") or "").upper()
    if company.manager_approval_high_risk and risk in ("HIGH", "CRITICAL"):
        return f"The shipment is assessed {risk} risk."
    return ""


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

    # The company commits to carrying the shipment only once its agent has
    # opened and verified every paper. Nothing about a document is automatic.
    if action in (ACTION_APPROVE, ACTION_MODIFY):
        from customs.paperwork import COMPANY, readiness_problem

        problem = readiness_problem(
            selection.quote,
            COMPANY,
            shipment_id=selection.shipment_id,
            company_code=selection.company.code,
        )
        if problem:
            raise DecisionError(
                f"{problem} Open and verify each document before you "
                f"{'approve' if action == ACTION_APPROVE else 'revise'} this request."
            )

    # Special and high-value cases need a company manager (M4 roles). An agent's
    # approval of one goes to a manager instead of becoming a booking, and an
    # agent may not reach the same commitment through a revision either.
    if action in (ACTION_APPROVE, ACTION_MODIFY):
        amount = None
        if action == ACTION_MODIFY:
            try:
                amount = float((revision or {}).get("total_price"))
            except (TypeError, ValueError):
                amount = None  # _create_revision reports the missing price
        needs_manager = manager_approval_reason(request_obj, actor, amount=amount)
        if needs_manager and action == ACTION_APPROVE:
            action = ACTION_ESCALATE
            reason = f"{needs_manager} The agent recommends approval: {reason}"
        elif needs_manager:
            raise DecisionError(
                f"{needs_manager} Escalate it so a manager can revise or approve it."
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

    if action == ACTION_REJECT:
        # The company said it cannot carry this shipment, so its offer stops
        # being selectable rather than sitting there to be picked again.
        offer = selection.company_quote
        offer.status = "WITHDRAWN"
        offer.save(update_fields=["status", "updated_at"])

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

    # An approved request is not a booking yet. Customs clears the consignment
    # first, and the customer then confirms or declines it.
    if target == lifecycle.APPROVED:
        send_to_customs(
            selection,
            actor={"email": "system", "role": "system"},
            note=(
                f"Approved by {actor.get('email', 'the company')}; sent to "
                "customs for clearance."
            ),
        )
        selection.refresh_from_db()

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

    if status_now in (lifecycle.APPROVED, lifecycle.PENDING_CUSTOMS_REVIEW):
        title = f"{company} approved your shipment"
        # Approval sends the request to customs; the customer's turn comes
        # once customs has cleared it.
        body = (
            f"{company} verified and approved {ref}. Customs is now checking the "
            "consignment. Once it is cleared you confirm or decline the booking "
            "in Selected Quotes."
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

    return safe_notify(
        notify.notify_user,
        selection.customer_id,
        title,
        body,
        category="QUOTE",
        severity=severity,
        entity_type="QUOTE_SELECTION",
        entity_id=str(selection.id),
        # Where the customer accepts a revision or answers a request.
        link="/dashboard/selected-quotes",
    )


def notify_managers_of_escalation(request_obj):
    """Tell the company's managers a request is waiting for their decision."""
    from companies.access import resolve_user_id
    from notifications import service as notify

    for manager in managers_for(request_obj.company):
        recipient = manager.user_id or resolve_user_id(manager.user_email)
        if not recipient:
            continue
        safe_notify(
            notify.notify_user,
            recipient,
            f"Manager approval needed: {request_obj.reference}",
            request_obj.decision_reason,
            category="QUOTE",
            severity="WARNING",
            entity_type="VERIFICATION_REQUEST",
            entity_id=request_obj.reference,
            link="/dashboard/manager-approvals",
        )


# --- Customer responses (document section 3, steps 12-13) -------------------


class CustomerResponseError(ValueError):
    """A customer response the workflow will not accept, with the reason."""


def _notify_company(selection, title, body, severity="INFO"):
    """Tell the company's agent that the ball is back in their court."""
    from notifications import service as notify

    request_obj = getattr(selection, "verification", None)
    recipient = (
        request_obj.assigned_agent_email
        if request_obj and request_obj.assigned_agent_email
        else None
    )
    if not recipient:
        membership = primary_agent_for(selection.company)
        recipient = membership.user_email if membership else None
    if not recipient:
        return None

    # The inbox is keyed by user id, not email, so resolve before sending.
    from companies.access import resolve_user_id

    recipient_id = resolve_user_id(recipient) or recipient

    return safe_notify(
        notify.notify_user,
        recipient_id,
        title,
        body,
        category="QUOTE",
        severity=severity,
        entity_type="QUOTE_SELECTION",
        entity_id=str(selection.id),
        link="/dashboard/pending-verification",
    )


@transaction.atomic
def respond_to_revision(selection, *, decision, actor, note=""):
    """The customer accepts or declines the company's counter-offer.

    Accepting takes the revised terms as the agreed ones. Declining does not
    cancel the shipment: it releases the customer to choose another company,
    which is the milestone's fallback rule.
    """
    decision = (decision or "").upper()
    if decision not in ("ACCEPT", "DECLINE"):
        raise CustomerResponseError("Decision must be ACCEPT or DECLINE.")

    if selection.status != lifecycle.REVISION_PENDING_CUSTOMER:
        raise CustomerResponseError(
            f"There is no revision waiting on you. This request is "
            f"{selection.status}."
        )

    revision = selection.revisions.filter(status="PENDING_CUSTOMER").first()
    if not revision:
        raise CustomerResponseError("No pending revision found for this request.")

    now = timezone.now()
    revision.customer_responded_at = now
    revision.customer_response_note = (note or "").strip()

    if decision == "ACCEPT":
        revision.status = "ACCEPTED"
        revision.save(
            update_fields=[
                "status",
                "customer_responded_at",
                "customer_response_note",
                "updated_at",
            ]
        )

        # The revised terms become the offer. The selection keeps its original
        # snapshot, so what the customer first agreed to stays visible beside
        # what they ended up with.
        offer = selection.company_quote
        offer.total_price = revision.revised_total_price
        if revision.revised_transit_days is not None:
            offer.transit_days = revision.revised_transit_days
        for field, value in (
            ("base_freight", revision.revised_base_freight),
            ("fuel_surcharge", revision.revised_fuel_surcharge),
            ("handling_fee", revision.revised_handling_fee),
            ("documentation_fee", revision.revised_documentation_fee),
        ):
            if value is not None:
                setattr(offer, field, value)
        offer.save()

        move_selection(
            selection,
            lifecycle.REVISION_ACCEPTED,
            actor=actor,
            reason=note or "Customer accepted the revised terms.",
            context={
                "revision": revision.reference,
                "agreed_price": revision.revised_total_price,
            },
        )

        # The company proposed these terms, so accepting them settles the
        # verification: there is nothing left for the agent to decide.
        move_selection(
            selection,
            lifecycle.APPROVED,
            actor={"email": "system", "role": "system"},
            reason=f"Revised terms accepted by the customer ({revision.reference}).",
        )

        send_to_customs(
            selection,
            actor={"email": "system", "role": "system"},
            note=(
                f"Revised terms accepted ({revision.reference}); sent to customs "
                "for clearance."
            ),
        )
        selection.refresh_from_db()

        _notify_company(
            selection,
            f"Revision accepted on {selection.reference}",
            (
                f"The customer accepted {revision.currency} "
                f"{revision.revised_total_price:,.0f}. The request is approved and "
                "has gone to customs for clearance."
            ),
            severity="SUCCESS",
        )
        return selection, revision

    revision.status = "DECLINED"
    revision.save(
        update_fields=[
            "status",
            "customer_responded_at",
            "customer_response_note",
            "updated_at",
        ]
    )

    move_selection(
        selection,
        lifecycle.RESELECT_QUOTE,
        actor=actor,
        reason=note or "Customer declined the revised terms.",
        context={"revision": revision.reference},
    )
    selection.is_active = False
    selection.save(update_fields=["is_active", "updated_at"])

    _notify_company(
        selection,
        f"Revision declined on {selection.reference}",
        f"The customer declined the revised terms. Reason: {note or 'none given'}",
        severity="WARNING",
    )
    return selection, revision


@transaction.atomic
def provide_requested_information(selection, *, actor, note="", provided=None):
    """The customer answers the company's request for more detail.

    Sends the request back to the agent rather than approving anything: the
    company still has to look at what arrived.
    """
    if selection.status != lifecycle.AWAITING_CUSTOMER_INFO:
        raise CustomerResponseError(
            f"This request is not waiting on information from you. It is "
            f"{selection.status}."
        )

    note = (note or "").strip()
    provided = [str(p).strip() for p in (provided or []) if str(p).strip()]
    if not note and not provided:
        raise CustomerResponseError(
            "Describe what you are providing, or list the items supplied."
        )

    request_obj = getattr(selection, "verification", None)
    if request_obj:
        # Reopen for decision: the previous decision has been answered.
        request_obj.decided_at = None
        request_obj.decided_by_email = ""
        request_obj.save(
            update_fields=["decided_at", "decided_by_email", "updated_at"]
        )

    move_selection(
        selection,
        lifecycle.UNDER_VERIFICATION,
        actor=actor,
        reason=note or "Customer supplied the requested information.",
        context={"provided": provided} if provided else None,
    )

    outstanding = ", ".join(provided) if provided else note
    _notify_company(
        selection,
        f"Customer responded on {selection.reference}",
        f"The information you asked for has been supplied: {outstanding}",
        severity="INFO",
    )
    return selection


# --- The company's review of each document -----------------------------------


def review_document_for_company(document, *, request_obj, decision, actor, remarks=""):
    """The agent's verdict on one paper, given only after opening it.

    The company reads each document for carriage, as customs later reads it
    for compliance. A rejection needs remarks, which the customer reads, and
    asks them for a corrected copy.
    """
    decision = (decision or "").upper()
    if decision not in ("VERIFIED", "REJECTED"):
        raise DecisionError("Decision must be VERIFIED or REJECTED.")

    remarks = (remarks or "").strip()
    if decision == "REJECTED" and not remarks:
        raise DecisionError("Say what is wrong with the document. The customer reads it.")

    open_statuses = lifecycle.AGENT_ACTIONABLE | {lifecycle.AWAITING_CUSTOMER_INFO}
    if request_obj.status not in open_statuses:
        raise DecisionError(
            f"This request is {request_obj.status}, so its documents are no longer "
            "yours to review."
        )

    if not document.was_viewed_by(actor.get("email")):
        raise DecisionError("Open the document and read it before you verify or reject it.")

    document.agent_status = decision
    document.agent_company = request_obj.company.code
    document.agent_reviewed_by = actor.get("email", "")
    document.agent_reviewed_at = timezone.now()
    document.agent_remarks = remarks
    document.save(
        update_fields=[
            "agent_status",
            "agent_company",
            "agent_reviewed_by",
            "agent_reviewed_at",
            "agent_remarks",
        ]
    )

    if decision == "REJECTED":
        from notifications import service as notify

        safe_notify(
            notify.notify_user,
            request_obj.selection.customer_id,
            f"{request_obj.company.name} rejected your {document.document_type}",
            (
                f'"{document.file_name}" was not accepted. Reason: {remarks} '
                "Upload a corrected copy under Documents."
            ),
            category="QUOTE",
            severity="WARNING",
            entity_type="SHIPMENT_DOCUMENT",
            entity_id=str(document.id),
            link="/dashboard/documents",
        )
    return document


# --- Customs clearance and the customer's final word ------------------------
#
# The company's approval says it can carry the shipment. Customs then decides
# whether the goods may move, and the customer has the last word on booking:
# approved by the company, cleared by customs, confirmed by the customer.

CUSTOMS_ROLES = ("customs", "customs_officer")


class CustomsDecisionError(ValueError):
    """A customs decision the workflow will not accept, with the reason."""


def send_to_customs(selection, *, actor, note=""):
    """Queue an approved request for customs clearance, and tell the desk."""
    from notifications import service as notify

    clearance, _ = CustomsClearance.objects.get_or_create(selection=selection)
    move_selection(
        selection,
        lifecycle.PENDING_CUSTOMS_REVIEW,
        actor=actor,
        reason=note or "Sent to customs for clearance.",
        context={"customs_reference": clearance.reference},
    )

    shipment = selection.shipment
    for role in CUSTOMS_ROLES:
        safe_notify(
            notify.notify_role,
            role,
            f"Clearance needed: {clearance.reference}",
            (
                f"{selection.company.name} approved {shipment.origin} to "
                f"{shipment.destination} ({shipment.cargo_type}, HS "
                f"{shipment.hs_code or 'not given'}). Clear or reject it; the "
                "customer cannot book until you do."
            ),
            category="CUSTOMS",
            severity="WARNING",
            entity_type="CUSTOMS_CLEARANCE",
            entity_id=clearance.reference,
            link="/dashboard/booking-clearances",
        )
    return clearance


@transaction.atomic
def decide_customs(clearance, *, decision, actor, reason=""):
    """A customs officer clears the shipment or rejects it.

    Clearing hands the request to the customer for the final decision. A
    rejection needs a reason, which the customer and the company both read,
    and leaves the customer free to choose another company.
    """
    decision = (decision or "").upper()
    if decision not in ("CLEAR", "REJECT"):
        raise CustomsDecisionError("Decision must be CLEAR or REJECT.")

    reason = (reason or "").strip()
    if decision == "REJECT" and not reason:
        raise CustomsDecisionError(
            "Give the reason for rejecting. The customer and the company both see it."
        )

    selection = clearance.selection
    if clearance.status != "PENDING":
        raise CustomsDecisionError(
            f"{clearance.reference} was already {clearance.status.lower()} by "
            f"{clearance.officer_email or 'another officer'}."
        )
    if selection.status != lifecycle.PENDING_CUSTOMS_REVIEW:
        raise CustomsDecisionError(
            f"This request is {selection.status}, not waiting for customs."
        )

    # Clearing is customs' final word, given only after an officer has opened
    # and verified every paper. A rejection needs no such wait.
    if decision == "CLEAR":
        from customs.paperwork import CUSTOMS, readiness_problem

        problem = readiness_problem(selection.quote, CUSTOMS, shipment_id=selection.shipment_id)
        if problem:
            raise CustomsDecisionError(f"{problem} Open and verify each document before clearing.")

    cleared = decision == "CLEAR"
    clearance.status = "CLEARED" if cleared else "REJECTED"
    clearance.officer_email = actor.get("email", "")
    clearance.reason = reason
    clearance.decided_at = timezone.now()
    clearance.save(
        update_fields=["status", "officer_email", "reason", "decided_at", "updated_at"]
    )

    move_selection(
        selection,
        lifecycle.CUSTOMS_CLEARED if cleared else lifecycle.CUSTOMS_REJECTED,
        actor=actor,
        reason=reason or "Cleared by customs.",
        context={"customs_reference": clearance.reference},
    )

    from notifications import service as notify

    company = selection.company.name
    offer = selection.company_quote
    if cleared:
        title = f"Customs cleared {selection.reference}: confirm your booking"
        body = (
            f"{company} approved your shipment and customs has cleared it. "
            f"Confirm the booking at {offer.currency} {offer.total_price:,.0f}, "
            "or decline it, in Selected Quotes."
            + (f" Officer's note: {reason}" if reason else "")
        )
    else:
        title = f"Customs could not clear {selection.reference}"
        body = f"Reason: {reason} You can choose another company's offer."
    safe_notify(
        notify.notify_user,
        selection.customer_id,
        title,
        body,
        category="CUSTOMS",
        severity="SUCCESS" if cleared else "WARNING",
        entity_type="QUOTE_SELECTION",
        entity_id=str(selection.id),
        link="/dashboard/selected-quotes",
    )
    _notify_company(
        selection,
        f"Customs {'cleared' if cleared else 'rejected'} {selection.reference}",
        (
            "The customer now confirms or declines the booking."
            if cleared
            else f"Customs rejected the shipment. Reason: {reason}"
        ),
        severity="INFO" if cleared else "WARNING",
    )
    return clearance


@transaction.atomic
def customer_final_decision(selection, *, decision, actor, note=""):
    """The customer's last word on a cleared request: book it, or decline.

    Returns the selection and its booking, which is None after a decline.
    Declining does not cancel the shipment; the customer may choose another
    company, as after any other rejection.
    """
    decision = (decision or "").upper()
    if decision not in ("ACCEPT", "DECLINE"):
        raise CustomerResponseError("Decision must be ACCEPT or DECLINE.")

    if selection.status != lifecycle.CUSTOMS_CLEARED:
        raise CustomerResponseError(
            f"There is no booking waiting on your decision. This request is "
            f"{selection.status}."
        )

    note = (note or "").strip()
    if decision == "ACCEPT":
        booking, _ = confirm_booking(
            selection, actor=actor, note=note or "Customer confirmed the booking."
        )
        return selection, booking

    move_selection(
        selection,
        lifecycle.RESELECT_QUOTE,
        actor=actor,
        reason=note or "Customer declined the booking.",
    )
    selection.is_active = False
    selection.save(update_fields=["is_active", "updated_at"])

    _notify_company(
        selection,
        f"Booking declined on {selection.reference}",
        (
            "The customer decided not to book after customs cleared it. "
            f"Reason: {note or 'none given'}"
        ),
        severity="WARNING",
    )
    return selection, None


# --- Booking (document section 3, step 14) ---------------------------------


class BookingError(ValueError):
    """A booking action the workflow will not accept, with the reason."""


@transaction.atomic
def confirm_booking(selection, *, actor, note=""):
    """Turn a cleared selection into a confirmed booking.

    Only a selection the company approved and customs cleared can become a
    booking, and only when the customer confirms it. That is the milestone's
    success definition: verification and customer confirmation must have
    happened first, so a booking can never appear straight off a selection.
    """
    existing = getattr(selection, "booking", None)
    if existing and existing.status == "CONFIRMED":
        # Confirming twice returns the same booking rather than issuing a
        # second reference for one shipment.
        return existing, False

    if selection.status != lifecycle.CUSTOMS_CLEARED:
        raise BookingError(
            "Only a request the company approved and customs cleared can be "
            f"booked. This one is {selection.status}."
        )

    offer = selection.company_quote
    accepted_revision = selection.revisions.filter(status="ACCEPTED").first()

    booking = Booking.objects.create(
        selection=selection,
        shipment=selection.shipment,
        quote=selection.quote,
        company=selection.company,
        customer_id=selection.customer_id,
        customer_email=selection.customer_email,
        agreed_total_price=offer.total_price,
        agreed_currency=offer.currency,
        agreed_transit_days=offer.transit_days,
        was_revised=bool(accepted_revision),
        status="CONFIRMED",
    )

    move_selection(
        selection,
        lifecycle.BOOKING_CONFIRMED,
        actor=actor,
        reason=note or f"Booking {booking.reference} confirmed.",
        context={"booking": booking.reference, "price": booking.agreed_total_price},
    )

    from notifications import service as notify
    from companies.access import resolve_user_id

    safe_notify(
        notify.notify_user,
        selection.customer_id,
        f"Booking confirmed: {booking.reference}",
        (
            f"{selection.company.name} has confirmed your shipment for "
            f"{booking.agreed_currency} {booking.agreed_total_price:,.0f}, "
            f"{booking.agreed_transit_days} days transit. "
            f"Quote your reference {booking.reference} in any correspondence."
        ),
        category="SHIPMENT",
        severity="SUCCESS",
        entity_type="BOOKING",
        entity_id=booking.reference,
        link="/dashboard/my-shipments",
    )

    membership = primary_agent_for(selection.company)
    if membership:
        safe_notify(
            notify.notify_user,
            resolve_user_id(membership.user_email) or membership.user_email,
            f"Booking confirmed: {booking.reference}",
            f"{selection.shipment.origin} to {selection.shipment.destination} is booked.",
            category="SHIPMENT",
            severity="SUCCESS",
            entity_type="BOOKING",
            entity_id=booking.reference,
            link="/dashboard/booking-management",
        )

    return booking, True


@transaction.atomic
def cancel_booking(booking, *, actor, reason=""):
    """Cancel a confirmed booking. A reason is required and reaches both sides."""
    reason = (reason or "").strip()
    if not reason:
        raise BookingError("A cancellation reason is required.")

    if booking.status == "CANCELLED":
        raise BookingError(
            f"{booking.reference} was already cancelled by "
            f"{booking.cancelled_by_email or 'someone'}."
        )
    if booking.status == "COMPLETED":
        raise BookingError(f"{booking.reference} is completed and cannot be cancelled.")

    booking.status = "CANCELLED"
    booking.cancelled_at = timezone.now()
    booking.cancelled_by_email = actor.get("email", "")
    booking.cancellation_reason = reason
    booking.save(
        update_fields=[
            "status",
            "cancelled_at",
            "cancelled_by_email",
            "cancellation_reason",
            "updated_at",
        ]
    )

    selection = booking.selection
    move_selection(
        selection,
        lifecycle.BOOKING_CANCELLED,
        actor=actor,
        reason=reason,
        context={"booking": booking.reference},
    )
    selection.is_active = False
    selection.save(update_fields=["is_active", "updated_at"])

    from notifications import service as notify
    from companies.access import resolve_user_id

    safe_notify(
        notify.notify_user,
        booking.customer_id,
        f"Booking cancelled: {booking.reference}",
        f"Your booking with {booking.company.name} was cancelled. Reason: {reason}",
        category="SHIPMENT",
        severity="WARNING",
        entity_type="BOOKING",
        entity_id=booking.reference,
        link="/dashboard/my-shipments",
    )

    membership = primary_agent_for(booking.company)
    if membership:
        safe_notify(
            notify.notify_user,
            resolve_user_id(membership.user_email) or membership.user_email,
            f"Booking cancelled: {booking.reference}",
            f"Cancelled by {actor.get('email', 'unknown')}. Reason: {reason}",
            category="SHIPMENT",
            severity="WARNING",
            entity_type="BOOKING",
            entity_id=booking.reference,
            link="/dashboard/booking-management",
        )

    return booking
