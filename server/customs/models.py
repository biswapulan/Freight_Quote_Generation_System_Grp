import uuid
from django.db import models
from django.utils import timezone


class HSCodeReference(models.Model):
    """Harmonized System (HS) code classification and commodity lookup table."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hs_code = models.CharField(max_length=16, unique=True, db_index=True)
    description = models.TextField()
    chapter = models.CharField(max_length=8, blank=True)
    heading = models.CharField(max_length=8, blank=True)
    subheading = models.CharField(max_length=8, blank=True)
    commodity_type = models.CharField(max_length=64, default="General Cargo")
    
    restricted = models.BooleanField(default=False)
    prohibited = models.BooleanField(default=False)
    country = models.CharField(max_length=64, default="GLOBAL")
    
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)
    source = models.CharField(max_length=128, default="WCO")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "hs_code_references"
        ordering = ["hs_code"]
        indexes = [
            models.Index(fields=["commodity_type"]),
            models.Index(fields=["restricted", "prohibited"]),
        ]

    def __str__(self):
        return f"{self.hs_code} - {self.description[:40]}"


class RegulationDocument(models.Model):
    """Corpus of trade legislation, tariff books, bilateral agreements, and restrictions."""

    STATUS_CHOICES = [
        ("ACTIVE", "Active"),
        ("DRAFT", "Draft"),
        ("ARCHIVED", "Archived"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    country = models.CharField(max_length=64)
    authority = models.CharField(max_length=128, help_text="e.g. US_CBP, EU_TAXUD, CBIC_INDIA")
    document_type = models.CharField(max_length=64, default="TARIFF_SCHEDULE")
    source_url = models.URLField(max_length=500, null=True, blank=True)
    source_name = models.CharField(max_length=128, default="Official Customs Authority")
    version = models.CharField(max_length=32, default="1.0")
    
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    
    content = models.TextField(help_text="Full text of regulatory document or chapter")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="ACTIVE")
    last_synced_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "regulation_documents"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["country", "authority"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.country} - {self.authority})"


class RegulationChunk(models.Model):
    """Chunked passages of regulation documents with embeddings for hybrid RAG search."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    regulation_document = models.ForeignKey(
        RegulationDocument,
        on_delete=models.CASCADE,
        related_name="chunks",
    )
    chunk_index = models.IntegerField(default=0)
    content = models.TextField()
    embedding = models.JSONField(null=True, blank=True, help_text="Dense vector representation (float array)")
    metadata = models.JSONField(default=dict, blank=True)
    page_number = models.IntegerField(null=True, blank=True)
    section_name = models.CharField(max_length=128, null=True, blank=True)
    
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "regulation_chunks"
        ordering = ["regulation_document", "chunk_index"]
        indexes = [
            models.Index(fields=["regulation_document", "chunk_index"]),
        ]

    def __str__(self):
        return f"Chunk #{self.chunk_index} for {self.regulation_document.title[:30]}"


class CustomsRequirement(models.Model):
    """Country-pair and commodity-specific regulatory requirement rules."""

    REQUIREMENT_TYPE_CHOICES = [
        ("TARIFF", "Tariff / Duty"),
        ("RESTRICTION", "Trade Restriction"),
        ("PROHIBITION", "Prohibited Good"),
        ("DOCUMENT", "Mandatory Documentation"),
        ("INSPECTION", "Physical/Quarantine Inspection"),
        ("SANCTION", "Trade Sanction"),
    ]

    RISK_LEVEL_CHOICES = [
        ("LOW", "Low Risk"),
        ("MEDIUM", "Medium Risk"),
        ("HIGH", "High Risk"),
        ("CRITICAL", "Critical Risk"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    origin_country = models.CharField(max_length=64, db_index=True)
    destination_country = models.CharField(max_length=64, db_index=True)
    hs_code = models.CharField(max_length=16, blank=True, db_index=True)
    commodity = models.CharField(max_length=128, blank=True)
    incoterm = models.CharField(max_length=16, blank=True)
    
    requirement_type = models.CharField(max_length=32, choices=REQUIREMENT_TYPE_CHOICES, default="DOCUMENT")
    description = models.TextField()
    mandatory = models.BooleanField(default=True)
    risk_level = models.CharField(max_length=20, choices=RISK_LEVEL_CHOICES, default="LOW")
    
    regulation = models.ForeignKey(RegulationDocument, on_delete=models.SET_NULL, null=True, blank=True)
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)
    active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "customs_requirements"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["origin_country", "destination_country"]),
            models.Index(fields=["hs_code", "active"]),
        ]

    def __str__(self):
        return f"{self.origin_country}->{self.destination_country} [{self.requirement_type}] {self.description[:40]}"


