// client/src/api/client.js
// Small shared fetch wrapper for endpoints under /api/ (not /api/auth/) that
// require a Bearer token. auth.js keeps its own copy since it also needs to
// call unauthenticated endpoints (signup/login/forgot-password).

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:8000/api"
    : "https://freight-quote-generation-system-grp.onrender.com/api");

const BASE = API_BASE_URL.replace(/\/$/, "");

export async function apiRequest(endpoint, { method = "GET", token, body, timeoutMs = 1200 } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BASE}${endpoint}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.detail || data.error || "Something went wrong");
    }

    return data;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}
