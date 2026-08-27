import uuid
from django.db import models
from django.utils import timezone


class DataFreshness(models.Model):
    """Tracks freshness and availability status of external data feeds (Weather, Tariff schedules, etc.)."""

    STATUS_CHOICES = [
        ("HEALTHY", "Healthy & Fresh"),
        ("DEGRADED", "Degraded / Stale"),
        ("OUTAGE", "Outage / Sync Failure"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    provider = models.CharField(max_length=64, db_index=True)
    data_type = models.CharField(max_length=64, help_text="e.g. WEATHER_FORECAST, TARIFF_SCHEDULE, PORT_CONGESTION")
    last_success_at = models.DateTimeField(default=timezone.now)
    last_attempt_at = models.DateTimeField(default=timezone.now)
    record_count = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="HEALTHY")
    freshness_seconds = models.IntegerField(default=0, help_text="Data age lag in seconds")
    error_message = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "data_freshness_logs"
        ordering = ["provider", "data_type"]
        unique_together = ("provider", "data_type")

    def __str__(self):
        return f"{self.provider} ({self.data_type}) - Status: {self.status} (Age: {self.freshness_seconds}s)"


class IntegrationSyncLog(models.Model):
    """Audit log of sync jobs executed against external data providers."""

    STATUS_CHOICES = [
        ("SUCCESS", "Success"),
        ("PARTIAL", "Partial Success"),
        ("FAILED", "Failed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    provider = models.CharField(max_length=64, db_index=True)
    integration_type = models.CharField(max_length=64)
    started_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="SUCCESS")
    records_processed = models.IntegerField(default=0)
    records_failed = models.IntegerField(default=0)
    error_message = models.TextField(blank=True)
    request_id = models.CharField(max_length=128, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "integration_sync_logs"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Sync [{self.provider}] {self.integration_type}: {self.status} ({self.records_processed} records)"


class AlertSubscription(models.Model):
    """User preferences for notification delivery channels on alerts."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.CharField(max_length=128, db_index=True)
    alert_type = models.CharField(max_length=64, default="ALL")
    min_severity = models.CharField(max_length=20, default="MEDIUM")
    email_enabled = models.BooleanField(default=True)
    teams_enabled = models.BooleanField(default=False)
    slack_enabled = models.BooleanField(default=False)
    active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "alert_subscriptions"

    def __str__(self):
        return f"AlertSub user={self.user_id} type={self.alert_type} (Email: {self.email_enabled})"
