// client/src/api/auth.js

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://freight-quote-generation-system-grp.onrender.com/api";

const AUTH_URL = `${API_BASE_URL.replace(/\/$/, "")}/auth`;

async function request(endpoint, data, { method = "POST", token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${AUTH_URL}${endpoint}`, {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(data),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body.detail || body.error || "Something went wrong");
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
