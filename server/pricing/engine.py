"""Rule-based freight pricing engine — Milestone 1.

Every function here is a pure function: no database access, no HTTP calls,
given the same input it always returns the same output. That makes the
formulas independently testable (see tests.py) and keeps arithmetic out of
the views, which only handle validation, persistence and HTTP concerns.

Stage 2 (a scikit-learn regression model trained on historical quotes) is
out of scope for Milestone 1. `calculate_quote` is the single seam where
that would plug in later, comparing its prediction against this rule-based
price rather than replacing it outright.
"""

import math
from decimal import ROUND_HALF_UP, Decimal

from .cities import resolve_city, supported_city_names

EARTH_RADIUS_KM = 6371.0

# Volumetric weight divisor: cm^3 -> kg equivalent, expressed here directly
# in m^3 -> kg (250 kg per cubic metre is a common road/rail approximation;
# air freight commonly uses a smaller divisor / higher factor, but a single
# mode-agnostic factor is the right amount of precision for Milestone 1).
VOLUMETRIC_FACTOR_KG_PER_M3 = 250

# Average line-haul speed per mode, used only for the indicative transit
# estimate shown alongside the quote (km per day).
MODE_SPEED_KM_PER_DAY = {
    "road": 450,
    "rail": 600,
    "air": 4000,
    "ocean": 400,
}

# Fixed dwell/handling days added on top of pure transit time (loading,
# customs, terminal handling). Kept as a flat constant per mode for M1.
MODE_DWELL_DAYS = {
    "road": 0.5,
    "rail": 1,
    "air": 1,
    "ocean": 3,
}

VALID_MODES = tuple(MODE_SPEED_KM_PER_DAY.keys())

DEFAULT_CARGO_MULTIPLIERS = {
    "general": 1.0,
    "express": 1.4,
    "cold_chain": 1.7,
    "hazardous": 2.0,
}

DEFAULT_MODE_MULTIPLIERS = {
    "road": 1.0,
    "rail": 0.85,
    "air": 3.2,
    "ocean": 0.65,
}

# The full default rate configuration. Admins can edit every value here
# through the rate-config API; this dict is only the seed used the first
# time the system runs, before any admin edits exist.
DEFAULT_RATE_CONFIG = {
    "currency": "INR",
    "base_handling_fee": 250.0,
    "rate_per_km_per_tonne": 3.5,
    "fuel_surcharge_pct": 12.0,
    "cargo_multipliers": dict(DEFAULT_CARGO_MULTIPLIERS),
    "mode_multipliers": dict(DEFAULT_MODE_MULTIPLIERS),
    "quote_validity_days": 7,
}


class UnservicedRouteError(Exception):
    """Raised when the origin or destination city isn't in the seeded table."""

    def __init__(self, field, value):
        self.field = field
        self.value = value
        message = (
            f"Could not resolve {field} '{value}'. This is a Milestone 1 stub "
            f"covering a limited set of cities — try one of: "
            f"{', '.join(supported_city_names())}"
        )
        super().__init__(message)


def haversine_distance_km(lat1, lon1, lat2, lon2):
    """Great-circle distance between two coordinates, in kilometres."""

    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return EARTH_RADIUS_KM * c


def resolve_route_distance_km(origin, destination):
    """Resolve two city names to coordinates and return the distance.

    Raises UnservicedRouteError if either city can't be resolved — this is
    the deterministic "lane not serviced" behaviour called for in the spec,
    rather than silently falling back to a guess.
    """

    origin_point = resolve_city(origin)
    if origin_point is None:
        raise UnservicedRouteError("origin", origin)

    destination_point = resolve_city(destination)
    if destination_point is None:
        raise UnservicedRouteError("destination", destination)

    distance = haversine_distance_km(*origin_point, *destination_point)
    # A route can't have zero distance in practice (same-city moves aren't
    # served by this quoting flow); floor it at a small positive value so
    # the pricing formula never divides by / multiplies by zero.
    return max(distance, 1.0)


def volumetric_weight_kg(volume_m3):
    """Dimensional weight equivalent, in kg, for a shipment's volume."""

    return max(volume_m3, 0) * VOLUMETRIC_FACTOR_KG_PER_M3


