"""Immutable audit trail for every state-changing action on the platform.

Backs the Admin portal's "Audit Logs" screen (PDF section 6) and satisfies core
test scenario 9 — "Agent modifies price -> Reason and audit record stored".
"""

import uuid

from django.db import models


class AuditLog(models.Model):
    """One row per state-changing action. Never updated, never deleted."""

    ENTITY_CHOICES = (
        ("SHIPMENT", "Shipment"),
        ("QUOTE", "Quote"),
        ("CUSTOMS_CHECK", "Customs Compliance Check"),
        ("RISK_ASSESSMENT", "Risk Assessment"),
        ("USER", "User"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    actor_id = models.CharField(max_length=64, db_index=True)
    actor_role = models.CharField(max_length=32, default="system")
    actor_email = models.CharField(max_length=254, blank=True, default="")

    action = models.CharField(max_length=64, db_index=True)
    entity_type = models.CharField(max_length=32, choices=ENTITY_CHOICES, db_index=True)
    entity_id = models.CharField(max_length=64, db_index=True)

    # Free-text justification. Mandatory for commercial overrides such as a price change.
    reason = models.TextField(blank=True, default="")

    # Field-level before/after so a reviewer can see exactly what moved.
    changes = models.JSONField(null=True, blank=True)
    context = models.JSONField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["entity_type", "entity_id"]),
        ]

    def __str__(self):
        return f"{self.created_at:%Y-%m-%d %H:%M} {self.actor_role}:{self.action} -> {self.entity_type}:{self.entity_id}"
