from rest_framework import serializers
from .models import (
    HSCodeReference,
    RegulationDocument,
    RegulationChunk,
    CustomsRequirement,
    CustomsDocumentRequirement,
    CustomsComplianceCheck,
    CustomsChecklistItem,
    ShipmentDocument,
)


class HSCodeReferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = HSCodeReference
        fields = "__all__"


class RegulationChunkSerializer(serializers.ModelSerializer):
    class Meta:
        model = RegulationChunk
        fields = "__all__"


class RegulationDocumentSerializer(serializers.ModelSerializer):
    chunks = RegulationChunkSerializer(many=True, read_only=True)

    class Meta:
        model = RegulationDocument
        fields = "__all__"


class CustomsDocumentRequirementSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomsDocumentRequirement
        fields = "__all__"


class CustomsRequirementSerializer(serializers.ModelSerializer):
    document_requirements = CustomsDocumentRequirementSerializer(many=True, read_only=True)

    class Meta:
        model = CustomsRequirement
        fields = "__all__"


class CustomsChecklistItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomsChecklistItem
        fields = "__all__"


class ShipmentDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShipmentDocument
        fields = "__all__"


class CustomsComplianceCheckSerializer(serializers.ModelSerializer):
    checklist_items = CustomsChecklistItemSerializer(many=True, read_only=True)
    documents = ShipmentDocumentSerializer(many=True, read_only=True)

    class Meta:
        model = CustomsComplianceCheck
        fields = "__all__"


class CustomsValidateRequestSerializer(serializers.Serializer):
    shipment_id = serializers.CharField(required=True)
    origin_country = serializers.CharField(required=True, max_length=64)
    destination_country = serializers.CharField(required=True, max_length=64)
    hs_code = serializers.CharField(required=True, max_length=16)
    commodity = serializers.CharField(required=False, default="General Cargo", max_length=128)
    incoterm = serializers.CharField(required=False, default="FOB", max_length=16)


class CustomsSignOffRequestSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=["APPROVED", "REJECTED", "NEEDS_DOCUMENTS"])
    officer_name = serializers.CharField(required=True, max_length=128)
    comments = serializers.CharField(required=False, allow_blank=True)


class RegulationSearchRequestSerializer(serializers.Serializer):
    query = serializers.CharField(required=True)
    country = serializers.CharField(required=False, allow_blank=True)
    hs_code = serializers.CharField(required=False, allow_blank=True)
    top_k = serializers.IntegerField(required=False, default=5)
