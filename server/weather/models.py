import uuid
from django.db import models
from django.utils import timezone


class WeatherAssessment(models.Model):
    """Stores high-level weather risk evaluation for a shipment route and departure window."""

    RISK_LEVEL_CHOICES = [
        ("LOW", "Low Risk"),
        ("MEDIUM", "Medium Risk"),
        ("HIGH", "High Risk"),
        ("CRITICAL", "Critical Risk"),
    ]

    STATUS_CHOICES = [
        ("COMPLETED", "Completed"),
        ("PENDING", "Pending"),
        ("FAILED", "Failed"),
        ("STALE", "Stale"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shipment_id = models.CharField(max_length=128, db_index=True)
    quote_id = models.CharField(max_length=128, null=True, blank=True, db_index=True)
    route_id = models.CharField(max_length=128, null=True, blank=True, db_index=True)

    risk_score = models.FloatField(default=0.0, help_text="Composite weather risk score (0-100)")
    risk_level = models.CharField(max_length=20, choices=RISK_LEVEL_CHOICES, default="LOW")
    
    storm_risk = models.FloatField(default=0.0, help_text="Storm risk score (0-100)")
    rainfall_risk = models.FloatField(default=0.0, help_text="Precipitation/Rainfall risk score (0-100)")
    wind_risk = models.FloatField(default=0.0, help_text="Gale/Wind speed risk score (0-100)")
    wave_risk = models.FloatField(default=0.0, help_text="Ocean wave/swell risk score (0-100)")
    temperature_risk = models.FloatField(default=0.0, help_text="Temperature extreme risk score (0-100)")
    
    delay_probability = models.FloatField(default=0.0, help_text="Predicted probability of transit delay (0.0 to 1.0 or 0-100%)")
    assessment_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="COMPLETED")
    provider = models.CharField(max_length=64, default="open-meteo")
    provider_timestamp = models.DateTimeField(default=timezone.now)
    assessed_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(null=True, blank=True)
    confidence_score = models.FloatField(default=1.0, help_text="Confidence metric (0.0 - 1.0)")
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "weather_assessments"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["shipment_id", "created_at"]),
            models.Index(fields=["route_id"]),
        ]

    def __str__(self):
        return f"WeatherAssessment {self.shipment_id} - Score: {self.risk_score} ({self.risk_level})"


class WeatherObservation(models.Model):
    """Waypoint-level meteorological and oceanographic observation data along the route."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    route_id = models.CharField(max_length=128, db_index=True)
    weather_assessment = models.ForeignKey(
        WeatherAssessment,
        on_delete=models.CASCADE,
        related_name="observations",
        null=True,
        blank=True,
    )
    latitude = models.FloatField()
    longitude = models.FloatField()
    observation_time = models.DateTimeField(default=timezone.now)
    
    temperature = models.FloatField(default=20.0, help_text="Surface temperature in °C")
    wind_speed = models.FloatField(default=0.0, help_text="Wind speed in knots/kmh")
    wind_direction = models.FloatField(default=0.0, help_text="Wind direction in degrees (0-360)")
    rainfall = models.FloatField(default=0.0, help_text="Precipitation in mm/h")
    wave_height = models.FloatField(default=0.0, help_text="Significant wave height in meters")
    visibility = models.FloatField(default=10.0, help_text="Visibility in km")
    pressure = models.FloatField(default=1013.25, help_text="Atmospheric pressure in hPa")
    weather_condition = models.CharField(max_length=64, default="Clear")
    
    storm_detected = models.BooleanField(default=False)
    storm_type = models.CharField(max_length=64, null=True, blank=True)
    storm_severity = models.CharField(max_length=32, null=True, blank=True)
    provider = models.CharField(max_length=64, default="open-meteo")
    raw_payload = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "weather_observations"
        ordering = ["observation_time"]
        indexes = [
            models.Index(fields=["route_id", "observation_time"]),
        ]

    def __str__(self):
        return f"Observation ({self.latitude}, {self.longitude}) - Wind: {self.wind_speed}kt, Wave: {self.wave_height}m"


class WeatherAlert(models.Model):
    """Severe weather warning and marine hazard alerts."""

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
        ("EXPIRED", "Expired"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shipment_id = models.CharField(max_length=128, null=True, blank=True, db_index=True)
    route_id = models.CharField(max_length=128, null=True, blank=True, db_index=True)
    alert_type = models.CharField(max_length=64, default="GALE_WARNING")
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default="MEDIUM")
    title = models.CharField(max_length=255)
    message = models.TextField()
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    
    starts_at = models.DateTimeField(default=timezone.now)
    ends_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="ACTIVE")
    
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    acknowledged_by = models.CharField(max_length=128, null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "weather_alerts"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "severity"]),
        ]

    def __str__(self):
        return f"[{self.severity}] {self.title} ({self.status})"
