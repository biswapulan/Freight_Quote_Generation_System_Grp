from datetime import timedelta
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import WeatherAssessment, WeatherObservation, WeatherAlert
from .serializers import (
    WeatherAssessmentSerializer,
    WeatherAssessRequestSerializer,
    WeatherAlertSerializer,
)
from .sampler import RouteGeometrySampler
from .provider import WeatherProviderAdapter
from .engine import WeatherRiskEngine


class WeatherAssessView(APIView):
    """Assess weather along candidate routes, predict delay probability, and generate alerts."""

    def post(self, request):
        serializer = WeatherAssessRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        shipment_id = data["shipment_id"]
        route_id = data.get("route_id") or f"route_{shipment_id}"
        origin = data.get("origin") or "Chennai"
        destination = data.get("destination") or "Rotterdam"
        transit_days = data.get("transit_days", 7)
        explicit_waypoints = data.get("waypoints", [])

        # 1. Sample geographic evaluation waypoints
        sampled_points = RouteGeometrySampler.sample_route_waypoints(
            origin=origin,
            destination=destination,
            explicit_waypoints=explicit_waypoints,
            max_samples=5,
        )

        # 2. Fetch observations for each waypoint
        observations_data = []
        for pt in sampled_points:
            obs = WeatherProviderAdapter.get_observation(pt["lat"], pt["lon"])
            obs["name"] = pt["name"]
            obs["route_id"] = route_id
            observations_data.append(obs)

        # 3. Calculate multi-parameter weather risk & delay
        route_display = f"{origin.title()} → {destination.title()}"
        eval_result = WeatherRiskEngine.evaluate_route_weather(
            observations=observations_data,
            transit_days=transit_days,
            route_name=route_display,
        )

        # 4. Persist WeatherAssessment
        expires_at = timezone.now() + timedelta(hours=6)
        assessment, _ = WeatherAssessment.objects.update_or_create(
            shipment_id=shipment_id,
            defaults={
                "quote_id": request.data.get("quote_id"),
                "route_id": route_id,
                "risk_score": eval_result["risk_score"],
                "risk_level": eval_result["risk_level"],
                "storm_risk": eval_result["storm_risk"],
                "rainfall_risk": eval_result["rainfall_risk"],
                "wind_risk": eval_result["wind_risk"],
                "wave_risk": eval_result["wave_risk"],
                "temperature_risk": eval_result["temperature_risk"],
                "delay_probability": eval_result["delay_probability"],
                "assessment_status": "COMPLETED",
                "provider": observations_data[0].get("provider", "open-meteo") if observations_data else "open-meteo",
                "provider_timestamp": timezone.now(),
                "assessed_at": timezone.now(),
                "expires_at": expires_at,
                "confidence_score": eval_result["confidence_score"],
            },
        )

        # 5. Persist child WeatherObservations
        assessment.observations.all().delete()
        for obs in observations_data:
            WeatherObservation.objects.create(
                route_id=route_id,
                weather_assessment=assessment,
                latitude=obs["latitude"],
                longitude=obs["longitude"],
                observation_time=timezone.now(),
                temperature=obs.get("temperature", 25.0),
                wind_speed=obs.get("wind_speed", 0.0),
                wind_direction=obs.get("wind_direction", 0.0),
                rainfall=obs.get("rainfall", 0.0),
                wave_height=obs.get("wave_height", 0.0),
                visibility=obs.get("visibility", 10.0),
                pressure=obs.get("pressure", 1013.25),
                weather_condition=obs.get("weather_condition", "Clear"),
                storm_detected=obs.get("storm_detected", False),
                storm_type=obs.get("storm_type"),
                storm_severity=obs.get("storm_severity"),
                provider=obs.get("provider", "open-meteo"),
                raw_payload={"name": obs.get("name")},
            )

        # 6. Persist severe WeatherAlerts
        for alert_dict in eval_result.get("alerts", []):
            WeatherAlert.objects.create(
                shipment_id=shipment_id,
                route_id=route_id,
                alert_type=alert_dict["alert_type"],
                severity=alert_dict["severity"],
                title=alert_dict["title"],
                message=alert_dict["message"],
                starts_at=timezone.now(),
                ends_at=timezone.now() + timedelta(days=2),
                status="ACTIVE",
            )

        response_payload = WeatherAssessmentSerializer(assessment).data
        response_payload["analysis"] = eval_result
        return Response(response_payload, status=status.HTTP_201_CREATED)

    def get(self, request, shipment_id=None):
        if not shipment_id:
            shipment_id = request.query_params.get("shipment_id")
        if not shipment_id:
            return Response({"error": "shipment_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        assessment = WeatherAssessment.objects.filter(shipment_id=shipment_id).first()
        if not assessment:
            return Response({"error": "Weather assessment not found"}, status=status.HTTP_404_NOT_FOUND)

        return Response(WeatherAssessmentSerializer(assessment).data)


class WeatherAlertListView(APIView):
    """List active weather alerts."""

    def get(self, request):
        shipment_id = request.query_params.get("shipment_id")
        qs = WeatherAlert.objects.all()
        if shipment_id:
            qs = qs.filter(shipment_id=shipment_id)
        return Response(WeatherAlertSerializer(qs, many=True).data)
