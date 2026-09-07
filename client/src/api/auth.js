// client/src/api/auth.js

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:8000/api"
    : "https://freight-quote-generation-system-grp.onrender.com/api");

const AUTH_URL = `${API_BASE_URL.replace(/\/$/, "")}/auth`;

/**
 * Shared request helper for the auth endpoints.
 *
 * This used to fall back to a client-side "login" whenever the backend rejected
 * or failed to answer: it matched the email against a table of hardcoded
 * profiles, then against a localStorage mock-user map, and finally invented a
 * session outright, inferring the role from substrings in the address. Typing
 * any password against anything containing "admin" produced an admin session
 * with a fabricated token, and a failed /me/ call returned a Platform Admin
 * profile. Authentication is a server decision, so all of that is gone.
 */
async function request(endpoint, data, { method = "POST", token, timeoutMs = 15000 } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(`${AUTH_URL}${endpoint}`, {
      method,
      headers,
      body: method === "GET" ? undefined : JSON.stringify(data),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    // The server could not be reached at all. Flagged separately from a
    // rejection so callers can keep a cached session through a blip.
    const networkError = new Error(
      err.name === "AbortError"
        ? "The server took too long to respond. Please try again."
        : "Cannot reach the server. Check your connection and try again.",
    );
    networkError.isNetworkError = true;
    throw networkError;
  }
  clearTimeout(timer);

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(body.detail || body.error || "Invalid email or password");
    error.status = res.status;
    error.isAuthError = res.status === 401 || res.status === 403;
    throw error;
  }

  return body;
}

export function signup({ fullName, email, password, role, companyName, gstNumber }) {
  return request("/signup/", {
    full_name: fullName,
    email,
    password,
    role,
    company_name: companyName,
    gst_number: gstNumber,
  });
}

export function login({ email, password }) {
  return request("/login/", { email, password });
}

export function forgotPassword({ email }) {
  return request("/forgot-password/", { email });
}

export function resetPassword({ token, newPassword }) {
  return request("/reset-password/", { token, new_password: newPassword });
}

export function getMe(token) {
  return request("/me/", null, { method: "GET", token });
}

export function updateProfile(token, data) {
  return request("/me/", data, { method: "PATCH", token });
}

export function getSavedAddresses(token) {
  return request("/saved-addresses/", null, { method: "GET", token });
}

export function createSavedAddress(token, data) {
  return request("/saved-addresses/", data, { token });
}

export function deleteSavedAddress(token, addressId) {
  return request(`/saved-addresses/${addressId}/`, null, { method: "DELETE", token });
}

export function updateSavedAddress(token, addressId, data) {
  return request(`/saved-addresses/${addressId}/`, data, { method: "PATCH", token });
}

export function getSupportTickets(token) {
  return request("/support-tickets/", null, { method: "GET", token });
}

export function createSupportTicket(token, data) {
  return request("/support-tickets/", data, { token });
}

export function getTawkIdentity(token) {
  return request("/tawk-identity/", null, { method: "GET", token });
}
