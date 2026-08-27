// client/src/api/risk.js
import { apiRequest } from "./client";

export async function assessShipmentRisk({
  shipment_id,
  quote_id,
  weather_score = 20.0,
  customs_score = 15.0,
  customs_status = "APPROVED",
  origin = "Chennai",
  destination = "Rotterdam",
  cargo_type = "General Cargo",
  hs_code = "850440",
  token,
}) {
  return apiRequest("/v1/risk/assess/", {
    method: "POST",
    token,
    body: {
      shipment_id,
      quote_id,
      weather_score,
      customs_score,
      customs_status,
      origin,
      destination,
      cargo_type,
      hs_code,
    },
    timeoutMs: 6000,
  });
}

export async function getRiskAssessment({ shipment_id, token }) {
  return apiRequest(`/v1/risk/assess/?shipment_id=${encodeURIComponent(shipment_id)}`, {
    method: "GET",
    token,
    timeoutMs: 5000,
  });
}

export async function getRiskAlerts(token) {
  return apiRequest("/v1/risk/alerts/", {
    method: "GET",
    token,
    timeoutMs: 5000,
  });
}

export async function acknowledgeRiskAlert({ alert_id, user_id = "Operations Broker", token }) {
  return apiRequest(`/v1/risk/alerts/${encodeURIComponent(alert_id)}/acknowledge/`, {
    method: "POST",
    token,
    body: { user_id },
    timeoutMs: 5000,
  });
}
