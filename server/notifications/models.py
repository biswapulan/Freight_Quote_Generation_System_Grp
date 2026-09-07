"""In-app notifications.

Every portal in PDF section 6 carries a "Notifications" nav item. A notification is
addressed either to one user (recipient_id) or to a whole role (recipient_role),
so "all freight agents" can be told about a new shipment request without the
emitter having to know who is on shift.
"""

import uuid

from django.db import models


class Notification(models.Model):
    CATEGORY_CHOICES = (
        ("SHIPMENT", "Shipment"),
        ("QUOTE", "Quote"),
        ("RISK", "Risk"),
        ("CUSTOMS", "Customs"),
        ("SYSTEM", "System"),
    )

    SEVERITY_CHOICES = (
        ("INFO", "Info"),
        ("SUCCESS", "Success"),
        ("WARNING", "Warning"),
        ("CRITICAL", "Critical"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Exactly one of these is normally set; recipient_role fans out to a whole desk.
    recipient_id = models.CharField(max_length=64, blank=True, default="", db_index=True)
    recipient_role = models.CharField(max_length=32, blank=True, default="", db_index=True)

    title = models.CharField(max_length=200)
    message = models.TextField(blank=True, default="")
    category = models.CharField(max_length=24, choices=CATEGORY_CHOICES, default="SYSTEM")
    severity = models.CharField(max_length=16, choices=SEVERITY_CHOICES, default="INFO")

    entity_type = models.CharField(max_length=32, blank=True, default="")
    entity_id = models.CharField(max_length=64, blank=True, default="", db_index=True)

    # Deep link the frontend can navigate to, e.g. /dashboard/quote-review.
    link = models.CharField(max_length=256, blank=True, default="")

    read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient_id", "read"]),
            models.Index(fields=["recipient_role", "read"]),
        ]

    def __str__(self):
        target = self.recipient_id or f"role:{self.recipient_role}"
        return f"[{self.severity}] {self.title} -> {target}"
