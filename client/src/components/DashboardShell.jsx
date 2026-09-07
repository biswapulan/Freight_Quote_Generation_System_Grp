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
import AdminAuditLogs from "./AdminAuditLogs";
import AdminOverview from "./AdminOverview";
import AdminRateConfig from "./AdminRateConfig";
import AdminUsers from "./AdminUsers";
import AdminMasterData from "./AdminMasterData";
import M1RouteDashboard from "./M1RouteDashboard";
import M3IntelligenceDashboard from "./M3IntelligenceDashboard";
import CustomsOfficerPortal from "./CustomsOfficerPortal";
import AIAgentMonitor from "./AIAgentMonitor";
import NotificationsCenter from "./NotificationsCenter";
import DocumentsCenter from "./DocumentsCenter";
import "./Logo.css";
import "./DashboardShell.css";

// 6. Dashboard Architecture Navigation Specifications per Role
// Ordered to follow the customer journey: raise an enquiry, watch the cargo
// move, review the resulting quotes, then the supporting record sections.
const RETAIL_SECTIONS = [
  "Dashboard",
  "Request Quote",
  "My Shipments",
  "My Quotes",
  "Documents",
  "Notifications",
  "Profile",
];

const BUSINESS_SECTIONS = [
  "Dashboard",
  "Request Quote",
  "My Shipments",
  "My Quotes",
  "Documents",
  "Notifications",
  "Profile",
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
  "Documents",
  "Notifications",
  "Profile",
];

const CUSTOMS_SECTIONS = [
  "Dashboard",
  "Pending Reviews",
  "Assigned Shipments",
  "Document Verification",
  "Customs Risk Flags",
  "Completed Reviews",
  "Notifications",
  "Profile",
];

const ADMIN_SECTIONS = [
  "Dashboard",
  "Users",
  "Customers",
  "Freight Agents",
  "Customs Officers",
  "Roles & Permissions",
  "All Shipments",
  "All Quotes",
  "AI Pricing Monitor",
  "AI Agent Monitor",
  "Risk Intelligence",
  "Locations",
  "Routes",
  "Carriers",
  "Container Types",
  "Cargo Categories",
  "Pricing Rules",
  "Reports",
  "Notifications",
  "Settings",
  "Audit Logs",
];

const ROLE_LABELS = {
  retail: "Customer (Retail)",
  business: "Customer (Business)",
  agent: "Freight Agent / Operations",
  customs: "Customs Officer",
  admin: "Administrator",
};

/**
 * Legacy slugs that still appear in older links and bookmarks. Without this
 * they fail the section check below and silently redirect to the Dashboard,
 * which looked like "Request Quote does nothing".
 */
const SECTION_ALIASES = {
  "generate-quote": "request-quote",
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
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const { section } = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const now = useLiveClock();

  if (!user) return null;

  // Role comes from the authenticated account only.
  //
  // This used to fall back to substring-matching the email address, so anyone
  // registering as "admin.something@..." was shown the Admin portal. The email
  // is not an authorisation claim.
  const rawRole = (user.role || "").toLowerCase();
  const role =
    rawRole === "customs" || rawRole === "customs_officer"
      ? "customs"
      : rawRole === "admin"
      ? "admin"
      : rawRole === "agent"
      ? "agent"
      : rawRole === "business"
      ? "business"
      : "retail";

  const sections =
    role === "customs"
      ? CUSTOMS_SECTIONS
      : role === "admin"
      ? ADMIN_SECTIONS
      : role === "agent"
      ? AGENT_SECTIONS
      : role === "business"
      ? BUSINESS_SECTIONS
      : RETAIL_SECTIONS;

  const items = sections.map((label) => ({ label, slug: slugify(label) }));
  const resolvedSection = SECTION_ALIASES[section] || section;

  if (!resolvedSection || !items.some((i) => i.slug === resolvedSection)) {
    return <Navigate to={`/dashboard/${items[0].slug}`} replace />;
  }

  const activeItem = items.find((i) => i.slug === resolvedSection);

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

          {/* The role switcher that used to live here handed out fabricated
              admin tokens on request, so any visitor could open the Admin
              portal. Roles now come only from the signed-in account. */}

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
          {/* Universal M3 / Telemetry / Shared Views */}
          {activeItem.slug === "notifications" ? (
            <NotificationsCenter />
          ) : activeItem.slug === "documents" ? (
            <DocumentsCenter />
          ) : activeItem.slug === "m3-intelligence" ? (
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
              <CustomsOfficerPortal initialTab={activeItem.slug} />
            )
          ) : /* Admin Portal Views */
          role === "admin" ? (
            activeItem.slug === "dashboard" || activeItem.slug === "analytics" || activeItem.slug === "reports" || activeItem.slug === "settings" ? (
              <AdminOverview />
            ) : activeItem.slug === "audit-logs" ? (
              <AdminAuditLogs />
            ) : activeItem.slug === "rate-config" || activeItem.slug === "pricing-rules" ? (
              <AdminRateConfig />
            ) : activeItem.slug === "customs-portal" ? (
              <CustomsOfficerPortal />
            ) : activeItem.slug === "users" || activeItem.slug === "customers" || activeItem.slug === "freight-agents" || activeItem.slug === "customs-officers" || activeItem.slug === "roles-and-permissions" ? (
              <AdminUsers />
            ) : activeItem.slug === "master-data" || activeItem.slug === "locations" || activeItem.slug === "container-types" || activeItem.slug === "cargo-categories" ? (
              <AdminMasterData />
            ) : activeItem.slug === "all-shipments" ? (
              <AgentShipmentDispatch />
            ) : activeItem.slug === "all-quotes" ? (
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
              <AdminOverview />
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
            ) : activeItem.slug === "customs-clearance" ? (
              <CustomsOfficerPortal />
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
