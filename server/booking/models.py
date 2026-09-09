"""The M4 booking workflow: company offers, selection, verification, booking.

Phase 2 introduces the offer layer. One shipment gets one M1-M3 analysis, and
that analysis is priced by every active company into its own CompanyQuote. The
customer compares those offers and picks one, which is what the later phases
turn into a verified booking.

Until now the "three carrier options" were built in the browser by multiplying
a single platform price, so they were never real offers: the cheap one was
cheaper by the same fraction on every lane, and no company had agreed to any of
it. These records are the platform's own, and each carries the terms it was
priced from.
"""

import uuid

from django.db import models
from django.utils import timezone

from . import lifecycle


class CompanyQuote(models.Model):
    """One freight company's priced offer for one shipment."""

    STATUS_CHOICES = [
        ("AVAILABLE", "Available"),
        ("SELECTED", "Selected by customer"),
        ("NOT_SELECTED", "Not selected"),
        ("EXPIRED", "Expired"),
        ("WITHDRAWN", "Withdrawn by company"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference = models.CharField(max_length=32, unique=True, db_index=True)

    shipment = models.ForeignKey(
        "quotes.Shipment", on_delete=models.CASCADE, related_name="company_quotes"
    )
    # The M1-M3 analysis this offer was priced from. Keeping the link means an
    # agent reviewing the offer can see the route, risk and ML price behind it.
    quote = models.ForeignKey(
        "quotes.Quote",
        on_delete=models.CASCADE,
        related_name="company_quotes",
        null=True,
        blank=True,
    )
    company = models.ForeignKey(
        "companies.FreightCompany", on_delete=models.CASCADE, related_name="quotes"
    )
    rate_card = models.ForeignKey(
        "companies.CompanyRateCard",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="quotes",
        help_text="Terms this offer was priced from, kept for audit.",
    )

    # ---- Commercial breakdown, so the customer sees what makes up the price --
    base_freight = models.FloatField(default=0.0)
    fuel_surcharge = models.FloatField(default=0.0)
    handling_fee = models.FloatField(default=0.0)
    documentation_fee = models.FloatField(default=0.0)
    total_price = models.FloatField(default=0.0)
    currency = models.CharField(max_length=8, default="INR")

    # ---- Service ----
    transit_days = models.IntegerField(null=True, blank=True)
    service_name = models.CharField(max_length=190, blank=True, default="")
    is_recommended = models.BooleanField(
        default=False, help_text="Platform's suggested option among the offers."
    )

    # ---- Risk context carried from M3, so comparison is not price-only ------
    risk_level = models.CharField(max_length=16, blank=True, default="")
    risk_score = models.FloatField(null=True, blank=True)

    # ---- Validity. M4 forbids confirming an expired offer outright. ---------
    valid_until = models.DateTimeField(null=True, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="AVAILABLE")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "company_quotes"
        ordering = ["total_price"]
        constraints = [
            models.UniqueConstraint(
                fields=["quote", "company"], name="unique_offer_per_company_per_quote"
            )
        ]
        indexes = [
            models.Index(fields=["shipment", "status"]),
        ]

    def __str__(self):
        return f"{self.reference} {self.company.name} {self.currency} {self.total_price:,.0f}"

    @property
    def is_expired(self):
        return bool(self.valid_until and self.valid_until <= timezone.now())

    @property
    def is_selectable(self):
        return self.status in ("AVAILABLE", "SELECTED") and not self.is_expired

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = f"CQ-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)


class QuoteSelection(models.Model):
    """The customer's chosen company offer, and the spine of the M4 workflow.

    The chosen carrier used to live as three loose columns on the quote, set
    from whatever the browser sent. This is the record the whole milestone
    hangs off: one active selection per shipment, carrying its own status
    through verification to booking.

    The commercial terms are snapshotted at selection time. M4 requires the
    originally selected values to survive, so a later rate card change or an
    agent's revision cannot quietly rewrite what the customer agreed to.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference = models.CharField(max_length=32, unique=True, db_index=True)

    shipment = models.ForeignKey(
        "quotes.Shipment", on_delete=models.CASCADE, related_name="selections"
    )
    quote = models.ForeignKey(
        "quotes.Quote", on_delete=models.CASCADE, related_name="selections"
    )
    company_quote = models.ForeignKey(
        CompanyQuote, on_delete=models.PROTECT, related_name="selections"
    )
    company = models.ForeignKey(
        "companies.FreightCompany", on_delete=models.PROTECT, related_name="selections"
    )

    customer_id = models.CharField(max_length=64, db_index=True)
    customer_email = models.EmailField(blank=True, default="")

    # ---- Snapshot of what was selected, frozen at selection time -----------
    selected_total_price = models.FloatField()
    selected_currency = models.CharField(max_length=8, default="INR")
    selected_transit_days = models.IntegerField(null=True, blank=True)
    selected_valid_until = models.DateTimeField(null=True, blank=True)

    status = models.CharField(
        max_length=40, choices=lifecycle.STATUS_CHOICES, default=lifecycle.SELECTED
    )
    is_active = models.BooleanField(
        default=True,
        help_text="False once superseded, so a shipment keeps one live selection.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "quote_selections"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["shipment", "is_active"]),
            models.Index(fields=["company", "status"]),
        ]

    def __str__(self):
        return f"{self.reference} {self.company.name} [{self.status}]"

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = f"SEL-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    @property
    def price_changed(self):
        """Has an agent revision moved the price away from what was selected?"""
        return round(self.company_quote.total_price, 2) != round(
            self.selected_total_price, 2
        )


class VerificationRequest(models.Model):
    """The selected company's review of one selection.

    Created the moment a customer selects, so the work is visible in exactly
    one company's queue and nowhere else. The agent who opens it is recorded,
    which is what stops two agents deciding the same request twice.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference = models.CharField(max_length=32, unique=True, db_index=True)

    selection = models.OneToOneField(
        QuoteSelection, on_delete=models.CASCADE, related_name="verification"
    )
    company = models.ForeignKey(
        "companies.FreightCompany",
        on_delete=models.CASCADE,
        related_name="verification_requests",
    )

    # Who picked it up, and who decided. Blank until an agent opens it.
    assigned_agent_email = models.EmailField(blank=True, default="", db_index=True)
    assigned_agent_name = models.CharField(max_length=190, blank=True, default="")
    decided_by_email = models.EmailField(blank=True, default="")
    decision_reason = models.TextField(blank=True, default="")

    status = models.CharField(
        max_length=40,
        choices=lifecycle.STATUS_CHOICES,
        default=lifecycle.PENDING_COMPANY_VERIFICATION,
    )

    # What the agent asked the customer for when the decision was Request Info.
    # A list rather than a sentence, so the customer's screen can tick items off
    # and the agent can see what is still outstanding.
    requested_information = models.JSONField(null=True, blank=True)

    # Response time is an M4 analytics requirement, so record the clock.
    opened_at = models.DateTimeField(null=True, blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    sla_due_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "verification_requests"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["company", "status"]),
        ]

    def __str__(self):
        return f"{self.reference} {self.company.name} [{self.status}]"

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = f"VR-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    @property
    def response_hours(self):
        if not self.decided_at:
            return None
        return round((self.decided_at - self.created_at).total_seconds() / 3600.0, 2)

    @property
    def is_overdue(self):
        if self.decided_at or not self.sla_due_at:
            return False
        return timezone.now() > self.sla_due_at


class VerificationCheck(models.Model):
    """One line of the agent's verification checklist (document section 5)."""

    AREA_CHOICES = [
        ("SHIPMENT", "Shipment details"),
        ("CARGO", "Cargo"),
        ("CAPACITY", "Capacity"),
        ("ROUTE", "Route"),
        ("SCHEDULE", "Schedule"),
        ("DOCUMENTS", "Documents"),
        ("COMMERCIAL", "Commercial"),
        ("RISK", "Risk context"),
        ("VALIDITY", "Quote validity"),
    ]

    RESULT_CHOICES = [
        ("PENDING", "Not yet checked"),
        ("PASS", "Confirmed"),
        ("ATTENTION", "Needs attention"),
        ("FAIL", "Cannot be met"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(
        VerificationRequest, on_delete=models.CASCADE, related_name="checks"
    )
    area = models.CharField(max_length=24, choices=AREA_CHOICES)
    prompt = models.CharField(max_length=255)
    result = models.CharField(max_length=16, choices=RESULT_CHOICES, default="PENDING")
    remarks = models.TextField(blank=True, default="")
    checked_by_email = models.EmailField(blank=True, default="")
    checked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "verification_checks"
        ordering = ["request", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["request", "area"], name="unique_check_area_per_request"
            )
        ]

    def __str__(self):
        return f"{self.area}: {self.result}"


class StatusHistory(models.Model):
    """Every status change on a selection, with who caused it and why.

    M4 requires selection, verification and booking to be traceable, and every
    modification to carry a reason. Recording the move itself means the trail
    survives even when the entity's current status has moved on again.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    selection = models.ForeignKey(
        QuoteSelection, on_delete=models.CASCADE, related_name="history"
    )
    old_status = models.CharField(max_length=40, blank=True, default="")
    new_status = models.CharField(max_length=40)
    changed_by_email = models.EmailField(blank=True, default="")
    changed_by_role = models.CharField(max_length=32, blank=True, default="")
    reason = models.TextField(blank=True, default="")
    context = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "selection_status_history"
        ordering = ["created_at"]
        verbose_name_plural = "status history"

    def __str__(self):
        return f"{self.old_status or 'new'} -> {self.new_status}"


class QuoteRevision(models.Model):
    """A company's counter-offer on a selection, kept beside the original.

    M4 forbids overwriting the quote the customer selected. When an agent
    changes the price or the schedule, the original terms stay on the selection
    and the new terms live here, so both sides see exactly what changed and the
    customer can decline and go elsewhere.

    Every revision carries a reason. "No silent changes" is a stated business
    rule: a price moving without an explanation is the thing this prevents.
    """

    STATUS_CHOICES = [
        ("PENDING_CUSTOMER", "Awaiting customer response"),
        ("ACCEPTED", "Accepted by customer"),
        ("DECLINED", "Declined by customer"),
        ("SUPERSEDED", "Replaced by a later revision"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference = models.CharField(max_length=32, unique=True, db_index=True)

    selection = models.ForeignKey(
        QuoteSelection, on_delete=models.CASCADE, related_name="revisions"
    )
    request = models.ForeignKey(
        VerificationRequest,
        on_delete=models.CASCADE,
        related_name="revisions",
        null=True,
        blank=True,
    )
    revision_number = models.PositiveIntegerField(default=1)

    # ---- What it was ----
    original_total_price = models.FloatField()
    original_transit_days = models.IntegerField(null=True, blank=True)

    # ---- What the company is now offering ----
    revised_total_price = models.FloatField()
    revised_transit_days = models.IntegerField(null=True, blank=True)
    revised_base_freight = models.FloatField(null=True, blank=True)
    revised_fuel_surcharge = models.FloatField(null=True, blank=True)
    revised_handling_fee = models.FloatField(null=True, blank=True)
    revised_documentation_fee = models.FloatField(null=True, blank=True)
    currency = models.CharField(max_length=8, default="INR")

    reason = models.TextField(help_text="Why the company changed the terms.")
    created_by_email = models.EmailField(blank=True, default="")

    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="PENDING_CUSTOMER"
    )
    customer_responded_at = models.DateTimeField(null=True, blank=True)
    customer_response_note = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "quote_revisions"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["selection", "revision_number"],
                name="unique_revision_number_per_selection",
            )
        ]

    def __str__(self):
        return f"{self.reference} rev{self.revision_number} [{self.status}]"

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = f"REV-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    @property
    def price_delta(self):
        return round(self.revised_total_price - self.original_total_price, 2)

    @property
    def price_delta_pct(self):
        if not self.original_total_price:
            return 0.0
        return round((self.price_delta / self.original_total_price) * 100.0, 2)

    @property
    def transit_delta(self):
        if self.revised_transit_days is None or self.original_transit_days is None:
            return None
        return self.revised_transit_days - self.original_transit_days
