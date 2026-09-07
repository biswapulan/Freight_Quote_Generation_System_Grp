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

// Exported so callers that cannot use apiRequest — multipart file uploads, which
// must not carry a JSON Content-Type — can still resolve the same origin.
export const API_BASE = BASE;

export async function apiRequest(endpoint, { method = "GET", token, body, timeoutMs = 10000 } = {}) {
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
      const error = new Error(data.detail || data.error || "Something went wrong");
      // Callers need to tell "the server rejected you" apart from "the server
      // could not be reached" — the first should sign you out, the second
      // should not. A bare Error message cannot express that.
      error.status = res.status;
      error.isAuthError = res.status === 401 || res.status === 403;
      throw error;
    }

    return data;
  } catch (err) {
    clearTimeout(timer);

    // The flag above was read by AuthContext and the quote store but nothing
    // ever set it, so an unreachable backend looked identical to a rejected
    // token and signed the user out. fetch throws a TypeError when it cannot
    // reach the host at all, and an AbortError when our own timeout fires.
    if (err && !err.status) {
      const unreachable =
        err.name === "TypeError" ||
        err.name === "AbortError" ||
        err.message === "Failed to fetch" ||
        err.message === "Load failed";
      if (unreachable) {
        err.isNetworkError = true;
        err.isAuthError = false;
        if (err.name === "AbortError") {
          err.message = "The FreightAI server took too long to respond.";
        } else {
          err.message = "Can't reach the FreightAI server. Is the backend running?";
        }
      }
    }

    throw err;
  }
}
