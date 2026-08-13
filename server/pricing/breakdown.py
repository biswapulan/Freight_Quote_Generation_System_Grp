"""10-Step Itemized Cost Build-up Engine — Milestone 2.

Calculates defensible freight quotes by building itemized cost components
in strict fixed order, honoring Incoterms leg responsibility matrix and CIF insurance rules.
"""

from decimal import Decimal, ROUND_HALF_UP
from .incoterm import filter_by_incoterm
from .rate_resolver import resolve_rate_card
from .weight_breaks import apply_weight_breaks

# Master Cost Component Catalogue
COMPONENT_CATALOGUE = {
    "OFR": {"name": "Ocean Freight", "calc_type": "PER_CONTAINER", "default_unit_inr": 160000.0},
    "AFR": {"name": "Air Freight", "calc_type": "PER_KG", "default_unit_inr": 220.0},
    "BAF": {"name": "Bunker Adjustment Factor (Fuel)", "calc_type": "PERCENT_OF_BASE", "pct": 12.5},
    "CAF": {"name": "Currency Adjustment Factor", "calc_type": "PERCENT_OF_BASE", "pct": 2.0},
    "LSS": {"name": "Low Sulphur Surcharge", "calc_type": "PER_CONTAINER", "default_unit_inr": 6500.0},
    "PSS": {"name": "Peak Season Surcharge", "calc_type": "PER_CONTAINER", "default_unit_inr": 8500.0},
    "WRS": {"name": "War Risk Surcharge", "calc_type": "PER_CONTAINER", "default_unit_inr": 12000.0},
    "THCO": {"name": "Terminal Handling - Origin", "calc_type": "PER_CONTAINER", "default_unit_inr": 18000.0},
    "THCD": {"name": "Terminal Handling - Destination", "calc_type": "PER_CONTAINER", "default_unit_inr": 16500.0},
    "ISPS": {"name": "Port Security Surcharge (ISPS)", "calc_type": "PER_CONTAINER", "default_unit_inr": 4200.0},
    "DOC": {"name": "Documentation & Bill of Lading", "calc_type": "FLAT_PER_SHIPMENT", "default_unit_inr": 3500.0},
    "CCO": {"name": "Customs Entry - Origin", "calc_type": "FLAT_PER_SHIPMENT", "default_unit_inr": 15000.0},
    "CCD": {"name": "Customs Entry - Destination", "calc_type": "FLAT_PER_SHIPMENT", "default_unit_inr": 18000.0},
    "PUH": {"name": "First-Mile Drayage / Haulage", "calc_type": "BASE_PLUS_PER_KM", "default_unit_inr": 12000.0},
    "DLH": {"name": "Final-Mile Drayage / Delivery", "calc_type": "BASE_PLUS_PER_KM", "default_unit_inr": 15000.0},
    "HAZ": {"name": "Hazardous Cargo Surcharge", "calc_type": "PERCENT_OF_BASE", "pct": 25.0},
    "RFR": {"name": "Reefer Cold-Chain Monitoring", "calc_type": "PER_CONTAINER", "default_unit_inr": 22000.0},
    "INS": {"name": "All-Risk Cargo Insurance (CIF 110%)", "calc_type": "PERCENT_OF_VALUE", "pct": 0.35},
}


