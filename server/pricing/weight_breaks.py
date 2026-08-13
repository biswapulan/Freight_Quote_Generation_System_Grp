"""Air Weight Breaks & Lower-Break Rule Implementation — Milestone 2.

Handles weight-tier step downs (+45, +100, +300, +500, +1000 kg) and evaluates
whether bumping up to the next break's minimum weight produces a lower total cost.
"""

from decimal import Decimal, ROUND_HALF_UP

# Default Air Weight Break Table (Rate per kg in INR)
DEFAULT_AIR_WEIGHT_BREAKS = [
    {"break_min": 0, "code": "MIN", "label": "Minimum Charge", "min_flat_inr": 3500.0, "rate_per_kg_inr": 0.0},
    {"break_min": 45, "code": "+45", "label": "45 - 99 kg", "min_flat_inr": 0.0, "rate_per_kg_inr": 220.0},
    {"break_min": 100, "code": "+100", "label": "100 - 299 kg", "min_flat_inr": 0.0, "rate_per_kg_inr": 195.0},
    {"break_min": 300, "code": "+300", "label": "300 - 499 kg", "min_flat_inr": 0.0, "rate_per_kg_inr": 180.0},
    {"break_min": 500, "code": "+500", "label": "500 - 999 kg", "min_flat_inr": 0.0, "rate_per_kg_inr": 165.0},
    {"break_min": 1000, "code": "+1000", "label": "1000+ kg", "min_flat_inr": 0.0, "rate_per_kg_inr": 148.0},
]


def apply_weight_breaks(chargeable_weight_kg, weight_break_table=None):
    """Compute air freight cost using weight breaks & lower-break rule.

    Example:
      At 280 kg, 280 * 195 = 54,600 INR.
      Next break is +300 kg @ 180 INR: 300 * 180 = 54,000 INR (cheaper!).
      This function selects the 300 kg break @ 180 INR to give the customer
      a lower price (54,000 INR).

    Returns:
      dict containing:
        - amount: total base air freight cost
        - rate_per_kg: applied rate per kg
        - weight_used: actual or bumped minimum weight used for calculation
        - break_code: code of applied break (e.g. '+300')
        - lower_break_applied: boolean indicating if lower-break rule was used
    """
    table = weight_break_table or DEFAULT_AIR_WEIGHT_BREAKS
    weight = max(float(chargeable_weight_kg or 0), 1.0)

    # 1. Calculate cost at the current applicable break
    applicable_break = None
    for item in sorted(table, key=lambda x: x["break_min"]):
        if weight >= item["break_min"]:
            applicable_break = item

    if not applicable_break:
        applicable_break = table[0]

    # Nominal calculation
    if applicable_break["code"] == "MIN":
        nominal_cost = applicable_break["min_flat_inr"]
        applied_rate = 0.0
        applied_weight = weight
    else:
        applied_rate = applicable_break["rate_per_kg_inr"]
        applied_weight = weight
        nominal_cost = weight * applied_rate

    best_cost = nominal_cost
    best_break_code = applicable_break["code"]
    best_rate = applied_rate
    best_weight = applied_weight
    lower_break_applied = False

    # 2. Lower-break rule check: Evaluate higher breaks at their minimum weight
    for item in table:
        if item["break_min"] > weight and item["rate_per_kg_inr"] > 0:
            candidate_cost = item["break_min"] * item["rate_per_kg_inr"]
            if candidate_cost < best_cost:
                best_cost = candidate_cost
                best_break_code = item["code"]
                best_rate = item["rate_per_kg_inr"]
                best_weight = item["break_min"]
                lower_break_applied = True

    return {
        "amount": round(best_cost, 2),
        "rate_per_kg": best_rate,
        "weight_used": best_weight,
        "break_code": best_break_code,
        "lower_break_applied": lower_break_applied,
    }
