// client/src/api/auth.js

const BASE_URL = "http://127.0.0.1:8000/api/auth";

async function request(endpoint, data) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
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