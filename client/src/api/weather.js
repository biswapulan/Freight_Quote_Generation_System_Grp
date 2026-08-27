// client/src/api/weather.js
import { apiRequest } from "./client";

export async function assessRouteWeather({
  shipment_id,
  origin,
  destination,
  transit_days = 7,
  waypoints = [],
  token,
}) {
  return apiRequest("/v1/weather/assess/", {
    method: "POST",
    token,
    body: {
      shipment_id,
      origin,
      destination,
      transit_days,
      waypoints,
    },
    timeoutMs: 8000,
  });
}

export async function getWeatherAssessment(shipment_id, token) {
  return apiRequest(`/v1/weather/assess/${encodeURIComponent(shipment_id)}/`, {
    method: "GET",
    token,
    timeoutMs: 5000,
  });
}

export async function getActiveWeatherAlerts(shipment_id = "", token) {
  const query = shipment_id ? `?shipment_id=${encodeURIComponent(shipment_id)}` : "";
  return apiRequest(`/v1/weather/alerts/${query}`, {
    method: "GET",
    token,
    timeoutMs: 5000,
  });
}