def build_cost_breakdown(
    origin_code,
    dest_code,
    mode="ocean",
    incoterm="FOB",
    container_type="40HC",
    container_qty=1,
    chargeable_weight_kg=1200,
    cargo_volume_cbm=4.5,
    declared_value_inr=0,
    cargo_type="general",
    customer_id=None,
    rate_config=None,
):
    """Generate itemized 10-step cost build-up conforming to M2 spec.

    Returns dict containing:
      - incoterm: applied incoterm code
      - cost_components: list of itemized fee objects with source labels
      - total_buy_cost: buy-side sum of costs
      - margin_pct: applied margin percentage
      - margin_amount: margin INR amount
      - sell_price: final cost + margin quote total
      - rate_card_rule: matched rate card rule description
    """
    allowed_codes = filter_by_incoterm(incoterm)
    mode_norm = (mode or "ocean").lower()
    qty = max(int(container_qty or 1), 1)

    # Resolve rate card
    matched_rate, rule_matched, source_label = resolve_rate_card(
        origin_code, dest_code, mode_norm, container_type, customer_id
    )

    cost_components = []
    base_freight_inr = 0.0

    # 1. Base Freight Step
    if "ocean" in mode_norm:
        if "OFR" in allowed_codes:
            card_base = matched_rate.get("base_rate_inr", 160000)
            base_freight_inr = card_base * qty
            cost_components.append({
                "order": 10,
                "code": "OFR",
                "name": "Ocean Freight Base Rate",
                "calculation_type": "PER_CONTAINER",
                "units": qty,
                "unit_rate_inr": card_base,
                "amount_inr": round(base_freight_inr, 2),
                "source": source_label,
            })
    elif "air" in mode_norm:
        if "AFR" in allowed_codes:
            air_result = apply_weight_breaks(chargeable_weight_kg)
            base_freight_inr = air_result["amount"]
            cost_components.append({
                "order": 10,
                "code": "AFR",
                "name": f"Air Freight ({air_result['break_code']})",
                "calculation_type": "PER_KG",
                "units": air_result["weight_used"],
                "unit_rate_inr": air_result["rate_per_kg"],
                "amount_inr": round(base_freight_inr, 2),
                "source": source_label,
                "lower_break_applied": air_result["lower_break_applied"],
            })
    else:  # Road/Rail
        base_freight_inr = max(chargeable_weight_kg * 45, 12000)
        cost_components.append({
            "order": 10,
            "code": "OFR",
            "name": "Ground Freight Base Rate",
            "calculation_type": "BASE_PLUS_PER_KM",
            "units": 1,
            "unit_rate_inr": base_freight_inr,
            "amount_inr": round(base_freight_inr, 2),
            "source": source_label,
        })

    # 2. Freight Surcharges (BAF, CAF, PSS, etc.)
    baf_pct = rate_config.get("fuel_surcharge_pct", 12.5) if rate_config else 12.5
    if "BAF" in allowed_codes and base_freight_inr > 0:
        baf_amt = base_freight_inr * (baf_pct / 100.0)
        cost_components.append({
            "order": 20,
            "code": "BAF",
            "name": f"Bunker Adjustment Factor ({baf_pct}%)",
            "calculation_type": "PERCENT_OF_BASE",
            "units": baf_pct,
            "unit_rate_inr": baf_pct,
            "amount_inr": round(baf_amt, 2),
            "source": "SURCHARGE_TABLE",
        })

    if "CAF" in allowed_codes and base_freight_inr > 0:
        caf_amt = base_freight_inr * 0.02
        cost_components.append({
            "order": 21,
            "code": "CAF",
            "name": "Currency Adjustment Factor (2%)",
            "calculation_type": "PERCENT_OF_BASE",
            "units": 2.0,
            "unit_rate_inr": 2.0,
            "amount_inr": round(caf_amt, 2),
            "source": "SURCHARGE_TABLE",
        })

    # 3. Origin Charges (THCO, ISPS, DOC, CCO)
    if "THCO" in allowed_codes:
        thco_unit = 18000.0 if "ocean" in mode_norm else 4500.0
        thco_amt = thco_unit * (qty if "ocean" in mode_norm else 1)
        cost_components.append({
            "order": 30,
            "code": "THCO",
            "name": "Terminal Handling — Origin",
            "calculation_type": "PER_CONTAINER" if "ocean" in mode_norm else "FLAT_PER_SHIPMENT",
            "units": qty if "ocean" in mode_norm else 1,
            "unit_rate_inr": thco_unit,
            "amount_inr": round(thco_amt, 2),
            "source": "SURCHARGE_TABLE",
        })

    if "ISPS" in allowed_codes:
        isps_amt = 4200.0 * qty
        cost_components.append({
            "order": 31,
            "code": "ISPS",
            "name": "Port Security Surcharge (ISPS)",
            "calculation_type": "PER_CONTAINER",
            "units": qty,
            "unit_rate_inr": 4200.0,
            "amount_inr": round(isps_amt, 2),
            "source": "SURCHARGE_TABLE",
        })

    if "DOC" in allowed_codes:
        cost_components.append({
            "order": 32,
            "code": "DOC",
            "name": "Documentation & Bill of Lading",
            "calculation_type": "FLAT_PER_SHIPMENT",
            "units": 1,
            "unit_rate_inr": 3500.0,
            "amount_inr": 3500.0,
            "source": "SURCHARGE_TABLE",
        })

    if "CCO" in allowed_codes:
        base_handling = rate_config.get("base_handling_fee", 1500.0) if rate_config else 1500.0
        cco_amt = base_handling * 10.0
        cost_components.append({
            "order": 33,
            "code": "CCO",
            "name": "Customs Clearance — Origin",
            "calculation_type": "FLAT_PER_SHIPMENT",
            "units": 1,
            "unit_rate_inr": cco_amt,
            "amount_inr": round(cco_amt, 2),
            "source": "SURCHARGE_TABLE",
        })

    # 4. Destination Charges (THCD, CCD)
    if "THCD" in allowed_codes:
        thcd_unit = 16500.0
        thcd_amt = thcd_unit * qty
        cost_components.append({
            "order": 40,
            "code": "THCD",
            "name": "Terminal Handling — Destination",
            "calculation_type": "PER_CONTAINER",
            "units": qty,
            "unit_rate_inr": thcd_unit,
            "amount_inr": round(thcd_amt, 2),
            "source": "SURCHARGE_TABLE",
        })

    if "CCD" in allowed_codes:
        cost_components.append({
            "order": 41,
            "code": "CCD",
            "name": "Customs Clearance — Destination (DDP)",
            "calculation_type": "FLAT_PER_SHIPMENT",
            "units": 1,
            "unit_rate_inr": 18000.0,
            "amount_inr": 18000.0,
            "source": "SURCHARGE_TABLE",
        })

    # 5. Haulage Legs (PUH, DLH)
    if "PUH" in allowed_codes:
        cost_components.append({
            "order": 50,
            "code": "PUH",
            "name": "First-Mile Pickup Haulage",
            "calculation_type": "BASE_PLUS_PER_KM",
            "units": 1,
            "unit_rate_inr": 12000.0,
            "amount_inr": 12000.0,
            "source": "SURCHARGE_TABLE",
        })

    if "DLH" in allowed_codes:
        cost_components.append({
            "order": 51,
            "code": "DLH",
            "name": "Final-Mile Delivery Haulage",
            "calculation_type": "BASE_PLUS_PER_KM",
            "units": 1,
            "unit_rate_inr": 15000.0,
            "amount_inr": 15000.0,
            "source": "SURCHARGE_TABLE",
        })

    # 6. Special Handling (HAZ, RFR)
    if cargo_type == "hazmat" or cargo_type == "hazardous":
        haz_amt = base_freight_inr * 0.25
        cost_components.append({
            "order": 60,
            "code": "HAZ",
            "name": "Hazardous Cargo Surcharge (25%)",
            "calculation_type": "PERCENT_OF_BASE",
            "units": 25.0,
            "unit_rate_inr": 25.0,
            "amount_inr": round(haz_amt, 2),
            "source": "SURCHARGE_TABLE",
        })
    elif cargo_type == "reefer" or cargo_type == "cold_chain":
        rfr_amt = 22000.0 * qty
        cost_components.append({
            "order": 61,
            "code": "RFR",
            "name": "Reefer Temperature Monitoring",
            "calculation_type": "PER_CONTAINER",
            "units": qty,
            "unit_rate_inr": 22000.0,
            "amount_inr": round(rfr_amt, 2),
            "source": "SURCHARGE_TABLE",
        })

    # 7. Cargo Insurance (CIF 110% Formula)
    if "INS" in allowed_codes and float(declared_value_inr or 0) > 0:
        val = float(declared_value_inr)
        freight_sum = sum(c["amount_inr"] for c in cost_components)
        insurable_val = (val + freight_sum) * 1.10
        ins_amt = max(insurable_val * 0.0035, 3500.0)
        cost_components.append({
            "order": 70,
            "code": "INS",
            "name": "All-Risk Cargo Insurance (CIF 110%)",
            "calculation_type": "PERCENT_OF_VALUE",
            "units": 0.35,
            "unit_rate_inr": 0.35,
            "amount_inr": round(ins_amt, 2),
            "source": "SURCHARGE_TABLE",
        })

    # 8. Sum to Total Buy Cost
    total_buy_cost = sum(c["amount_inr"] for c in cost_components)

    # 9 & 10. Margin Policy Resolution & Sell Price
    margin_pct = 14.2  # Target margin
    margin_amount = round(total_buy_cost * (margin_pct / 100.0), 2)
    sell_price = round(total_buy_cost + margin_amount, 2)

    return {
        "incoterm": incoterm,
        "cost_components": cost_components,
        "total_buy_cost": round(total_buy_cost, 2),
        "margin_pct": margin_pct,
        "margin_amount": margin_amount,
        "sell_price": sell_price,
        "rate_card_rule": rule_matched,
        "matched_carrier": matched_rate.get("carrier_name", "Maersk Line"),
    }
