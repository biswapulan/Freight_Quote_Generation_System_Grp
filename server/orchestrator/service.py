"""The AI Orchestrator (PDF section 5).

Implements the agent flow the specification asks for:

    AI ORCHESTRATOR -> ROUTE AGENT -> PRICING AGENT
                    -> WEATHER AGENT + CUSTOMS AGENT
                    -> RISK AGENT -> QUOTE ENGINE

Before this existed each agent was reachable only as its own isolated endpoint,
and the Risk agent had to be *told* the weather and customs scores by its caller.
Here the orchestrator computes them and feeds them forward, which is what makes
M1/M2/M3 one pipeline rather than three.

Design rules:
  * Every agent is individually fault-isolated. A failure degrades that agent to a
    documented fallback and the pipeline continues -- a weather outage must never
    stop a customer getting a quote (core test scenario 5).
  * Every agent invocation is timed and persisted so the Admin AI Agent Monitor
    reports real telemetry.
"""

import logging
import time
from typing import Any, Dict, Optional

from django.conf import settings

from . import geo
from .models import AgentInvocation, OrchestrationRun

logger = logging.getLogger(__name__)

# Documented conversion used whenever a value has to cross between the INR-native
# ML model and the USD-native M1 rate card.
USD_TO_INR = 83.5

# Risk premium applied to the recommended price. The PDF requires the quote
# recommendation to be a function of pricing *and* risk, not pricing alone.
RISK_PREMIUM = {
    "LOW": 0.00,
    "MEDIUM": 0.02,
    "HIGH": 0.05,
    "CRITICAL": 0.05,
}

# Fallback HS classification when the customer did not supply one. The Customs
# agent needs a tariff heading to look anything up.
_HS_BY_CARGO = [
    ("arms", "9302.00"),
    ("munition", "9302.00"),
    ("weapon", "9302.00"),
    ("chemical", "2905.11"),
    ("hazardous", "2905.11"),
    ("pharma", "3004.90"),
    ("vaccine", "3004.90"),
    ("medicament", "3004.90"),
    ("coffee", "0901.11"),
    ("perishable", "0901.11"),
    ("food", "0901.11"),
    ("textile", "6109.10"),
    ("apparel", "6109.10"),
    ("garment", "6109.10"),
    ("electronic", "8517.12"),
    ("machinery", "8504.40"),
    ("automotive", "8708.29"),
]

DEFAULT_HS_CODE = "8471.30"


def infer_hs_code(cargo_type: str) -> str:
    """Best-effort HS heading for a free-text cargo description."""
    cargo = (cargo_type or "").lower()
    for keyword, code in _HS_BY_CARGO:
        if keyword in cargo:
            return code
    return DEFAULT_HS_CODE


class AgentFailure(Exception):
    """Raised inside an agent step to force the documented fallback path."""


