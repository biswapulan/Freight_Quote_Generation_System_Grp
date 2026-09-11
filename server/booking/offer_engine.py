"""Price one shipment analysis into an offer from every active company.

M1 works out the route and distance, M2 predicts a price and M3 scores the
risk. That analysis is the same whoever carries the freight. What differs is
each company's commercial terms, so each company prices the same work from its
own rate card, and the AI's recommended price for the lane (M2's prediction
loaded for M3's risk) moves every company's freight rate by the same factor.

This replaces the browser-side generator, where the three options were the
platform's own total multiplied by 0.88, 1.00 and 1.05. Those were not offers:
no company had agreed to them, the ordering never changed between lanes, and
an agent reviewing one saw a number their company had never quoted.
"""

from datetime import timedelta

from django.utils import timezone

from companies.models import CompanyRateCard, FreightCompany
from quotes.insights import market_factor

from .models import CompanyQuote


def _rate_card_for(company, mode):
    """The company's terms for this mode, falling back to its ocean card."""
    cards = company.rate_cards.filter(is_active=True)
    card = cards.filter(mode__iexact=mode).first() or cards.filter(mode="ocean").first()
    if card and card.is_effective():
        return card
    return None


def price_offer(card, *, distance_km, weight_kg, transit_days, base_reference, ai_factor=None):
    """Apply one rate card to one shipment's measurements.

    `base_reference` anchors the offer to the platform's own M1/M2 costing, so
    a company with a sparse rate card still produces a sane number rather than
    a near-zero one.

    `ai_factor` is the AI's view of the lane (quotes.insights.market_factor).
    It scales the line haul, the part of a freight price the market moves; the
    company's fixed fees stay as its rate card sets them.
    """
    distance_km = float(distance_km or 0)
    weight_kg = float(weight_kg or 0)

    line_haul = (card.rate_per_km * distance_km) + (card.rate_per_kg * weight_kg)
    if line_haul <= 0:
        # No usable per-unit terms: fall back to the platform's costing so the
        # company still competes rather than quoting nothing.
        line_haul = float(base_reference or 0)
    elif ai_factor:
        line_haul *= ai_factor

    fuel = line_haul * (card.fuel_surcharge_pct / 100.0)
    total = (
        card.base_booking_fee
        + line_haul
        + fuel
        + card.handling_fee
        + card.documentation_fee
    )
    total = max(total, card.minimum_charge or 0.0)

    return {
        "base_freight": round(card.base_booking_fee + line_haul, 2),
        "fuel_surcharge": round(fuel, 2),
        "handling_fee": round(card.handling_fee, 2),
        "documentation_fee": round(card.documentation_fee, 2),
        "total_price": round(total, 2),
        "currency": card.currency,
        "transit_days": max(1, int((transit_days or 14) + card.transit_days_delta)),
        "valid_until": timezone.now() + timedelta(days=card.validity_days or 14),
    }


def generate_company_quotes(quote, *, replace=False):
    """Create one CompanyQuote per active company for this analysis.

    Returns the offers, cheapest first. Safe to call more than once: existing
    offers for the same analysis are reused unless `replace` is set, so a page
    refresh never silently reprices what a customer is looking at.
    """
    shipment = quote.shipment
    existing = CompanyQuote.objects.filter(quote=quote)

    if existing.exists() and not replace:
        return list(existing.order_by("total_price"))
    if replace:
        # Never discard an offer the customer already acted on.
        existing.exclude(status="SELECTED").delete()

    mode = (shipment.transport_mode or "ocean").lower()
    factor = market_factor(quote)
    offers = []

    for company in FreightCompany.objects.filter(status="ACTIVE"):
        if company.modes and mode not in [m.lower() for m in company.modes]:
            continue

        card = _rate_card_for(company, mode)
        if not card:
            continue

        priced = price_offer(
            card,
            distance_km=quote.distance,
            weight_kg=shipment.weight,
            transit_days=quote.estimated_transit_days,
            base_reference=quote.total_price,
            ai_factor=factor,
        )

        offer, _ = CompanyQuote.objects.update_or_create(
            quote=quote,
            company=company,
            defaults={
                "shipment": shipment,
                "rate_card": card,
                "service_name": company.service_name,
                "risk_level": quote.overall_risk_level or "",
                "risk_score": quote.overall_risk_score,
                "ai_market_factor": factor,
                "status": "AVAILABLE",
                **priced,
            },
        )
        offers.append(offer)

    # The platform recommends the best balance of price and reliability rather
    # than the cheapest outright, and says so on exactly one offer.
    if offers:
        for offer in offers:
            offer.is_recommended = False

        def score(o):
            otp = o.company.on_time_performance or 70.0
            # Lower is better: price weighted against schedule reliability.
            return o.total_price * (1.0 + (100.0 - otp) / 100.0)

        best = min(offers, key=score)
        best.is_recommended = True
        CompanyQuote.objects.bulk_update(offers, ["is_recommended"])

    return sorted(offers, key=lambda o: o.total_price)
