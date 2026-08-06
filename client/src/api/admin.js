// client/src/api/admin.js
import { apiRequest } from "./client";

export function getRateConfig(token) {
  return apiRequest("/admin/rate-config/", { token });
}

export function updateRateConfig(token, updates) {
  return apiRequest("/admin/rate-config/", { method: "PATCH", token, body: updates });
}