class AIOrchestrator:
    """Runs the full agent pipeline for one shipment and returns a combined state."""

    @classmethod
    def analyze(
        cls,
        shipment,
        quote_id: Optional[str] = None,
        triggered_by: str = "system",
    ) -> Dict[str, Any]:
        """Execute every agent and return the combined analysis state.

        Never raises for agent-level problems: the returned dict always carries a
        usable route, price and risk, with `degraded_agents` naming anything that
        fell back.
        """
        started = time.perf_counter()

        run = OrchestrationRun.objects.create(
            shipment_id=shipment.id,
            quote_id=quote_id or "",
            triggered_by=triggered_by,
            status="RUNNING",
        )

        origin_geo = geo.resolve(shipment.origin)
        dest_geo = geo.resolve(shipment.destination)
        hs_code = (shipment.hs_code or "").strip() or infer_hs_code(shipment.cargo_type)

        context = {
            "shipment_id": shipment.id,
            "origin": shipment.origin,
            "destination": shipment.destination,
            "origin_geo": origin_geo,
            "destination_geo": dest_geo,
            "cargo_type": shipment.cargo_type,
            "hs_code": hs_code,
            "weight_kg": shipment.weight,
            "volume_cbm": shipment.volume,
            "transport_mode": shipment.transport_mode,
            "container_type": shipment.container_type or "40FT",
        }

        degraded: list[str] = []

        route = cls._invoke(run, "ROUTE", degraded, cls._route_agent, context)
        context["route"] = route

        pricing = cls._invoke(run, "PRICING", degraded, cls._pricing_agent, context)
        context["pricing"] = pricing

        weather = cls._invoke(run, "WEATHER", degraded, cls._weather_agent, context)
        context["weather"] = weather

        customs = cls._invoke(run, "CUSTOMS", degraded, cls._customs_agent, context)
        context["customs"] = customs

        risk = cls._invoke(run, "RISK", degraded, cls._risk_agent, context)

        # The AI Quote Recommendation is the last step because it consumes both the
        # pricing outputs and the composite risk level (PDF section 4).
        recommendation = cls._recommend_price(pricing, risk)

        duration_ms = int((time.perf_counter() - started) * 1000)

        result = {
            "run_id": str(run.id),
            "shipment_id": shipment.id,
            "quote_id": quote_id,
            "route": route,
            "pricing": pricing,
            "weather": weather,
            "customs": customs,
            "risk": risk,
            "recommendation": recommendation,
            "degraded_agents": degraded,
            "duration_ms": duration_ms,
            "agent_flow": [
                "AI_ORCHESTRATOR",
                "ROUTE_AGENT",
                "PRICING_AGENT",
                "WEATHER_AGENT",
                "CUSTOMS_AGENT",
                "RISK_AGENT",
                "QUOTE_ENGINE",
            ],
        }

        run.status = "DEGRADED" if degraded else "COMPLETED"
        run.duration_ms = duration_ms
        run.degraded_agents = degraded
        run.result = result
        run.save(update_fields=["status", "duration_ms", "degraded_agents", "result"])

        return result

    # ------------------------------------------------------------------
    # Agent invocation harness
    # ------------------------------------------------------------------

    @classmethod
    def _invoke(cls, run, agent_name, degraded, fn, context) -> Dict[str, Any]:
        """Run one agent, timing it and isolating its failures."""
        started = time.perf_counter()
        try:
            output = fn(context)
            status = "DEGRADED" if output.get("degraded") else "OK"
            error = output.get("error", "")
        except Exception as exc:  # noqa: BLE001 - deliberate: agents must not break the run
            logger.exception("%s agent failed for shipment %s", agent_name, context["shipment_id"])
            output = cls._agent_fallback(agent_name, context, str(exc))
            status = "FAILED"
            error = str(exc)

        if status != "OK":
            degraded.append(agent_name)

        duration_ms = int((time.perf_counter() - started) * 1000)

        try:
            AgentInvocation.objects.create(
                run=run,
                agent=agent_name,
                status=status,
                duration_ms=duration_ms,
                summary=output.get("summary", "")[:256],
                error=error[:2000] if error else "",
                output=output,
            )
        except Exception:
            logger.exception("Failed to persist telemetry for %s agent", agent_name)

        # Namespaced so harness metadata can never shadow an agent's own payload
        # keys -- the Customs agent, for instance, reports a business `status`.
        output["agent_status"] = status
        output["agent_duration_ms"] = duration_ms
        return output

    @classmethod
    def _agent_fallback(cls, agent_name: str, context: Dict[str, Any], error: str) -> Dict[str, Any]:
        """Neutral, documented output used when an agent raises outright."""
        base = {"degraded": True, "error": error, "fallback": True}
        if agent_name == "ROUTE":
            return {
                **base,
                "distance_km": 5000.0,
                "transit_days": 14,
                "route_id": "RT-FALLBACK",
                "path_display": f"{context['origin']} -> {context['destination']}",
                "carrier": "Unassigned",
                "alternate_routes": [],
                "summary": "Route agent unavailable; nominal distance and transit applied.",
            }
        if agent_name == "PRICING":
            return {
                **base,
                "currency": "USD",
                "rule_price": 0.0,
                "ai_predicted_price": None,
                "ml_status": "UNAVAILABLE",
                "breakdown": {},
                "summary": "Pricing agent unavailable.",
            }
        if agent_name == "WEATHER":
            return {
                **base,
                "risk_score": 20.0,
                "risk_level": "LOW",
                "delay_probability": 0.1,
                "alerts": [],
                "summary": "Weather agent unavailable; baseline seasonal risk applied.",
            }
        if agent_name == "CUSTOMS":
            return {
                **base,
                "risk_score": 40.0,
                "readiness_score": 60.0,
                "status": "NEEDS_DOCUMENTS",
                "is_prohibited": False,
                "missing_documents": [],
                "summary": "Customs agent unavailable; manual broker check required.",
            }
        return {
            **base,
            "overall_score": 50.0,
            "risk_level": "MEDIUM",
            "can_issue_quote": False,
            "policy_action": "REQUIRES_SENIOR_BROKER_REVIEW",
            "summary": "Risk agent unavailable; defaulting to manual review.",
        }

    # ------------------------------------------------------------------
    # 1. Route Agent -- route options, distance and ETA (PDF section 5)
    # ------------------------------------------------------------------

    @classmethod
    def _route_agent(cls, context: Dict[str, Any]) -> Dict[str, Any]:
        from pricing.route_agent import evaluate_shipment_routes
        from quotes.pricing_calculator import calculate_distance_km

        origin_code = context["origin_geo"].get("port_code") or "INMAA"
        dest_code = context["destination_geo"].get("port_code") or "SGSIN"

        distance_km = calculate_distance_km(context["origin"], context["destination"])

        routes = evaluate_shipment_routes(
            shipment_id=context["shipment_id"],
            customer_id="",
            customer_name="",
            origin_code=origin_code,
            dest_code=dest_code,
            cargo_type=context["cargo_type"],
            container_type=context["container_type"],
        )
        recommended = routes["recommended_route"]

        # The route dataset only covers a handful of lanes; for anything else it
        # emits a nominal 7-day transit regardless of distance, which is wrong for
        # a long haul like Chennai to Rotterdam. Derive the ETA from distance and
        # mode instead whenever the lane was not a real dataset match.
        lane_matched = routes.get("lane_matched")
        if lane_matched is None:
            lane_matched = not recommended["route_id"].startswith(
                f"RT-{origin_code}-{dest_code}-"
            )

        if lane_matched:
            transit_days = recommended["transit_days"]
            eta_basis = "carrier schedule"
        else:
            transit_days = cls.estimate_transit_days(
                distance_km, context["transport_mode"], recommended.get("is_direct", True)
            )
            eta_basis = "distance and mode"

        return {
            "degraded": False,
            "distance_km": distance_km,
            "transit_days": transit_days,
            "eta_basis": eta_basis,
            "lane_matched": lane_matched,
            "route_id": recommended["route_id"],
            "path_display": recommended["path_display"],
            "carrier": recommended["carrier"],
            "reliability_score": recommended.get("reliability_score"),
            "is_direct": recommended.get("is_direct", True),
            "alternate_routes": cls._rescore_alternates(
                routes.get("alternate_routes", []), distance_km,
                context["transport_mode"], lane_matched,
            ),
            "origin_code": origin_code,
            "dest_code": dest_code,
            "summary": (
                f"{recommended['path_display']} via {recommended['carrier']}, "
                f"{distance_km:,.0f} km, {transit_days} days."
            ),
        }

    # Average door-to-door speed in km per day, and fixed terminal handling days,
    # per transport mode. Ocean figures reflect a ~20 knot service speed.
    _TRANSIT_PROFILE = {
        "air": (2400.0, 2),
        "express": (3000.0, 1),
        "road": (600.0, 1),
        "ground": (600.0, 1),
        "rail": (450.0, 2),
        "ocean": (550.0, 4),
    }

    @classmethod
    def estimate_transit_days(cls, distance_km: float, transport_mode: str, is_direct: bool = True) -> int:
        """Estimate door-to-door transit days from distance and transport mode."""
        mode = (transport_mode or "ocean").lower()
        if mode.startswith("ocean"):
            mode = "ocean"
        speed_per_day, handling_days = cls._TRANSIT_PROFILE.get(mode, cls._TRANSIT_PROFILE["ocean"])

        sailing_days = distance_km / speed_per_day
        transhipment_penalty = 0 if is_direct else 3
        return max(1, int(round(sailing_days + handling_days + transhipment_penalty)))

    @classmethod
    def _rescore_alternates(cls, alternates, distance_km, transport_mode, lane_matched):
        """Give synthetic alternate routes a distance-based ETA too."""
        if lane_matched:
            return alternates
        rescored = []
        for alt in alternates:
            rescored.append(
                {
                    **alt,
                    "transit_days": cls.estimate_transit_days(
                        distance_km, transport_mode, alt.get("is_direct", True)
                    ),
                }
            )
        return rescored

    # ------------------------------------------------------------------
    # 2. Pricing Agent -- M1 rule price + M2 ML prediction (PDF section 5)
    # ------------------------------------------------------------------

    @classmethod
    def _pricing_agent(cls, context: Dict[str, Any]) -> Dict[str, Any]:
        from pricing.ml_service import MLPricingService
        from quotes.pricing_calculator import calculate_quote_pricing

        route = context["route"]
        distance_km = route["distance_km"]

        # --- M1: deterministic itemised rule price (the quote's line items) ---
        breakdown = calculate_quote_pricing(
            distance_km=distance_km,
            weight_kg=context["weight_kg"],
            volume_cbm=context["volume_cbm"],
            transport_mode=context["transport_mode"],
            cargo_type=context["cargo_type"],
        )
        rule_price = breakdown["total_price"]

        # --- M2: ML spot-rate prediction ---
        ml_status = "FALLBACK_RULE"
        ai_price = None
        ml_detail: Dict[str, Any] = {}
        ml_error = ""

        try:
            model_loaded = MLPricingService.get_model() is not None
            prediction = MLPricingService.predict_freight_rate(
                origin_port=context["origin_geo"].get("city") or context["origin"],
                destination_port=context["destination_geo"].get("city") or context["destination"],
                transport_mode=cls._ml_transport_mode(context["transport_mode"]),
                cargo_type=context["cargo_type"],
                container_type=context["container_type"],
                weight_kg=context["weight_kg"],
                volume_cbm=context["volume_cbm"],
                distance_km=distance_km,
                transit_days=route["transit_days"],
            )
            if model_loaded:
                ml_status = "PREDICTED"
                # The model is INR-native; the M1 rate card is USD-native.
                ai_price = round(prediction["ml_predicted_price_inr"] / USD_TO_INR, 2)
            ml_detail = {
                "predicted_price_inr": prediction.get("ml_predicted_price_inr"),
                "rule_price_inr": prediction.get("rule_based_price_inr"),
                "variance_percent": prediction.get("variance_percent"),
                "strategy": prediction.get("strategy"),
                "pricing_recommendation": prediction.get("pricing_recommendation"),
                "confidence_interval_95": prediction.get("confidence_interval_95"),
                "model_metadata": prediction.get("model_metadata"),
            }
        except Exception as exc:  # noqa: BLE001 - scenario 5: ML down must not block the quote
            logger.warning("ML pricing unavailable for %s: %s", context["shipment_id"], exc)
            ml_error = str(exc)

        # Core test scenario 5 -- ML unavailable falls back to the rule price.
        if ml_status != "PREDICTED":
            ai_price = rule_price

        variance = round(ai_price - rule_price, 2)
        variance_pct = round((variance / rule_price) * 100, 1) if rule_price else 0.0

        return {
            "degraded": ml_status != "PREDICTED",
            "error": ml_error,
            "currency": "USD",
            "rule_price": rule_price,
            "ai_predicted_price": ai_price,
            "ml_status": ml_status,
            "variance": variance,
            "variance_percent": variance_pct,
            "breakdown": breakdown,
            "rule_price_inr": round(rule_price * USD_TO_INR, 2),
            "ai_predicted_price_inr": round(ai_price * USD_TO_INR, 2),
            "ml_detail": ml_detail,
            "summary": (
                f"Rule {rule_price:,.2f} USD vs AI {ai_price:,.2f} USD "
                f"({variance_pct:+.1f}%), ml_status={ml_status}."
            ),
        }

    @staticmethod
    def _ml_transport_mode(mode: str) -> str:
        """Map the platform's transport modes onto the ML model's training labels."""
        normalized = (mode or "ocean").lower()
        if normalized.startswith("air") or normalized == "express":
            return "Air"
        if normalized in ("road", "ground", "truck"):
            return "Road"
        if normalized == "rail":
            return "Rail"
        return "Sea"

    # ------------------------------------------------------------------
    # 3. Weather Agent -- route weather and delay risk (PDF section 5)
    # ------------------------------------------------------------------

    @classmethod
    def _weather_agent(cls, context: Dict[str, Any]) -> Dict[str, Any]:
        from weather.engine import WeatherRiskEngine
        from weather.provider import WeatherProviderAdapter
        from weather.sampler import RouteGeometrySampler

        # Live provider calls are network-bound. Quote generation is synchronous,
        # so the sample count is capped and deployments can opt out entirely.
        max_samples = getattr(settings, "ORCHESTRATOR_WEATHER_SAMPLES", 3)
        live = getattr(settings, "ORCHESTRATOR_LIVE_WEATHER", True)

        waypoints = RouteGeometrySampler.sample_route_waypoints(
            origin=context["origin"],
            destination=context["destination"],
            explicit_waypoints=[],
            max_samples=max_samples,
        )

        observations = []
        for point in waypoints:
            if live:
                obs = WeatherProviderAdapter.get_observation(point["lat"], point["lon"])
            else:
                obs = WeatherProviderAdapter.get_simulated_observation(point["lat"], point["lon"])
            obs["name"] = point["name"]
            observations.append(obs)

        evaluation = WeatherRiskEngine.evaluate_route_weather(
            observations=observations,
            transit_days=context["route"]["transit_days"],
            route_name=context["route"]["path_display"],
        )

        cls._persist_weather(context, observations, evaluation)

        return {
            "degraded": False,
            "risk_score": evaluation["risk_score"],
            "risk_level": evaluation["risk_level"],
            "delay_probability": evaluation["delay_probability"],
            "estimated_delay_hours": evaluation.get("estimated_delay_hours"),
            "max_wave_height_m": evaluation.get("max_wave_height_m"),
            "max_wind_speed_knots": evaluation.get("max_wind_speed_knots"),
            "has_storm": evaluation.get("has_storm", False),
            "advisories": evaluation.get("advisories", []),
            "alerts": evaluation.get("alerts", []),
            "waypoints_sampled": len(observations),
            "provider": observations[0].get("provider") if observations else "unknown",
            "summary": (
                f"Weather risk {evaluation['risk_score']}/100 ({evaluation['risk_level']}), "
                f"delay probability {int(evaluation['delay_probability'] * 100)}%."
            ),
        }

    @classmethod
    def _persist_weather(cls, context, observations, evaluation):
        """Store the assessment and any severe-weather alerts.

        Without this the Weather panel and the alerts endpoint would only ever
        show data from someone manually calling /weather/assess, never from an
        actual quote run. Core scenario 6 depends on the alert being recorded.
        """
        from datetime import timedelta

        from django.utils import timezone
        from weather.models import WeatherAlert, WeatherAssessment, WeatherObservation

        route_id = context["route"].get("route_id") or f"route_{context['shipment_id']}"
        now = timezone.now()

        assessment, _ = WeatherAssessment.objects.update_or_create(
            shipment_id=context["shipment_id"],
            defaults={
                "route_id": route_id,
                "risk_score": evaluation["risk_score"],
                "risk_level": evaluation["risk_level"],
                "storm_risk": evaluation["storm_risk"],
                "rainfall_risk": evaluation["rainfall_risk"],
                "wind_risk": evaluation["wind_risk"],
                "wave_risk": evaluation["wave_risk"],
                "temperature_risk": evaluation["temperature_risk"],
                "delay_probability": evaluation["delay_probability"],
                "assessment_status": "COMPLETED",
                "provider": observations[0].get("provider", "open-meteo") if observations else "open-meteo",
                "provider_timestamp": now,
                "assessed_at": now,
                "expires_at": now + timedelta(hours=6),
                "confidence_score": evaluation["confidence_score"],
            },
        )

        assessment.observations.all().delete()
        for obs in observations:
            WeatherObservation.objects.create(
                route_id=route_id,
                weather_assessment=assessment,
                latitude=obs["latitude"],
                longitude=obs["longitude"],
                observation_time=now,
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

        for alert in evaluation.get("alerts", []):
            WeatherAlert.objects.update_or_create(
                shipment_id=context["shipment_id"],
                alert_type=alert["alert_type"],
                title=alert["title"],
                defaults={
                    "route_id": route_id,
                    "severity": alert["severity"],
                    "message": alert["message"],
                    "starts_at": now,
                    "ends_at": now + timedelta(days=2),
                    "status": "ACTIVE",
                },
            )

    # ------------------------------------------------------------------
    # 4. Customs Agent -- documents and requirements (PDF section 5)
    # ------------------------------------------------------------------

    @classmethod
    def _customs_agent(cls, context: Dict[str, Any]) -> Dict[str, Any]:
        from customs.models import CustomsChecklistItem, CustomsComplianceCheck, ShipmentDocument
        from customs.validator import CustomsComplianceEngine
        from django.utils import timezone

        origin_country = context["origin_geo"].get("country") or "India"
        dest_country = context["destination_geo"].get("country") or "Netherlands"

        evaluation = CustomsComplianceEngine.evaluate_shipment_compliance(
            shipment_id=context["shipment_id"],
            origin_country=origin_country,
            destination_country=dest_country,
            hs_code=context["hs_code"],
            commodity=context["cargo_type"],
            incoterm="FOB",
        )

        # Persist so the Customs Officer portal has something to open.
        check, _ = CustomsComplianceCheck.objects.update_or_create(
            shipment_id=context["shipment_id"],
            defaults={
                "origin_country": origin_country,
                "destination_country": dest_country,
                "hs_code": evaluation["hs_code"],
                "commodity": context["cargo_type"],
                "incoterm": evaluation["incoterm"],
                "readiness_score": evaluation["readiness_score"],
                "risk_level": evaluation["risk_level"],
                "status": evaluation["status"],
                "checked_at": timezone.now(),
            },
        )
        # Reconcile the generated checklist against documents already on file, so a
        # re-quote after an upload reflects the paperwork that has since arrived.
        uploaded_types = set(
            ShipmentDocument.objects.filter(
                shipment_id=context["shipment_id"]
            )
            .exclude(verification_status="REJECTED")
            .values_list("document_type", flat=True)
        )
        uploaded_normalized = {cls._normalize_doc(name) for name in uploaded_types}

        check.checklist_items.all().delete()
        checklist_items = []
        outstanding = []
        for item in evaluation["checklist_items"]:
            satisfied = cls._normalize_doc(item["item_name"]) in uploaded_normalized
            item_status = "SATISFIED" if satisfied else item["status"]

            CustomsChecklistItem.objects.create(
                compliance_check=check,
                item_name=item["item_name"],
                description=item["description"],
                mandatory=item["mandatory"],
                status=item_status,
                document_required=item["document_required"],
                citation=item.get("citation", ""),
                evidence=item.get("evidence", ""),
            )
            checklist_items.append({**item, "status": item_status})

            if item["mandatory"] and not satisfied:
                outstanding.append(item["item_name"])

        # readiness_score is "how ready"; the Risk engine wants "how risky".
        customs_risk = round(100.0 - float(evaluation["readiness_score"]), 1)
        compliance_status = evaluation["status"]

        # Core test scenario 7 -- a missing mandatory document raises a customs
        # flag and routes the shipment to an officer. The underlying validator
        # only grades tariff eligibility, so document readiness is layered here.
        documents_status = "COMPLETE" if not outstanding else "MISSING"
        if outstanding and compliance_status not in ("REJECTED",):
            compliance_status = "NEEDS_DOCUMENTS"
            # Each outstanding mandatory document adds risk, capped so that
            # paperwork alone can never look worse than a prohibition.
            customs_risk = min(round(customs_risk + 10.0 * len(outstanding), 1), 75.0)

        if compliance_status == "REJECTED":
            customs_risk = 100.0

        check.status = compliance_status
        check.save(update_fields=["status"])

        return {
            "degraded": False,
            "check_id": str(check.id),
            "risk_score": customs_risk,
            "readiness_score": evaluation["readiness_score"],
            "status": compliance_status,
            "tariff_status": evaluation["status"],
            "documents_status": documents_status,
            "risk_level": evaluation["risk_level"],
            "origin_country": origin_country,
            "destination_country": dest_country,
            "hs_code": evaluation["hs_code"],
            "incoterm": evaluation["incoterm"],
            "is_prohibited": evaluation["is_prohibited"],
            "is_restricted": evaluation["is_restricted"],
            "advisory": evaluation["advisory"],
            "missing_documents": outstanding,
            "documents_on_file": sorted(uploaded_types),
            "checklist_items": checklist_items,
            "summary": (
                f"Customs {compliance_status} ({customs_risk}/100 risk); tariff "
                f"{evaluation['status']}, {len(outstanding)} mandatory document(s) outstanding."
            ),
        }

    @staticmethod
    def _normalize_doc(name: str) -> str:
        """Compare document names ignoring case, spacing and punctuation.

        Uploads arrive as "COMMERCIAL_INVOICE" while the checklist says
        "Commercial Invoice"; both must resolve to the same key.
        """
        return "".join(ch for ch in (name or "").lower() if ch.isalnum())

    # ------------------------------------------------------------------
    # 5. Risk Agent -- composite score (PDF section 5)
    # ------------------------------------------------------------------

    @classmethod
    def _risk_agent(cls, context: Dict[str, Any]) -> Dict[str, Any]:
        from risk.engine import MultiFactorRiskEngine

        weather = context["weather"]
        customs = context["customs"]

        # This is the wiring the spec asks for and the old code lacked: the Risk
        # engine is fed by the Weather and Customs agents rather than by defaults.
        assessment = MultiFactorRiskEngine.evaluate_shipment_risk(
            shipment_id=context["shipment_id"],
            weather_score=float(weather.get("risk_score", 20.0)),
            customs_score=float(customs.get("risk_score", 15.0)),
            customs_status=customs.get("status", "APPROVED"),
            origin=context["origin"],
            destination=context["destination"],
            cargo_type=context["cargo_type"],
            hs_code=context["hs_code"].replace(".", ""),
        )

        return {
            "degraded": False,
            "assessment_id": assessment["id"],
            "overall_score": assessment["overall_score"],
            "risk_level": assessment["risk_level"],
            "can_issue_quote": assessment["can_issue_quote"],
            "policy_action": assessment["policy_action"],
            "policy_message": assessment["policy_message"],
            "weather_score": assessment["weather_score"],
            "customs_score": assessment["customs_score"],
            "route_score": assessment["route_score"],
            "port_score": assessment["port_score"],
            "cargo_score": assessment["cargo_score"],
            "factors": assessment["factors"],
            "explanation": assessment["explanation"],
            "summary": assessment["explanation"]["summary"],
        }

    # ------------------------------------------------------------------
    # AI Quote Recommendation (PDF section 4)
    # ------------------------------------------------------------------

    @classmethod
    def _recommend_price(cls, pricing: Dict[str, Any], risk: Dict[str, Any]) -> Dict[str, Any]:
        """Blend the rule and AI prices, then load for risk.

        Uses pricing *and* risk outputs, per "AI Quote Recommendation" in the spec.
        """
        rule_price = float(pricing.get("rule_price") or 0.0)
        ai_price = float(pricing.get("ai_predicted_price") or rule_price)

        blended = (rule_price + ai_price) / 2 if rule_price else ai_price
        risk_level = risk.get("risk_level", "MEDIUM")
        premium_rate = RISK_PREMIUM.get(risk_level, 0.02)
        premium = round(blended * premium_rate, 2)
        recommended = round(blended + premium, 2)

        if premium_rate:
            rationale = (
                f"Midpoint of rule ({rule_price:,.2f}) and AI ({ai_price:,.2f}) prices, "
                f"loaded {premium_rate:.0%} for {risk_level} composite risk."
            )
        else:
            rationale = (
                f"Midpoint of rule ({rule_price:,.2f}) and AI ({ai_price:,.2f}) prices; "
                f"{risk_level} risk carries no premium."
            )

        return {
            "recommended_price": recommended,
            "recommended_price_inr": round(recommended * USD_TO_INR, 2),
            "currency": pricing.get("currency", "USD"),
            "blended_base": round(blended, 2),
            "risk_premium": premium,
            "risk_premium_rate": premium_rate,
            "risk_level": risk_level,
            "strategy": pricing.get("ml_detail", {}).get("strategy", "RULE_BASELINE"),
            "rationale": rationale,
        }
