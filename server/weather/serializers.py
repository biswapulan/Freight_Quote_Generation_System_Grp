from rest_framework import serializers
from .models import WeatherAssessment, WeatherObservation, WeatherAlert


class WeatherObservationSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeatherObservation
        fields = "__all__"


class WeatherAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeatherAlert
        fields = "__all__"


class WeatherAssessmentSerializer(serializers.ModelSerializer):
    observations = WeatherObservationSerializer(many=True, read_only=True)
    alerts = serializers.SerializerMethodField()
    advisories = serializers.SerializerMethodField()

    class Meta:
        model = WeatherAssessment
        fields = "__all__"

    def get_alerts(self, obj):
        alerts = WeatherAlert.objects.filter(shipment_id=obj.shipment_id, status="ACTIVE")
        return WeatherAlertSerializer(alerts, many=True).data

    def get_advisories(self, obj):
        if obj.risk_score > 60:
            return [
                "Consider delaying departure by 24-48 hours to avoid peak marine swell.",
                "Review alternative coastal or transshipment route recommendations.",
            ]
        return ["Weather conditions are optimal across all transit waypoints."]


class WeatherAssessRequestSerializer(serializers.Serializer):
    shipment_id = serializers.CharField(required=True)
    route_id = serializers.CharField(required=False, allow_blank=True)
    origin = serializers.CharField(required=False, allow_blank=True, default="Chennai")
    destination = serializers.CharField(required=False, allow_blank=True, default="Rotterdam")
    transit_days = serializers.IntegerField(required=False, default=7)
    waypoints = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list,
        help_text="Optional list of {lat, lon, name} route coordinates",
    )
    departure_date = serializers.DateTimeField(required=False, allow_null=True)
