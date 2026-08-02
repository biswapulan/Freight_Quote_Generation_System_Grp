// client/src/api/auth.js

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://freight-quote-generation-system-grp.onrender.com/api";

const AUTH_URL = `${API_BASE_URL.replace(/\/$/, "")}/auth`;

async function request(endpoint, data) {
  const res = await fetch(`${AUTH_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body.detail || body.error || "Something went wrong");
  }

  return body;
}

export function signup({ fullName, email, password }) {
  return request("/signup/", { full_name: fullName, email, password });
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
