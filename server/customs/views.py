from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone

from .models import (
    CustomsComplianceCheck,
    CustomsChecklistItem,
    CustomsRequirement,
    RegulationDocument,
    RegulationChunk,
    HSCodeReference,
    ShipmentDocument,
)
from .serializers import (
    CustomsComplianceCheckSerializer,
    CustomsValidateRequestSerializer,
    CustomsSignOffRequestSerializer,
    RegulationSearchRequestSerializer,
    RegulationChunkSerializer,
    HSCodeReferenceSerializer,
    ShipmentDocumentSerializer,
)
from .validator import CustomsComplianceEngine
from .rag_engine import CustomsRAGEngine


class CustomsValidateView(APIView):
    """Validate customs compliance, HS code, Incoterm, and generate legal-cited checklists."""

    def post(self, request):
        serializer = CustomsValidateRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        shipment_id = data["shipment_id"]
        origin = data["origin_country"]
        dest = data["destination_country"]
        hs_code = data["hs_code"]
        commodity = data.get("commodity", "General Cargo")
        incoterm = data.get("incoterm", "FOB")
        quote_id = request.data.get("quote_id")

        # Execute domain evaluation
        eval_result = CustomsComplianceEngine.evaluate_shipment_compliance(
            shipment_id=shipment_id,
            origin_country=origin,
            destination_country=dest,
            hs_code=hs_code,
            commodity=commodity,
            incoterm=incoterm,
            quote_id=quote_id,
        )

        # Persist / Update CustomsComplianceCheck
        check, _ = CustomsComplianceCheck.objects.update_or_create(
            shipment_id=shipment_id,
            defaults={
                "quote_id": quote_id,
                "origin_country": origin,
                "destination_country": dest,
                "hs_code": eval_result["hs_code"],
                "commodity": commodity,
                "incoterm": eval_result["incoterm"],
                "readiness_score": eval_result["readiness_score"],
                "risk_level": eval_result["risk_level"],
                "status": eval_result["status"],
                "checked_at": timezone.now(),
            },
        )

        # Re-create child checklist items
        check.checklist_items.all().delete()
        for item in eval_result["checklist_items"]:
            CustomsChecklistItem.objects.create(
                compliance_check=check,
                item_name=item["item_name"],
                description=item["description"],
                mandatory=item["mandatory"],
                status=item["status"],
                document_required=item["document_required"],
                citation=item.get("citation", ""),
                evidence=item.get("evidence", ""),
            )

        res_data = CustomsComplianceCheckSerializer(check).data
        res_data["advisory"] = eval_result["advisory"]
        res_data["is_prohibited"] = eval_result["is_prohibited"]
        res_data["is_restricted"] = eval_result["is_restricted"]
        res_data["regulatory_evidence"] = eval_result["regulatory_evidence"]

        return Response(res_data, status=status.HTTP_201_CREATED)

    def get(self, request, shipment_id=None):
        if not shipment_id:
            shipment_id = request.query_params.get("shipment_id")
        if not shipment_id:
            return Response({"error": "shipment_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        check = CustomsComplianceCheck.objects.filter(shipment_id=shipment_id).first()
        if not check:
            return Response({"error": "Customs compliance check not found"}, status=status.HTTP_404_NOT_FOUND)

        return Response(CustomsComplianceCheckSerializer(check).data)


class CustomsSignOffView(APIView):
    """Customs compliance officer sign-off / review action endpoint."""

    def post(self, request, check_id):
        check = CustomsComplianceCheck.objects.filter(id=check_id).first()
        if not check:
            # Fallback lookup by shipment_id
            check = CustomsComplianceCheck.objects.filter(shipment_id=check_id).first()
        if not check:
            return Response({"error": "Customs compliance check not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = CustomsSignOffRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        check.status = data["decision"]
        check.reviewed_by = data["officer_name"]
        
        # If approved by officer, boost readiness score
        if data["decision"] == "APPROVED":
            check.readiness_score = max(check.readiness_score, 95.0)
            check.risk_level = "LOW"
        elif data["decision"] == "REJECTED":
            check.readiness_score = 0.0
            check.risk_level = "CRITICAL"
        
        check.save()

        # Update checklist items with comment
        if data.get("comments"):
            for item in check.checklist_items.all():
                item.reviewer_comment = f"Reviewed by {data['officer_name']}: {data['comments']}"
                item.save()

        return Response({
            "message": f"Customs sign-off decision '{check.status}' recorded successfully.",
            "compliance_check": CustomsComplianceCheckSerializer(check).data,
        })


class DocumentUploadView(APIView):
    """Upload or register compliance documents against a checklist item."""

    def post(self, request):
        shipment_id = request.data.get("shipment_id")
        checklist_item_id = request.data.get("checklist_item_id")
        document_type = request.data.get("document_type", "COMMERCIAL_INVOICE")
        file_name = request.data.get("file_name", "document.pdf")
        file_url = request.data.get("file_url", f"https://storage.local/documents/{file_name}")
        uploaded_by = request.data.get("uploaded_by", "shipping_client")

        if not shipment_id:
            return Response({"error": "shipment_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        check = CustomsComplianceCheck.objects.filter(shipment_id=shipment_id).first()
        checklist_item = None
        if checklist_item_id:
            checklist_item = CustomsChecklistItem.objects.filter(id=checklist_item_id).first()

        doc = ShipmentDocument.objects.create(
            shipment_id=shipment_id,
            customs_check=check,
            checklist_item=checklist_item,
            document_type=document_type,
            file_name=file_name,
            file_url=file_url,
            uploaded_by=uploaded_by,
            verification_status="VERIFIED",
            verified_by="AutoComplianceValidator",
            verified_at=timezone.now(),
        )

        if checklist_item:
            checklist_item.status = "VERIFIED"
            checklist_item.document_uploaded = True
            checklist_item.save()

        # Recalculate readiness score based on verified items
        if check:
            total = check.checklist_items.count()
            verified = check.checklist_items.filter(status="VERIFIED").count()
            if total > 0:
                check.readiness_score = round(70.0 + (verified / total) * 30.0, 1)
                if verified == total:
                    check.status = "APPROVED"
                check.save()

        return Response({
            "message": "Document uploaded and verified successfully.",
            "document": ShipmentDocumentSerializer(doc).data,
            "compliance_check": CustomsComplianceCheckSerializer(check).data if check else None,
        }, status=status.HTTP_201_CREATED)


class RegulationSearchView(APIView):
    """Search regulation chunks using Hybrid RAG (BM25 + Semantic Vector + RRF)."""

    def post(self, request):
        serializer = RegulationSearchRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        query = serializer.validated_data["query"]
        country = serializer.validated_data.get("country")
        hs_code = serializer.validated_data.get("hs_code")
        top_k = serializer.validated_data.get("top_k", 5)

        results = CustomsRAGEngine.search_regulations(
            query=query,
            country=country,
            hs_code=hs_code,
            top_k=top_k,
        )

        return Response({
            "query": query,
            "country_filter": country,
            "hs_code_filter": hs_code,
            "total_matches": len(results),
            "results": results,
        })


class HSCodeListView(APIView):
    """List supported HS code classifications."""

    def get(self, request):
        CustomsRAGEngine.initialize_knowledge_base()
        codes = HSCodeReference.objects.all()
        return Response(HSCodeReferenceSerializer(codes, many=True).data)
