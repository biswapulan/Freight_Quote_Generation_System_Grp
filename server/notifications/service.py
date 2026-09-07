"""Notification emitters.

Like the audit service, delivery must never break the business operation that
triggered it, so every write is guarded.
"""

import logging

from .models import Notification

logger = logging.getLogger(__name__)


def notify_user(
    recipient_id: str,
    title: str,
    message: str = "",
    *,
    category: str = "SYSTEM",
    severity: str = "INFO",
    entity_type: str = "",
    entity_id: str = "",
    link: str = "",
) -> Notification | None:
    """Send a notification to one specific user."""
    if not recipient_id:
        return None
    return _create(
        recipient_id=str(recipient_id),
        recipient_role="",
        title=title,
        message=message,
        category=category,
        severity=severity,
        entity_type=entity_type,
        entity_id=entity_id,
        link=link,
    )


def notify_role(
    role: str,
    title: str,
    message: str = "",
    *,
    category: str = "SYSTEM",
    severity: str = "INFO",
    entity_type: str = "",
    entity_id: str = "",
    link: str = "",
) -> Notification | None:
    """Send a notification to every user holding a role (agent, customs, admin)."""
    if not role:
        return None
    return _create(
        recipient_id="",
        recipient_role=role.lower(),
        title=title,
        message=message,
        category=category,
        severity=severity,
        entity_type=entity_type,
        entity_id=entity_id,
        link=link,
    )


def _create(**kwargs) -> Notification | None:
    try:
        return Notification.objects.create(**kwargs)
    except Exception:
        logger.exception("Failed to emit notification: %s", kwargs.get("title"))
        return None
