"""Synthetic Historical Freight Dataset Generator — Milestone 3 Phase 5.

Generates 5,000 realistic historical maritime & multimodal container shipment records
across major global trade lanes with realistic market factors, fuel surcharges, and spot prices.
"""

import os
import random
import csv
import numpy as np
import pandas as pd

# Set random seed for reproducibility
random.seed(42)
np.random.seed(42)

ROUTES = [
    {"origin": "Chennai", "destination": "Rotterdam", "dist_km": 11500, "base_days": 22},
    {"origin": "Nhava Sheva", "destination": "New York", "dist_km": 14200, "base_days": 26},
    {"origin": "Shanghai", "destination": "Los Angeles", "dist_km": 10500, "base_days": 14},
    {"origin": "Nhava Sheva", "destination": "Dubai", "dist_km": 2100, "base_days": 5},
    {"origin": "Singapore", "destination": "Dubai", "dist_km": 5900, "base_days": 10},
    {"origin": "Shanghai", "destination": "Rotterdam", "dist_km": 19500, "base_days": 28},
    {"origin": "Hamburg", "destination": "Singapore", "dist_km": 15800, "base_days": 24},
    {"origin": "Chennai", "destination": "Colombo", "dist_km": 650, "base_days": 3},
    {"origin": "Tokyo", "destination": "Los Angeles", "dist_km": 8800, "base_days": 11},
    {"origin": "Singapore", "destination": "Fremantle", "dist_km": 3900, "base_days": 8},
    {"origin": "Santos", "destination": "Rotterdam", "dist_km": 10200, "base_days": 18},
    {"origin": "Busan", "destination": "Long Beach", "dist_km": 9400, "base_days": 13},
]

CONTAINER_TYPES = ["20ft_Standard", "40ft_Standard", "40ft_HighCube", "LCL_Consolidated"]
CARGO_TYPES = ["General_Dry", "Electronics", "Hazardous_Chemicals", "Perishable_Reefer", "Automotive", "Textiles"]
CARRIER_TIERS = ["Tier_1_Alliance", "Tier_2_Regional", "Tier_3_Spot"]


def generate_dataset(num_samples: int = 5000, output_path: str = "ml/data/historical_freight_rates.csv") -> pd.DataFrame:
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    rows = []

    for i in range(num_samples):
        route = random.choice(ROUTES)
        origin = route["origin"]
        dest = route["destination"]
        dist_km = route["dist_km"] + random.uniform(-100, 100)
        transit_days = route["base_days"] + random.randint(-1, 3)

        container = random.choice(CONTAINER_TYPES)
        cargo = random.choice(CARGO_TYPES)
        carrier = random.choice(CARRIER_TIERS)

        # Weight & Volume
        if container == "20ft_Standard":
            weight_kg = random.uniform(3000, 21000)
            volume_cbm = random.uniform(15, 33)
            base_container_rate = 1200
        elif container == "40ft_Standard":
            weight_kg = random.uniform(8000, 26000)
            volume_cbm = random.uniform(35, 67)
            base_container_rate = 2100
        elif container == "40ft_HighCube":
            weight_kg = random.uniform(10000, 28000)
            volume_cbm = random.uniform(45, 76)
            base_container_rate = 2450
        else: # LCL
            weight_kg = random.uniform(500, 5000)
            volume_cbm = random.uniform(2, 14)
            base_container_rate = 600

        # Market Factors
        month = random.randint(1, 12)
        # Peak season: Aug - Oct (pre-holiday retail restocking)
        seasonality_index = 1.25 if month in [8, 9, 10] else (0.90 if month in [1, 2] else 1.05)
        # Brent fuel bunker index ($70 to $110 per barrel)
        brent_fuel_index = round(random.uniform(72.0, 108.0), 1)
        fuel_surcharge_factor = (brent_fuel_index - 70.0) * 8.5

        # Demand pressure (1.0 = normal, 1.4 = port congestion surge)
        market_demand_factor = round(random.uniform(0.88, 1.42), 2)

        # Cargo premium
        cargo_multipliers = {
            "General_Dry": 1.0,
            "Textiles": 1.02,
            "Automotive": 1.10,
            "Electronics": 1.15,
            "Perishable_Reefer": 1.35,
            "Hazardous_Chemicals": 1.45,
        }
        cargo_factor = cargo_multipliers.get(cargo, 1.0)

        # Carrier tier adjustment
        carrier_adjustments = {
            "Tier_1_Alliance": 1.08,
            "Tier_2_Regional": 0.98,
            "Tier_3_Spot": 0.92,
        }
        carrier_factor = carrier_adjustments.get(carrier, 1.0)

        # Distance & Weight charges
        distance_charge = dist_km * 0.12
        weight_charge = (weight_kg / 1000.0) * 35.0
        volume_charge = volume_cbm * 18.0

        # Realistic actual spot freight price formulation
        subtotal = (base_container_rate + distance_charge + weight_charge + volume_charge + fuel_surcharge_factor)
        market_price = subtotal * cargo_factor * seasonality_index * market_demand_factor * carrier_factor

        # Add realistic Gaussian noise (+- $60)
        actual_price = round(market_price + np.random.normal(0, 45), 2)
        actual_price = max(actual_price, 450.0)

        rows.append({
            "shipment_ref": f"SHP-{10000 + i}",
            "origin_port": origin,
            "destination_port": dest,
            "distance_km": round(dist_km, 1),
            "transit_time_days": transit_days,
            "container_type": container,
            "cargo_type": cargo,
            "weight_kg": round(weight_kg, 1),
            "volume_cbm": round(volume_cbm, 1),
            "carrier_tier": carrier,
            "departure_month": month,
            "seasonality_index": seasonality_index,
            "brent_fuel_index": brent_fuel_index,
            "market_demand_factor": market_demand_factor,
            "actual_freight_price_usd": actual_price,
        })

    df = pd.DataFrame(rows)
    df.to_csv(output_path, index=False)
    print(f"✅ Generated {len(df)} historical freight shipment records at '{output_path}'")
    return df


if __name__ == "__main__":
    generate_dataset()
