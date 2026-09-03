"""State transition lifecycle engine for Shipments and Quotes (PDF M1-M3 Standard)."""

class InvalidStateTransitionError(ValueError):
    """Raised when an illegal status lifecycle transition is attempted."""
    pass


# Shipment Status Constants
SHIPMENT_STATUS_DRAFT = "DRAFT"
SHIPMENT_STATUS_SUBMITTED = "SUBMITTED"
SHIPMENT_STATUS_PROCESSING = "PROCESSING"
SHIPMENT_STATUS_ANALYZED = "ANALYZED"
SHIPMENT_STATUS_QUOTED = "QUOTED"
SHIPMENT_STATUS_CLOSED = "CLOSED"
SHIPMENT_STATUS_CANCELLED = "CANCELLED"

# Backward compatibility / legacy aliases
SHIPMENT_LEGACY_MAP = {
    "CREATED": SHIPMENT_STATUS_SUBMITTED,
    "APPROVED": SHIPMENT_STATUS_QUOTED,
    "IN_TRANSIT": SHIPMENT_STATUS_PROCESSING,
    "DELIVERED": SHIPMENT_STATUS_CLOSED,
}

SHIPMENT_TRANSITIONS = {
    SHIPMENT_STATUS_DRAFT: {SHIPMENT_STATUS_SUBMITTED, SHIPMENT_STATUS_CANCELLED},
    SHIPMENT_STATUS_SUBMITTED: {SHIPMENT_STATUS_PROCESSING, SHIPMENT_STATUS_CANCELLED},
    SHIPMENT_STATUS_PROCESSING: {SHIPMENT_STATUS_ANALYZED, SHIPMENT_STATUS_CANCELLED},
    SHIPMENT_STATUS_ANALYZED: {SHIPMENT_STATUS_QUOTED, SHIPMENT_STATUS_CANCELLED},
    SHIPMENT_STATUS_QUOTED: {SHIPMENT_STATUS_CLOSED, SHIPMENT_STATUS_CANCELLED},
    SHIPMENT_STATUS_CLOSED: set(),
    SHIPMENT_STATUS_CANCELLED: set(),
}


# Quote Status Constants (10. Status Flow & Final Architecture)
QUOTE_STATUS_DRAFT = "DRAFT"
QUOTE_STATUS_GENERATED = "GENERATED"
QUOTE_STATUS_PENDING_REVIEW = "PENDING_REVIEW"
QUOTE_STATUS_APPROVED = "APPROVED"
QUOTE_STATUS_SENT = "SENT"
QUOTE_STATUS_ACCEPTED = "ACCEPTED"
QUOTE_STATUS_REJECTED = "REJECTED"
QUOTE_STATUS_EXPIRED = "EXPIRED"

# Primary & Role-Specific Constants
QUOTE_STATUS_REQUESTED = "REQUESTED"
QUOTE_STATUS_AI_ANALYZED = "AI_ANALYZED"
QUOTE_STATUS_CUSTOMS_REVIEWED = "CUSTOMS_REVIEWED"
QUOTE_STATUS_CUSTOMS_FLAGGED = "CUSTOMS_FLAGGED"
QUOTE_STATUS_FINAL_QUOTE_SENT = "FINAL_QUOTE_SENT"

# Backward compatibility / legacy aliases
QUOTE_LEGACY_MAP = {
    "REQUESTED": QUOTE_STATUS_DRAFT,
    "PENDING": QUOTE_STATUS_PENDING_REVIEW,
    "AI_ANALYZED": QUOTE_STATUS_GENERATED,
    "CUSTOMS_REVIEWED": QUOTE_STATUS_PENDING_REVIEW,
    "CUSTOMS_FLAGGED": QUOTE_STATUS_PENDING_REVIEW,
    "FINAL_QUOTE_SENT": QUOTE_STATUS_SENT,
    "ISSUED": QUOTE_STATUS_SENT,
    "BOOKED": QUOTE_STATUS_ACCEPTED,
    "CONFIRMED": QUOTE_STATUS_ACCEPTED,
    "CANCELLED": QUOTE_STATUS_REJECTED,
}

