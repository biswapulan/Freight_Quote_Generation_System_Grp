"""Unit tests for the pure pricing-engine functions.

These test the calculation module directly (no HTTP, no Mongo) since the
engine is written as pure functions specifically to make this possible.
"""

from django.test import SimpleTestCase

from .engine import (
    DEFAULT_RATE_CONFIG,
    UnservicedRouteError,
    calculate_quote,
    chargeable_weight_kg,
    estimate_transit_days,
    haversine_distance_km,
    resolve_route_distance_km,
    volumetric_weight_kg,
)


class HaversineDistanceTests(SimpleTestCase):
    def test_same_point_is_zero(self):
        self.assertAlmostEqual(haversine_distance_km(19.0760, 72.8777, 19.0760, 72.8777), 0, places=3)

    def test_known_city_pair_is_reasonable(self):
        # Mumbai -> Delhi great-circle distance is roughly 1150-1160 km.
        distance = haversine_distance_km(19.0760, 72.8777, 28.7041, 77.1025)
        self.assertTrue(1100 < distance < 1200, f"Got {distance}")


class RouteResolutionTests(SimpleTestCase):
    def test_unresolved_origin_raises(self):
        with self.assertRaises(UnservicedRouteError):
            resolve_route_distance_km("Atlantis", "Mumbai")

    def test_unresolved_destination_raises(self):
        with self.assertRaises(UnservicedRouteError):
            resolve_route_distance_km("Mumbai", "Atlantis")

    def test_case_and_whitespace_insensitive(self):
        distance_a = resolve_route_distance_km("Mumbai", "Delhi")
        distance_b = resolve_route_distance_km("  MUMBAI ", " delhi ")
        self.assertAlmostEqual(distance_a, distance_b, places=6)


class WeightTests(SimpleTestCase):
    def test_volumetric_weight_scales_with_volume(self):
        self.assertEqual(volumetric_weight_kg(1), 250)
        self.assertEqual(volumetric_weight_kg(2), 500)

    def test_chargeable_weight_picks_greater(self):
        # Light but bulky: volumetric wins.
        self.assertEqual(chargeable_weight_kg(actual_weight_kg=10, volume_m3=1), 250)
        # Heavy but compact: actual wins.
        self.assertEqual(chargeable_weight_kg(actual_weight_kg=500, volume_m3=0.1), 500)


class TransitEstimateTests(SimpleTestCase):
    def test_air_is_faster_than_road_for_same_distance(self):
        air_days = estimate_transit_days(2000, "air")
        road_days = estimate_transit_days(2000, "road")
        self.assertLess(air_days, road_days)

    def test_transit_days_is_whole_number(self):
        days = estimate_transit_days(1234, "road")
        self.assertIsInstance(days, int)
        self.assertGreater(days, 0)


class CalculateQuoteTests(SimpleTestCase):
    def setUp(self):
        self.rate_config = dict(DEFAULT_RATE_CONFIG)

    def test_basic_quote_has_positive_total(self):
        result = calculate_quote(
            origin="Mumbai",
            destination="Delhi",
            weight_kg=500,
            volume_m3=1,
            cargo_type="general",
            mode="road",
            rate_config=self.rate_config,
        )
        self.assertGreater(result["breakdown"]["total"], 0)
        self.assertEqual(result["breakdown"]["total"], round(
            result["breakdown"]["base_handling_fee"]
            + result["breakdown"]["distance_cost"]
            + result["breakdown"]["cargo_charge"]
            + result["breakdown"]["fuel_surcharge"],
            2,
        ))

    def test_hazardous_cargo_costs_more_than_general(self):
        common_kwargs = dict(
            origin="Mumbai",
            destination="Delhi",
            weight_kg=500,
            volume_m3=1,
            mode="road",
            rate_config=self.rate_config,
        )
        general = calculate_quote(cargo_type="general", **common_kwargs)
        hazardous = calculate_quote(cargo_type="hazardous", **common_kwargs)
        self.assertGreater(
            hazardous["breakdown"]["total"], general["breakdown"]["total"]
        )

    def test_air_mode_costs_more_than_ocean_for_same_route(self):
        common_kwargs = dict(
            origin="Mumbai",
            destination="Dubai",
            weight_kg=500,
            volume_m3=1,
            cargo_type="general",
            rate_config=self.rate_config,
        )
        air = calculate_quote(mode="air", **common_kwargs)
        ocean = calculate_quote(mode="ocean", **common_kwargs)
        self.assertGreater(air["breakdown"]["total"], ocean["breakdown"]["total"])

    def test_unsupported_mode_raises_value_error(self):
        with self.assertRaises(ValueError):
            calculate_quote(
                origin="Mumbai",
                destination="Delhi",
                weight_kg=500,
                volume_m3=1,
                cargo_type="general",
                mode="hyperloop",
                rate_config=self.rate_config,
            )

    def test_admin_edited_rate_changes_the_price(self):
        cheap_config = dict(self.rate_config, rate_per_km_per_tonne=1.0)
        expensive_config = dict(self.rate_config, rate_per_km_per_tonne=10.0)
        common_kwargs = dict(
            origin="Mumbai",
            destination="Delhi",
            weight_kg=500,
            volume_m3=1,
            cargo_type="general",
            mode="road",
        )
        cheap = calculate_quote(rate_config=cheap_config, **common_kwargs)
        expensive = calculate_quote(rate_config=expensive_config, **common_kwargs)
        self.assertGreater(
            expensive["breakdown"]["total"], cheap["breakdown"]["total"]
        )
