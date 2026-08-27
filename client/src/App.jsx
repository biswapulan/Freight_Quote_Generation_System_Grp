import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import ProfessionalLanding from "./components/ProfessionalLanding";
import AuthPage from "./components/AuthPage";
import DashboardShell from "./components/DashboardShell";
import QuotePage from "./components/QuotePage";
import QuoteGenerator from "./components/QuoteGenerator";
import AdminRateConfig from "./components/AdminRateConfig";
import AdminUsers from "./components/AdminUsers";
import ProtectedRoute from "./components/ProtectedRoute";
import TransportDetail from "./components/TransportDetail";
import TrackingPage from "./components/TrackingPage";
import ShipmentPage from "./components/ShipmentPage";
import ContactPage from "./components/ContactPage";
import PageLoader from "./components/PageLoader";
import CookieConsent from "./components/CookieConsent";
import M3IntelligenceDashboard from "./components/M3IntelligenceDashboard";
import { LocationProvider } from "./context/LocationContext";

const INITIAL_LOAD_MS = 600;

function App() {
  const [loading, setLoading] = useState(true);
  const [cookiesResolved, setCookiesResolved] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), INITIAL_LOAD_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const shouldLock = loading || !cookiesResolved;
    document.body.style.overflow = shouldLock ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [loading, cookiesResolved]);

  return (
    <LocationProvider>
      <PageLoader visible={loading} />

      {!loading && <CookieConsent onResolved={setCookiesResolved} />}

      <div
        aria-hidden={!cookiesResolved}
        style={
          !cookiesResolved
            ? { filter: "blur(2px)", pointerEvents: "none", userSelect: "none" }
            : undefined
        }
      >
      <Routes>
        <Route path="/" element={<ProfessionalLanding />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/services" element={<QuoteGenerator />} />
        <Route path="/transport/:mode" element={<TransportDetail />} />
        <Route path="/tracking" element={<TrackingPage />} />
        <Route path="/shipment" element={<ShipmentPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/m3-intelligence" element={<M3IntelligenceDashboard />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardShell />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/:section"
          element={
            <ProtectedRoute>
              <DashboardShell />
            </ProtectedRoute>
          }
        />

        <Route
          path="/quote"
          element={
            <ProtectedRoute>
              <QuotePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminRateConfig />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/users"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminUsers />
            </ProtectedRoute>
          }
        />
      </Routes>
      </div>
    </LocationProvider>
  );
}

export default App;
