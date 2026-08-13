"""Rate Card Resolution Engine — Milestone 2.

Implements the 5-level priority lookup for carrier contract & spot rate matching:
  1. CONTRACT card assigned to specific customer (Customer Contract)
  2. CONTRACT card for carrier (General Carrier Contract)
  3. SPOT card for carrier
  4. TARIFF card (Published worst rate)
  5. Fallback -> Market Rate Model (labeled PREDICTED)
"""

# Default Mock Rate Cards for fallback & development
MOCK_RATE_CARDS = [
    {
        "card_id": "RC-MAERSK-2026-H2",
        "carrier_name": "Maersk Line",
        "type": "CONTRACT",
        "customer_id": None,
        "mode": "ocean",
        "valid_from": "2026-01-01",
        "valid_to": "2026-12-31",
        "status": "ACTIVE",
        "rates": {
            "INNSA-AEJEA-20GP": {"base_rate_inr": 120000, "min_charge": 100000, "transit_days": 5},
            "INNSA-AEJEA-40GP": {"base_rate_inr": 160000, "min_charge": 140000, "transit_days": 5},
            "INNSA-AEJEA-40HC": {"base_rate_inr": 178000, "min_charge": 150000, "transit_days": 5},
            "INNSA-NLRTM-20GP": {"base_rate_inr": 210000, "min_charge": 180000, "transit_days": 22},
            "INNSA-NLRTM-40HC": {"base_rate_inr": 290000, "min_charge": 250000, "transit_days": 22},
        },
    },
    {
        "card_id": "RC-EMIRATES-AIR-2026",
        "carrier_name": "Emirates SkyCargo",
        "type": "CONTRACT",
        "customer_id": None,
        "mode": "air",
        "valid_from": "2026-01-01",
        "valid_to": "2026-12-31",
        "status": "ACTIVE",
        "rates": {
            "DEL-DXB-AIR": {"base_rate_inr": 220, "min_charge": 3500, "transit_days": 2},
            "BOM-FRA-AIR": {"base_rate_inr": 380, "min_charge": 5000, "transit_days": 3},
        },
    },
]


def resolve_rate_card(origin_code, dest_code, mode, container_type=None, customer_id=None, active_cards=None):
    """Resolve rate card line matching lane + mode according to 5-level priority.

    Returns:
      (matched_rate_dict, rule_matched_name, source_label)
      source_label is one of: 'RATE_CARD', 'SURCHARGE_TABLE', 'PREDICTED', 'MANUAL'.
    """
    cards = active_cards or MOCK_RATE_CARDS
    lane_key = f"{origin_code}-{dest_code}"
    mode_normalized = mode.lower() if mode else "ocean"
    c_type = container_type or "40HC"
    lookup_key = f"{lane_key}-{c_type}" if "ocean" in mode_normalized else f"{lane_key}-AIR"

    # Level 1: Customer-Specific CONTRACT Card
    if customer_id:
        for card in cards:
            if card.get("status") == "ACTIVE" and card.get("type") == "CONTRACT" and card.get("customer_id") == customer_id:
                if lookup_key in card.get("rates", {}):
                    rate_data = card["rates"][lookup_key]
                    return rate_data, "CONTRACT_CUSTOMER_SPECIFIC", "RATE_CARD"

    # Level 2: General Carrier CONTRACT Card
    for card in cards:
        if card.get("status") == "ACTIVE" and card.get("type") == "CONTRACT" and not card.get("customer_id"):
            if lookup_key in card.get("rates", {}):
                rate_data = card["rates"][lookup_key]
                return rate_data, "CONTRACT_CARRIER_GENERAL", "RATE_CARD"

    # Level 3: SPOT Card
    for card in cards:
        if card.get("status") == "ACTIVE" and card.get("type") == "SPOT":
            if lookup_key in card.get("rates", {}):
                rate_data = card["rates"][lookup_key]
                return rate_data, "SPOT_CARRIER", "RATE_CARD"

    # Level 4: TARIFF Card
    for card in cards:
        if card.get("status") == "ACTIVE" and card.get("type") == "TARIFF":
            if lookup_key in card.get("rates", {}):
                rate_data = card["rates"][lookup_key]
                return rate_data, "TARIFF_PUBLISHED", "RATE_CARD"

    # Level 5: Fallback -> Market Rate Model (PREDICTED)
    fallback_rate = {
        "base_rate_inr": 160000 if "ocean" in mode_normalized else 320,
        "min_charge": 5000,
        "transit_days": 12,
    }
    return fallback_rate, "MARKET_RATE_MODEL_PREDICTED", "PREDICTED"