QUOTE_TRANSITIONS = {
    QUOTE_STATUS_DRAFT: {QUOTE_STATUS_GENERATED, QUOTE_STATUS_REJECTED, QUOTE_STATUS_EXPIRED},
    QUOTE_STATUS_GENERATED: {QUOTE_STATUS_PENDING_REVIEW, QUOTE_STATUS_APPROVED, QUOTE_STATUS_SENT, QUOTE_STATUS_REJECTED, QUOTE_STATUS_EXPIRED},
    QUOTE_STATUS_PENDING_REVIEW: {QUOTE_STATUS_APPROVED, QUOTE_STATUS_SENT, QUOTE_STATUS_REJECTED, QUOTE_STATUS_EXPIRED},
    QUOTE_STATUS_APPROVED: {QUOTE_STATUS_SENT, QUOTE_STATUS_ACCEPTED, QUOTE_STATUS_REJECTED, QUOTE_STATUS_EXPIRED},
    QUOTE_STATUS_SENT: {QUOTE_STATUS_ACCEPTED, QUOTE_STATUS_REJECTED, QUOTE_STATUS_EXPIRED},
    QUOTE_STATUS_ACCEPTED: set(),
    QUOTE_STATUS_REJECTED: set(),
    QUOTE_STATUS_EXPIRED: set(),
}


def normalize_shipment_status(status_str: str) -> str:
    """Normalize status string handling legacy aliases."""
    if not status_str:
        return SHIPMENT_STATUS_SUBMITTED
    norm = status_str.strip().upper()
    return SHIPMENT_LEGACY_MAP.get(norm, norm)


def normalize_quote_status(status_str: str) -> str:
    """Normalize status string handling legacy aliases."""
    if not status_str:
        return QUOTE_STATUS_REQUESTED
    norm = status_str.strip().upper()
    return QUOTE_LEGACY_MAP.get(norm, norm)


def validate_shipment_transition(current_status: str, target_status: str) -> bool:
    """Validate whether the transition is allowed according to the lifecycle graph."""
    curr = normalize_shipment_status(current_status)
    tgt = normalize_shipment_status(target_status)
    
    if curr == tgt:
        return True
    
    allowed = SHIPMENT_TRANSITIONS.get(curr, set())
    # Allow administrative override to CANCELLED or CLOSED from any active state
    if tgt in {SHIPMENT_STATUS_CANCELLED, SHIPMENT_STATUS_CLOSED}:
        return True
    
    if tgt not in allowed:
        # Also allow jumping directly from SUBMITTED to QUOTED for synchronous instant pipelines
        if curr == SHIPMENT_STATUS_SUBMITTED and tgt in {SHIPMENT_STATUS_PROCESSING, SHIPMENT_STATUS_ANALYZED, SHIPMENT_STATUS_QUOTED}:
            return True
        raise InvalidStateTransitionError(
            f"Invalid Shipment transition from {curr} to {tgt}. Allowed next states: {allowed or 'None (Terminal)'}"
        )
    return True


def validate_quote_transition(current_status: str, target_status: str) -> bool:
    """Validate whether the transition is allowed according to the lifecycle graph."""
    curr = normalize_quote_status(current_status)
    tgt = normalize_quote_status(target_status)
    
    if curr == tgt:
        return True
        
    allowed = QUOTE_TRANSITIONS.get(curr, set())
    if tgt in {QUOTE_STATUS_REJECTED, QUOTE_STATUS_EXPIRED}:
        return True
        
    if tgt not in allowed:
        # Allow instant quote generation straight to SENT / APPROVED when auto-approved
        if curr in {QUOTE_STATUS_DRAFT, QUOTE_STATUS_GENERATED} and tgt in {QUOTE_STATUS_APPROVED, QUOTE_STATUS_SENT}:
            return True
        raise InvalidStateTransitionError(
            f"Invalid Quote transition from {curr} to {tgt}. Allowed next states: {allowed or 'None (Terminal)'}"
        )
    return True
