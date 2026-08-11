// client/src/api/admin.js
import { apiRequest } from "./client";

export function getRateConfig(token) {
  return apiRequest("/admin/rate-config/", { token });
}

export function updateRateConfig(token, updates) {
  return apiRequest("/admin/rate-config/", { method: "PATCH", token, body: updates });
}

// User Management — these live under /api/auth/admin/users/ (the accounts
// app owns the user documents), so this reuses the same AUTH_URL base that
// api/auth.js builds, rather than the plain /api/ base used above.
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://freight-quote-generation-system-grp.onrender.com/api";
const AUTH_URL = `${API_BASE_URL.replace(/\/$/, "")}/auth`;

async function authApiRequest(endpoint, { method = "GET", token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${AUTH_URL}${endpoint}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.detail || data.error || "Something went wrong");
  }

  return data;
}

export function listUsers(token, { role, status: statusFilter, search } = {}) {
  const params = new URLSearchParams();
  if (role) params.set("role", role);
  if (statusFilter) params.set("status", statusFilter);
  if (search) params.set("search", search);
  const qs = params.toString();
  return authApiRequest(`/admin/users/${qs ? `?${qs}` : ""}`, { token });
}

export function createUser(token, payload) {
  return authApiRequest("/admin/users/", { method: "POST", token, body: payload });
}

export function updateUser(token, userId, updates) {
  return authApiRequest(`/admin/users/${userId}/`, { method: "PATCH", token, body: updates });
}

export function deactivateUser(token, userId) {
  return authApiRequest(`/admin/users/${userId}/`, { method: "DELETE", token });
}
