"""Margin Policy & Floor Enforcement Engine — Milestone 2 (FQ-AMB-001/M2 §5).

Resolves margin policy across 5 priority scope levels:
  1. CUSTOMER_LANE (Most specific)
  2. CUSTOMER_TIER
  3. LANE
  4. CARGO_TYPE
  5. GLOBAL (Fallback)

Enforces business rules deterministically: any margin write below floor_pct
is rejected server-side with an HTTP 409 status and an approval request created.
"""

from decimal import Decimal

# Default Margin Policies Seed
DEFAULT_MARGIN_POLICIES = [
    {
        "id": "mp_1",
        "scope": "CUSTOMER_LANE",
        "scope_key": "Sharma Textiles|INNSA-AEJEA",
        "resolution_priority": 1,
        "floor_pct": 9.0,
        "target_pct": 12.0,
        "stretch_pct": 15.0,
        "is_active": True,
    },
    {
        "id": "mp_2",
        "scope": "CUSTOMER_TIER",
        "scope_key": "STRATEGIC",
        "resolution_priority": 2,
        "floor_pct": 10.0,
        "target_pct": 13.0,
        "stretch_pct": 16.0,
        "is_active": True,
    },
    {
        "id": "mp_3",
        "scope": "LANE",
        "scope_key": "INNSA-AEJEA",
        "resolution_priority": 3,
        "floor_pct": 12.0,
        "target_pct": 15.0,
        "stretch_pct": 19.0,
        "is_active": True,
    },
    {
        "id": "mp_4",
        "scope": "CARGO_TYPE",
        "scope_key": "HAZARDOUS",
        "resolution_priority": 4,
        "floor_pct": 18.0,
        "target_pct": 22.0,
        "stretch_pct": 26.0,
        "is_active": True,
    },
    {
        "id": "mp_5",
        "scope": "GLOBAL",
        "scope_key": None,
        "resolution_priority": 5,
        "floor_pct": 13.0,
        "target_pct": 16.0,
        "stretch_pct": 20.0,
        "is_active": True,
    },
]


class MarginFloorViolationError(Exception):
    """Raised when a margin write attempt is below the resolved floor percentage.
    
    Triggers HTTP 409 QUOTE_BELOW_MARGIN_FLOOR in the API response layer.
    """

    def __init__(self, requested_margin_pct, floor_pct, scope, policy_id):
        self.requested_margin_pct = requested_margin_pct
        self.floor_pct = floor_pct
        self.scope = scope
        self.policy_id = policy_id
        self.gap_points = round(floor_pct - requested_margin_pct, 2)
        message = (
            f"Margin {requested_margin_pct}% is below applicable floor of {floor_pct}% "
            f"for scope {scope} (Policy ID: {policy_id}). Violation gap: {self.gap_points} percentage points."
        )
        super().__init__(message)


def resolve_margin_policy(lane_key=None, cargo_type=None, customer_tier=None, customer_name=None, policies=None):
    """Resolve the applicable margin policy based on 5-level priority order (most specific wins)."""
    pool = policies or DEFAULT_MARGIN_POLICIES
    active_policies = [p for p in pool if p.get("is_active", True)]

    # Candidate matches
    cust_lane_key = f"{customer_name}|{lane_key}" if customer_name and lane_key else None

    candidates = []
    for p in active_policies:
        scope = p["scope"]
        key = p.get("scope_key")

        if scope == "CUSTOMER_LANE" and key == cust_lane_key:
            candidates.append(p)
        elif scope == "CUSTOMER_TIER" and key == customer_tier:
            candidates.append(p)
        elif scope == "LANE" and key == lane_key:
            candidates.append(p)
        elif scope == "CARGO_TYPE" and key == (cargo_type or "").upper():
            candidates.append(p)
        elif scope == "GLOBAL":
            candidates.append(p)

    if not candidates:
        return DEFAULT_MARGIN_POLICIES[-1]  # Global fallback

    # Sort by resolution_priority ascending (1 is most specific)
    candidates.sort(key=lambda x: x.get("resolution_priority", 99))
    return candidates[0]


def enforce_margin_floor(requested_margin_pct, total_buy_cost, policy):
    """Enforce margin floor percentage deterministically.

    Raises MarginFloorViolationError if requested_margin_pct < floor_pct.
    Returns (sell_price, margin_amount, applied_pct, suppressed_record).
    """
    req_pct = float(requested_margin_pct or 0.0)
    floor_pct = float(policy.get("floor_pct", 12.0))

    if req_pct < floor_pct:
        raise MarginFloorViolationError(req_pct, floor_pct, policy["scope"], policy["id"])

    margin_amount = round(float(total_buy_cost) * (req_pct / 100.0), 2)
    sell_price = round(float(total_buy_cost) + margin_amount, 2)

    return sell_price, margin_amount, req_pct, None
