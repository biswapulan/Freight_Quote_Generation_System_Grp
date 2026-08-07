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
import "./Logo.css";
import "./DashboardShell.css";

// Sidebar section labels per account type — see the slug switch in <main>
// further down for what each renders. "Overview", "Routes" and
// "Port Congestion" render real UI for retail accounts; the business
// account versions of these sections are still placeholders.
const RETAIL_SECTIONS = [
  "Overview",
  "Generate Quote",
  "Shipments History",
  "Saved Addresses",
  "Routes",
  "Port Congestion",
  "Carriers",
  "Profile",
  "Support",
];

const BUSINESS_SECTIONS = [
  "Overview",
  "New Quote",
  "Company Shipments",
  "Bulk Quote",
  "Team Management",
  "Invoices & Billing",
  "Routes",
  "Port Congestion",
  "Carriers",
  "Company Profile",
  "Support",
];

const ROLE_LABELS = {
  retail: "Retail Account",
  business: "Business Account",
  admin: "Admin",
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

  const sections = user.role === "business" ? BUSINESS_SECTIONS : RETAIL_SECTIONS;
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
  const timeLabel = now.toLocaleTimeString("en-GB"); // HH:MM:SS

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
            <span className="dash-role">{ROLE_LABELS[user.role] || "Account"}</span>
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
          activeItem.slug === "generate-quote" || activeItem.slug === "new-quote" || activeItem.slug === "shipments-history"
            ? " dash-content-flush"
            : ""
        }`}
      >
        <RetailQuotesProvider>
          {activeItem.slug === "overview" && user.role !== "business" ? (
            <RetailOverview />
          ) : activeItem.slug === "routes" && user.role !== "business" ? (
            <RetailRoutes />
          ) : activeItem.slug === "port-congestion" && user.role !== "business" ? (
            <RetailPortCongestion />
          ) : activeItem.slug === "generate-quote" && user.role !== "business" ? (
            <RetailGenerateQuote />
          ) : activeItem.slug === "new-quote" ? (
            <QuoteCalculator />
          ) : activeItem.slug === "shipments-history" ? (
            <RetailShipmentsHistory />
          ) : activeItem.slug === "saved-addresses" ? (
            <SavedAddresses />
          ) : activeItem.slug === "carriers" ? (
            <Carriers />
          ) : activeItem.slug === "support" ? (
            <Support />
          ) : activeItem.slug === "profile" && user.role === "retail" ? (
            <RetailProfile />
          ) : (
            <div className="dash-placeholder">
              <h1>{activeItem.label}</h1>
              <p>This section hasn&apos;t been built yet.</p>
            </div>
          )}
        </RetailQuotesProvider>
      </main>
    </div>
  );
}
