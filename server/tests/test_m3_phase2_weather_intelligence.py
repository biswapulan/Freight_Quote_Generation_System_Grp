import pytest
from rest_framework.test import APIClient
from weather.sampler import RouteGeometrySampler, haversine_distance, MARITIME_WAYPOINTS
from weather.provider import WeatherProviderAdapter
from weather.engine import WeatherRiskEngine
from weather.models import WeatherAssessment, WeatherObservation, WeatherAlert


@pytest.mark.django_db
class TestMilestone3Phase2WeatherIntelligence:

    def test_haversine_distance(self):
        # Distance between Chennai and Singapore is ~2900 km
        chennai = (13.0827, 80.2707)
        singapore = (1.3521, 103.8198)
        dist = haversine_distance(chennai, singapore)
        assert 2700 < dist < 3100

    def test_route_geometry_sampler_corridors(self):
        # Test Asia to Europe route includes strategic maritime chokepoints
        waypoints = RouteGeometrySampler.sample_route_waypoints(
            origin="Chennai",
            destination="Rotterdam",
            max_samples=6,
        )
        assert len(waypoints) >= 4
        names = [wp["name"] for wp in waypoints]
        assert any("Origin Port" in n for n in names)
        assert any("Destination Port" in n for n in names)
        assert any("Suez" in n or "Arabian" in n or "Bab-el-Mandeb" in n for n in names)

    def test_weather_provider_adapter_fallback_and_cache(self):
        # Fetch observation for Bay of Bengal coordinates
        obs = WeatherProviderAdapter.get_observation(14.0, 86.0)
        assert "temperature" in obs
        assert "wind_speed" in obs
        assert "wave_height" in obs
        assert "weather_condition" in obs
        assert obs["wave_height"] >= 0.0

        # Immediate second call should hit coordinate cache
        obs_cached = WeatherProviderAdapter.get_observation(14.0, 86.0)
        assert obs_cached.get("cached", False) is True

    def test_weather_risk_engine_calm_vs_severe(self):
        # Calm marine conditions
        calm_obs = [
            {"name": "Port A", "wave_height": 0.8, "wind_speed": 10.0, "rainfall": 0.0, "storm_detected": False, "temperature": 26.0, "visibility": 12.0, "pressure": 1014.0},
            {"name": "Sea Point 1", "wave_height": 1.2, "wind_speed": 12.0, "rainfall": 0.0, "storm_detected": False, "temperature": 27.0, "visibility": 12.0, "pressure": 1013.0},
        ]
        calm_eval = WeatherRiskEngine.evaluate_route_weather(calm_obs, transit_days=5)
        assert calm_eval["risk_level"] == "LOW"
        assert calm_eval["delay_probability"] <= 0.30
        assert len(calm_eval["alerts"]) == 0

        # Severe storm conditions
        severe_obs = [
            {"name": "Chokepoint X", "wave_height": 5.8, "wind_speed": 48.0, "rainfall": 35.0, "storm_detected": True, "temperature": 29.0, "visibility": 3.0, "pressure": 988.0},
        ]
        severe_eval = WeatherRiskEngine.evaluate_route_weather(severe_obs, transit_days=8)
        assert severe_eval["risk_level"] in ["HIGH", "CRITICAL"]
        assert severe_eval["delay_probability"] >= 0.60
        assert severe_eval["estimated_delay_hours"] > 0
        assert len(severe_eval["alerts"]) >= 1
        assert len(severe_eval["advisories"]) >= 1

    def test_weather_assess_api_endpoint(self):
        client = APIClient()
        payload = {
            "shipment_id": "SHP-M3-WEATHER-01",
            "origin": "Chennai",
            "destination": "Rotterdam",
            "transit_days": 18,
        }
        res = client.post("/api/v1/weather/assess/", payload, format="json")
        assert res.status_code == 201
        assert res.data["shipment_id"] == "SHP-M3-WEATHER-01"
        assert "risk_score" in res.data
        assert "delay_probability" in res.data
        assert "observations" in res.data
        assert len(res.data["observations"]) >= 3

        # Query detail endpoint
        detail_res = client.get("/api/v1/weather/assess/SHP-M3-WEATHER-01/")
        assert detail_res.status_code == 200
        assert detail_res.data["shipment_id"] == "SHP-M3-WEATHER-01"

    def test_weather_alerts_api_endpoint(self):
        client = APIClient()
        WeatherAlert.objects.create(
            shipment_id="SHP-ALERT-TEST",
            alert_type="TROPICAL_DEPRESSION",
            severity="CRITICAL",
            title="Tropical Depression in South China Sea",
            message="Wave heights exceeding 6m.",
            status="ACTIVE",
        )
        res = client.get("/api/v1/weather/alerts/?shipment_id=SHP-ALERT-TEST")
        assert res.status_code == 200
        assert len(res.data) >= 1
        assert res.data[0]["severity"] == "CRITICAL"
