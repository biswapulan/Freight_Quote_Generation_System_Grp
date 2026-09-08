"""Freight companies and the agents authorised to act for them (M4 phase 1).

Milestone 4 turns an AI-generated quote into a verified booking by routing the
customer's chosen option to the company that will actually carry the freight.
That needs two things the platform never had: a record of each freight company,
and a record of which users may act on that company's behalf.

Before this, the three carriers were literal objects in the browser bundle and
a quote's "assigned agent" was an email string copied from them, so company
isolation could not be enforced anywhere: it was a display convention, not data.
"""

import uuid

from django.db import models
from django.utils import timezone


class FreightCompany(models.Model):
    """A freight provider that can quote for and carry a shipment."""

    STATUS_CHOICES = [
        ("ACTIVE", "Active"),
        ("SUSPENDED", "Suspended"),
        ("INACTIVE", "Inactive"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Stable human-readable handle used in URLs, seeds and the carrier options
    # the customer sees. Kept separate from the display name so renaming a
    # company does not orphan the quotes that referenced it.
    code = models.SlugField(max_length=48, unique=True)
    name = models.CharField(max_length=190)
    legal_name = models.CharField(max_length=190, blank=True, default="")

    # Service profile
    modes = models.JSONField(
        default=list,
        help_text='Transport modes served, e.g. ["ocean", "air"].',
    )
    service_name = models.CharField(
        max_length=190,
        blank=True,
        default="",
        help_text="Headline service, e.g. 'MECL Service - weekly sailing'.",
    )
    headquarters = models.CharField(max_length=190, blank=True, default="")
    contact_email = models.EmailField(blank=True, default="")
    contact_phone = models.CharField(max_length=48, blank=True, default="")

    # Operational reputation, shown next to each company's offer so the
    # customer is comparing service as well as price.
    on_time_performance = models.FloatField(
        null=True, blank=True, help_text="Schedule reliability, 0-100."
    )
    average_response_hours = models.FloatField(
        null=True, blank=True, help_text="Typical agent verification turnaround."
    )

    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="ACTIVE")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "freight_companies"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.code})"

    @property
    def is_bookable(self):
        return self.status == "ACTIVE"


class CompanyAgent(models.Model):
    """Authorises one platform user to act for one freight company.

    Accounts live in MongoDB rather than the Django ORM, so membership is held
    by user id and email rather than a foreign key. Email is the practical
    lookup, because that is what the signed token carries on every request.
    """

    ROLE_CHOICES = [
        ("AGENT", "Company Agent"),
        ("MANAGER", "Company Manager"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        FreightCompany, on_delete=models.CASCADE, related_name="agents"
    )

    user_id = models.CharField(max_length=64, blank=True, default="", db_index=True)
    user_email = models.EmailField(db_index=True)
    display_name = models.CharField(max_length=190, blank=True, default="")

    # A manager may approve the high-value and exception cases an agent has to
    # escalate. Kept as a role on the membership rather than a new platform
    # role, so a person's platform role stays "agent" and their authority is
    # scoped by the company they belong to.
    role = models.CharField(max_length=16, choices=ROLE_CHOICES, default="AGENT")
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "company_agents"
        ordering = ["company__name", "user_email"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "user_email"], name="unique_agent_per_company"
            )
        ]

    def __str__(self):
        return f"{self.user_email} -> {self.company.code} ({self.role})"

    @property
    def can_approve_escalations(self):
        return self.role == "MANAGER"
