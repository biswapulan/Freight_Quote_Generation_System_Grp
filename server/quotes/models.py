import uuid
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


def generate_shipment_id():
    return f"SHP-{uuid.uuid4().hex[:8].upper()}"


def generate_quote_id():
    return f"QTE-{uuid.uuid4().hex[:8].upper()}"


class Shipment(models.Model):
    """Mentor Specification Model: Shipment.
    
    Fields: id, customerId, origin, destination, cargoType, weight, volume, transportMode, status
    """
    STATUS_CHOICES = (
        ("DRAFT", "Draft"),
        ("SUBMITTED", "Submitted"),
        ("PROCESSING", "Processing"),
        ("ANALYZED", "Analyzed"),
        ("QUOTED", "Quoted"),
        ("CLOSED", "Closed"),
        ("CANCELLED", "Cancelled"),
        # Legacy mappings
        ("CREATED", "Created (Legacy)"),
        ("APPROVED", "Approved (Legacy)"),
        ("REJECTED", "Rejected (Legacy)"),
        ("IN_TRANSIT", "In Transit (Legacy)"),
        ("DELIVERED", "Delivered (Legacy)"),
    )

    id = models.CharField(max_length=64, primary_key=True, default=generate_shipment_id)
    customer_id = models.CharField(max_length=64, db_index=True)
    customer_email = models.EmailField(blank=True, default="")
    origin = models.CharField(max_length=128)
    destination = models.CharField(max_length=128)
    cargo_type = models.CharField(max_length=128, default="General Cargo")
    weight = models.FloatField(help_text="Weight in kilograms (kg)")
    volume = models.FloatField(help_text="Volume in cubic meters (cbm)")
    transport_mode = models.CharField(max_length=32, default="ocean", help_text="ocean, air, road, rail")
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="SUBMITTED")

    # Container & tariff classification — consumed by the Customs and Risk agents (PDF section 8).
    container_type = models.CharField(max_length=32, blank=True, default="40FT")
    hs_code = models.CharField(max_length=16, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.id} ({self.origin} -> {self.destination})"

    @property
    def customerId(self):
        return self.customer_id

    @property
    def cargoType(self):
        return self.cargo_type

    @property
    def transportMode(self):
        return self.transport_mode


class Quote(models.Model):
    """Mentor Specification Model: Quote.
    
    Fields: id, shipmentId, distance, basePrice, distanceCharge, weightCharge, fuelCharge, totalPrice, status
    """
    STATUS_CHOICES = (
        ("DRAFT", "Draft"),
        ("GENERATED", "Generated"),
        ("PENDING_REVIEW", "Pending Review"),
        ("APPROVED", "Approved"),
        ("SENT", "Sent to Customer"),
        ("ACCEPTED", "Accepted by Customer"),
        ("REJECTED", "Rejected"),
        ("EXPIRED", "Expired"),
        # Legacy mappings
        ("PENDING", "Pending (Legacy)"),
    )

    id = models.CharField(max_length=64, primary_key=True, default=generate_quote_id)
    shipment = models.ForeignKey(Shipment, on_delete=models.CASCADE, related_name="quotes")
    customer_id = models.CharField(max_length=64, db_index=True)
    distance = models.FloatField(help_text="Distance in kilometers (km) or nautical miles")
    base_price = models.FloatField(help_text="Fixed base booking/terminal charge ($)")
    distance_charge = models.FloatField(help_text="Distance charge based on rate per km ($)")
    weight_charge = models.FloatField(help_text="Weight charge based on mass ($)")
    fuel_charge = models.FloatField(help_text="Fuel bunker / surcharge ($)")
    total_price = models.FloatField(help_text="Total calculated price ($)")
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="PENDING_REVIEW")
    admin_notes = models.TextField(blank=True, default="")
    currency = models.CharField(max_length=8, default="USD")

    # ---- M1: Route Intelligence -------------------------------------------------
    estimated_transit_days = models.IntegerField(null=True, blank=True)
    route_id = models.CharField(max_length=64, blank=True, default="")
    route_path = models.CharField(max_length=256, blank=True, default="")
    carrier = models.CharField(max_length=128, blank=True, default="")

    # ---- M2: AI Pricing Intelligence (PDF section 8) ----------------------------
    ai_predicted_price = models.FloatField(null=True, blank=True)
    recommended_price = models.FloatField(null=True, blank=True)
    pricing_strategy = models.CharField(max_length=48, blank=True, default="")
    ml_status = models.CharField(
        max_length=24,
        default="UNAVAILABLE",
        help_text="PREDICTED when the ML model answered, FALLBACK_RULE when it did not.",
    )

    # ---- M3: Risk Intelligence (PDF section 8) ----------------------------------
    weather_risk_score = models.FloatField(null=True, blank=True)
    customs_risk_score = models.FloatField(null=True, blank=True)
    route_risk_score = models.FloatField(null=True, blank=True)
    overall_risk_score = models.FloatField(null=True, blank=True)
    overall_risk_level = models.CharField(max_length=16, blank=True, default="")
    policy_action = models.CharField(max_length=48, blank=True, default="")
    requires_human_review = models.BooleanField(default=True)

    # Full orchestrator output, kept verbatim so dashboards can explain every number.
    analysis = models.JSONField(null=True, blank=True)

    # ---- Carrier selection & agent assignment -----------------------------------
    # The customer picks a carrier as the last step of their enquiry. Each
    # carrier is serviced by its own freight agent, and that agent alone works
    # the quote. This lived only in the customer's browser before, so the agent
    # desk could not tell which carrier had been asked for, let alone whose
    # queue the quote belonged in.
    selected_carrier = models.CharField(max_length=128, blank=True, default="")
    assigned_agent_email = models.CharField(max_length=254, blank=True, default="")
    assigned_agent_name = models.CharField(max_length=190, blank=True, default="")
    carrier_selected_at = models.DateTimeField(null=True, blank=True)

    # ---- Human review (PDF section 3, step 10) ----------------------------------
    reviewed_by = models.CharField(max_length=128, blank=True, default="")
    review_reason = models.TextField(blank=True, default="")
    original_total_price = models.FloatField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.id} for {self.shipment_id} - ${self.total_price:.2f} ({self.status})"

    @property
    def shipmentId(self):
        return self.shipment_id

    @property
    def basePrice(self):
        return self.base_price

    @property
    def distanceCharge(self):
        return self.distance_charge

    @property
    def weightCharge(self):
        return self.weight_charge

    @property
    def fuelCharge(self):
        return self.fuel_charge

    @property
    def totalPrice(self):
        return self.total_price

    @property
    def distance_km(self):
        """Alias — the mentor spec refers to this field as distance in km."""
        return self.distance
