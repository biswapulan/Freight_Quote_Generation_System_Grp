"""Request serializers for the quote-generation endpoint."""

from rest_framework import serializers

from .pricing import VEHICLE_TYPES


class GenerateQuoteSerializer(serializers.Serializer):
    """Validate the payload needed to generate a freight quote."""

    pickup_location = serializers.CharField(max_length=255)
    drop_location = serializers.CharField(max_length=255)
    distance_km = serializers.FloatField(min_value=0.1)
    weight_kg = serializers.FloatField(min_value=0.1)
    vehicle_type = serializers.ChoiceField(choices=list(VEHICLE_TYPES.keys()))
