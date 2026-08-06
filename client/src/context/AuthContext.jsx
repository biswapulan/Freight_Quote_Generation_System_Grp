import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getMe } from "../api/auth";

const AuthContext = createContext(null);

const TOKEN_KEY = "freightai_token";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  // "loading" covers the brief window on first load where we have a token
  // but haven't confirmed it's still valid yet — pages should not redirect
  // to /login until this resolves, or a page refresh would always bounce
  // a logged-in user out.
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setUser(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    getMe(token)
      .then((profile) => {
        if (!cancelled) setUser(profile);
      })
      .catch(() => {
        // Token is invalid or expired — clear it rather than looping.
        if (!cancelled) {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  function login({ token: newToken, ...profile }) {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(profile);
    setLoading(false);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  function updateUser(profile) {
    setUser(profile);
  }

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: Boolean(token && user),
      role: user?.role || null,
      login,
      logout,
      updateUser,
    }),
    [token, user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
