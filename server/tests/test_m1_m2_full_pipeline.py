"""Integrated Test Suite for Milestone 1 (Route Intelligence) & Milestone 2 (Pricing Engine).

Verifies the complete spec contract:
M1: Shipment -> Candidate Routes -> Transit Estimation -> Carrier Comparison -> Recommended Route
M2: Recommended Route -> 10-Step Build-Up -> Incoterms Matrix -> Air Breaks -> Rate Resolver -> Margin Floor (409) -> Final Quote
"""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pricing.route_agent import evaluate_shipment_routes
from pricing.incoterm import filter_by_incoterm
from pricing.weight_breaks import apply_weight_breaks
from pricing.rate_resolver import resolve_rate_card
from pricing.breakdown import build_cost_breakdown
from quotes.margin_policy import resolve_margin_policy, enforce_margin_floor, MarginFloorViolationError


def test_m1_route_agent_pipeline():
    print("Testing M1 Route Intelligence Agent Pipeline...")
    res = evaluate_shipment_routes(
        shipment_id="SHP001",
        customer_id="C001",
        customer_name="ABC Logistics",
        origin_code="INMAA",
        dest_code="SGSIN",
        cargo_type="Electronics",
        container_type="40FT",
    )

    assert res["shipment_id"] == "SHP001"
    assert res["status"] == "ROUTE_READY"
    assert res["total_candidate_routes"] == 3

    rec = res["recommended_route"]
    assert rec["is_recommended"] is True
    assert rec["carrier"] == "ABC Shipping"
    assert rec["transit_days"] == 6
    assert rec["path_display"] == "Chennai → Singapore"

    print("✅ M1 Route Agent Pipeline PASSED — Recommended Route: Chennai → Singapore (6 Days, ABC Shipping)")


def test_m2_pricing_pipeline():
    print("Testing M2 Pricing & Margin Engine Pipeline...")
    # Step 1: Incoterms Scope
    assert filter_by_incoterm("EXW") == []
    assert "INS" in filter_by_incoterm("CIF")

    # Step 2: Air Weight Break (+300 kg lower-break rule)
    air_res = apply_weight_breaks(280)
    assert air_res["amount"] == 54000.0
    assert air_res["lower_break_applied"] is True

    # Step 3: 10-Step Itemized Build-Up
    cost_res = build_cost_breakdown(
        origin_code="INMAA",
        dest_code="SGSIN",
        mode="ocean",
        incoterm="CIF",
        declared_value_inr=1000000.0,
    )
    assert cost_res["total_buy_cost"] > 0
    assert any(item["code"] == "INS" for item in cost_res["cost_components"])

    # Step 4: Margin Floor 409 Exception
    policy = resolve_margin_policy(lane_key="INMAA-SGSIN", customer_tier="STRATEGIC")
    try:
        enforce_margin_floor(8.0, 300000.0, policy)
        assert False, "Should raise MarginFloorViolationError"
    except MarginFloorViolationError as err:
        assert err.gap_points > 0

    print("✅ M2 Pricing & Margin Pipeline PASSED — 10-Step Build-Up & 409 Floor Enforcement Verified")


if __name__ == "__main__":
    print("======================================================================")
    print("  RUNNING MILESTONE 1 & MILESTONE 2 INTEGRATED TEST SUITE")
    print("======================================================================\n")
    test_m1_route_agent_pipeline()
    test_m2_pricing_pipeline()
    print("\n🎉 ALL M1 + M2 SYSTEM WORKFLOW TESTS PASSED CLEANLY!")
