import math

# City/Port Coordinate Table for Geodesic Distance
PORT_COORDINATES = {
    "chennai": (13.0975, 80.2924),
    "nhava sheva": (18.9490, 72.9490),
    "mumbai": (18.9490, 72.9490),
    "singapore": (1.2644, 103.8198),
    "rotterdam": (51.9490, 4.1420),
    "shanghai": (31.2304, 121.4737),
    "los angeles": (33.7432, -118.2673),
    "new york": (40.7128, -74.0060),
    "dubai": (25.0110, 55.0272),
    "jebel ali": (25.0110, 55.0272),
    "colombo": (6.9271, 79.8612),
    "hamburg": (53.5511, 9.9937),
    "tokyo": (35.6762, 139.6503),
    "fremantle": (-32.0569, 115.7439),
    "sydney": (-33.8688, 151.2093),
}


def calculate_distance_km(origin_name: str, dest_name: str) -> float:
    """Calculate realistic transport distance in kilometers between two ports."""
    orig_key = origin_name.lower().strip()
    dest_key = dest_name.lower().strip()

    orig_coords = PORT_COORDINATES.get(orig_key, (13.0, 80.0))
    dest_coords = PORT_COORDINATES.get(dest_key, (52.0, 4.0))

    lat1, lon1 = math.radians(orig_coords[0]), math.radians(orig_coords[1])
    lat2, lon2 = math.radians(dest_coords[0]), math.radians(dest_coords[1])

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    earth_radius_km = 6371.0
    great_circle = earth_radius_km * c

    # Maritime routing factor (routes wind through waterways)
    maritime_distance = max(great_circle * 1.35, 250.0)
    return round(maritime_distance, 2)


def calculate_quote_pricing(
    distance_km: float,
    weight_kg: float,
    volume_cbm: float,
    transport_mode: str = "ocean",
    cargo_type: str = "General Cargo",
) -> dict:
    """Calculates deterministic itemized freight pricing.
    
    Formula:
      basePrice + distanceCharge + weightCharge + fuelCharge = totalPrice
    """
    mode = transport_mode.lower().strip()

    # Rate cards per transport mode
    if mode == "air":
        base_price = 250.00
        rate_per_km = 0.65
        rate_per_kg = 0.45
        fuel_surcharge_rate = 0.15
    elif mode == "road" or mode == "rail":
        base_price = 80.00
        rate_per_km = 0.45
        rate_per_kg = 0.12
        fuel_surcharge_rate = 0.08
    else:  # Ocean / Standard
        base_price = 150.00
        rate_per_km = 0.12
        rate_per_kg = 0.08
        fuel_surcharge_rate = 0.10

    # Chargeable weight consideration (Volumetric vs Gross)
    volumetric_weight = volume_cbm * (1000 / 6 if mode == "air" else 1000)
    chargeable_weight = max(weight_kg, volumetric_weight)

    distance_charge = round(distance_km * rate_per_km, 2)
    weight_charge = round(chargeable_weight * rate_per_kg, 2)
    fuel_charge = round((base_price + distance_charge + weight_charge) * fuel_surcharge_rate, 2)

    total_price = round(base_price + distance_charge + weight_charge + fuel_charge, 2)

    return {
        "distance": distance_km,
        "base_price": base_price,
        "distance_charge": distance_charge,
        "weight_charge": weight_charge,
        "fuel_charge": fuel_charge,
        "total_price": total_price,
    }
