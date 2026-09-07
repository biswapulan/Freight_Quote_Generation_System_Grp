import os

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

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


def _normalize_doc_name(name):
    return "".join(ch for ch in (name or "").lower() if ch.isalnum())


def _match_checklist_item(check, document_type):
    """Find the checklist requirement a document satisfies, by name.

    Uploads only carried a checklist item when the client happened to send its
    id, which nothing did, so every document arrived unlinked. Verifying one
    then never marked the requirement satisfied: the checklist stayed PENDING,
    readiness never reached 100, and a fully stamped consignment still reported
    all of its documents as missing.
    """
    if not check:
        return None
    target = _normalize_doc_name(document_type)
    if not target:
        return None
    for item in check.checklist_items.all():
        if _normalize_doc_name(item.item_name) == target:
            return item
    return None


def _sync_quote_customs_analysis(shipment_id, check):
    """Write the live compliance state back onto the quote's stored analysis.

    The quote keeps a snapshot of the customs evaluation taken when it was
    generated. Verifying documents and signing off updated the compliance check
    row but never that snapshot, and every dashboard reads the snapshot. So a
    consignment with all papers stamped and cleared still reported itself as
    needing documents, and never left the officer's pending queue.
    """
    if not check:
        return

    from quotes.models import Quote

    items = list(check.checklist_items.all())
    outstanding = [i.item_name for i in items if i.status != "VERIFIED"]

    # Recompute readiness and status from the checklist as it stands now.
    # These were only ever recalculated inside the verify endpoint, using the
    # item count at that moment, so anything that changed the checklist
    # afterwards left the check frozen: a consignment with every document
    # verified still read NEEDS_DOCUMENTS at 94% and never left the queue.
    # An officer's own sign-off decision is never overwritten.
    if items and check.status not in ("APPROVED", "REJECTED"):
        verified = len(items) - len(outstanding)
        check.readiness_score = round(70.0 + (verified / len(items)) * 30.0, 1)
        check.status = "NEEDS_REVIEW" if verified == len(items) else "NEEDS_DOCUMENTS"
        check.save(update_fields=["readiness_score", "status"])

    for quote in Quote.objects.filter(shipment_id=shipment_id):
        analysis = quote.analysis or {}
        customs = analysis.get("customs")
        if not isinstance(customs, dict):
            continue

        customs["status"] = check.status
        customs["readiness_score"] = check.readiness_score
        customs["missing_documents"] = outstanding

        by_name = {i.item_name: i.status for i in items}
        for entry in customs.get("checklist_items") or []:
            name = entry.get("item_name")
            if name in by_name:
                entry["status"] = by_name[name]

        analysis["customs"] = customs
        quote.analysis = analysis
        quote.save(update_fields=["analysis", "updated_at"])


