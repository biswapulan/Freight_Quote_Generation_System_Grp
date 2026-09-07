"""Orchestration telemetry.

One OrchestrationRun per analyse call, with one AgentInvocation per agent that
ran inside it. This is what the Admin portal's "AI Agent Monitor" (PDF section 6)
reports on — previously a hardcoded array in the React component.
"""

import uuid

from django.db import models


class OrchestrationRun(models.Model):
    """A single pass of the agent pipeline over one shipment."""

    STATUS_CHOICES = (
        ("RUNNING", "Running"),
        ("COMPLETED", "Completed"),
        ("DEGRADED", "Completed with degraded agents"),
        ("FAILED", "Failed"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shipment_id = models.CharField(max_length=64, db_index=True)
    quote_id = models.CharField(max_length=64, blank=True, default="", db_index=True)

    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="RUNNING")
    duration_ms = models.IntegerField(default=0)

    # Names of agents that fell back rather than producing a first-class result.
    degraded_agents = models.JSONField(default=list, blank=True)
    result = models.JSONField(null=True, blank=True)

    triggered_by = models.CharField(max_length=64, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Run {self.id} ({self.shipment_id}) {self.status}"


class AgentInvocation(models.Model):
    """Per-agent record within a run — the unit the AI Agent Monitor charts."""

    STATUS_CHOICES = (
        ("OK", "Succeeded"),
        ("DEGRADED", "Fell back"),
        ("FAILED", "Failed"),
    )

    AGENT_CHOICES = (
        ("ROUTE", "Route Agent"),
        ("PRICING", "Pricing Agent"),
        ("WEATHER", "Weather Agent"),
        ("CUSTOMS", "Customs Agent"),
        ("RISK", "Risk Agent"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.ForeignKey(
        OrchestrationRun, on_delete=models.CASCADE, related_name="invocations"
    )
    agent = models.CharField(max_length=24, choices=AGENT_CHOICES, db_index=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="OK")
    duration_ms = models.IntegerField(default=0)

    summary = models.CharField(max_length=256, blank=True, default="")
    error = models.TextField(blank=True, default="")
    output = models.JSONField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.agent} {self.status} ({self.duration_ms}ms)"
