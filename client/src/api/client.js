// client/src/api/client.js
// Small shared fetch wrapper for endpoints under /api/ (not /api/auth/) that
// require a Bearer token. auth.js keeps its own copy since it also needs to
// call unauthenticated endpoints (signup/login/forgot-password).

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://freight-quote-generation-system-grp.onrender.com/api";

const BASE = API_BASE_URL.replace(/\/$/, "");

export async function apiRequest(endpoint, { method = "GET", token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${endpoint}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.detail || data.error || "Something went wrong");
  }

  return data;
}