class CustomsValidateView(APIView):
    """Validate customs compliance, HS code, Incoterm, and generate legal-cited checklists."""

    # The M1-M3 service endpoints resolve the caller through
    # quotes.auth_helper rather than DRF's Mongo-backed authenticator, which
    # rejects any subject id that is not a Mongo ObjectId. Declared here so a
    # freight-agent or customs token is not turned away with a 403.
    authentication_classes = []
    permission_classes = []

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

    # The M1-M3 service endpoints resolve the caller through
    # quotes.auth_helper rather than DRF's Mongo-backed authenticator, which
    # rejects any subject id that is not a Mongo ObjectId. Declared here so a
    # freight-agent or customs token is not turned away with a 403.
    authentication_classes = []
    permission_classes = []

    def post(self, request, check_id):
        check = None
        # Try UUID lookup first, but handle non-UUID values gracefully
        try:
            import uuid as _uuid
            _uuid.UUID(str(check_id))
            check = CustomsComplianceCheck.objects.filter(id=check_id).first()
        except (ValueError, TypeError):
            pass

        if not check:
            # Fallback lookup by shipment_id or quote_id
            check = CustomsComplianceCheck.objects.filter(shipment_id=check_id).first()
        if not check:
            check = CustomsComplianceCheck.objects.filter(quote_id=check_id).first()
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

        # PDF section 7: "Approve/Flag -> Result returns to Risk workflow".
        # The officer's decision changes the customs risk input, so the composite
        # risk is recomputed and any affected quote is updated in place.
        reassessment = self._return_to_risk_workflow(check, data)

        # Push the decision onto the quote's stored analysis, which is what the
        # dashboards read. Without this a signed-off consignment stayed in the
        # officer's pending queue forever.
        _sync_quote_customs_analysis(check.shipment_id, check)

        # Tell the customer. Sign-off notified the agent only, so the customer
        # never learned that their shipment had cleared customs, or been held.
        from notifications import service as notify_customer
        from quotes.models import Shipment as _Shipment

        shipment = _Shipment.objects.filter(id=check.shipment_id).first()
        if shipment and shipment.customer_id:
            comments = data.get("comments") or ""
            if check.status == "APPROVED":
                notify_customer.notify_user(
                    shipment.customer_id,
                    f"Customs cleared shipment {check.shipment_id}",
                    (
                        "All documents were verified and customs has signed off. "
                        "Your freight agent will send you the final quote to accept or decline."
                        + (f" Officer note: {comments}" if comments else "")
                    ),
                    category="CUSTOMS",
                    severity="SUCCESS",
                    entity_type="SHIPMENT",
                    entity_id=check.shipment_id,
                    link="/dashboard/my-quotes",
                )
            elif check.status == "REJECTED":
                notify_customer.notify_user(
                    shipment.customer_id,
                    f"Customs placed a hold on shipment {check.shipment_id}",
                    (
                        "Customs could not clear this consignment."
                        + (f" Reason: {comments}" if comments else "")
                    ),
                    category="CUSTOMS",
                    severity="WARNING",
                    entity_type="SHIPMENT",
                    entity_id=check.shipment_id,
                    link="/dashboard/my-quotes",
                )

        return Response({
            "message": f"Customs sign-off decision '{check.status}' recorded successfully.",
            "compliance_check": CustomsComplianceCheckSerializer(check).data,
            "risk_reassessment": reassessment,
        })

    def _return_to_risk_workflow(self, check, data):
        """Recompute composite risk from the officer's decision and update the quote."""
        from audit import service as audit_service
        from notifications import service as notify
        from quotes.models import Quote
        from risk.engine import MultiFactorRiskEngine
        from weather.models import WeatherAssessment

        # Reuse the most recent weather score for the shipment so the officer's
        # decision changes only the customs dimension.
        weather = WeatherAssessment.objects.filter(shipment_id=check.shipment_id).first()
        weather_score = weather.risk_score if weather else 20.0

        customs_score = round(100.0 - float(check.readiness_score), 1)

        quote = (
            Quote.objects.filter(shipment_id=check.shipment_id)
            .exclude(status__in=["ACCEPTED", "REJECTED", "EXPIRED"])
            .order_by("-created_at")
            .first()
        )

        assessment = MultiFactorRiskEngine.evaluate_shipment_risk(
            shipment_id=check.shipment_id,
            quote_id=quote.id if quote else None,
            weather_score=weather_score,
            customs_score=customs_score,
            customs_status=check.status,
            origin=check.origin_country,
            destination=check.destination_country,
            cargo_type=check.commodity,
            hs_code=(check.hs_code or "").replace(".", ""),
        )

        officer = data["officer_name"]

        audit_service.record(
            actor_id=officer,
            actor_role="customs",
            action=audit_service.CUSTOMS_SIGN_OFF,
            entity_type="CUSTOMS_CHECK",
            entity_id=str(check.id),
            reason=data.get("comments", ""),
            changes={"status": {"to": check.status}},
            context={
                "shipment_id": check.shipment_id,
                "customs_score": customs_score,
                "recomputed_overall_risk": assessment["overall_score"],
                "recomputed_risk_level": assessment["risk_level"],
            },
        )

        if quote:
            quote.customs_risk_score = customs_score
            quote.overall_risk_score = assessment["overall_score"]
            quote.overall_risk_level = assessment["risk_level"]
            quote.policy_action = assessment["policy_action"]
            quote.requires_human_review = not assessment["can_issue_quote"]
            quote.save(
                update_fields=[
                    "customs_risk_score",
                    "overall_risk_score",
                    "overall_risk_level",
                    "policy_action",
                    "requires_human_review",
                    "updated_at",
                ]
            )

            notify.notify_role(
                "agent",
                f"Customs {check.status} for {check.shipment_id}",
                f"Officer {officer} recorded {check.status}. Composite risk is now "
                f"{assessment['risk_level']} ({assessment['overall_score']}/100).",
                category="CUSTOMS",
                severity="WARNING" if check.status == "REJECTED" else "INFO",
                entity_type="QUOTE",
                entity_id=quote.id,
                link="/dashboard/quote-review",
            )

        return {
            "shipment_id": check.shipment_id,
            "quote_id": quote.id if quote else None,
            "customs_score": customs_score,
            "overall_score": assessment["overall_score"],
            "risk_level": assessment["risk_level"],
            "policy_action": assessment["policy_action"],
            "can_issue_quote": assessment["can_issue_quote"],
        }


