"""The M4 selection-to-booking state machine (milestone document section 11).

M1-M3 end at a priced, risk-scored quote. M4 carries the customer's chosen
company offer through that company's verification and out the other side as a
booking, or as a revision the customer must accept, or as a rejection that
sends them back to the other offers.

Transitions are declared rather than implied, so an agent decision cannot skip
verification, a booking cannot be confirmed straight from a selection, and a
duplicate decision on an already-decided request is refused instead of quietly
overwriting the first one.
"""


class InvalidSelectionTransitionError(ValueError):
    """Raised when a selection is moved somewhere the workflow does not allow."""


# --- Statuses, in the order the milestone document lists them ---------------
OPTIONS_AVAILABLE = "QUOTE_OPTIONS_AVAILABLE"
SELECTED = "QUOTE_SELECTED"
PENDING_COMPANY_VERIFICATION = "PENDING_COMPANY_VERIFICATION"
UNDER_VERIFICATION = "UNDER_VERIFICATION"
AWAITING_CUSTOMER_INFO = "AWAITING_CUSTOMER_INFO"
REVISION_PENDING_CUSTOMER = "REVISION_PENDING_CUSTOMER"
REVISION_ACCEPTED = "REVISION_ACCEPTED"
APPROVED = "APPROVED"
REJECTED = "REJECTED"
ESCALATED = "ESCALATED"
BOOKING_CONFIRMED = "BOOKING_CONFIRMED"
BOOKING_CANCELLED = "BOOKING_CANCELLED"
RESELECT_QUOTE = "RESELECT_QUOTE"

STATUS_CHOICES = [
    (OPTIONS_AVAILABLE, "Quote options available"),
    (SELECTED, "Quote selected by customer"),
    (PENDING_COMPANY_VERIFICATION, "Pending company verification"),
    (UNDER_VERIFICATION, "Under verification"),
    (AWAITING_CUSTOMER_INFO, "Awaiting customer information"),
    (REVISION_PENDING_CUSTOMER, "Revision pending customer"),
    (REVISION_ACCEPTED, "Revision accepted"),
    (APPROVED, "Approved by company"),
    (REJECTED, "Rejected by company"),
    (ESCALATED, "Escalated for manager approval"),
    (BOOKING_CONFIRMED, "Booking confirmed"),
    (BOOKING_CANCELLED, "Booking cancelled"),
    (RESELECT_QUOTE, "Customer may select another option"),
]

# States that end the selection's life. Nothing moves out of these.
TERMINAL = {BOOKING_CONFIRMED, BOOKING_CANCELLED, RESELECT_QUOTE}

ALLOWED_TRANSITIONS = {
    OPTIONS_AVAILABLE: {SELECTED},
    SELECTED: {PENDING_COMPANY_VERIFICATION, BOOKING_CANCELLED},
    PENDING_COMPANY_VERIFICATION: {UNDER_VERIFICATION, BOOKING_CANCELLED},
    UNDER_VERIFICATION: {
        APPROVED,
        REJECTED,
        REVISION_PENDING_CUSTOMER,
        AWAITING_CUSTOMER_INFO,
        ESCALATED,
    },
    # The customer supplies what was asked for, and it goes back to the agent.
    AWAITING_CUSTOMER_INFO: {UNDER_VERIFICATION, BOOKING_CANCELLED},
    # The customer either takes the revised terms or walks to another company.
    REVISION_PENDING_CUSTOMER: {REVISION_ACCEPTED, RESELECT_QUOTE, BOOKING_CANCELLED},
    REVISION_ACCEPTED: {APPROVED, BOOKING_CONFIRMED},
    # A manager either clears the escalation or the company declines it.
    ESCALATED: {APPROVED, REJECTED, REVISION_PENDING_CUSTOMER},
    APPROVED: {BOOKING_CONFIRMED, BOOKING_CANCELLED},
    # A rejection is not the end of the shipment, only of this company's part.
    REJECTED: {RESELECT_QUOTE},
    BOOKING_CONFIRMED: {BOOKING_CANCELLED},
    BOOKING_CANCELLED: set(),
    RESELECT_QUOTE: set(),
}

# Statuses where the request is sitting in the company agent's queue.
AGENT_ACTIONABLE = {PENDING_COMPANY_VERIFICATION, UNDER_VERIFICATION, ESCALATED}

# Statuses where the ball is with the customer.
CUSTOMER_ACTIONABLE = {AWAITING_CUSTOMER_INFO, REVISION_PENDING_CUSTOMER, APPROVED}


def can_transition(current, target):
    return target in ALLOWED_TRANSITIONS.get(current, set())


def assert_transition(current, target):
    """Raise unless this move is part of the declared workflow."""
    if current == target:
        raise InvalidSelectionTransitionError(
            f"This request is already {current}."
        )
    if current in TERMINAL:
        raise InvalidSelectionTransitionError(
            f"This request is {current} and cannot be changed."
        )
    if not can_transition(current, target):
        allowed = ", ".join(sorted(ALLOWED_TRANSITIONS.get(current, set()))) or "nothing"
        raise InvalidSelectionTransitionError(
            f"Cannot move from {current} to {target}. Allowed from here: {allowed}."
        )


def is_agent_actionable(status):
    return status in AGENT_ACTIONABLE


def is_customer_actionable(status):
    return status in CUSTOMER_ACTIONABLE
