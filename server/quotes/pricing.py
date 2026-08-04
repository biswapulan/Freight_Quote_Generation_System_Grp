"""
Freight pricing calculator.

This file only does MATH. It doesn't touch the database or the API.
Keeping it separate makes it easy to test and easy to change the
pricing rules later without breaking anything else.
"""

# --- Pricing rules (you can tune these numbers anytime) ---

BASE_FARE = 500  # flat "booking fee" charged to everyone, in rupees

RATE_PER_KG = 2  # extra charge per kg of weight, in rupees

FUEL_SURCHARGE_PERCENT = 10  # % added on top of (distance + weight charge)

# Each vehicle type has its own per-km rate and a max weight it can carry.
VEHICLE_TYPES = {
    "mini_truck": {"rate_per_km": 15, "capacity_kg": 750},
    "truck": {"rate_per_km": 25, "capacity_kg": 3000},
    "container": {"rate_per_km": 40, "capacity_kg": 10000},
    "trailer": {"rate_per_km": 55, "capacity_kg": 20000},
}


class PricingError(Exception):
    """Raised when the quote request is invalid (bad vehicle, too heavy, etc)."""
    pass


def calculate_price(distance_km, weight_kg, vehicle_type):
    """
    Work out the price for a shipment.

    Args:
        distance_km: how far the shipment travels (must be > 0)
        weight_kg: how heavy the shipment is (must be > 0)
        vehicle_type: one of the keys in VEHICLE_TYPES

    Returns:
        A dict with the full price breakdown and the total.

    Raises:
        PricingError: if the input doesn't make sense.
    """

    # --- Step 1: check the inputs are valid ---
    if distance_km is None or distance_km <= 0:
        raise PricingError("Distance must be greater than 0 km.")

    if weight_kg is None or weight_kg <= 0:
        raise PricingError("Weight must be greater than 0 kg.")

    vehicle = VEHICLE_TYPES.get(vehicle_type)
    if vehicle is None:
        valid_options = ", ".join(VEHICLE_TYPES.keys())
        raise PricingError(f"Unknown vehicle_type '{vehicle_type}'. Choose one of: {valid_options}.")

    if weight_kg > vehicle["capacity_kg"]:
        raise PricingError(
            f"This '{vehicle_type}' can carry up to {vehicle['capacity_kg']} kg, "
            f"but the shipment is {weight_kg} kg. Please choose a bigger vehicle."
        )

    # --- Step 2: do the math, one line item at a time ---
    distance_charge = distance_km * vehicle["rate_per_km"]
    weight_charge = weight_kg * RATE_PER_KG

    subtotal = BASE_FARE + distance_charge + weight_charge
    fuel_surcharge = subtotal * (FUEL_SURCHARGE_PERCENT / 100)

    total = subtotal + fuel_surcharge

    # --- Step 3: return a clear breakdown (not just one number) ---
    return {
        "vehicle_type": vehicle_type,
        "distance_km": distance_km,
        "weight_kg": weight_kg,
        "base_fare": round(BASE_FARE, 2),
        "distance_charge": round(distance_charge, 2),
        "weight_charge": round(weight_charge, 2),
        "fuel_surcharge": round(fuel_surcharge, 2),
        "total_price": round(total, 2),
    }
