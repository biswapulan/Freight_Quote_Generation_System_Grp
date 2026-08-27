"""Multi-Factor Shipment Risk Scoring & Policy Gating Engine — Milestone 3 Phase 4.

Calculates weighted composite risk across 5 distinct dimensions:
  1. Weather Risk (30% weight)
  2. Customs & Compliance Risk (25% weight)
  3. Route Graph & Chokepoint Risk (20% weight)
  4. Port Congestion Risk (15% weight)
  5. Cargo & Commodity Sensitivity Risk (10% weight)

Enforces Policy Gating Rules:
  - Score 0-30 (LOW): Auto-approved for quote issuance
  - Score 31-60 (MEDIUM): Approved with cautionary risk advisory
  - Score 61-80 (HIGH): Flagged for Senior Freight Broker review
  - Score 81-100 (CRITICAL) or Customs REJECTED: Hard blocked from quote issuance
"""

from typing import Dict, Any, List, Tuple
from django.utils import timezone
from .models import ShipmentRiskAssessment, RiskFactor, RiskAlert


class MultiFactorRiskEngine:
    """Core domain service for synthesizing risk and generating factor explainability."""

    DEFAULT_WEIGHTS = {
        "weather": 0.30,
        "customs": 0.25,
        "route": 0.20,
        "port": 0.15,
        "cargo": 0.10,
    }

    @classmethod
    def calculate_cargo_risk(cls, cargo_type: str, hs_code: str = "") -> Tuple[float, str]:
        """Determine cargo sensitivity score (0-100) based on commodity class and HS code."""
        cargo = cargo_type.lower()
        if "revolver" in cargo or "arms" in cargo or "munition" in cargo or hs_code.startswith("9302"):
            return 95.0, "Prohibited or heavily restricted military armament (Class 1)."
        if "chemical" in cargo or "methanol" in cargo or "hazardous" in cargo or hs_code.startswith("2905"):
            return 65.0, "Hazardous Class 3 flammable chemicals requiring special handling and TSCA declaration."
        if "pharma" in cargo or "vaccine" in cargo or "medicament" in cargo or hs_code.startswith("3004"):
            return 45.0, "High-value temperature-controlled cold chain cargo subject to spoilage."
        if "coffee" in cargo or "perishable" in cargo or "grain" in cargo or hs_code.startswith("0901"):
            return 35.0, "Agricultural perishable cargo subject to quarantine inspections and moisture risk."
        if "electronics" in cargo or "inverter" in cargo or "server" in cargo or hs_code.startswith("8504"):
            return 25.0, "High-value electronic components with sensitive circuitry."
        if "textile" in cargo or "apparel" in cargo or hs_code.startswith("6109"):
            return 15.0, "Standard non-perishable consumer dry cargo."
        return 20.0, "Standard general dry freight cargo."

    @classmethod
    def calculate_route_risk(cls, origin: str, destination: str) -> Tuple[float, str]:
        """Assess corridor security, chokepoint transit, and geopolitical risk."""
        orig = origin.lower()
        dest = destination.lower()

        # Corridors traversing Red Sea / Bab-el-Mandeb or Suez
        if ("rotterdam" in dest or "hamburg" in dest or "london" in dest) and ("chennai" in orig or "mumbai" in orig or "singapore" in orig):
            return 48.0, "Route navigates Bab-el-Mandeb / Red Sea transit corridor with heightened maritime security advisories."
        # Transpacific route
        if "shanghai" in orig and ("los angeles" in dest or "long beach" in dest):
            return 22.0, "Deep-water Transpacific ocean route with seasonal typhoon exposure."
        # Regional feeder
        if "singapore" in orig or "colombo" in orig or "dubai" in orig:
            return 18.0, "High-density established maritime trade corridor with standard navigational density."
        return 20.0, "Standard international maritime commercial shipping lane."

    @classmethod
    def calculate_port_risk(cls, origin: str, destination: str) -> Tuple[float, str]:
        """Assess berth congestion and average dwell time index."""
        dest = destination.lower()
        if "new york" in dest or "los angeles" in dest or "long beach" in dest:
            return 42.0, "US West/East coast terminal dwell averages 3-5 days with peak season container yard utilization."
        if "rotterdam" in dest or "antwerp" in dest or "hamburg" in dest:
            return 30.0, "North European container terminal operations running at moderate 32hr average berth turnaround."
        if "singapore" in dest or "dubai" in dest:
            return 18.0, "World-class automated hub with fast average container turnaround (< 24 hrs)."
        return 25.0, "Standard commercial port dwell time."

    @classmethod
    def evaluate_shipment_risk(
        cls,
        shipment_id: str,
        quote_id: str = None,
        weather_score: float = 20.0,
        customs_score: float = 15.0,
        customs_status: str = "APPROVED",
        origin: str = "Chennai",
        destination: str = "Rotterdam",
        cargo_type: str = "General Cargo",
        hs_code: str = "850440",
    ) -> Dict[str, Any]:
        """Computes composite risk, generates factor explainability, and enforces policy gating."""
        
        # 1. Compute Sub-factor Scores
        cargo_score, cargo_reason = cls.calculate_cargo_risk(cargo_type, hs_code)
        route_score, route_reason = cls.calculate_route_risk(origin, destination)
        port_score, port_reason = cls.calculate_port_risk(origin, destination)

        # 2. Weighted Composite Calculation
        w_w = cls.DEFAULT_WEIGHTS["weather"]
        c_w = cls.DEFAULT_WEIGHTS["customs"]
        r_w = cls.DEFAULT_WEIGHTS["route"]
        p_w = cls.DEFAULT_WEIGHTS["port"]
        cg_w = cls.DEFAULT_WEIGHTS["cargo"]

        w_contrib = round(weather_score * w_w, 2)
        c_contrib = round(customs_score * c_w, 2)
        r_contrib = round(route_score * r_w, 2)
        p_contrib = round(port_score * p_w, 2)
        cg_contrib = round(cargo_score * cg_w, 2)

        overall = round(w_contrib + c_contrib + r_contrib + p_contrib + cg_contrib, 1)

        # 3. Determine Risk Severity Level
        if overall <= 30.0:
            risk_level = "LOW"
        elif overall <= 60.0:
            risk_level = "MEDIUM"
        elif overall <= 80.0:
            risk_level = "HIGH"
        else:
            risk_level = "CRITICAL"

        # Special override for Prohibited Munitions or Customs Rejection
        if customs_status == "REJECTED" or hs_code.startswith("9302"):
            overall = max(overall, 95.0)
            risk_level = "CRITICAL"

        # 4. Policy Gating Rule
        if risk_level == "CRITICAL" or customs_status == "REJECTED":
            policy_action = "BLOCK_QUOTE_ISSUANCE"
            policy_message = "Quote hard-blocked by policy. Cargo is prohibited, under embargo, or has critical composite risk."
            can_issue_quote = False
        elif risk_level == "HIGH" or customs_status == "NEEDS_DOCUMENTS":
            policy_action = "REQUIRES_SENIOR_BROKER_REVIEW"
            policy_message = "High risk detected. Requires Senior Broker manual sign-off before customer confirmation."
            can_issue_quote = False
        elif risk_level == "MEDIUM":
            policy_action = "AUTO_APPROVED_WITH_ADVISORY"
            policy_message = "Quote eligible for issuance with standard maritime risk advisory disclaimer attached."
            can_issue_quote = True
        else:
            policy_action = "AUTO_APPROVED"
            policy_message = "Shipment verified within standard operational safety thresholds. Instant quote approved."
            can_issue_quote = True

        # 5. Factor Explainability Narrative
        contributions = {
            "weather": w_contrib,
            "customs": c_contrib,
            "route": r_contrib,
            "port": p_contrib,
            "cargo": cg_contrib,
        }
        dominant_factor = max(contributions, key=contributions.get)

        explanation = {
            "summary": f"Overall shipment risk is {risk_level} ({overall}/100). Dominant risk driver is {dominant_factor.capitalize()}.",
            "dominant_factor": dominant_factor,
            "policy_action": policy_action,
            "policy_message": policy_message,
            "can_issue_quote": can_issue_quote,
            "weights": cls.DEFAULT_WEIGHTS,
            "contributions": contributions,
        }

        # 6. Database Persistence
        assessment, _ = ShipmentRiskAssessment.objects.update_or_create(
            shipment_id=shipment_id,
            defaults={
                "quote_id": quote_id,
                "weather_score": weather_score,
                "customs_score": customs_score,
                "route_score": route_score,
                "port_score": port_score,
                "cargo_score": cargo_score,
                "overall_score": overall,
                "risk_level": risk_level,
                "explanation": explanation,
                "assessed_at": timezone.now(),
            },
        )

        # Clear and rebuild factor breakdown
        assessment.factors.all().delete()
        
        factors_to_create = [
            RiskFactor(
                risk_assessment=assessment,
                factor_type="WEATHER",
                factor_name="Marine & Weather Conditions",
                score=weather_score,
                weight=w_w,
                contribution=w_contrib,
                severity="LOW" if weather_score <= 30 else ("MEDIUM" if weather_score <= 60 else "HIGH"),
                reason=f"Open-Meteo ocean telemetry evaluates wave swell and wind gusts along corridor ({w_contrib} pts).",
                source="Weather Intelligence Agent",
            ),
            RiskFactor(
                risk_assessment=assessment,
                factor_type="CUSTOMS",
                factor_name="Regulatory & Customs Clearance",
                score=customs_score,
                weight=c_w,
                contribution=c_contrib,
                severity="LOW" if customs_score <= 30 else ("MEDIUM" if customs_score <= 60 else "CRITICAL"),
                reason=f"Customs readiness evaluates document completeness and tariff restrictions ({c_contrib} pts).",
                source="Customs RAG Engine",
            ),
            RiskFactor(
                risk_assessment=assessment,
                factor_type="ROUTE",
                factor_name="Transit Corridor & Chokepoints",
                score=route_score,
                weight=r_w,
                contribution=r_contrib,
                severity="LOW" if route_score <= 30 else ("MEDIUM" if route_score <= 60 else "HIGH"),
                reason=route_reason,
                source="Route Graph Engine",
            ),
            RiskFactor(
                risk_assessment=assessment,
                factor_type="PORT",
                factor_name="Port Congestion & Terminal Dwell",
                score=port_score,
                weight=p_w,
                contribution=p_contrib,
                severity="LOW" if port_score <= 30 else ("MEDIUM" if port_score <= 60 else "HIGH"),
                reason=port_reason,
                source="Port Congestion Monitor",
            ),
            RiskFactor(
                risk_assessment=assessment,
                factor_type="CARGO",
                factor_name="Commodity & Cargo Sensitivity",
                score=cargo_score,
                weight=cg_w,
                contribution=cg_contrib,
                severity="LOW" if cargo_score <= 30 else ("MEDIUM" if cargo_score <= 60 else "CRITICAL"),
                reason=cargo_reason,
                source="HS Code Classification Engine",
            ),
        ]
        RiskFactor.objects.bulk_create(factors_to_create)

        # 7. Generate High-Priority Alerts if necessary
        if risk_level in ["HIGH", "CRITICAL"]:
            RiskAlert.objects.update_or_create(
                shipment_id=shipment_id,
                title=f"{risk_level} Shipment Risk Threshold Exceeded",
                defaults={
                    "risk_assessment": assessment,
                    "quote_id": quote_id,
                    "severity": risk_level,
                    "alert_type": "RISK_POLICY_BREACH",
                    "message": policy_message,
                    "status": "ACTIVE",
                    "source": "Risk Policy Engine",
                },
            )

        return {
            "id": str(assessment.id),
            "shipment_id": shipment_id,
            "quote_id": quote_id,
            "overall_score": overall,
            "risk_level": risk_level,
            "can_issue_quote": can_issue_quote,
            "policy_action": policy_action,
            "policy_message": policy_message,
            "weather_score": weather_score,
            "customs_score": customs_score,
            "route_score": route_score,
            "port_score": port_score,
            "cargo_score": cargo_score,
            "explanation": explanation,
            "factors": [
                {
                    "factor_type": f.factor_type,
                    "factor_name": f.factor_name,
                    "score": f.score,
                    "weight": f.weight,
                    "contribution": f.contribution,
                    "severity": f.severity,
                    "reason": f.reason,
                    "source": f.source,
                }
                for f in factors_to_create
            ],
        }
