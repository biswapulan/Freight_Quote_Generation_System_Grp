import { Routes, Route } from "react-router-dom";
import ProfessionalLanding from "./components/ProfessionalLanding";
import AuthPage from "./components/AuthPage";
import DashboardShell from "./components/DashboardShell";
import QuotePage from "./components/QuotePage";
import QuoteGenerator from "./components/QuoteGenerator";
import AdminRateConfig from "./components/AdminRateConfig";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Routes>
      <Route path="/" element={<ProfessionalLanding />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/services" element={<QuoteGenerator />} />

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
    </Routes>
  );
}

export default App;
