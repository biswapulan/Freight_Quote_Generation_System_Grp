import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Wrap a page element with this to require a logged-in session, and
 * optionally a specific role. Usage:
 *   <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
 *   <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminPage /></ProtectedRoute>} />
 */
export default function ProtectedRoute({ children, requiredRole }) {
  const { isAuthenticated, loading, role } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="route-loading">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requiredRole && role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
