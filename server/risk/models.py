import uuid
from django.db import models
from django.utils import timezone


class ShipmentRiskAssessment(models.Model):
    """Explainable composite shipment risk evaluation."""

    RISK_LEVEL_CHOICES = [
        ("LOW", "Low Risk (0-30)"),
        ("MEDIUM", "Medium Risk (31-60)"),
        ("HIGH", "High Risk (61-80)"),
        ("CRITICAL", "Critical Risk (81-100)"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shipment_id = models.CharField(max_length=128, db_index=True)
    quote_id = models.CharField(max_length=128, null=True, blank=True, db_index=True)
    
    weather_score = models.FloatField(default=0.0, help_text="Weather risk score (0-100)")
    customs_score = models.FloatField(default=0.0, help_text="Customs risk score (0-100)")
    route_score = models.FloatField(default=0.0, help_text="Route risk score (0-100)")
    port_score = models.FloatField(default=0.0, help_text="Port congestion risk score (0-100)")
    cargo_score = models.FloatField(default=0.0, help_text="Cargo sensitivity risk score (0-100)")
    
    overall_score = models.FloatField(default=0.0, help_text="Weighted composite risk score (0-100)")
    risk_level = models.CharField(max_length=20, choices=RISK_LEVEL_CHOICES, default="LOW")
    confidence_score = models.FloatField(default=0.95, help_text="Confidence metric (0.0 to 1.0)")
    
    explanation = models.JSONField(default=dict, blank=True, help_text="Structured explainability breakdown and narrative")
    assessed_at = models.DateTimeField(default=timezone.now)
    model_version = models.CharField(max_length=32, default="v1.0-composite")
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "shipment_risk_assessments"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["shipment_id", "created_at"]),
            models.Index(fields=["overall_score"]),
        ]

    def __str__(self):
        return f"RiskAssessment {self.shipment_id} - Score: {self.overall_score:.1f} ({self.risk_level})"


class RiskFactor(models.Model):
    """Granular factor-level contribution to the overall composite risk score."""

    FACTOR_TYPE_CHOICES = [
        ("WEATHER", "Weather & Ocean"),
        ("CUSTOMS", "Customs & Regulatory"),
        ("ROUTE", "Transit & Chokepoint"),
        ("PORT", "Port Congestion & Dwell"),
        ("CARGO", "Cargo & Commodity Type"),
    ]

    SEVERITY_CHOICES = [
        ("LOW", "Low"),
        ("MEDIUM", "Medium"),
        ("HIGH", "High"),
        ("CRITICAL", "Critical"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    risk_assessment = models.ForeignKey(
        ShipmentRiskAssessment,
        on_delete=models.CASCADE,
        related_name="factors",
    )
    factor_type = models.CharField(max_length=32, choices=FACTOR_TYPE_CHOICES)
    factor_name = models.CharField(max_length=128)
    score = models.FloatField(default=0.0, help_text="Normalized factor score (0-100)")
    weight = models.FloatField(default=0.2, help_text="Configured factor weight (0.0 - 1.0)")
    contribution = models.FloatField(default=0.0, help_text="Absolute points contributed to overall score")
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default="LOW")
    reason = models.TextField(help_text="Plain-English explanation of why this factor received this score")
    source = models.CharField(max_length=128, default="Risk Engine")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "risk_factors"
        ordering = ["-contribution"]

    def __str__(self):
        return f"Factor [{self.factor_type}] {self.factor_name}: {self.score:.1f} (Contrib: {self.contribution:.1f})"


class RiskAlert(models.Model):
    """High-priority risk events that notify shipping agents or require acknowledgement."""

    SEVERITY_CHOICES = [
        ("LOW", "Low"),
        ("MEDIUM", "Medium"),
        ("HIGH", "High"),
        ("CRITICAL", "Critical"),
    ]

    STATUS_CHOICES = [
        ("ACTIVE", "Active"),
        ("ACKNOWLEDGED", "Acknowledged"),
        ("RESOLVED", "Resolved"),
        ("DISMISSED", "Dismissed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shipment_id = models.CharField(max_length=128, null=True, blank=True, db_index=True)
    quote_id = models.CharField(max_length=128, null=True, blank=True, db_index=True)
    risk_assessment = models.ForeignKey(
        ShipmentRiskAssessment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="alerts",
    )
    alert_type = models.CharField(max_length=64, default="RISK_THRESHOLD_BREACH")
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default="MEDIUM")
    title = models.CharField(max_length=255)
    message = models.TextField()
    source = models.CharField(max_length=64, default="Risk Engine")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="ACTIVE")
    
    acknowledged_by = models.CharField(max_length=128, null=True, blank=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.CharField(max_length=128, null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "risk_alerts"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "severity"]),
        ]

    def __str__(self):
        return f"RiskAlert [{self.severity}] {self.title} ({self.status})"
