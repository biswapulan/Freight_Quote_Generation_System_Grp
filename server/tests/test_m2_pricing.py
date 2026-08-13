"""Unit Test Suite for Milestone 2 Pricing Engine, Incoterms, Air Weight Breaks & Margin Floors.
"""

import os
import sys

# Add server directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pricing.incoterm import filter_by_incoterm
from pricing.weight_breaks import apply_weight_breaks
from pricing.rate_resolver import resolve_rate_card
from pricing.breakdown import build_cost_breakdown
from quotes.margin_policy import resolve_margin_policy, enforce_margin_floor, MarginFloorViolationError
from quotes.approval_rules import evaluate_approval_rules


def test_incoterms_matrix():
    print("Testing Incoterms Scope Matrix...")
    assert filter_by_incoterm("EXW") == [], "EXW should return empty list []"
    assert "PUH" in filter_by_incoterm("FOB") and "THCO" in filter_by_incoterm("FOB")
    assert "INS" in filter_by_incoterm("CIF")
    assert "CCD" in filter_by_incoterm("DDP")
    print("✅ Incoterms Scope Matrix PASSED")


def test_air_lower_break_rule():
    print("Testing Air Weight Breaks & Lower-Break Rule...")
    # 280 kg @ 195 INR/kg = 54,600 INR
    # Lower break: 300 kg @ 180 INR/kg = 54,000 INR (should pick lower-break!)
    res = apply_weight_breaks(280)
    assert res["amount"] == 54000.0, f"Expected 54000.0, got {res['amount']}"
    assert res["break_code"] == "+300"
    assert res["lower_break_applied"] is True
    print("✅ Air Lower-Break Rule PASSED")


def test_10_step_cost_breakdown():
    print("Testing 10-Step Cost Breakdown Engine...")
    result = build_cost_breakdown(
        origin_code="INNSA",
        dest_code="AEJEA",
        mode="ocean",
        incoterm="CIF",
        container_type="40HC",
        container_qty=2,
        declared_value_inr=1000000.0,
    )
    assert result["incoterm"] == "CIF"
    assert result["total_buy_cost"] > 0
    assert any(c["code"] == "INS" for c in result["cost_components"]), "CIF must include INS"
    print("✅ 10-Step Cost Breakdown PASSED")


def test_margin_floor_enforcement():
    print("Testing Margin Floor Enforcement (409 Conflict trigger)...")
    policy = resolve_margin_policy(lane_key="INNSA-AEJEA", customer_tier="STRATEGIC")

    # Above floor should succeed
    sell_price, margin_amt, applied, _ = enforce_margin_floor(14.0, 300000.0, policy)
    assert applied == 14.0

    # Below floor should raise MarginFloorViolationError
    try:
        enforce_margin_floor(8.0, 300000.0, policy)
        assert False, "Should have raised MarginFloorViolationError"
    except MarginFloorViolationError as err:
        assert err.gap_points > 0
        print("✅ Margin Floor Violation 409 Exception PASSED")


if __name__ == "__main__":
    test_incoterms_matrix()
    test_air_lower_break_rule()
    test_10_step_cost_breakdown()
    test_margin_floor_enforcement()
    print("\n🎉 ALL MILESTONE 2 PRICING ENGINE UNIT TESTS PASSED!")
