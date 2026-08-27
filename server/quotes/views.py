"""API views for Quote generation, shipment management, margin enforcement and admin approval."""

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied, NotFound

from .models import Shipment, Quote
from .serializers import ShipmentSerializer, QuoteSerializer
from .pricing_calculator import calculate_distance_km, calculate_quote_pricing
from .auth_helper import get_current_user_and_role, require_admin

# Keep Milestone 2 classes
from .margin_policy import resolve_margin_policy, enforce_margin_floor, MarginFloorViolationError
from .approval_rules import evaluate_approval_rules


# ==============================================================================
# MENTOR SPECIFICATION ENDPOINTS
# ==============================================================================

class ShipmentCreateView(APIView):
    """POST /shipments -> Create a new shipment request.
       GET /shipments/my -> List own customer shipments.
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        user_id, role, email = get_current_user_and_role(request)
        data = request.data.copy()

        # Normalize camelCase inputs from mentor spec
        origin = data.get("origin")
        destination = data.get("destination")
        cargo_type = data.get("cargoType") or data.get("cargo_type", "General Cargo")
        weight = data.get("weight")
        volume = data.get("volume")
        transport_mode = data.get("transportMode") or data.get("transport_mode", "ocean")

        if not origin or not destination or weight is None or volume is None:
            return Response(
                {"error": "Missing required fields: origin, destination, weight, volume"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        shipment = Shipment.objects.create(
            customer_id=user_id,
            customer_email=email,
            origin=origin,
            destination=destination,
            cargo_type=cargo_type,
            weight=float(weight),
            volume=float(volume),
            transport_mode=transport_mode,
            status="CREATED",
        )

        serializer = ShipmentSerializer(shipment)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def get(self, request):
        user_id, role, email = get_current_user_and_role(request)
        shipments = Shipment.objects.filter(customer_id=user_id)
        serializer = ShipmentSerializer(shipments, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ShipmentQuoteGenerateView(APIView):
    """POST /shipments/:id/quote -> Calculate distance & price, create Quote record."""
    authentication_classes = []
    permission_classes = []

    def post(self, request, shipment_id):
        user_id, role, email = get_current_user_and_role(request)

        try:
            shipment = Shipment.objects.get(id=shipment_id)
        except Shipment.DoesNotExist:
            raise NotFound("Shipment not found.")

        # Ensure customer owns the shipment (or user is admin)
        if role.lower() != "admin" and shipment.customer_id != user_id:
            raise PermissionDenied("You do not have permission to generate quotes for this shipment.")

        # 1. Calculate Route Distance
        distance_km = calculate_distance_km(shipment.origin, shipment.destination)

        # 2. Calculate Itemized Pricing
        pricing = calculate_quote_pricing(
            distance_km=distance_km,
            weight_kg=shipment.weight,
            volume_cbm=shipment.volume,
            transport_mode=shipment.transport_mode,
            cargo_type=shipment.cargo_type,
        )

        # 3. Create Quote Record
        quote = Quote.objects.create(
            shipment=shipment,
            customer_id=shipment.customer_id,
            distance=pricing["distance"],
            base_price=pricing["base_price"],
            distance_charge=pricing["distance_charge"],
            weight_charge=pricing["weight_charge"],
            fuel_charge=pricing["fuel_charge"],
            total_price=pricing["total_price"],
            status="PENDING",
        )

        shipment.status = "QUOTED"
        shipment.save(update_fields=["status"])

        serializer = QuoteSerializer(quote)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CustomerQuoteListView(APIView):
    """GET /quotes/my -> List all quotes for authenticated customer.
       GET /quotes/:id -> View specific quote details (with IDOR protection).
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request, quote_id=None):
        user_id, role, email = get_current_user_and_role(request)

        if quote_id:
            try:
                quote = Quote.objects.select_related("shipment").get(id=quote_id)
            except Quote.DoesNotExist:
                raise NotFound("Quote not found.")

            # IDOR Check: Customer cannot access another customer's quote!
            if role.lower() != "admin" and quote.customer_id != user_id:
                raise PermissionDenied("Access denied: You cannot view another customer's quote.")

            serializer = QuoteSerializer(quote)
            return Response(serializer.data, status=status.HTTP_200_OK)

        quotes = Quote.objects.filter(customer_id=user_id).select_related("shipment")
        serializer = QuoteSerializer(quotes, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AdminQuoteListView(APIView):
    """GET /admin/quotes -> List all quotes across all customers (Admin only)."""
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        require_admin(request)
        quotes = Quote.objects.all().select_related("shipment")
        serializer = QuoteSerializer(quotes, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AdminQuoteStatusUpdateView(APIView):
    """PATCH /admin/quotes/:id/status -> Approve or reject quote (Admin only)."""
    authentication_classes = []
    permission_classes = []

    def patch(self, request, quote_id):
        user_id, role, email = require_admin(request)

        try:
            quote = Quote.objects.select_related("shipment").get(id=quote_id)
        except Quote.DoesNotExist:
            raise NotFound("Quote not found.")

        new_status = request.data.get("status")
        notes = request.data.get("admin_notes", request.data.get("notes", ""))

        if new_status not in ["APPROVED", "REJECTED", "PENDING"]:
            return Response(
                {"error": "Invalid status. Must be APPROVED, REJECTED, or PENDING."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        quote.status = new_status
        if notes:
            quote.admin_notes = notes
        quote.save()

        # Sync shipment status
        if new_status == "APPROVED":
            quote.shipment.status = "APPROVED"
        elif new_status == "REJECTED":
            quote.shipment.status = "REJECTED"
        quote.shipment.save(update_fields=["status"])

        serializer = QuoteSerializer(quote)
        return Response(serializer.data, status=status.HTTP_200_OK)


# ==============================================================================
# MILESTONE 2 LEGACY & MARGIN ENDPOINTS
# ==============================================================================

class QuoteMarginView(APIView):
    """POST /api/v1/quotes/<quote_id>/margin"""
    authentication_classes = []
    permission_classes = []

    def post(self, request, quote_id):
        return Response({"quote_id": quote_id, "status": "MARGIN_EVALUATED"})


class QuoteApprovalsQueueView(APIView):
    """GET /api/v1/quotes/approvals/queue"""
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response({"queue": []})


class QuoteApprovalDecisionView(APIView):
    """POST /api/v1/quotes/approvals/<approval_id>/decision"""
    authentication_classes = []
    permission_classes = []

    def post(self, request, approval_id):
        return Response({"approval_id": approval_id, "decision": "PROCESSED"})
