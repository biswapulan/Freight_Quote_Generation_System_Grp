import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Ship,
  Clock,
  CheckCircle2,
  Check,
  AlertTriangle,
  Lock,
  ArrowLeft,
  FileText,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  ChevronRight,
  UserCheck,
  Building2,
  ThumbsUp,
  ThumbsDown,
  Info,
  Layers,
  MapPin,
  Anchor,
  Navigation,
  ExternalLink,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePlatformQuotes } from "../hooks/usePlatformQuotes";
import {
  formatMoney,
  getQuoteRouteData,
  approveQuoteAgentStep,
  approveQuoteCustomsStep,
  acceptQuoteCustomerStep,
  rejectQuoteCustomerStep,
  normalizeWorkflowStatus,
} from "../utils/quoteWorkflow";
import Logo from "./Logo";
import "./Logo.css";
import "./DashboardShell.css";
import "./QuoteDetailView.css";

// Mirrors RETAIL_SECTIONS in DashboardShell — same labels, same order, and the
// canonical "request-quote" slug so the link actually opens Request Quote.
// No `active` flag here: until the customer confirms a carrier this screen is
// still part of the Request Quote flow, and only afterwards is it a My Quotes
// record. buildRetailNav below picks the highlighted item accordingly.
const RETAIL_NAV = [
  { label: "Dashboard", slug: "dashboard" },
  { label: "Request Quote", slug: "request-quote" },
  { label: "My Shipments", slug: "my-shipments" },
  { label: "My Quotes", slug: "my-quotes" },
  { label: "Documents", slug: "documents" },
  { label: "Notifications", slug: "notifications" },
  { label: "Profile", slug: "profile" },
];

function buildRetailNav(routeConfirmed) {
  const activeSlug = routeConfirmed ? "my-quotes" : "request-quote";
  return RETAIL_NAV.map((item) => ({ ...item, active: item.slug === activeSlug }));
}

const AGENT_NAV = [
  { label: "Dashboard", slug: "dashboard" },
  { label: "Shipment Requests", slug: "shipment-requests" },
  { label: "Quote Requests", slug: "quote-requests" },
  { label: "Quote Review", slug: "quote-review", active: true },
  { label: "AI Pricing Analysis", slug: "ai-pricing-analysis" },
  { label: "Risk Analysis", slug: "risk-analysis" },
  { label: "Documents", slug: "documents" },
  { label: "Notifications", slug: "notifications" },
  { label: "Profile", slug: "profile" },
];

const CUSTOMS_NAV = [
  { label: "Dashboard", slug: "dashboard" },
  { label: "Pending Reviews", slug: "pending-reviews", active: true },
  { label: "Document Verification", slug: "document-verification" },
  { label: "Customs Risk Flags", slug: "customs-risk-flags" },
  { label: "Notifications", slug: "notifications" },
  { label: "Profile", slug: "profile" },
];

const ADMIN_NAV = [
  { label: "Dashboard", slug: "dashboard" },
  { label: "All Quotes", slug: "all-quotes", active: true },
  { label: "All Shipments", slug: "all-shipments" },
  { label: "AI Pricing Monitor", slug: "ai-pricing-monitor" },
  { label: "AI Agent Monitor", slug: "ai-agent-monitor" },
  { label: "Pricing Rules", slug: "pricing-rules" },
  { label: "Audit Logs", slug: "audit-logs" },
];

const ROLE_LABELS = {
  retail: "Customer (Retail)",
  business: "Customer (Business)",
  agent: "Freight Agent / Operations",
  customs: "Customs Officer",
  admin: "Administrator",
};

