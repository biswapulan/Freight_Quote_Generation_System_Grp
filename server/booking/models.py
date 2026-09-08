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