def chargeable_weight_kg(actual_weight_kg, volume_m3):
    """The greater of actual and volumetric weight — what's actually billed."""

    return max(actual_weight_kg, volumetric_weight_kg(volume_m3))


def estimate_transit_days(distance_km, mode):
    """Indicative transit time in whole days for the given mode and distance."""

    speed = MODE_SPEED_KM_PER_DAY[mode]
    dwell = MODE_DWELL_DAYS[mode]
    line_haul_days = distance_km / speed
    return math.ceil(line_haul_days + dwell)


def _round_money(value):
    """Round a float to 2dp using Decimal, avoiding binary float artefacts."""

    return float(
        Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    )


def calculate_quote(
    *,
    origin,
    destination,
    weight_kg,
    volume_m3,
    cargo_type,
    mode,
    rate_config,
):
    """Compute a full rule-based quote breakdown.

    Formula (each term documented so the breakdown is auditable):
      chargeable_weight_t = max(actual, volumetric) weight, in tonnes
      distance_cost        = rate_per_km_per_tonne * distance_km
                              * chargeable_weight_t * mode_multiplier
      cargo_charge          = distance_cost * (cargo_multiplier - 1)
      subtotal              = base_handling_fee + distance_cost + cargo_charge
      fuel_surcharge         = subtotal * fuel_surcharge_pct / 100
      total                  = subtotal + fuel_surcharge

    Returns a dict with the distance, weight, transit estimate and a full
    itemised cost breakdown. Raises UnservicedRouteError for an unresolved
    city, and ValueError for an unsupported mode/cargo type.
    """

    if mode not in VALID_MODES:
        raise ValueError(f"Unsupported transport mode '{mode}'. Valid modes: {VALID_MODES}")

    cargo_multipliers = rate_config.get("cargo_multipliers", DEFAULT_CARGO_MULTIPLIERS)
    if cargo_type not in cargo_multipliers:
        raise ValueError(
            f"Unsupported cargo type '{cargo_type}'. Valid types: {tuple(cargo_multipliers)}"
        )

    distance_km = resolve_route_distance_km(origin, destination)

    chargeable_kg = chargeable_weight_kg(weight_kg, volume_m3)
    chargeable_tonnes = max(chargeable_kg / 1000.0, 0.01)  # never fully zero

    mode_multiplier = rate_config.get("mode_multipliers", DEFAULT_MODE_MULTIPLIERS)[mode]
    cargo_multiplier = cargo_multipliers[cargo_type]

    rate_per_km_per_tonne = rate_config.get(
        "rate_per_km_per_tonne", DEFAULT_RATE_CONFIG["rate_per_km_per_tonne"]
    )
    base_handling_fee = rate_config.get(
        "base_handling_fee", DEFAULT_RATE_CONFIG["base_handling_fee"]
    )
    fuel_surcharge_pct = rate_config.get(
        "fuel_surcharge_pct", DEFAULT_RATE_CONFIG["fuel_surcharge_pct"]
    )

    distance_cost = (
        rate_per_km_per_tonne * distance_km * chargeable_tonnes * mode_multiplier
    )
    cargo_charge = distance_cost * (cargo_multiplier - 1)
    subtotal = base_handling_fee + distance_cost + cargo_charge
    fuel_surcharge = subtotal * (fuel_surcharge_pct / 100.0)
    total = subtotal + fuel_surcharge

    transit_days = estimate_transit_days(distance_km, mode)

    return {
        "distance_km": round(distance_km, 1),
        "actual_weight_kg": round(weight_kg, 2),
        "volumetric_weight_kg": round(volumetric_weight_kg(volume_m3), 2),
        "chargeable_weight_kg": round(chargeable_kg, 2),
        "transit_days": transit_days,
        "currency": rate_config.get("currency", DEFAULT_RATE_CONFIG["currency"]),
        "breakdown": {
            "base_handling_fee": _round_money(base_handling_fee),
            "distance_cost": _round_money(distance_cost),
            "cargo_charge": _round_money(cargo_charge),
            "fuel_surcharge": _round_money(fuel_surcharge),
            "total": _round_money(total),
        },
        "rates_used": {
            "rate_per_km_per_tonne": rate_per_km_per_tonne,
            "mode_multiplier": mode_multiplier,
            "cargo_multiplier": cargo_multiplier,
            "fuel_surcharge_pct": fuel_surcharge_pct,
        },
    }
