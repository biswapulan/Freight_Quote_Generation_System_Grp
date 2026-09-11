"""The M2 price and M3 risk, as company offers and the M4 screens use them."""

from types import SimpleNamespace

import pytest

from booking.offer_engine import price_offer
from quotes.insights import MARKET_FACTOR_BOUNDS, ai_insights, market_factor

ANALYSIS = {
    "pricing": {
        "currency": "USD",
        "rule_price": 3000.0,
        "rule_price_inr": 250500.0,
        "ai_predicted_price": 1500.0,
        "ai_predicted_price_inr": 125250.0,
        "ml_status": "PREDICTED",
        "breakdown": {
            "base_price": 150.0,
            "distance_charge": 1250.0,
            "weight_charge": 1400.0,
            "fuel_charge": 200.0,
            "total_price": 3000.0,
        },
    },
    "recommendation": {
        "recommended_price": 2295.0,
        "recommended_price_inr": 191632.5,
        "risk_premium_rate": 0.02,
        "strategy": "DISCOUNT_TO_WIN",
    },
    "weather": {"risk_score": 8.0, "summary": "Weather risk 8/100.", "alerts": []},
    "customs": {
        "risk_score": 52.0,
        "summary": "Customs needs documents.",
        "missing_documents": ["Commercial Invoice", "Packing List"],
    },
    "risk": {
        "overall_score": 32.0,
        "risk_level": "MEDIUM",
        "route_score": 48.0,
        "summary": "Overall shipment risk is MEDIUM.",
    },
    "route": {"summary": "INMAA to NLRTM."},
}


def _quote(analysis=ANALYSIS):
    return SimpleNamespace(
        analysis=analysis,
        ml_status="PREDICTED",
        overall_risk_score=None,
        overall_risk_level="",
        weather_risk_score=None,
        customs_risk_score=None,
        route_risk_score=None,
    )


def test_market_factor_is_the_recommended_price_over_the_rule_price():
    assert market_factor(_quote()) == pytest.approx(2295.0 / 3000.0, abs=1e-4)


def test_market_factor_is_held_within_bounds():
    low, high = MARKET_FACTOR_BOUNDS
    cheap = {**ANALYSIS, "recommendation": {"recommended_price": 300.0}}
    dear = {**ANALYSIS, "recommendation": {"recommended_price": 30000.0}}
    assert market_factor(_quote(cheap)) == low
    assert market_factor(_quote(dear)) == high


def test_no_ai_price_means_no_adjustment():
    assert market_factor(_quote(None)) is None
    assert market_factor(_quote({"pricing": {"rule_price": 3000.0}})) is None
    assert ai_insights(_quote(None)) is None


def test_insights_are_in_rupees_at_the_pricing_agents_own_rate():
    insights = ai_insights(_quote())
    assert insights["currency"] == "INR"
    assert insights["standardPrice"] == 250500.0
    assert insights["recommendedPrice"] == 191632.5

    amounts = {line["key"]: line["amount"] for line in insights["breakdown"]}
    assert amounts["distance"] == pytest.approx(1250.0 * 250500.0 / 3000.0)
    assert sum(amounts.values()) == pytest.approx(insights["standardPrice"])

    assert insights["aiAdjustmentPct"] == pytest.approx(-23.5, abs=0.1)
    assert insights["offerAdjustmentPct"] == pytest.approx(-23.5, abs=0.1)
    assert insights["riskPremiumPct"] == 2.0


def test_offer_adjustment_is_capped_but_the_ai_view_is_not():
    cheap = {**ANALYSIS, "recommendation": {"recommended_price": 900.0, "recommended_price_inr": 75150.0}}
    insights = ai_insights(_quote(cheap))
    assert insights["aiAdjustmentPct"] == -70.0
    assert insights["offerAdjustmentPct"] == -30.0


def test_insights_carry_the_risk_and_its_alerts():
    insights = ai_insights(_quote())
    assert insights["risk"]["overallLevel"] == "MEDIUM"
    assert insights["risk"]["weather"]["score"] == 8.0
    assert insights["risk"]["customs"]["score"] == 52.0
    assert insights["risk"]["route"]["score"] == 48.0
    assert any("Commercial Invoice" in alert for alert in insights["alerts"])


def test_the_ai_factor_moves_line_haul_but_not_fixed_fees():
    card = SimpleNamespace(
        rate_per_km=10.0,
        rate_per_kg=1.0,
        fuel_surcharge_pct=10.0,
        base_booking_fee=5000.0,
        handling_fee=2000.0,
        documentation_fee=1000.0,
        minimum_charge=0.0,
        currency="INR",
        transit_days_delta=0,
        validity_days=14,
    )
    common = dict(distance_km=1000, weight_kg=1000, transit_days=10, base_reference=0)
    plain = price_offer(card, **common)
    adjusted = price_offer(card, ai_factor=0.8, **common)

    # Line haul of 11,000 becomes 8,800, fuel follows it, the fees do not move.
    assert plain["base_freight"] == 5000 + 11000
    assert adjusted["base_freight"] == 5000 + 8800
    assert adjusted["fuel_surcharge"] == pytest.approx(880.0)
    assert adjusted["handling_fee"] == plain["handling_fee"]
    assert adjusted["total_price"] == pytest.approx(5000 + 8800 + 880 + 2000 + 1000)
