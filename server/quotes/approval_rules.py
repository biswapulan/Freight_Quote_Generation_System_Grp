"""Approval Rule Evaluator & Queue Router — Milestone 2 (FQ-AMB-001/M2 §5.4).

Evaluates 6 ordered breach conditions:
  1. Margin below floor by > 5 percentage points -> PRICING_MANAGER
  2. Margin below floor by up to 5 percentage points -> SENIOR_BROKER
  3. Quote value above high-value threshold (> ₹5,00,000) -> PRICING_MANAGER
  4. Any component sourced as PREDICTED -> SENIOR_BROKER
  5. New customer with no credit profile -> SENIOR_BROKER
  6. Rate card expires before quote validity ends -> SENIOR_BROKER
"""

DEFAULT_APPROVAL_RULES = [
    {
        "order_index": 1,
        "name": "Deep discount — margin below floor by >5 percentage points",
        "condition_type": "MARGIN_BELOW_FLOOR_DEEP",
        "threshold": 5.0,
        "approver_role": "PRICING_MANAGER",
        "is_blocking": True,
        "is_active": True,
    },
    {
        "order_index": 2,
        "name": "Margin below floor by up to 5 percentage points",
        "condition_type": "MARGIN_BELOW_FLOOR",
        "threshold": 0.0,
        "approver_role": "SENIOR_BROKER",
        "is_blocking": True,
        "is_active": True,
    },
    {
        "order_index": 3,
        "name": "Quote value above high-value threshold",
        "condition_type": "QUOTE_VALUE_ABOVE",
        "threshold": 500000.0,
        "approver_role": "PRICING_MANAGER",
        "is_blocking": True,
        "is_active": True,
    },
    {
        "order_index": 4,
        "name": "Any component sourced as PREDICTED",
        "condition_type": "HAS_PREDICTED_COMPONENT",
        "threshold": None,
        "approver_role": "SENIOR_BROKER",
        "is_blocking": False,
        "is_active": True,
    },
    {
        "order_index": 5,
        "name": "New customer with no credit profile",
        "condition_type": "NO_CREDIT_PROFILE",
        "threshold": None,
        "approver_role": "SENIOR_BROKER",
        "is_blocking": True,
        "is_active": True,
    },
    {
        "order_index": 6,
        "name": "Rate card expires before quote validity ends",
        "condition_type": "RATE_CARD_EXPIRES_BEFORE_VALIDITY",
        "threshold": None,
        "approver_role": "SENIOR_BROKER",
        "is_blocking": True,
        "is_active": True,
    },
]


def evaluate_approval_rules(quote_context, rules=None):
    """Evaluate ordered approval rules against quote context.

    Returns:
      (requires_approval, breach_records, primary_approver_role)
    """
    rule_set = rules or DEFAULT_APPROVAL_RULES
    active_rules = sorted(
        [r for r in rule_set if r.get("is_active", True)],
        key=lambda x: x.get("order_index", 99),
    )

    breaches = []
    margin_pct = float(quote_context.get("applied_margin_pct", 14.0))
    floor_pct = float(quote_context.get("floor_pct", 12.0))
    gap = floor_pct - margin_pct
    quote_val = float(quote_context.get("total_sell_price", 0.0))
    has_predicted = quote_context.get("has_predicted_component", False)
    has_credit = quote_context.get("has_credit_profile", True)

    for rule in active_rules:
        c_type = rule["condition_type"]
        triggered = False
        reason = ""

        if c_type == "MARGIN_BELOW_FLOOR_DEEP" and gap > 5.0:
            triggered = True
            reason = f"Margin {margin_pct}% is {round(gap, 1)} percentage points below floor ({floor_pct}%)."
        elif c_type == "MARGIN_BELOW_FLOOR" and 0.0 < gap <= 5.0:
            triggered = True
            reason = f"Margin {margin_pct}% is {round(gap, 1)} percentage points below floor ({floor_pct}%)."
        elif c_type == "QUOTE_VALUE_ABOVE" and quote_val > float(rule.get("threshold") or 500000.0):
            triggered = True
            reason = f"Total quote value ₹{quote_val:,.2f} exceeds high-value threshold of ₹5,00,000."
        elif c_type == "HAS_PREDICTED_COMPONENT" and has_predicted:
            triggered = True
            reason = "Quote contains base rate sourced as PREDICTED (no active rate card found)."
        elif c_type == "NO_CREDIT_PROFILE" and not has_credit:
            triggered = True
            reason = "Customer has no approved credit profile on record."

        if triggered:
            breaches.append({
                "rule_name": rule["name"],
                "condition_type": c_type,
                "approver_role": rule["approver_role"],
                "is_blocking": rule["is_blocking"],
                "reason": reason,
            })

    requires_approval = len(breaches) > 0
    primary_role = breaches[0]["approver_role"] if breaches else "NONE"

    return requires_approval, breaches, primary_role
