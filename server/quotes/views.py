"""API views for generating and listing freight quotes."""

from datetime import datetime

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .mongo import quotes_collection
from .pricing import PricingError, calculate_price
from .serializers import GenerateQuoteSerializer


class GenerateQuoteView(APIView):
    """Calculate a price and save a new quote for the logged-in user."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = GenerateQuoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            price_breakdown = calculate_price(
                distance_km=data['distance_km'],
                weight_kg=data['weight_kg'],
                vehicle_type=data['vehicle_type'],
            )
        except PricingError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        # request.user is the Mongo user document returned by MongoJWTAuthentication
        user_id = request.user['_id']

        quote_doc = {
            'user_id': user_id,
            'pickup_location': data['pickup_location'],
            'drop_location': data['drop_location'],
            'price_breakdown': price_breakdown,
            'created_at': datetime.utcnow(),
        }
        result = quotes_collection.insert_one(quote_doc)

        return Response(
            {
                'quote_id': str(result.inserted_id),
                'pickup_location': quote_doc['pickup_location'],
                'drop_location': quote_doc['drop_location'],
                **price_breakdown,
            },
            status=status.HTTP_201_CREATED,
        )


class MyQuotesView(APIView):
    """Return every quote the logged-in user has generated, newest first."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_id = request.user['_id']
        cursor = quotes_collection.find({'user_id': user_id}).sort('created_at', -1)

        quotes = []
        for doc in cursor:
            quotes.append(
                {
                    'quote_id': str(doc['_id']),
                    'pickup_location': doc['pickup_location'],
                    'drop_location': doc['drop_location'],
                    'created_at': doc['created_at'].isoformat(),
                    **doc['price_breakdown'],
                }
            )

        return Response(quotes)
