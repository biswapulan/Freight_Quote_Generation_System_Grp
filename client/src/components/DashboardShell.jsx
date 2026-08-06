import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import QuoteCalculator from "./QuoteCalculator";
import "./DashboardShell.css";

// Sidebar section labels per account type. These are placeholders only —
// each renders as a blank page with just the section name until someone
// builds the real content for it.
const RETAIL_SECTIONS = [
  "Overview",
  "New Quote",
  "My Shipments",
  "Quote History",
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
          Freight<span>AI</span>
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

      <main className={`dash-content${activeItem.slug === "new-quote" ? " dash-content-flush" : ""}`}>
        {activeItem.slug === "new-quote" ? (
          <QuoteCalculator />
        ) : (
          <div className="dash-placeholder">
            <h1>{activeItem.label}</h1>
            <p>This section hasn&apos;t been built yet.</p>
          </div>
        )}
      </main>
    </div>
  );
}
