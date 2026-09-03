import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { RetailQuotesProvider } from "../context/RetailQuotesContext";
import Logo from "./Logo";
import QuoteCalculator from "./QuoteCalculator";
import RetailGenerateQuote from "./RetailGenerateQuote";
import RetailOverview from "./RetailOverview";
import RetailProfile from "./RetailProfile";
import RetailRoutes from "./RetailRoutes";
import RetailPortCongestion from "./RetailPortCongestion";
import RetailShipmentsHistory from "./RetailShipmentsHistory";
import SavedAddresses from "./SavedAddresses";
import Carriers from "./Carriers";
import Support from "./Support";
import AgentOverview from "./AgentOverview";
import AgentQuoteDesk from "./AgentQuoteDesk";
import AgentShipmentDispatch from "./AgentShipmentDispatch";
import AgentSpotRates from "./AgentSpotRates";
import AgentPerformance from "./AgentPerformance";
import AdminRateConfig from "./AdminRateConfig";
import AdminUsers from "./AdminUsers";
import AdminMasterData from "./AdminMasterData";
import M1RouteDashboard from "./M1RouteDashboard";
import M3IntelligenceDashboard from "./M3IntelligenceDashboard";
import CustomsOfficerPortal from "./CustomsOfficerPortal";
import AIAgentMonitor from "./AIAgentMonitor";
import "./Logo.css";
import "./DashboardShell.css";

// PDF Page 7 Specification Sidebar Sections per Role
const RETAIL_SECTIONS = [
  "Dashboard",
  "My Shipments",
  "Request Quote",
  "My Quotes",
  "M3 Intelligence",
  "Saved Addresses",
  "Routes",
  "Port Congestion",
  "Carriers",
  "Profile",
  "Support",
];

const BUSINESS_SECTIONS = [
  "Dashboard",
  "My Shipments",
  "Request Quote",
  "My Quotes",
  "Bulk Quote",
  "M3 Intelligence",
  "Team Management",
  "Invoices & Billing",
  "Saved Addresses",
  "Routes",
  "Port Congestion",
  "Carriers",
  "Profile",
  "Support",
];

const AGENT_SECTIONS = [
  "Dashboard",
  "Shipment Requests",
  "All Shipments",
  "Quote Requests",
  "Quote Review",
  "Generated Quotes",
  "AI Pricing Analysis",
  "Risk Analysis",
  "Customers",
  "Spot Rates",
  "Client & Performance",
  "Routes",
  "Port Congestion",
  "Carriers",
  "Profile",
  "Support",
];

const CUSTOMS_SECTIONS = [
  "Dashboard",
  "Pending Reviews",
  "Assigned Shipments",
  "Document Verification",
  "Customs Risk Flags",
  "Completed Reviews",
  "M3 Intelligence",
  "Profile",
  "Support",
];

const ADMIN_SECTIONS = [
  "Dashboard",
  "Rate Config",
  "AI Agent Monitor",
  "AI Pricing Monitor",
  "Risk Intelligence",
  "Users",
  "Master Data",
  "All Shipments",
  "All Quotes",
  "Routes",
  "Port Congestion",
  "Carriers",
  "Profile",
  "Support",
];

const ROLE_LABELS = {
  retail: "Customer (Retail)",
  business: "Customer (Business)",
  agent: "Freight Agent / Operations",
  customs: "Customs Officer",
  admin: "Administrator",
};

function slugify(label) {
  return label
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function useLiveClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return now;
}

