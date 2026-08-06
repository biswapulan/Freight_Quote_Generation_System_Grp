// client/src/api/quotes.js
import { apiRequest } from "./client";

export function estimateQuote(token, payload) {
  return apiRequest("/quotes/estimate/", {
    method: "POST",
    token,
    body: {
      origin: payload.origin,
      destination: payload.destination,
      weight_kg: Number(payload.weightKg),
      volume_m3: Number(payload.volumeM3),
      cargo_type: payload.cargoType,
      mode: payload.mode,
    },
  });
}

export function listQuotes(token) {
  return apiRequest("/quotes/", { token });
}

export function getQuote(token, id) {
  return apiRequest(`/quotes/${id}/`, { token });
}

export function confirmQuote(token, id) {
  return apiRequest(`/quotes/${id}/confirm/`, { method: "POST", token });
}
