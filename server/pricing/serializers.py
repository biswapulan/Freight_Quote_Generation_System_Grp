"""Request/response serializers for the pricing app."""

from rest_framework import serializers

from .engine import DEFAULT_CARGO_MULTIPLIERS, DEFAULT_MODE_MULTIPLIERS, VALID_MODES


class QuoteRequestSerializer(serializers.Serializer):
    """Validates a shipment quote request before it reaches the pricing engine.

    Double protection: the React form validates on the client for a
    responsive UX, and this serializer validates again on the server since
    the client can never be trusted.
    """

    origin = serializers.CharField(min_length=2, max_length=100)
    destination = serializers.CharField(min_length=2, max_length=100)
    weight_kg = serializers.FloatField(min_value=0.01)
    volume_m3 = serializers.FloatField(min_value=0)
    cargo_type = serializers.ChoiceField(choices=tuple(DEFAULT_CARGO_MULTIPLIERS))
    mode = serializers.ChoiceField(choices=VALID_MODES)

    def validate(self, attrs):
        if attrs["origin"].strip().lower() == attrs["destination"].strip().lower():
            raise serializers.ValidationError(
                "Origin and destination must be different."
            )
        return attrs


class RateConfigSerializer(serializers.Serializer):
    """Validates an (partial) admin update to the rate configuration.

    All fields are optional so PATCH-style partial updates work; only the
    fields supplied are merged into the stored config.
    """

    currency = serializers.CharField(max_length=3, required=False)
    base_handling_fee = serializers.FloatField(min_value=0, required=False)
    rate_per_km_per_tonne = serializers.FloatField(min_value=0, required=False)
    fuel_surcharge_pct = serializers.FloatField(min_value=0, max_value=100, required=False)
    quote_validity_days = serializers.IntegerField(min_value=1, max_value=90, required=False)
    cargo_multipliers = serializers.DictField(
        child=serializers.FloatField(min_value=0), required=False
    )
    mode_multipliers = serializers.DictField(
        child=serializers.FloatField(min_value=0), required=False
    )

    def validate_cargo_multipliers(self, value):
        unknown = set(value) - set(DEFAULT_CARGO_MULTIPLIERS)
        if unknown:
            raise serializers.ValidationError(f"Unknown cargo types: {sorted(unknown)}")
        return value

    def validate_mode_multipliers(self, value):
        unknown = set(value) - set(DEFAULT_MODE_MULTIPLIERS)
        if unknown:
            raise serializers.ValidationError(f"Unknown transport modes: {sorted(unknown)}")
        return value