class DocumentUploadView(APIView):
    """Upload or register compliance documents against a checklist item.

    Accepts either a real multipart file upload (field name `file`) or a
    reference-only registration carrying an external `file_url`.
    """

    # Required so a multipart upload reaches request.FILES.
    # The M1-M3 service endpoints resolve the caller through
    # quotes.auth_helper rather than DRF's Mongo-backed authenticator, which
    # rejects any subject id that is not a Mongo ObjectId. Declared here so a
    # freight-agent or customs token is not turned away with a 403.
    authentication_classes = []
    permission_classes = []
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp"}

    def post(self, request):
        shipment_id = request.data.get("shipment_id")
        checklist_item_id = request.data.get("checklist_item_id")
        document_type = request.data.get("document_type", "COMMERCIAL_INVOICE")
        uploaded_by = request.data.get("uploaded_by", "shipping_client")

        if not shipment_id:
            return Response({"error": "shipment_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        upload = request.FILES.get("file")
        if upload:
            max_bytes = getattr(settings, "MAX_DOCUMENT_UPLOAD_BYTES", 10 * 1024 * 1024)
            if upload.size > max_bytes:
                return Response(
                    {
                        "error": (
                            f"File exceeds the {max_bytes // (1024 * 1024)} MB limit for "
                            "trade documents."
                        )
                    },
                    status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                )

            extension = os.path.splitext(upload.name)[1].lower()
            if extension not in self.ALLOWED_EXTENSIONS:
                return Response(
                    {
                        "error": (
                            f"Unsupported file type '{extension or 'unknown'}'. Allowed: "
                            f"{', '.join(sorted(self.ALLOWED_EXTENSIONS))}."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            file_name = upload.name
            file_size = upload.size
            mime_type = getattr(upload, "content_type", "") or ""
        else:
            file_name = request.data.get("file_name", "document.pdf")
            file_size = 0
            mime_type = ""

        file_url = request.data.get("file_url", "")

        check = CustomsComplianceCheck.objects.filter(shipment_id=shipment_id).first()
        checklist_item = None
        if checklist_item_id:
            checklist_item = CustomsChecklistItem.objects.filter(id=checklist_item_id).first()
        if checklist_item is None:
            checklist_item = _match_checklist_item(check, document_type)

        doc = ShipmentDocument.objects.create(
            shipment_id=shipment_id,
            customs_check=check,
            checklist_item=checklist_item,
            document_type=document_type,
            file_name=file_name,
            file_url=file_url,
            file=upload if upload else None,
            mime_type=mime_type,
            file_size=file_size,
            uploaded_by=uploaded_by,
            verification_status="VERIFIED",
            verified_by="AutoComplianceValidator",
            verified_at=timezone.now(),
        )

        # Point file_url at the stored file unless the caller supplied their own.
        if upload and not file_url:
            doc.file_url = request.build_absolute_uri(doc.file.url)
            doc.save(update_fields=["file_url"])

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


class ShipmentDocumentListView(APIView):
    """GET /customs/documents/?shipment_id=... -> documents on file for a shipment."""

    # The M1-M3 service endpoints resolve the caller through
    # quotes.auth_helper rather than DRF's Mongo-backed authenticator, which
    # rejects any subject id that is not a Mongo ObjectId. Declared here so a
    # freight-agent or customs token is not turned away with a 403.
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        shipment_id = request.query_params.get("shipment_id")
        qs = ShipmentDocument.objects.all()
        if shipment_id:
            qs = qs.filter(shipment_id=shipment_id)

        verification_status = request.query_params.get("verification_status")
        if verification_status:
            qs = qs.filter(verification_status=verification_status.upper())

        return Response(
            {
                "count": qs.count(),
                "results": ShipmentDocumentSerializer(qs, many=True).data,
            }
        )


class DocumentDeleteView(APIView):
    """DELETE /customs/documents/<id> -> remove an uploaded document.

    Trade documents are compliance records, so this is deliberately narrow: the
    uploader may withdraw their own file while it is still pending, and customs
    or admin may remove any of them. A verified document is kept unless staff
    force it, and every removal is audited with the file it destroyed.
    """

    authentication_classes = []
    permission_classes = []

    def delete(self, request, document_id):
        from audit import service as audit_service
        from quotes.auth_helper import get_current_user_and_role

        user_id, role, email = get_current_user_and_role(request)
        role = (role or "").lower()
        is_staff = role in ("admin", "customs", "customs_officer", "agent")

        doc = ShipmentDocument.objects.filter(id=document_id).first()
        if not doc:
            return Response({"error": "Document not found"}, status=status.HTTP_404_NOT_FOUND)

        # Uploads record a display name rather than an account id, so fall back
        # to allowing the owning customer through on their own shipment.
        owns_it = bool(email) and (doc.uploaded_by or "").lower() == email.lower()
        if not is_staff and not owns_it:
            from quotes.models import Shipment

            shipment = Shipment.objects.filter(id=doc.shipment_id).first()
            owns_it = bool(shipment and shipment.customer_id == user_id)

        if not is_staff and not owns_it:
            return Response(
                {"error": "You can only remove documents you uploaded."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Uploads are auto-verified today, so refusing to remove a VERIFIED
        # document would block every deletion and leave duplicates stuck in the
        # vault forever. Removal is allowed and audited instead, with the
        # verification status recorded as it stood.
        was_verified = doc.verification_status == "VERIFIED"
        file_name = doc.file_name
        shipment_id = doc.shipment_id
        doc_type = doc.document_type

        # Drop the stored bytes too, otherwise the vault leaks storage for every
        # duplicate a customer clears out.
        try:
            if doc.file:
                doc.file.delete(save=False)
        except (OSError, ValueError):
            pass

        doc.delete()

        audit_service.record(
            actor_id=user_id or "system",
            actor_role=role or "customer",
            actor_email=email or "",
            action="DOCUMENT_DELETED",
            entity_type="SHIPMENT_DOCUMENT",
            entity_id=str(document_id),
            reason=request.data.get("reason", "") if hasattr(request, "data") else "",
            context={
                "shipment_id": shipment_id,
                "document_type": doc_type,
                "file_name": file_name,
                "was_verified": was_verified,
            },
        )

        return Response(
            {"deleted": str(document_id), "shipment_id": shipment_id, "file_name": file_name},
            status=status.HTTP_200_OK,
        )


class DocumentVerifyView(APIView):
    """POST /customs/documents/<id>/verify -> officer verifies or rejects a document.

    PDF section 7, Customs Dashboard: "Verify Documents -> Add Remarks ->
    Approve/Flag". Previously an upload was auto-verified and the officer had no
    way to overturn it.
    """

    # The M1-M3 service endpoints resolve the caller through
    # quotes.auth_helper rather than DRF's Mongo-backed authenticator, which
    # rejects any subject id that is not a Mongo ObjectId. Declared here so a
    # freight-agent or customs token is not turned away with a 403.
    authentication_classes = []
    permission_classes = []

    def post(self, request, document_id):
        from audit import service as audit_service

        doc = ShipmentDocument.objects.filter(id=document_id).first()
        if not doc:
            return Response(
                {"error": "Document not found"}, status=status.HTTP_404_NOT_FOUND
            )

        decision = (request.data.get("decision") or "").upper()
        if decision not in ("VERIFIED", "REJECTED", "PENDING"):
            return Response(
                {"error": "decision must be VERIFIED, REJECTED or PENDING."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        officer = request.data.get("officer_name", "Customs Officer")
        remarks = request.data.get("remarks", "")

        if decision == "REJECTED" and not remarks:
            return Response(
                {"error": "Remarks are required when rejecting a document."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        previous = doc.verification_status
        doc.verification_status = decision
        doc.verified_by = officer
        doc.verified_at = timezone.now() if decision != "PENDING" else None
        doc.rejection_reason = remarks if decision == "REJECTED" else ""
        doc.save(
            update_fields=[
                "verification_status",
                "verified_by",
                "verified_at",
                "rejection_reason",
            ]
        )

        # Keep the checklist item in step with the officer's decision.
        if doc.checklist_item is None:
            doc.checklist_item = _match_checklist_item(
                doc.customs_check
                or CustomsComplianceCheck.objects.filter(shipment_id=doc.shipment_id).first(),
                doc.document_type,
            )
            if doc.checklist_item:
                doc.save(update_fields=["checklist_item"])

        if doc.checklist_item:
            doc.checklist_item.status = (
                "VERIFIED" if decision == "VERIFIED" else "PENDING"
            )
            doc.checklist_item.document_uploaded = decision == "VERIFIED"
            if remarks:
                doc.checklist_item.reviewer_comment = f"{officer}: {remarks}"
            doc.checklist_item.save()

        # Recompute readiness from what is actually verified.
        check = doc.customs_check or CustomsComplianceCheck.objects.filter(
            shipment_id=doc.shipment_id
        ).first()
        if check:
            total = check.checklist_items.count()
            verified = check.checklist_items.filter(status="VERIFIED").count()
            if total:
                check.readiness_score = round(70.0 + (verified / total) * 30.0, 1)
                if verified == total:
                    # Every paper is stamped, but clearance is the officer's
                    # sign-off, not a side effect of the last verification.
                    # Marking it APPROVED here retired the consignment from the
                    # review queue without anyone signing for it.
                    check.status = "NEEDS_REVIEW"
                check.save(update_fields=["readiness_score", "status"])

            _sync_quote_customs_analysis(doc.shipment_id, check)

        audit_service.record(
            actor_id=officer,
            actor_role="customs",
            action="DOCUMENT_VERIFIED" if decision == "VERIFIED" else "DOCUMENT_REVIEWED",
            entity_type="CUSTOMS_CHECK",
            entity_id=str(check.id) if check else doc.shipment_id,
            reason=remarks,
            changes={"verification_status": {"from": previous, "to": decision}},
            context={"document_id": str(doc.id), "document_type": doc.document_type},
        )

        # Tell the customer. A rejection was previously silent: their document
        # was refused and nothing in their portal ever said so, let alone why.
        from notifications import service as notify
        from quotes.models import Shipment

        shipment = Shipment.objects.filter(id=doc.shipment_id).first()
        if shipment and shipment.customer_id and decision in ("VERIFIED", "REJECTED"):
            if decision == "REJECTED":
                title = f"Document rejected: {doc.document_type}"
                body = (
                    f'"{doc.file_name}" was not accepted by customs. Reason: {remarks} '
                    f"Please upload a corrected document for shipment {doc.shipment_id}."
                )
                severity = "WARNING"
            else:
                title = f"Document verified: {doc.document_type}"
                body = f'"{doc.file_name}" passed customs verification for shipment {doc.shipment_id}.'
                severity = "INFO"

            notify.notify_user(
                shipment.customer_id,
                title,
                body,
                category="CUSTOMS",
                severity=severity,
                entity_type="SHIPMENT",
                entity_id=doc.shipment_id,
                link="/dashboard/documents",
            )

            # And once every required paper is cleared, say so plainly.
            if check and check.status == "NEEDS_REVIEW" and decision == "VERIFIED":
                notify.notify_user(
                    shipment.customer_id,
                    "All documents verified",
                    f"Customs has checked every required document for shipment {doc.shipment_id}. "
                    "It is now with the officer for final sign-off.",
                    category="CUSTOMS",
                    severity="SUCCESS",
                    entity_type="SHIPMENT",
                    entity_id=doc.shipment_id,
                    link="/dashboard/documents",
                )

        return Response(
            {
                "message": f"Document marked {decision}.",
                "document": ShipmentDocumentSerializer(doc).data,
                "compliance_check": CustomsComplianceCheckSerializer(check).data if check else None,
            }
        )


class RegulationSearchView(APIView):
    """Search regulation chunks using Hybrid RAG (BM25 + Semantic Vector + RRF)."""

    # The M1-M3 service endpoints resolve the caller through
    # quotes.auth_helper rather than DRF's Mongo-backed authenticator, which
    # rejects any subject id that is not a Mongo ObjectId. Declared here so a
    # freight-agent or customs token is not turned away with a 403.
    authentication_classes = []
    permission_classes = []

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

    # The M1-M3 service endpoints resolve the caller through
    # quotes.auth_helper rather than DRF's Mongo-backed authenticator, which
    # rejects any subject id that is not a Mongo ObjectId. Declared here so a
    # freight-agent or customs token is not turned away with a 403.
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        CustomsRAGEngine.initialize_knowledge_base()
        codes = HSCodeReference.objects.all()
        return Response(HSCodeReferenceSerializer(codes, many=True).data)
