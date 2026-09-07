"""Helper for writing audit records.

Kept deliberately forgiving: an audit write must never be the reason a business
operation fails, so every call is wrapped and failures are swallowed after being
surfaced to the log.
"""

import logging

from .models import AuditLog

logger = logging.getLogger(__name__)


# Canonical action names, referenced from views so spellings stay consistent.
SHIPMENT_CREATED = "SHIPMENT_CREATED"
SHIPMENT_STATUS_CHANGED = "SHIPMENT_STATUS_CHANGED"
QUOTE_GENERATED = "QUOTE_GENERATED"
QUOTE_PRICE_MODIFIED = "QUOTE_PRICE_MODIFIED"
QUOTE_APPROVED = "QUOTE_APPROVED"
QUOTE_SENT = "QUOTE_SENT"
QUOTE_REJECTED = "QUOTE_REJECTED"
QUOTE_INFO_REQUESTED = "QUOTE_INFO_REQUESTED"
QUOTE_STATUS_CHANGED = "QUOTE_STATUS_CHANGED"
CUSTOMER_DECISION = "CUSTOMER_DECISION"
CUSTOMS_SIGN_OFF = "CUSTOMS_SIGN_OFF"
ORCHESTRATOR_RUN = "ORCHESTRATOR_RUN"


def record(
    *,
    actor_id: str,
    actor_role: str = "system",
    actor_email: str = "",
    action: str,
    entity_type: str,
    entity_id: str,
    reason: str = "",
    changes: dict | None = None,
    context: dict | None = None,
) -> AuditLog | None:
    """Write one audit row. Returns the row, or None if persistence failed."""
    try:
        return AuditLog.objects.create(
            actor_id=str(actor_id or "system"),
            actor_role=(actor_role or "system").lower(),
            actor_email=actor_email or "",
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id),
            reason=reason or "",
            changes=changes,
            context=context,
        )
    except Exception:
        logger.exception("Failed to write audit record for %s:%s", entity_type, entity_id)
        return None


def diff(before: dict, after: dict) -> dict:
    """Build a {field: {from, to}} map of the values that actually changed."""
    changed = {}
    for key, new_value in after.items():
        old_value = before.get(key)
        if old_value != new_value:
            changed[key] = {"from": old_value, "to": new_value}
    return changed
