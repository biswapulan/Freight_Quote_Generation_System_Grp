"""Milestone 1 — Route Intelligence Agent (Python Service Layer).

M1 Principle: Determines HOW the shipment should move (Routes, Carriers, Transit Time, Recommendation).
M2 consumes the output of M1 to determine HOW MUCH it should cost.
"""

from typing import Dict, List, Any


# Route dataset & carrier options master
ROUTE_DATASET = [
    {
        "origin_code": "INMAA",
        "origin_name": "Chennai",
        "dest_code": "SGSIN",
        "dest_name": "Singapore",
        "routes": [
            {
                "route_id": "RT-MAA-SIN-01",
                "path": ["INMAA", "SGSIN"],
                "path_display": "Chennai → Singapore",
                "transit_days": 6,
                "carrier": "ABC Shipping",
                "carrier_code": "ABCS",
                "transhipment_ports": [],
                "reliability_score": 98.5,
                "service_frequency": "3x / week",
                "is_direct": True,
            },
            {
                "route_id": "RT-MAA-SIN-02",
                "path": ["INMAA", "LKCMB", "SGSIN"],
                "path_display": "Chennai → Colombo → Singapore",
                "transit_days": 8,
                "carrier": "XYZ Shipping",
                "carrier_code": "XYZS",
                "transhipment_ports": ["LKCMB"],
                "reliability_score": 94.0,
                "service_frequency": "Daily",
                "is_direct": False,
            },
            {
                "route_id": "RT-MAA-SIN-03",
                "path": ["INMAA", "AEJEA", "SGSIN"],
                "path_display": "Chennai → Dubai → Singapore",
                "transit_days": 12,
                "carrier": "Global Marine",
                "carrier_code": "GLBM",
                "transhipment_ports": ["AEJEA"],
                "reliability_score": 89.0,
                "service_frequency": "2x / week",
                "is_direct": False,
            },
        ],
    },
    {
        "origin_code": "INNSA",
        "origin_name": "Nhava Sheva (Mumbai)",
        "dest_code": "AEJEA",
        "dest_name": "Port of Jebel Ali (Dubai)",
        "routes": [
            {
                "route_id": "RT-NSA-JEA-01",
                "path": ["INNSA", "AEJEA"],
                "path_display": "Nhava Sheva → Dubai",
                "transit_days": 5,
                "carrier": "Emirates Ocean Line",
                "carrier_code": "EMOL",
                "transhipment_ports": [],
                "reliability_score": 99.0,
                "service_frequency": "Daily",
                "is_direct": True,
            },
            {
                "route_id": "RT-NSA-JEA-02",
                "path": ["INNSA", "OMMCT", "AEJEA"],
                "path_display": "Nhava Sheva → Muscat → Dubai",
                "transit_days": 7,
                "carrier": "Gulf Feeder Services",
                "carrier_code": "GFED",
                "transhipment_ports": ["OMMCT"],
                "reliability_score": 92.5,
                "service_frequency": "4x / week",
                "is_direct": False,
            },
        ],
    },
]


def evaluate_shipment_routes(
    shipment_id: str,
    customer_id: str,
    customer_name: str,
    origin_code: str,
    dest_code: str,
    cargo_type: str = "Electronics",
    container_type: str = "40FT",
) -> Dict[str, Any]:
    """Milestone 1 Route Agent: Generates candidate routes, compares transit & carriers,

    and picks the recommended route for a shipment request.
    """
    origin_upper = origin_code.upper()
    dest_upper = dest_code.upper()

    # Search route dataset for matching lane
    matched_lane = None
    for lane in ROUTE_DATASET:
        if lane["origin_code"] == origin_upper and lane["dest_code"] == dest_upper:
            matched_lane = lane
            break

    if not matched_lane:
        # Dynamic fallback route generator for unlisted lanes
        direct_route = {
            "route_id": f"RT-{origin_upper}-{dest_upper}-01",
            "path": [origin_upper, dest_upper],
            "path_display": f"{origin_upper} → {dest_upper}",
            "transit_days": 7,
            "carrier": "ABC Shipping",
            "carrier_code": "ABCS",
            "transhipment_ports": [],
            "reliability_score": 96.0,
            "service_frequency": "3x / week",
            "is_direct": True,
        }
        trans_route = {
            "route_id": f"RT-{origin_upper}-{dest_upper}-02",
            "path": [origin_upper, "SGSIN", dest_upper],
            "path_display": f"{origin_upper} → Singapore → {dest_upper}",
            "transit_days": 10,
            "carrier": "XYZ Shipping",
            "carrier_code": "XYZS",
            "transhipment_ports": ["SGSIN"],
            "reliability_score": 91.0,
            "service_frequency": "2x / week",
            "is_direct": False,
        }
        candidate_routes = [direct_route, trans_route]
        origin_name = origin_upper
        dest_name = dest_upper
    else:
        candidate_routes = matched_lane["routes"]
        origin_name = matched_lane["origin_name"]
        dest_name = matched_lane["dest_name"]

    # Select recommended route (highest reliability_score & shortest transit)
    sorted_routes = sorted(
        candidate_routes, key=lambda r: (-r["reliability_score"], r["transit_days"])
    )
    recommended = dict(sorted_routes[0])
    recommended["is_recommended"] = True

    alternates = [dict(r) for r in sorted_routes[1:]]
    for alt in alternates:
        alt["is_recommended"] = False

    return {
        "shipment_id": shipment_id,
        "customer_id": customer_id,
        "customer_name": customer_name,
        "origin_code": origin_upper,
        "origin_name": origin_name,
        "dest_code": dest_upper,
        "dest_name": dest_name,
        "cargo_type": cargo_type,
        "container_type": container_type,
        "recommended_route": recommended,
        "alternate_routes": alternates,
        "total_candidate_routes": len(candidate_routes),
        "status": "ROUTE_READY",
    }
