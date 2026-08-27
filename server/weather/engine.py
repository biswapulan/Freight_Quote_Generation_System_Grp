"""Weather Risk Scoring, Severe Storm Detection & Delay Modeling Engine.

Translates waypoint meteorological telemetry into composite weather risk scores,
transit delay probabilities, and actionable rerouting / departure advisories.
"""

from typing import List, Dict, Any, Tuple


class WeatherRiskEngine:
    """Calculates multi-parameter weather risk and delay estimation."""

    @classmethod
    def evaluate_route_weather(
        cls,
        observations: List[Dict[str, Any]],
        transit_days: int = 7,
        route_name: str = "Maritime Route",
    ) -> Dict[str, Any]:
        """Aggregate observations into overall weather score, delay probability, and alerts."""
        if not observations:
            return cls._empty_assessment()

        max_wave = max(obs.get("wave_height", 0.0) for obs in observations)
        max_wind = max(obs.get("wind_speed", 0.0) for obs in observations)
        max_rain = max(obs.get("rainfall", 0.0) for obs in observations)
        min_vis = min(obs.get("visibility", 10.0) for obs in observations)
        min_press = min(obs.get("pressure", 1013.0) for obs in observations)

        has_storm = any(obs.get("storm_detected", False) for obs in observations)
        storm_count = sum(1 for obs in observations if obs.get("storm_detected", False))

        # 1. Component Risk Calculations (0-100)
        # Wave swell risk
        if max_wave < 1.5:
            wave_risk = max_wave * 12.0
        elif max_wave < 3.0:
            wave_risk = 20.0 + (max_wave - 1.5) * 20.0
        elif max_wave < 5.0:
            wave_risk = 50.0 + (max_wave - 3.0) * 18.0
        else:
            wave_risk = min(100.0, 86.0 + (max_wave - 5.0) * 7.0)

        # Wind speed / gale risk (knots)
        if max_wind < 15.0:
            wind_risk = max_wind * 1.2
        elif max_wind < 28.0:
            wind_risk = 20.0 + (max_wind - 15.0) * 2.3
        elif max_wind < 40.0:
            wind_risk = 50.0 + (max_wind - 28.0) * 2.5
        else:
            wind_risk = min(100.0, 80.0 + (max_wind - 40.0) * 1.5)

        # Rainfall / Monsoon risk (mm/h)
        rainfall_risk = min(100.0, max_rain * 4.0)

        # Storm risk
        if has_storm:
            storm_risk = min(100.0, 65.0 + (storm_count * 12.0))
        elif max_wind > 30.0 or max_wave > 3.8:
            storm_risk = 45.0
        else:
            storm_risk = 10.0

        # Temperature risk (extreme heat / cold)
        max_temp = max(obs.get("temperature", 25.0) for obs in observations)
        min_temp = min(obs.get("temperature", 25.0) for obs in observations)
        temp_risk = 10.0
        if max_temp > 40.0 or min_temp < 0.0:
            temp_risk = 40.0

        # 2. Composite Weather Risk Score (0-100)
        # Wave: 35%, Wind: 30%, Storm: 20%, Rain: 10%, Temp: 5%
        composite_score = (
            wave_risk * 0.35 +
            wind_risk * 0.30 +
            storm_risk * 0.20 +
            rainfall_risk * 0.10 +
            temp_risk * 0.05
        )
        composite_score = round(min(100.0, max(5.0, composite_score)), 1)

        # 3. Categorize Risk Level
        if composite_score <= 30.0:
            risk_level = "LOW"
        elif composite_score <= 60.0:
            risk_level = "MEDIUM"
        elif composite_score <= 80.0:
            risk_level = "HIGH"
        else:
            risk_level = "CRITICAL"

        # 4. Predict Delay Probability (0.0 to 1.0)
        # Delay likelihood accelerates non-linearly with severe conditions
        delay_prob = (composite_score / 120.0)
        if has_storm or max_wave > 4.5 or max_wind > 38.0:
            delay_prob = max(delay_prob, 0.65)
        delay_prob = round(min(0.95, max(0.05, delay_prob)), 2)

        # Estimated delay in hours
        est_delay_hours = round(delay_prob * (transit_days * 24 * 0.35), 1)

        # 5. Severe Condition Alerts & Alternative Route Advisories
        generated_alerts = []
        advisories = []

        if has_storm or composite_score > 60.0:
            severe_waypoints = [obs.get("name", "Waypoint") for obs in observations if obs.get("storm_detected") or obs.get("wave_height", 0) > 3.5]
            title = f"Severe Maritime Weather Alert on {route_name}"
            msg = (
                f"Sustained winds up to {max_wind} knots and peak swell waves of {max_wave}m detected near "
                f"{', '.join(severe_waypoints[:3])}. Estimated transit delay: ~{est_delay_hours} hours."
            )
            generated_alerts.append({
                "alert_type": "SEVERE_STORM_WARNING" if has_storm else "HIGH_SWELL_ADVISORY",
                "severity": "CRITICAL" if composite_score > 80 else "HIGH",
                "title": title,
                "message": msg,
            })
            advisories.append(f"Delay departure window by 24-48 hours to bypass storm peak near {severe_waypoints[0] if severe_waypoints else 'transit corridor'}.")
            advisories.append("Request master speed adjustment or evaluate southern alternative passage.")
        else:
            advisories.append("Weather conditions are favorable along the entire transit corridor.")
            advisories.append("Standard sailing schedule confirmed with low environmental variance.")

        return {
            "risk_score": composite_score,
            "risk_level": risk_level,
            "wave_risk": round(wave_risk, 1),
            "wind_risk": round(wind_risk, 1),
            "storm_risk": round(storm_risk, 1),
            "rainfall_risk": round(rainfall_risk, 1),
            "temperature_risk": round(temp_risk, 1),
            "delay_probability": delay_prob,
            "delay_percentage": int(delay_prob * 100),
            "estimated_delay_hours": est_delay_hours,
            "max_wave_height_m": max_wave,
            "max_wind_speed_knots": max_wind,
            "min_visibility_km": min_vis,
            "has_storm": has_storm,
            "advisories": advisories,
            "alerts": generated_alerts,
            "confidence_score": 0.96,
        }

    @staticmethod
    def _empty_assessment() -> Dict[str, Any]:
        return {
            "risk_score": 20.0,
            "risk_level": "LOW",
            "wave_risk": 15.0,
            "wind_risk": 15.0,
            "storm_risk": 10.0,
            "rainfall_risk": 10.0,
            "temperature_risk": 10.0,
            "delay_probability": 0.10,
            "delay_percentage": 10,
            "estimated_delay_hours": 0.0,
            "has_storm": False,
            "advisories": ["No weather telemetry available; standard baseline applied."],
            "alerts": [],
            "confidence_score": 0.50,
        }