class CustomsDocumentRequirement(models.Model):
    """Specific document requirements mapped to a customs requirement."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customs_requirement = models.ForeignKey(
        CustomsRequirement,
        on_delete=models.CASCADE,
        related_name="document_requirements",
    )
    document_type = models.CharField(max_length=64, help_text="e.g. COO, COMMERCIAL_INVOICE, MSDS, PHYTOSANITARY")
    document_name = models.CharField(max_length=128)
    mandatory = models.BooleanField(default=True)
    description = models.TextField(blank=True)
    accepted_formats = models.CharField(max_length=128, default="PDF,PNG,JPG,DOCX")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "customs_document_requirements"

    def __str__(self):
        return f"{self.document_name} ({'Mandatory' if self.mandatory else 'Optional'})"


class CustomsComplianceCheck(models.Model):
    """Evaluation result for a specific shipment/quote compliance assessment."""

    STATUS_CHOICES = [
        ("APPROVED", "Approved"),
        ("NEEDS_DOCUMENTS", "Needs Documents"),
        ("NEEDS_REVIEW", "Needs Officer Review"),
        ("REJECTED", "Rejected"),
        ("PENDING", "Pending"),
    ]

    RISK_LEVEL_CHOICES = [
        ("LOW", "Low Risk"),
        ("MEDIUM", "Medium Risk"),
        ("HIGH", "High Risk"),
        ("CRITICAL", "Critical Risk"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shipment_id = models.CharField(max_length=128, db_index=True)
    quote_id = models.CharField(max_length=128, null=True, blank=True, db_index=True)
    
    origin_country = models.CharField(max_length=64)
    destination_country = models.CharField(max_length=64)
    hs_code = models.CharField(max_length=16)
    commodity = models.CharField(max_length=128)
    incoterm = models.CharField(max_length=16, blank=True)
    
    readiness_score = models.FloatField(default=0.0, help_text="Readiness score (0-100%)")
    risk_level = models.CharField(max_length=20, choices=RISK_LEVEL_CHOICES, default="LOW")
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="PENDING")
    
    checked_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_by = models.CharField(max_length=128, null=True, blank=True)
    reviewed_by = models.CharField(max_length=128, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "customs_compliance_checks"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["shipment_id", "status"]),
        ]

    def __str__(self):
        return f"Compliance Check {self.shipment_id} - Score: {self.readiness_score}% [{self.status}]"


class CustomsChecklistItem(models.Model):
    """Actionable requirement checklist items for compliance verification."""

    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("UPLOADED", "Uploaded"),
        ("VERIFIED", "Verified"),
        ("WAIVED", "Waived"),
        ("REJECTED", "Rejected"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    compliance_check = models.ForeignKey(
        CustomsComplianceCheck,
        on_delete=models.CASCADE,
        related_name="checklist_items",
    )
    requirement_id = models.CharField(max_length=128, null=True, blank=True)
    item_name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    mandatory = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")
    
    document_required = models.BooleanField(default=False)
    document_uploaded = models.BooleanField(default=False)
    evidence = models.TextField(blank=True, help_text="Regulatory proof/evidence statement")
    citation = models.TextField(blank=True, help_text="Legal clause or regulation citation reference")
    reviewer_comment = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "customs_checklist_items"
        ordering = ["-mandatory", "item_name"]

    def __str__(self):
        return f"Checklist Item: {self.item_name} [{self.status}]"


class ShipmentDocument(models.Model):
    """Physical or digital file uploaded for customs verification."""

    VERIFICATION_STATUS_CHOICES = [
        ("PENDING", "Pending Verification"),
        ("VERIFIED", "Verified & Accepted"),
        ("REJECTED", "Rejected"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shipment_id = models.CharField(max_length=128, db_index=True)
    customs_check = models.ForeignKey(
        CustomsComplianceCheck,
        on_delete=models.SET_NULL,
        related_name="documents",
        null=True,
        blank=True,
    )
    checklist_item = models.ForeignKey(
        CustomsChecklistItem,
        on_delete=models.SET_NULL,
        related_name="uploaded_documents",
        null=True,
        blank=True,
    )
    document_type = models.CharField(max_length=64)
    file_name = models.CharField(max_length=255)
    file_url = models.CharField(max_length=500)
    mime_type = models.CharField(max_length=64, blank=True)
    file_size = models.IntegerField(default=0, help_text="File size in bytes")
    
    uploaded_by = models.CharField(max_length=128, blank=True)
    uploaded_at = models.DateTimeField(default=timezone.now)
    verification_status = models.CharField(max_length=20, choices=VERIFICATION_STATUS_CHOICES, default="PENDING")
    verified_by = models.CharField(max_length=128, null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "shipment_documents"
        ordering = ["-uploaded_at"]
        indexes = [
            models.Index(fields=["shipment_id", "document_type"]),
        ]

    def __str__(self):
        return f"{self.file_name} ({self.document_type}) [{self.verification_status}]"
