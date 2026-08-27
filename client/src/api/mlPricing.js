// client/src/api/mlPricing.js
import { apiRequest } from "./client";

export async function predictMLFreightRate({
  origin_port = "Chennai",
  destination_port = "Rotterdam",
  distance_km = 11500.0,
  transit_time_days = 22,
  container_type = "40ft_Standard",
  cargo_type = "General_Dry",
  weight_kg = 18500.0,
  volume_cbm = 58.0,
  carrier_tier = "Tier_1_Alliance",
  departure_month = 8,
  seasonality_index = 1.25,
  brent_fuel_index = 88.5,
  market_demand_factor = 1.15,
  token,
}) {
  return apiRequest("/v1/pricing/ml-predict/", {
    method: "POST",
    token,
    body: {
      origin_port,
      destination_port,
      distance_km,
      transit_time_days,
      container_type,
      cargo_type,
      weight_kg,
      volume_cbm,
      carrier_tier,
      departure_month,
      seasonality_index,
      brent_fuel_index,
      market_demand_factor,
    },
    timeoutMs: 6000,
  });
}

export async function getMLBenchmarks(token) {
  return apiRequest("/v1/pricing/benchmarks/", {
    method: "GET",
    token,
    timeoutMs: 5000,
  });
}
