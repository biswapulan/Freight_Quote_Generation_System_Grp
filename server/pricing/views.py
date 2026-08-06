"""API views for quote generation, quote history and admin rate config."""

from bson import ObjectId
from bson.errors import InvalidId
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminRole, IsAuthenticatedMongoUser

from .engine import DEFAULT_RATE_CONFIG, UnservicedRouteError, calculate_quote
from .mongo import (
    create_quote_document,
    get_active_rate_config,
    get_quote_for_user,
    list_quotes_for_user,
    save_rate_config,
    set_quote_status,
)
from .serializers import QuoteRequestSerializer, RateConfigSerializer


def _serialize_rate_config(doc):
    """Strip Mongo-internal fields before sending a rate config to a client."""

    data = dict(doc)
    data.pop("_id", None)
    data.pop("updated_at", None)
    updated_at = doc.get("updated_at")
    return {
        **data,
        "updated_at": updated_at.isoformat() if updated_at else None,
        "updated_by": doc.get("updated_by", ""),
    }


def _serialize_quote(doc):
    """Shape a Mongo quote document for the API response."""

    return {
        "id": str(doc["_id"]),
        "origin": doc["origin"],
        "destination": doc["destination"],
        "weight_kg": doc["weight_kg"],
        "volume_m3": doc["volume_m3"],
        "cargo_type": doc["cargo_type"],
        "mode": doc["mode"],
        "distance_km": doc["distance_km"],
        "chargeable_weight_kg": doc["chargeable_weight_kg"],
        "transit_days": doc["transit_days"],
        "currency": doc["currency"],
        "breakdown": doc["breakdown"],
        "status": doc["status"],
        "created_at": doc["created_at"].isoformat(),
        "expires_at": doc["expires_at"].isoformat(),
    }


class EstimateQuoteView(APIView):
    """Validate a shipment request, price it, persist it, and return the quote.

    Every quote is scoped to request.user — nobody can generate a quote
    without a valid session, and the resulting document is only ever
    readable by the user who created it (see QuoteListView/QuoteDetailView).
    """

    permission_classes = [IsAuthenticatedMongoUser]

    def post(self, request):
        serializer = QuoteRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        rate_config = get_active_rate_config()

        try:
            result = calculate_quote(
                origin=payload["origin"],
                destination=payload["destination"],
                weight_kg=payload["weight_kg"],
                volume_m3=payload["volume_m3"],
                cargo_type=payload["cargo_type"],
                mode=payload["mode"],
                rate_config=rate_config,
            )
        except UnservicedRouteError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        validity_days = rate_config.get(
            "quote_validity_days", DEFAULT_RATE_CONFIG["quote_validity_days"]
        )
        quote_doc = create_quote_document(
            user=request.user,
            request_payload=payload,
            quote_result=result,
            validity_days=validity_days,
        )

        return Response(_serialize_quote(quote_doc), status=status.HTTP_201_CREATED)


class QuoteListView(APIView):
    """List the authenticated user's own quote history — nobody else's."""

    permission_classes = [IsAuthenticatedMongoUser]

    def get(self, request):
        quotes = list_quotes_for_user(request.user["_id"])
        return Response({"results": [_serialize_quote(q) for q in quotes]})


class QuoteDetailView(APIView):
    """Retrieve a single quote, scoped to the requesting user."""

    permission_classes = [IsAuthenticatedMongoUser]

    def get(self, request, quote_id):
        try:
            oid = ObjectId(quote_id)
        except (InvalidId, TypeError):
            return Response({"detail": "Invalid quote id"}, status=status.HTTP_404_NOT_FOUND)

        quote = get_quote_for_user(oid, request.user["_id"])
        if not quote:
            return Response({"detail": "Quote not found"}, status=status.HTTP_404_NOT_FOUND)

        return Response(_serialize_quote(quote))


class QuoteConfirmView(APIView):
    """Move a quote from draft to confirmed. Scoped to the requesting user."""

    permission_classes = [IsAuthenticatedMongoUser]

    def post(self, request, quote_id):
        try:
            oid = ObjectId(quote_id)
        except (InvalidId, TypeError):
            return Response({"detail": "Invalid quote id"}, status=status.HTTP_404_NOT_FOUND)

        existing = get_quote_for_user(oid, request.user["_id"])
        if not existing:
            return Response({"detail": "Quote not found"}, status=status.HTTP_404_NOT_FOUND)
        if existing["status"] != "draft":
            return Response(
                {"detail": f"Quote is already {existing['status']}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        updated = set_quote_status(oid, request.user["_id"], "confirmed")
        return Response(_serialize_quote(updated))


class RateConfigView(APIView):
    """Admin-only: view and edit the pricing rules used by the engine.

    This is exactly the "admin edits base rate / fuel % / multipliers
    without touching code" capability from the project spec — GET returns
    the live config, PATCH merges in changes and every subsequent quote
    uses the new values immediately.
    """

    permission_classes = [IsAdminRole]

    def get(self, request):
        config = get_active_rate_config()
        return Response(_serialize_rate_config(config))

    def patch(self, request):
        serializer = RateConfigSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        if not serializer.validated_data:
            return Response(
                {"detail": "No valid fields supplied."}, status=status.HTTP_400_BAD_REQUEST
            )

        updated = save_rate_config(
            serializer.validated_data, updated_by_email=request.user.get("email")
        )
        return Response(_serialize_rate_config(updated))
