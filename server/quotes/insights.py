"""The M2 price and M3 risk for one quote, in the shape the M4 screens use.

The orchestrator stores its whole run on the quote: the rule price and the
model's prediction (M2), the weather, customs and composite risk (M3), and the
price it recommends from both. Company offers, the agent's verification window
and the customer's quote screen all need the same few figures from that run,
in rupees, so they are read from it in one place.
"""

# How far the AI may move a company's freight rate either way. Rate cards are
# commercial terms; an outlier prediction should nudge them, not rewrite them.
MARKET_FACTOR_BOUNDS = (0.70, 1.30)

BREAKDOWN_LINES = (
    ("base", "base_price", "Base charge"),
    ("distance", "distance_charge", "Distance charge"),
    ("weight", "weight_charge", "Weight charge"),
    ("fuel", "fuel_charge", "Fuel surcharge"),
)


def _section(quote, name):
    return (quote.analysis or {}).get(name) or {}


def _rounded(value):
    return round(float(value), 2) if value is not None else None


def _pct(factor):
    return round((factor - 1.0) * 100.0, 1) if factor else None


def market_factor(quote):
    """The AI recommended price as a share of the rule price, within bounds.

    The recommended price blends the model's prediction with the rule price and
    loads it for the composite risk, so this one ratio carries both M2 and M3
    into every company's offer. It is unitless, so no currency conversion is
    involved. None when the run has no price to compare.
    """
    rule = _section(quote, "pricing").get("rule_price")
    recommended = _section(quote, "recommendation").get("recommended_price")
    if not rule or recommended is None:
        return None
    low, high = MARKET_FACTOR_BOUNDS
    return round(min(max(float(recommended) / float(rule), low), high), 4)


def ai_insights(quote):
    """Prices in rupees, risk scores and alerts for one quote, or None."""
    pricing = _section(quote, "pricing")
    recommendation = _section(quote, "recommendation")
    weather = _section(quote, "weather")
    customs = _section(quote, "customs")
    risk = _section(quote, "risk")
    route = _section(quote, "route")
    if not pricing and not risk:
        return None

    rule = pricing.get("rule_price")
    rule_inr = pricing.get("rule_price_inr")
    recommended = recommendation.get("recommended_price")
    # Convert at the rate the pricing agent itself used, so these lines add up
    # to the rupee figures it stored.
    rate = float(rule_inr) / float(rule) if rule and rule_inr else None
    breakdown = pricing.get("breakdown") or {}
    lines = [
        {"key": key, "label": label, "amount": _rounded(breakdown[field] * rate)}
        for key, field, label in BREAKDOWN_LINES
        if rate and breakdown.get(field) is not None
    ]

    alerts = list(weather.get("alerts") or [])
    if weather.get("has_storm"):
        alerts.append("Storm activity is forecast on the route.")
    if customs.get("is_prohibited"):
        alerts.append("This cargo is prohibited on this lane.")
    elif customs.get("is_restricted"):
        alerts.append("This cargo is restricted on this lane and needs a licence.")
    # Read the uploads as they are now. The stored checklist is from when the
    # quote was generated and went on listing papers the customer had since
    # uploaded as outstanding.
    from customs.paperwork import paperwork

    papers, _ = paperwork(quote)
    missing = [p["name"] for p in papers if not p["onFile"]]
    rejected = [
        p["name"]
        for p in papers
        if p["onFile"] and "REJECTED" in (p["customsStatus"], p["companyAnyStatus"])
    ]
    if missing:
        alerts.append("Customs documents outstanding: " + ", ".join(missing) + ".")
    if rejected:
        alerts.append("Rejected and waiting for a new upload: " + ", ".join(rejected) + ".")

    premium = recommendation.get("risk_premium_rate")
    raw_factor = float(recommended) / float(rule) if rule and recommended is not None else None

    return {
        "currency": "INR",
        "standardPrice": _rounded(rule_inr),
        "aiPredictedPrice": _rounded(pricing.get("ai_predicted_price_inr")),
        "recommendedPrice": _rounded(recommendation.get("recommended_price_inr")),
        "mlStatus": pricing.get("ml_status") or quote.ml_status,
        # The recommended price against the standard one, as the AI sees it...
        "aiAdjustmentPct": _pct(raw_factor),
        # ...and what company offers get once it is held within bounds.
        "marketFactor": market_factor(quote),
        "offerAdjustmentPct": _pct(market_factor(quote)),
        "riskPremiumPct": round(premium * 100.0, 1) if premium is not None else None,
        "strategy": recommendation.get("strategy"),
        "breakdown": lines,
        "risk": {
            "overallScore": risk.get("overall_score", quote.overall_risk_score),
            "overallLevel": risk.get("risk_level") or quote.overall_risk_level,
            "summary": risk.get("summary"),
            "weather": {
                "score": weather.get("risk_score", quote.weather_risk_score),
                "summary": weather.get("summary"),
            },
            "customs": {
                "score": customs.get("risk_score", quote.customs_risk_score),
                "summary": customs.get("summary"),
            },
            "route": {
                "score": risk.get("route_score", quote.route_risk_score),
                "summary": route.get("summary"),
            },
        },
        "alerts": alerts[:6],
    }