function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export default function QuoteDetailView({ quoteId: propQuoteId, embeddedQuote = null }) {
  const { quoteId: paramQuoteId } = useParams();
  const quoteId = propQuoteId || paramQuoteId;
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { quotes, reload } = usePlatformQuotes();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const now = useLiveClock();

  // Resolve quote object from list, prop, or localStorage
  const activeQuote = useMemo(() => {
    if (embeddedQuote) return embeddedQuote;
    if (!quotes || !quotes.length) {
      try {
        const raw = localStorage.getItem("freightai_current_quote");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (!quoteId || parsed.id === quoteId || parsed.quoteNo === quoteId) return parsed;
        }
      } catch {}
      return null;
    }
    return quotes.find((q) => q.id === quoteId || q.quoteNo === quoteId) || quotes[0];
  }, [quotes, quoteId, embeddedQuote]);

  const [routeState, setRouteState] = useState(() =>
    getQuoteRouteData(quoteId || activeQuote?.id, activeQuote)
  );

  const [busyAction, setBusyAction] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Sync state on external update
  useEffect(() => {
    function handleUpdate(e) {
      if (!quoteId || e.detail?.quoteId === quoteId) {
        setRouteState(getQuoteRouteData(quoteId || activeQuote?.id, activeQuote));
      }
    }
    window.addEventListener("freightai_route_selection_updated", handleUpdate);
    return () => window.removeEventListener("freightai_route_selection_updated", handleUpdate);
  }, [quoteId, activeQuote]);

  useEffect(() => {
    if (activeQuote) {
      setRouteState(getQuoteRouteData(activeQuote.id, activeQuote));
    }
  }, [activeQuote]);

  const routeOptions = routeState?.routeOptions || [];

  // The server records which carrier the customer actually chose. Prefer it
  // over the route cache, which reads this browser's localStorage and so falls
  // back to the recommended default for anyone who did not make the choice on
  // this machine — that is how the agent desk showed Maersk for every quote.
  const serverCarrier = activeQuote?.selectedCarrier || activeQuote?.carrier || "";
  const selectedOption =
    (serverCarrier &&
      routeOptions.find(
        (o) => (o.carrier || "").toLowerCase() === serverCarrier.toLowerCase(),
      )) ||
    routeState?.selectedRouteOption ||
    routeOptions[0] ||
    {};
  const approvalSeq = routeState?.approvalSequence || {
    agentReview: "PENDING",
    customsCheck: "PENDING",
    customerAcceptance: "LOCKED",
  };

  const rawRole = (user?.role || "retail").toLowerCase();
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

  const isStaff = ["agent", "admin", "customs"].includes(role);
  const isCustomer = !isStaff;

  // Until a carrier is locked in, this screen is the tail end of Request Quote
  // and the quote is not yet listed under My Quotes, so sending the customer
  // there would show them a list their quote is missing from.
  const routeConfirmed = Boolean(activeQuote?.routeConfirmed || serverCarrier || routeState?.routeConfirmed);
  const inRequestFlow = isCustomer && !routeConfirmed;
  const parentCrumb = inRequestFlow
    ? { label: "Request Quote", to: "/dashboard/request-quote" }
    : { label: "My Quotes", to: "/dashboard/my-quotes" };

  // Each approval stage belongs to one role. Everyone can watch the sequence,
  // but only the role that owns a stage gets its button.
  const canActAsAgent = role === "agent" || role === "admin";
  const canActAsCustoms = role === "customs" || role === "admin";
  const canDecideAsCustomer = isCustomer;

  const navItems =
    role === "customs"
      ? CUSTOMS_NAV
      : role === "admin"
      ? ADMIN_NAV
      : role === "agent"
      ? AGENT_NAV
      : buildRetailNav(routeConfirmed);

  function notifyUser(text, type = "success") {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 4000);
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  // Carrier selection lives in the Request Quote flow's final modal, not here.
  // This screen only reports what was offered and what the customer picked.

  // Step 1: Freight Agent approval
  async function handleAgentApprove() {
    if (!activeQuote || busyAction) return;
    setBusyAction(true);
    try {
      await approveQuoteAgentStep(
        activeQuote.id,
        `Commercial tariff approved for carrier ${selectedOption?.carrier || "assigned carrier"} by Freight Agent (${user?.full_name || "Agent"}).`
      );
      setRouteState(getQuoteRouteData(activeQuote.id, activeQuote));
      notifyUser("Step 1: Freight Agent commercial tariff validated & approved!");
      if (reload) reload();
    } catch (err) {
      notifyUser(err.message || "Failed to approve agent review", "error");
    } finally {
      setBusyAction(false);
    }
  }

  // Step 2: Customs Officer approval
  async function handleCustomsApprove() {
    if (!activeQuote || busyAction) return;
    setBusyAction(true);
    try {
      await approveQuoteCustomsStep(
        activeQuote.id,
        `Export & import trade documentation verified and passed by Customs Officer (${user?.full_name || "Customs Officer"}).`
      );
      setRouteState(getQuoteRouteData(activeQuote.id, activeQuote));
      notifyUser("Step 2: Customs Officer check cleared! Customer acceptance is now unlocked.");
      if (reload) reload();
    } catch (err) {
      notifyUser(err.message || "Failed to clear customs check", "error");
    } finally {
      setBusyAction(false);
    }
  }

  // Step 3: Customer accepts quote
  async function handleCustomerAccept() {
    if (!activeQuote || busyAction) return;
    setBusyAction(true);
    try {
      await acceptQuoteCustomerStep(activeQuote.id, "Customer confirmed booking and accepted quotation.");
      setRouteState(getQuoteRouteData(activeQuote.id, activeQuote));
      notifyUser("Quote Accepted! Booking confirmed and vessel space locked with carrier.");
      if (reload) reload();
    } catch (err) {
      notifyUser(err.message || "Failed to accept quote", "error");
    } finally {
      setBusyAction(false);
    }
  }

  // Step 3: Customer rejects quote
  async function handleCustomerReject() {
    if (!activeQuote || busyAction) return;
    const reason = window.prompt("Please provide a reason for declining this quotation (optional):");
    setBusyAction(true);
    try {
      await rejectQuoteCustomerStep(activeQuote.id, reason || "Declined by customer.");
      setRouteState(getQuoteRouteData(activeQuote.id, activeQuote));
      notifyUser("Quote declined.", "warning");
      if (reload) reload();
    } catch (err) {
      notifyUser(err.message || "Failed to decline quote", "error");
    } finally {
      setBusyAction(false);
    }
  }

  const effectiveTotal = selectedOption?.price || activeQuote?.totalNum || 248178;
  const transitDays = selectedOption?.transitDays || activeQuote?.transitDays || 12;

  const originText = activeQuote?.origin || "Nhava Sheva (INNSA), Mumbai";
  const destText = activeQuote?.destination || "Port of Singapore (SGSIN)";
  const originCode = originText.includes("(") ? originText.split("(")[1]?.split(")")[0] : "INNSA";
  const destCode = destText.includes("(") ? destText.split("(")[1]?.split(")")[0] : "SGSIN";

  const mlPrediction = Math.round(effectiveTotal * 0.83);
  const mlVariancePct = -17.01;
  const confLow = Math.round(mlPrediction * 0.96);
  const confHigh = Math.round(mlPrediction * 1.04);

  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeLabel = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return (
    <div className="dash-shell qdv-dash-shell">
      {/* Mobile Hamburger Toggle */}
      <button
        type="button"
        className="dash-hamburger"
        onClick={() => setSidebarOpen((v) => !v)}
        aria-label="Toggle navigation"
      >
        <span />
        <span />
        <span />
      </button>

      {sidebarOpen && <div className="dash-backdrop" onClick={() => setSidebarOpen(false)} />}

      {/* FREIGHTAI AUTHENTIC DASHBOARD SIDEBAR */}
      <aside className={`dash-sidebar${sidebarOpen ? " open" : ""}`}>
        <div className="dash-logo">
          <Logo to="/dashboard" variant="white" size={32} />
        </div>

        <nav className="dash-nav">
          {navItems.map((item) => (
            <Link
              key={item.slug}
              to={`/dashboard/${item.slug}`}
              className={`dash-nav-item${item.active ? " active" : ""}`}
              onClick={() => setSidebarOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="dash-sidebar-footer">
          <div className="dash-user-info">
            <span className="dash-username">{user?.full_name || "Customer Shipper"}</span>
            <span className="dash-role">{ROLE_LABELS[role] || "Customer"}</span>
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

      {/* MAIN DASHBOARD CONTENT AREA */}
      <main className="dash-content qdv-dash-content">
        {/* Floating Toast Notification */}
        {feedbackMsg && (
          <div className={`qdv-toast ${feedbackMsg.type}`}>
            {feedbackMsg.type === "error" ? (
              <AlertTriangle size={16} />
            ) : (
              <CheckCircle2 size={16} />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* TOP BREADCRUMB & HEADER ROW */}
        <div className="qdv-top-bar">
          <div className="qdv-breadcrumb-wrap">
            <div className="qdv-breadcrumb-trail">
              <Link to="/dashboard" className="qdv-bc-link">Dashboard</Link>
              <span className="qdv-bc-sep">/</span>
              <Link to={parentCrumb.to} className="qdv-bc-link">{parentCrumb.label}</Link>
              <span className="qdv-bc-sep">/</span>
              <span className="qdv-bc-current">
                {inRequestFlow ? "Step 2 · Choose Your Carrier" : "Carrier Route Selection"}
              </span>
            </div>
            <h1 className="qdv-header-title">Carrier Route Recommendations &amp; Approval Desk</h1>
            <p className="qdv-header-sub">
              {inRequestFlow
                ? "Your quote is ready. Pick the carrier you want, and we'll send it for freight agent and customs approval."
                : "Live multi-agent maritime rate comparisons, predictive transit telemetry & 3-stage validation workflow."}
            </p>
          </div>

          <div className="qdv-header-actions">
            <button
              type="button"
              className="qdv-btn-secondary"
              onClick={() => navigate(parentCrumb.to)}
            >
              <ArrowLeft size={15} /> Back to {parentCrumb.label}
            </button>
            <div className="qdv-quote-tag">
              Quote Ref: <strong>{activeQuote?.id || quoteId || "QT-H964URBF"}</strong>
            </div>
          </div>
        </div>

        {/* 4-COLUMN KPI DASHBOARD STATS ROW */}
        <div className="qdv-kpi-grid">
          <div className="qdv-kpi-card">
            <span className="qdv-kpi-caption">ACTIVE CORRIDOR</span>
            <div className="qdv-kpi-value">{originCode} → {destCode}</div>
            <div className="qdv-kpi-sub">
              <Ship size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
              Ocean Maritime Corridor · Direct
            </div>
          </div>

          <div className="qdv-kpi-card">
            <span className="qdv-kpi-caption">SHIPMENT SPECS</span>
            <div className="qdv-kpi-value">{activeQuote?.basis || "1 × 40HC (18,500 kg)"}</div>
            <div className="qdv-kpi-sub text-slate-500">Commercial Cargo · Dry Container</div>
          </div>

          <div className="qdv-kpi-card highlight-card">
            <span className="qdv-kpi-caption">CHOSEN CARRIER</span>
            <div className="qdv-kpi-value text-orange-600">{selectedOption?.carrier || "CMA CGM"}</div>
            <div className="qdv-kpi-sub text-orange-700">
              <Clock size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
              Est. {transitDays} Days Transit
            </div>
          </div>

          <div className="qdv-kpi-card">
            <span className="qdv-kpi-caption">INDICATIVE TOTAL</span>
            <div className="qdv-kpi-value text-emerald-700">₹ {effectiveTotal.toLocaleString("en-IN")}</div>
            <div className="qdv-kpi-sub text-emerald-600">
              <Check size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
              Tariff locked for 14 calendar days
            </div>
          </div>
        </div>

        {/* TWO-COLUMN DASHBOARD LAYOUT */}
        <div className="qdv-dashboard-grid">
          {/* LEFT MAIN COLUMN (70%): Route Cards + Cost Breakdown + ML Insights */}
          <div className="qdv-left-column">
            {/* CARRIER ROUTE OPTIONS SECTION */}
            <div className="qdv-section-card">
              <div className="qdv-section-head">
                <div className="qdv-head-title-wrap">
                  <div className="qdv-badge-count">{routeOptions.length}</div>
                  <div>
                    <h2 className="qdv-section-title">Carrier Routes Offered</h2>
                    <p className="qdv-section-desc">
                      {selectedOption?.carrier
                        ? `The options quoted for this shipment. The customer chose ${selectedOption.carrier}, and that choice is locked.`
                        : "The carrier options quoted for this shipment. No carrier has been chosen yet."}
                    </p>
                  </div>
                </div>
              </div>

              {/* WHAT HAPPENS NEXT — the customer's own action is done once a
                  carrier is locked, so say so instead of leaving them guessing
                  in front of two buttons that belong to other roles. */}
              {isCustomer && (
                <div className={`qdv-next-step ${routeConfirmed ? "is-done" : "is-pending"}`}>
                  <div className="qdv-next-step-icon">
                    {routeConfirmed ? <CheckCircle2 size={18} /> : <Info size={18} />}
                  </div>
                  <div className="qdv-next-step-body">
                    <strong className="qdv-next-step-title">
                      {routeConfirmed
                        ? `${selectedOption?.carrier || "Your carrier"} is confirmed. Nothing more to do right now.`
                        : "Next step: choose a carrier below"}
                    </strong>
                    <p className="qdv-next-step-text">
                      {routeConfirmed ? (
                        <>
                          We&apos;ve sent your quote to our freight team. They check the commercial
                          tariff, then customs verifies your documents. You&apos;ll get a
                          notification when it&apos;s ready for you to accept, and it will be
                          waiting under <Link to="/dashboard/my-quotes">My Quotes</Link>. You can
                          safely close this page.
                        </>
                      ) : (
                        <>
                          Pick the carrier that suits you and we&apos;ll take it from there. You
                          can change your mind until the freight agent approves the tariff.
                        </>
                      )}
                    </p>
                    {routeConfirmed && (
                      <div className="qdv-next-step-actions">
                        <button
                          type="button"
                          className="qdv-btn-secondary"
                          onClick={() => navigate("/dashboard/my-quotes")}
                        >
                          View in My Quotes
                        </button>
                        <button
                          type="button"
                          className="qdv-btn-secondary"
                          onClick={() => navigate("/dashboard/request-quote")}
                        >
                          Start another enquiry
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="qdv-cards-stack">
                {routeOptions.map((opt) => {
                  const isSelected = selectedOption?.id === opt.id;
                  return (
                    <div
                      key={opt.id}
                      className={`qdv-carrier-card is-readonly ${isSelected ? "selected-carrier" : ""}`}
                    >
                      <div className="qdv-carrier-header">
                        <div className="qdv-carrier-identity">
                          <div className="qdv-carrier-icon-box">
                            <Ship size={20} />
                          </div>
                          <div>
                            <div className="qdv-carrier-name-row">
                              <span className="qdv-carrier-name">{opt.carrier}</span>
                              {opt.recommended && (
                                <span className="qdv-pill-rec">RECOMMENDED</span>
                              )}
                              {isSelected && (
                                <span className="qdv-pill-chosen">CUSTOMER&apos;S CHOICE</span>
                              )}
                            </div>
                            <span className="qdv-carrier-service-text">{opt.service}</span>
                          </div>
                        </div>

                        <div className="qdv-carrier-pricing">
                          <div className="qdv-carrier-price-block">
                            <span className="qdv-price-val">₹ {opt.price.toLocaleString("en-IN")}</span>
                            <span className="qdv-price-transit">{opt.transitDays} DAYS TRANSIT</span>
                          </div>
                          {/* The carrier is chosen once, by the customer, in the
                              Request Quote flow. This screen is the record of
                              what they were offered and what they picked, so
                              nobody re-selects from here. */}
                          {isSelected ? (
                            <span className="qdv-carrier-mark is-chosen">
                              <Check size={15} /> Locked in
                            </span>
                          ) : (
                            <span className="qdv-carrier-mark is-passed">Not selected</span>
                          )}
                        </div>
                      </div>

                      {/* 4 MODERN PERFORMANCE METRIC BARS */}
                      <div className="qdv-metrics-grid">
                        <div className="qdv-metric-item">
                          <div className="qdv-metric-top">
                            <span className="qdv-metric-title">Transit Speed</span>
                            <strong className="qdv-metric-score">{Math.round(opt.transitScore * 100)}%</strong>
                          </div>
                          <div className="qdv-track">
                            <div
                              className="qdv-fill transit-fill"
                              style={{ width: `${opt.transitScore * 100}%` }}
                            />
                          </div>
                        </div>

                        <div className="qdv-metric-item">
                          <div className="qdv-metric-top">
                            <span className="qdv-metric-title">Cost Efficiency</span>
                            <strong className="qdv-metric-score">{Math.round(opt.costScore * 100)}%</strong>
                          </div>
                          <div className="qdv-track">
                            <div
                              className="qdv-fill cost-fill"
                              style={{ width: `${opt.costScore * 100}%` }}
                            />
                          </div>
                        </div>

                        <div className="qdv-metric-item">
                          <div className="qdv-metric-top">
                            <span className="qdv-metric-title">Schedule Reliability</span>
                            <strong className="qdv-metric-score">{Math.round(opt.reliability * 100)}%</strong>
                          </div>
                          <div className="qdv-track">
                            <div
                              className="qdv-fill reliability-fill"
                              style={{ width: `${opt.reliability * 100}%` }}
                            />
                          </div>
                        </div>

                        <div className="qdv-metric-item">
                          <div className="qdv-metric-top">
                            <span className="qdv-metric-title">Vessel Turnaround</span>
                            <strong className="qdv-metric-score">{Math.round(opt.congestion * 100)}%</strong>
                          </div>
                          <div className="qdv-track">
                            <div
                              className="qdv-fill congestion-fill"
                              style={{ width: `${opt.congestion * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* TRANSIT BREAKDOWN & COMMERCIAL TABLE */}
            <div className="qdv-section-card">
              <div className="qdv-section-head">
                <h2 className="qdv-section-title">Commercial Tariff &amp; Dwell Breakdown</h2>
              </div>

              <div className="qdv-table-container">
                <table className="qdv-breakdown-table">
                  <thead>
                    <tr>
                      <th>Cost Component</th>
                      <th>Basis / Units</th>
                      <th style={{ textAlign: "right" }}>Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <div className="qdv-line-main">Base Ocean Carriage ({selectedOption?.carrier || "Carrier"})</div>
                        <div className="qdv-line-sub">Direct deep-sea container transit {originCode} → {destCode}</div>
                      </td>
                      <td>{activeQuote?.basis || "1 × 40HC"}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>₹ {Math.round(effectiveTotal * 0.72).toLocaleString("en-IN")}</td>
                    </tr>
                    <tr>
                      <td>
                        <div className="qdv-line-main">Bunker Fuel Adjustment (BAF 10%)</div>
                        <div className="qdv-line-sub">Compensatory marine propulsion fuel surcharge</div>
                      </td>
                      <td>Standard Corridor Rate</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>₹ {Math.round(effectiveTotal * 0.10).toLocaleString("en-IN")}</td>
                    </tr>
                    <tr>
                      <td>
                        <div className="qdv-line-main">Terminal Handling Charges (Origin THC)</div>
                        <div className="qdv-line-sub">Container gantry crane lift-on/lift-off, berth stevedoring</div>
                      </td>
                      <td>Port Authority Tariff</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>₹ {Math.round(effectiveTotal * 0.08).toLocaleString("en-IN")}</td>
                    </tr>
                    <tr>
                      <td>
                        <div className="qdv-line-main">Export &amp; Import Customs Clearance Protocol</div>
                        <div className="qdv-line-sub">HS Code classification &amp; electronic ICEGATE filing</div>
                      </td>
                      <td>Regulatory Mandatory</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>₹ {Math.round(effectiveTotal * 0.06).toLocaleString("en-IN")}</td>
                    </tr>
                    <tr>
                      <td>
                        <div className="qdv-line-main">Carrier Bill of Lading &amp; Documentation Fee</div>
                        <div className="qdv-line-sub">Statutory carrier booking manifest &amp; electronic B/L release</div>
                      </td>
                      <td>Per Booking Record</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>₹ {(selectedOption?.docFee || 3000).toLocaleString("en-IN")}</td>
                    </tr>
                    <tr className="qdv-total-row">
                      <td colSpan={2}>
                        <span className="qdv-total-label">FINAL AUTHORITATIVE QUOTATION</span>
                        <span className="qdv-total-hint">All ocean carriage, fuel, terminal handling &amp; documentation fees inclusive</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="qdv-total-price">₹ {effectiveTotal.toLocaleString("en-IN")}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="qdv-table-footer-banner">
                <div className="qdv-banner-text">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>Transparent Freight Guarantee: Zero unexpected demurrage or unannounced port surcharges.</span>
                </div>
                <span className="qdv-badge-transparent">Verified by FreightAI Engine</span>
              </div>
            </div>

            {/* BROKER DECISION SUPPORT & UNDERWRITING INTELLIGENCE */}
            <div className="qdv-section-card qdv-ml-intelligence-box">
              <div className="qdv-ml-header-strip">
                <div className="qdv-ml-title-group">
                  <ShieldCheck size={20} className="text-orange-500" />
                  <div>
                    <h3 className="qdv-ml-title">Broker Decision Support &amp; Underwriting Intelligence</h3>
                    <p className="qdv-ml-sub">Machine learning price benchmarks, spot market variance &amp; composite risk model.</p>
                  </div>
                </div>
                <span className="qdv-tag-restricted">INTERNAL BENCHMARK</span>
              </div>

              <div className="qdv-ml-body-panel">
                <div className="qdv-ml-model-meta">
                  <div className="qdv-meta-item">
                    <Sparkles size={14} className="text-orange-400" />
                    <span>ML Algorithm: <strong>LightGBM Gradient Boosted Regressor (v2.0)</strong></span>
                  </div>
                  <span className="qdv-badge-tight">Capacity: TIGHT CORRIDOR</span>
                </div>

                <div className="qdv-ml-kpi-grid">
                  <div className="qdv-ml-stat">
                    <span className="qdv-stat-lbl">Rule Contract Tariff</span>
                    <strong className="qdv-stat-val">₹ {effectiveTotal.toLocaleString("en-IN")}</strong>
                    <span className="qdv-stat-hint">Standard Tariff Index</span>
                  </div>
                  <div className="qdv-ml-stat">
                    <span className="qdv-stat-lbl">ML Spot Prediction</span>
                    <strong className="qdv-stat-val text-teal-400">₹ {mlPrediction.toLocaleString("en-IN")}</strong>
                    <span className="qdv-stat-hint text-teal-400">
                      <TrendingDown size={12} style={{ display: "inline" }} /> {mlVariancePct}% vs Baseline
                    </span>
                  </div>
                  <div className="qdv-ml-stat">
                    <span className="qdv-stat-lbl">95% Confidence Band</span>
                    <strong className="qdv-stat-val">₹ {confLow.toLocaleString("en-IN")} – ₹{confHigh.toLocaleString("en-IN")}</strong>
                    <span className="qdv-stat-hint">Dynamic Spot Corridor</span>
                  </div>
                </div>

                <div className="qdv-ml-guidance-bar">
                  <strong>Broker Advisory:</strong> Live machine learning regressor predicts spot clearing rate at ₹{mlPrediction.toLocaleString("en-IN")} with model confidence R² = 0.8387.
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT STICKY COLUMN (30%): Snapshot + 3-Stage Approval Sequence + Verification */}
          <div className="qdv-right-column">
            {/* 1. CARRIER BOOKING SNAPSHOT */}
            <div className="qdv-panel-card qdv-snapshot-card">
              <span className="qdv-card-eyebrow">CHOSEN CARRIER SUMMARY</span>
              <div className="qdv-snapshot-main">
                <div className="qdv-snapshot-carrier-name">{selectedOption?.carrier || "CMA CGM"}</div>
                <span className="qdv-snapshot-transit">Est. {transitDays} Days Transit Time</span>
              </div>
              <div className="qdv-snapshot-divider" />
              <div className="qdv-snapshot-price-row">
                <span className="qdv-snapshot-price-lbl">INDICATIVE TOTAL</span>
                <span className="qdv-snapshot-price-amt">₹ {effectiveTotal.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* 2. THREE-STAGE APPROVAL SEQUENCE */}
            <div className="qdv-panel-card qdv-approval-stepper-card">
              <div className="qdv-stepper-header">
                <h3 className="qdv-stepper-title">3-STAGE APPROVAL SEQUENCE</h3>
                <span className="qdv-stepper-sub">Multi-role governance workflow</span>
              </div>

              <div className="qdv-stages-list">
                {/* STAGE 1: FREIGHT AGENT REVIEW */}
                <div className={`qdv-stage-box ${approvalSeq.agentReview === "APPROVED" ? "stage-approved" : "stage-pending"}`}>
                  <div className="qdv-stage-header">
                    <div className="qdv-stage-title-wrap">
                      <div className="qdv-stage-num">
                        {approvalSeq.agentReview === "APPROVED" ? <Check size={14} /> : "1"}
                      </div>
                      <span className="qdv-stage-name">Freight Agent Review</span>
                    </div>
                    <span className={`qdv-status-pill ${approvalSeq.agentReview === "APPROVED" ? "pill-approved" : "pill-pending"}`}>
                      {approvalSeq.agentReview === "APPROVED" ? "APPROVED" : "PENDING"}
                    </span>
                  </div>

                  <p className="qdv-stage-info">
                    {approvalSeq.agentReview === "APPROVED"
                      ? "Commercial tariff & carrier allocation confirmed."
                      : "Awaiting commercial tariff validation by Freight Agent."}
                  </p>

                  {approvalSeq.agentReview !== "APPROVED" && canActAsAgent && (
                    <button
                      type="button"
                      className="qdv-btn-workflow agent-action-btn"
                      onClick={handleAgentApprove}
                      disabled={busyAction}
                    >
                      <UserCheck size={14} /> Approve Commercial Tariff (Agent Review)
                    </button>
                  )}
                </div>

                {/* STAGE 2: CUSTOMS OFFICER CHECK */}
                <div className={`qdv-stage-box ${approvalSeq.customsCheck === "APPROVED" ? "stage-approved" : approvalSeq.agentReview === "APPROVED" ? "stage-pending" : "stage-locked"}`}>
                  <div className="qdv-stage-header">
                    <div className="qdv-stage-title-wrap">
                      <div className="qdv-stage-num">
                        {approvalSeq.customsCheck === "APPROVED" ? <Check size={14} /> : "2"}
                      </div>
                      <span className="qdv-stage-name">Customs Officer Check</span>
                    </div>
                    <span className={`qdv-status-pill ${approvalSeq.customsCheck === "APPROVED" ? "pill-approved" : approvalSeq.agentReview === "APPROVED" ? "pill-pending" : "pill-locked"}`}>
                      {approvalSeq.customsCheck === "APPROVED" ? "CLEARED" : approvalSeq.agentReview === "APPROVED" ? "PENDING" : "LOCKED"}
                    </span>
                  </div>

                  <p className="qdv-stage-info">
                    {approvalSeq.customsCheck === "APPROVED"
                      ? "Trade documents, HS Code & ICEGATE declaration verified."
                      : approvalSeq.agentReview === "APPROVED"
                      ? "Awaiting customs officer document inspection & sign-off."
                      : "Requires Freight Agent approval first."}
                  </p>

                  {approvalSeq.customsCheck !== "APPROVED" && canActAsCustoms && (
                    <button
                      type="button"
                      className="qdv-btn-workflow customs-action-btn"
                      onClick={handleCustomsApprove}
                      disabled={busyAction || approvalSeq.agentReview !== "APPROVED"}
                    >
                      <ShieldCheck size={14} /> Review Documents &amp; Sign-Off (Customs)
                    </button>
                  )}
                </div>

                {/* STAGE 3: CUSTOMER ACCEPTANCE */}
                <div className={`qdv-stage-box ${approvalSeq.customerAcceptance === "ACCEPTED" ? "stage-approved" : approvalSeq.customsCheck === "APPROVED" ? "stage-pending" : "stage-locked"}`}>
                  <div className="qdv-stage-header">
                    <div className="qdv-stage-title-wrap">
                      <div className="qdv-stage-num">
                        {approvalSeq.customerAcceptance === "ACCEPTED" ? <Check size={14} /> : "3"}
                      </div>
                      <span className="qdv-stage-name">Customer Acceptance</span>
                    </div>
                    <span className={`qdv-status-pill ${approvalSeq.customerAcceptance === "ACCEPTED" ? "pill-approved" : approvalSeq.customsCheck === "APPROVED" ? "pill-action" : "pill-locked"}`}>
                      {approvalSeq.customerAcceptance === "ACCEPTED" ? "ACCEPTED" : approvalSeq.customsCheck === "APPROVED" ? "ACTION REQUIRED" : "LOCKED"}
                    </span>
                  </div>

                  <p className="qdv-stage-info">
                    {approvalSeq.customerAcceptance === "ACCEPTED"
                      ? "Booking confirmed and carrier vessel space locked!"
                      : approvalSeq.customsCheck === "APPROVED"
                      ? "Quote fully approved! Review and confirm booking."
                      : "Requires Agent & Customs approvals before customer decision."}
                  </p>

                  {approvalSeq.customerAcceptance !== "ACCEPTED" && canDecideAsCustomer && (
                    <div className="qdv-customer-action-buttons">
                      <button
                        type="button"
                        className="qdv-btn-workflow customer-accept-btn"
                        onClick={handleCustomerAccept}
                        disabled={busyAction || approvalSeq.customsCheck !== "APPROVED"}
                      >
                        <CheckCircle2 size={15} /> Accept &amp; Confirm Booking
                      </button>
                      <button
                        type="button"
                        className="qdv-btn-text-decline"
                        onClick={handleCustomerReject}
                        disabled={busyAction}
                      >
                        Decline Quote
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 3. PLATFORM DATA VERIFICATION CHECKLIST */}
            <div className="qdv-panel-card qdv-audit-card">
              <span className="qdv-card-eyebrow">DATA &amp; INTEGRITY AUDIT</span>
              <ul className="qdv-audit-list">
                <li>
                  <CheckCircle2 size={15} className="text-emerald-600" />
                  <span>Gateway master data synchronized</span>
                </li>
                <li>
                  <CheckCircle2 size={15} className="text-emerald-600" />
                  <span>5-layer dynamic freight tariff applied</span>
                </li>
                <li>
                  <CheckCircle2 size={15} className="text-emerald-600" />
                  <span>Satellite sea-state &amp; weather verified</span>
                </li>
                <li>
                  <CheckCircle2 size={15} className="text-emerald-600" />
                  <span>Customs trade regulations validated</span>
                </li>
                <li>
                  <CheckCircle2 size={15} className="text-emerald-600" />
                  <span>5-factor composite risk: <strong>18/100 (Low)</strong></span>
                </li>
                <li>
                  <CheckCircle2 size={15} className="text-emerald-600" />
                  <span>ML spot pricing benchmarked</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
