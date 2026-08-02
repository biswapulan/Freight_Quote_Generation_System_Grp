import { createContext, useContext, useMemo, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
const [authState, setAuthState] = useState({
token: null,
user: null,
});

function login({ token, fullName }) {
setAuthState({
token,
user: { fullName },
});
}

function logout() {
setAuthState({
token: null,
user: null,
});
}

const value = useMemo(
() => ({
token: authState.token,
user: authState.user,
isAuthenticated: Boolean(authState.token),
login,
logout,
}),
[authState],
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
