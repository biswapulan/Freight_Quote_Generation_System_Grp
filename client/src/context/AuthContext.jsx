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

    // Demo or fallback session token - preserve user from localStorage
    if (token.startsWith('freight_jwt_')) {
      const cachedUser = localStorage.getItem('freightai_user');
      if (cachedUser) {
        try {
          setUser(JSON.parse(cachedUser));
        } catch {}
      }
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    getMe(token)
      .then((profile) => {
        if (!cancelled) {
          setUser(profile);
          localStorage.setItem("freightai_user", JSON.stringify(profile));
        }
      })
      .catch((err) => {
        if (cancelled) return;

        // A rejected token must end the session. Falling back to the cached
        // profile here left the UI looking signed in while every API call
        // returned 403 — the app appeared to work but nothing loaded.
        if (err?.isAuthError || !err?.isNetworkError) {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem("freightai_user");
          setToken(null);
          setUser(null);
          return;
        }

        // The server is unreachable rather than refusing us; keep the cached
        // profile so a brief outage does not log the user out.
        const cachedUser = localStorage.getItem("freightai_user");
        if (cachedUser) {
          try {
            setUser(JSON.parse(cachedUser));
            return;
          } catch {}
        }
        setToken(null);
        setUser(null);
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
    localStorage.setItem("freightai_user", JSON.stringify(profile));
    setToken(newToken);
    setUser(profile);
    setLoading(false);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("freightai_user");
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