export default function DashboardShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { section } = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const now = useLiveClock();

  if (!user) return null;

  const role = (user.role || "retail").toLowerCase();

  const sections =
    role === "admin"
      ? ADMIN_SECTIONS
      : role === "customs" || role === "customs_officer"
      ? CUSTOMS_SECTIONS
      : role === "agent"
      ? AGENT_SECTIONS
      : role === "business"
      ? BUSINESS_SECTIONS
      : RETAIL_SECTIONS;

  const items = sections.map((label) => ({ label, slug: slugify(label) }));

  if (!section || !items.some((i) => i.slug === section)) {
    return <Navigate to={`/dashboard/${items[0].slug}`} replace />;
  }

  const activeItem = items.find((i) => i.slug === section);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const dateLabel = now.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeLabel = now.toLocaleTimeString("en-GB");

  return (
    <div className="dash-shell">
      <button
        type="button"
        className="dash-mobile-toggle"
        aria-label={sidebarOpen ? "Close menu" : "Open menu"}
        aria-expanded={sidebarOpen}
        onClick={() => setSidebarOpen((v) => !v)}
      >
        <span />
        <span />
        <span />
      </button>

      {sidebarOpen && <div className="dash-backdrop" onClick={() => setSidebarOpen(false)} />}

      <aside className={`dash-sidebar${sidebarOpen ? " open" : ""}`}>
        <div className="dash-logo">
          <Logo to="/dashboard" variant="white" size={32} />
        </div>

        <nav className="dash-nav">
          {items.map((item) => (
            <Link
              key={item.slug}
              to={`/dashboard/${item.slug}`}
              className={`dash-nav-item${item.slug === activeItem.slug ? " active" : ""}`}
              onClick={() => setSidebarOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="dash-sidebar-footer">
          <div className="dash-user-info">
            <span className="dash-username">{user.full_name}</span>
            <span className="dash-role">{ROLE_LABELS[role] || "Account"}</span>
          </div>
          <div className="dash-clock">
            <span className="dash-clock-date">{dateLabel}</span>
            <span className="dash-clock-time">{timeLabel}</span>
          </div>
          <button type="button" className="dash-logout" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </aside>

      <main
        className={`dash-content${
          activeItem.slug === "request-quote" ||
          activeItem.slug === "generate-quote" ||
          activeItem.slug === "my-shipments" ||
          activeItem.slug === "my-quotes" ||
          activeItem.slug === "shipments-history"
            ? " dash-content-flush"
            : ""
        }`}
      >
        <RetailQuotesProvider>
          {/* Universal M3 / Telemetry Views */}
          {activeItem.slug === "m3-intelligence" ? (
            <M3IntelligenceDashboard mode="all" />
          ) : activeItem.slug === "risk-intelligence" || activeItem.slug === "risk-analysis" ? (
            <M3IntelligenceDashboard mode="risk" />
          ) : activeItem.slug === "ai-pricing-monitor" || activeItem.slug === "ai-pricing-analysis" ? (
            <M3IntelligenceDashboard mode="pricing" />
          ) : activeItem.slug === "ai-agent-monitor" ? (
            <AIAgentMonitor />
          ) : /* Customs Officer Portal Views */
          role === "customs" || role === "customs_officer" ? (
            activeItem.slug === "profile" ? (
              <RetailProfile />
            ) : activeItem.slug === "support" ? (
              <Support />
            ) : (
              <CustomsOfficerPortal />
            )
          ) : /* Admin Portal Views */
          role === "admin" ? (
            activeItem.slug === "dashboard" || activeItem.slug === "rate-config" ? (
              <AdminRateConfig />
            ) : activeItem.slug === "users" || activeItem.slug === "user-management" ? (
              <AdminUsers />
            ) : activeItem.slug === "master-data" ? (
              <AdminMasterData />
            ) : activeItem.slug === "all-shipments" || activeItem.slug === "all-quotes" ? (
              <AgentQuoteDesk />
            ) : activeItem.slug === "routes" ? (
              <RetailRoutes />
            ) : activeItem.slug === "port-congestion" ? (
              <RetailPortCongestion />
            ) : activeItem.slug === "carriers" ? (
              <Carriers />
            ) : activeItem.slug === "profile" ? (
              <RetailProfile />
            ) : activeItem.slug === "support" ? (
              <Support />
            ) : (
              <AdminRateConfig />
            )
          ) : /* Freight Agent Views */
          role === "agent" ? (
            activeItem.slug === "dashboard" ? (
              <AgentOverview />
            ) : activeItem.slug === "shipment-requests" || activeItem.slug === "all-shipments" ? (
              <AgentShipmentDispatch />
            ) : activeItem.slug === "quote-requests" ||
              activeItem.slug === "quote-review" ||
              activeItem.slug === "generated-quotes" ? (
              <AgentQuoteDesk />
            ) : activeItem.slug === "ai-pricing-analysis" || activeItem.slug === "risk-analysis" ? (
              <M3IntelligenceDashboard />
            ) : activeItem.slug === "customers" ? (
              <AgentShipmentDispatch />
            ) : activeItem.slug === "spot-rates" ? (
              <AgentSpotRates />
            ) : activeItem.slug === "client-and-performance" ? (
              <AgentPerformance />
            ) : activeItem.slug === "routes" ? (
              <RetailRoutes />
            ) : activeItem.slug === "port-congestion" ? (
              <RetailPortCongestion />
            ) : activeItem.slug === "carriers" ? (
              <Carriers />
            ) : activeItem.slug === "profile" ? (
              <RetailProfile />
            ) : activeItem.slug === "support" ? (
              <Support />
            ) : (
              <AgentOverview />
            )
          ) : /* Customer Portal Views (Retail & Business) */
          activeItem.slug === "dashboard" ? (
            <RetailOverview />
          ) : activeItem.slug === "request-quote" || activeItem.slug === "generate-quote" ? (
            <RetailGenerateQuote />
          ) : activeItem.slug === "my-shipments" || activeItem.slug === "company-shipments" ? (
            <RetailShipmentsHistory viewMode="shipments" />
          ) : activeItem.slug === "my-quotes" ||
            activeItem.slug === "shipments-history" ? (
            <RetailShipmentsHistory viewMode="quotes" />
          ) : activeItem.slug === "bulk-quote" ? (
            <QuoteCalculator />
          ) : activeItem.slug === "saved-addresses" ? (
            <SavedAddresses />
          ) : activeItem.slug === "routes" ? (
            <RetailRoutes />
          ) : activeItem.slug === "port-congestion" ? (
            <RetailPortCongestion />
          ) : activeItem.slug === "carriers" ? (
            <Carriers />
          ) : activeItem.slug === "profile" ? (
            <RetailProfile />
          ) : activeItem.slug === "support" ? (
            <Support />
          ) : (
            <RetailOverview />
          )}
        </RetailQuotesProvider>
      </main>
    </div>
  );
}
