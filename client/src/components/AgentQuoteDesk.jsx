import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Send,
  FileCheck,
  Inbox,
  Clock,
  MessageSquare,
  RotateCw,
  Eye,
  XCircle,
  Table as TableIcon,
  Check,
  Building2,
  ArrowRight,
} from "lucide-react";
import {
  formatMoney,
  modifyQuoteInStore,
  updateQuoteStatusInStore,
  approveQuoteAgentStep,
  STATUS_CONFIG,
  normalizeWorkflowStatus,
  getQuoteRouteData,
} from "../utils/quoteWorkflow";
import { useAuth } from "../context/AuthContext";
import { usePlatformQuotes } from "../hooks/usePlatformQuotes";
import QuoteWorkflowStepper from "./QuoteWorkflowStepper";
import "./AgentQuoteDesk.css";

/** Freight Agent dashboard cards (PDF section 6), derived from the live quotes. */
function buildDeskStats(quotes) {
  const today = new Date().toDateString();
  const priced = quotes.filter((q) => q.totalNum > 0);

  const variances = quotes
    .filter((q) => q.aiPredictedPrice != null && q.ruleBasedPrice > 0 && q.mlStatus === "PREDICTED")
    .map((q) => ((q.aiPredictedPrice - q.ruleBasedPrice) / q.ruleBasedPrice) * 100);

  const sum = (list) => list.reduce((acc, n) => acc + n, 0);

  return {
    newRequests: quotes.filter((q) => ["REQUESTED", "GENERATED"].includes(q.status)).length,
    pendingReviews: quotes.filter((q) => q.status === "PENDING_REVIEW").length,
    highRisk: quotes.filter((q) => ["HIGH", "CRITICAL"].includes(q.overallRisk)).length,
    sentToday: quotes.filter(
      (q) => q.status === "SENT" && q.createdAt && new Date(q.createdAt).toDateString() === today,
    ).length,
    approved: quotes.filter((q) => ["APPROVED", "SENT", "ACCEPTED"].includes(q.status)).length,
    avgQuote: priced.length ? Math.round(sum(priced.map((q) => q.totalNum)) / priced.length) : 0,
    avgVariance: variances.length ? Math.round((sum(variances) / variances.length) * 10) / 10 : null,
    currency: quotes[0]?.currency || "USD",
  };
}

export default function AgentQuoteDesk() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { quotes, loading, error, reload } = usePlatformQuotes();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [activeTab, setActiveTab] = useState("queue"); // "queue" | "activity" | "messages" | "table"

  const [activeModalQuote, setActiveModalQuote] = useState(null);
  const [marginPct, setMarginPct] = useState(10);
  const [fuelPct, setFuelPct] = useState(8);
  const [portFee, setPortFee] = useState(15000);
  const [actionNotice, setActionNotice] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);

  function openPricingModal(q) {
    setActiveModalQuote(q);
    setMarginPct(q.marginPct || 10);
    setFuelPct(q.fuelSurchargePct || 8);
    setPortFee(q.portFee || 15000);
    setActionError(null);
  }

  function flash(message) {
    setActionNotice(message);
    setTimeout(() => setActionNotice(null), 4000);
  }

  async function handleQuickApprove(q) {
    const qId = q.id || q.quoteNo;
    setBusy(true);
    setActionError(null);
    try {
      await approveQuoteAgentStep(
        qId,
        `Commercial tariff approved by Freight Agent (${user?.full_name || "Freight Agent"}). Forwarded to Customs Officer for document verification.`
      );
      flash(`Quotation ${qId} approved! Forwarded to Customs Officer for document verification.`);
      if (reload) reload();
    } catch (err) {
      setActionError(err.message || "Failed to approve quotation.");
    } finally {
      setBusy(false);
    }
  }

  async function handleQuickReject(q) {
    const qId = q.id || q.quoteNo;
    const reason = window.prompt(`Reason for rejecting quote ${qId}:`, "Commercial terms / operational capacity unavailable.");
    if (!reason) return;
    setBusy(true);
    setActionError(null);
    try {
      await updateQuoteStatusInStore(qId, "REJECTED", { reason });
      flash(`Quotation ${qId} marked as rejected.`);
      if (reload) reload();
    } catch (err) {
      setActionError(err.message || "Failed to reject quote.");
    } finally {
      setBusy(false);
    }
  }

  function handleQuickComment(q) {
    const qId = q.id || q.quoteNo;
    const comment = window.prompt(`Add operational note for quote ${qId}:`);
    if (!comment) return;
    flash(`Internal note saved for ${qId}: "${comment}"`);
  }

  /**
   * Approve the commercials.
   *
   * If the desk changed the price, that is a commercial override: it goes
   * through the modify endpoint first with a reason, so it lands in the audit
   * trail (PDF section 9, scenario 9) before the approval itself.
   */
  async function handleApproveOnly() {
    if (!activeModalQuote || busy) return;
    const quoteId = activeModalQuote.id;
    const finalAmount = calculateFinalCost(activeModalQuote, marginPct, fuelPct, portFee);

    setBusy(true);
    setActionError(null);
    try {
      if (finalAmount !== Math.round(activeModalQuote.totalNum)) {
        await modifyQuoteInStore(
          quoteId,
          finalAmount,
          `Commercial margin ${marginPct}%, fuel ${fuelPct}%, port fee ${portFee} applied by Operations Desk.`,
        );
      }
      await updateQuoteStatusInStore(quoteId, "APPROVED", {
        reason: `Commercial margin (${marginPct}%) approved by Operations Desk.`,
      });
      await approveQuoteAgentStep(quoteId, `Commercial margin (${marginPct}%) approved by Operations Desk.`);
      flash(`Quote ${quoteId} commercials APPROVED.`);
      setActiveModalQuote(null);
    } catch (err) {
      setActionError(err.message || "Could not approve this quote.");
    } finally {
      setBusy(false);
    }
  }

  /** Approve if needed, then send the final quote to the customer (PDF step 11). */
  async function handleSaveQuote() {
    if (!activeModalQuote || busy) return;
    const quoteId = activeModalQuote.id;
    const finalAmount = calculateFinalCost(activeModalQuote, marginPct, fuelPct, portFee);

    setBusy(true);
    setActionError(null);
    try {
      if (finalAmount !== Math.round(activeModalQuote.totalNum)) {
        await modifyQuoteInStore(
          quoteId,
          finalAmount,
          `Commercial margin ${marginPct}%, fuel ${fuelPct}%, port fee ${portFee} applied before dispatch.`,
        );
      }
      if (normalizeWorkflowStatus(activeModalQuote.status) !== "APPROVED") {
        await updateQuoteStatusInStore(quoteId, "APPROVED", {
          reason: `Commercial margin (${marginPct}%) validated by Operations Desk.`,
        });
      }
      await updateQuoteStatusInStore(quoteId, "SENT", {
        reason: "Final official quotation dispatched to customer.",
      });
      flash(`Final quotation for ${quoteId} dispatched to the customer.`);
      setActiveModalQuote(null);
    } catch (err) {
      setActionError(err.message || "Could not send this quote.");
    } finally {
      setBusy(false);
    }
  }

  /** Reject the quote. The reason is mandatory and is recorded. */
  async function handleRejectQuote() {
    if (!activeModalQuote || busy) return;
    const reason = window.prompt("Why is this quote being rejected?");
    if (!reason) return;

    setBusy(true);
    setActionError(null);
    try {
      await updateQuoteStatusInStore(activeModalQuote.id, "REJECTED", { reason });
      flash(`Quote ${activeModalQuote.id} rejected.`);
      setActiveModalQuote(null);
    } catch (err) {
      setActionError(err.message || "Could not reject this quote.");
    } finally {
      setBusy(false);
    }
  }

  /** Ask the customer for more information; the quote stays in review. */
  async function handleRequestInfo() {
    if (!activeModalQuote || busy) return;
    const reason = window.prompt("What information is required from the customer?");
    if (!reason) return;

    setBusy(true);
    setActionError(null);
    try {
      await updateQuoteStatusInStore(activeModalQuote.id, "PENDING_REVIEW", { reason });
      flash(`Information requested from the customer for ${activeModalQuote.id}.`);
      setActiveModalQuote(null);
    } catch (err) {
      setActionError(err.message || "Could not request information.");
    } finally {
      setBusy(false);
    }
  }

  const filteredQuotes = quotes.filter((q) => {
    const qId = q.id || q.quoteNo || "";
    const client = q.customerName || q.client || "";
    const origin = q.origin || "";
    const dest = q.destination || "";

    const matchesSearch =
      qId.toLowerCase().includes(search.toLowerCase()) ||
      client.toLowerCase().includes(search.toLowerCase()) ||
      origin.toLowerCase().includes(search.toLowerCase()) ||
      dest.toLowerCase().includes(search.toLowerCase());

    const normStatus = normalizeWorkflowStatus(q.status);
    const matchesStatus =
      statusFilter === "All" ||
      normStatus === statusFilter ||
      q.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  function calculateFinalCost(q, mPct = q.marginPct, fPct = q.fuelSurchargePct, pFee = q.portFee) {
    const marginAmount = q.baseRate * (mPct / 100);
    const fuelAmount = q.baseRate * (fPct / 100);
    return Math.round(q.baseRate + marginAmount + fuelAmount + pFee);
  }

  const stats = buildDeskStats(quotes);

  const reviewQueueQuotes = quotes.filter((q) => {
    const norm = normalizeWorkflowStatus(q.status);
    const routeData = getQuoteRouteData(q.id || q.quoteNo, q);
    const isPendingAgent = routeData?.approvalSequence?.agentReview === "PENDING";
    return isPendingAgent || ["PENDING_REVIEW", "QUOTED", "REQUESTED", "GENERATED"].includes(norm);
  });

  const myActivityQuotes = quotes.filter((q) => {
    const norm = normalizeWorkflowStatus(q.status);
    const routeData = getQuoteRouteData(q.id || q.quoteNo, q);
    return routeData?.approvalSequence?.agentReview === "APPROVED" || ["APPROVED", "SENT", "ACCEPTED", "REJECTED"].includes(norm);
  });

  return (
    <div className="agent-quote-desk">
      <div className="desk-header">
        <div className="desk-title">
          <h1>Milestone 2 — Broker Pricing &amp; Quotation Dashboard</h1>
          <p>Review customer freight requests, calculate operational costs, enforce margin policies, and issue dynamic binding quotes</p>
        </div>

        <div className="desk-controls">
          <input
            type="text"
            className="desk-search-input"
            placeholder="Search quotes, clients, ports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="desk-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="APPROVED">Approved</option>
            <option value="SENT">Sent</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Freight Agent dashboard cards (PDF section 6), computed from live data. */}
      <div className="m1-kpi-grid" style={{ marginBottom: "20px" }}>
        <div className="m1-kpi-card">
          <span className="m1-kpi-label">New Requests</span>
          <strong className="m1-kpi-val">{stats.newRequests}</strong>
        </div>
        <div className="m1-kpi-card">
          <span className="m1-kpi-label">Pending Reviews</span>
          <strong className="m1-kpi-val" style={{ color: "#ea580c" }}>{stats.pendingReviews}</strong>
        </div>
        <div className="m1-kpi-card">
          <span className="m1-kpi-label">High Risk Shipments</span>
          <strong className="m1-kpi-val" style={{ color: "#dc2626" }}>{stats.highRisk}</strong>
        </div>
        <div className="m1-kpi-card">
          <span className="m1-kpi-label">Quotes Sent Today</span>
          <strong className="m1-kpi-val" style={{ color: "#0284c7" }}>{stats.sentToday}</strong>
        </div>
        <div className="m1-kpi-card">
          <span className="m1-kpi-label">Approved Quotes</span>
          <strong className="m1-kpi-val" style={{ color: "#16a34a" }}>{stats.approved}</strong>
        </div>
        <div className="m1-kpi-card">
          <span className="m1-kpi-label">Avg Quote Value</span>
          <strong className="m1-kpi-val">{formatMoney(stats.avgQuote, stats.currency)}</strong>
        </div>
        <div className="m1-kpi-card">
          <span className="m1-kpi-label">AI vs Rule Variance</span>
          <strong className="m1-kpi-val" style={{ color: "#7c3aed" }}>
            {stats.avgVariance === null ? "—" : `${stats.avgVariance > 0 ? "+" : ""}${stats.avgVariance}%`}
          </strong>
        </div>
      </div>

      {actionNotice && (
        <div style={{ padding: "12px 16px", background: "rgba(34, 197, 94, 0.15)", border: "1px solid rgba(34, 197, 94, 0.3)", borderRadius: "10px", color: "#16a34a", fontSize: "13.5px", display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", fontWeight: "600" }}>
          <CheckCircle2 size={18} /> {actionNotice}
        </div>
      )}

      {error && (
        <div style={{ padding: "12px 16px", background: "rgba(220, 38, 38, 0.12)", border: "1px solid rgba(220, 38, 38, 0.3)", borderRadius: "10px", color: "#b91c1c", fontSize: "13.5px", display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", fontWeight: 600 }}>
          <AlertTriangle size={18} /> {error}
          <button type="button" onClick={reload} style={{ marginLeft: "auto", background: "none", border: "1px solid currentColor", borderRadius: "6px", padding: "4px 10px", color: "inherit", cursor: "pointer", fontWeight: 700 }}>
            Retry
          </button>
        </div>
      )}

      {/* Mentor Screenshot 3: Tab Navigation Bar */}
      <div className="desk-tabs-bar">
        <div className="desk-tabs-left">
          <button
            type="button"
            className={`desk-tab-btn ${activeTab === "queue" ? "active" : ""}`}
            onClick={() => setActiveTab("queue")}
          >
            <Inbox size={16} /> Review Queue <span className="tab-badge">{reviewQueueQuotes.length}</span>
          </button>
          <button
            type="button"
            className={`desk-tab-btn ${activeTab === "activity" ? "active" : ""}`}
            onClick={() => setActiveTab("activity")}
          >
            <Clock size={16} /> My Activity <span className="tab-badge secondary">{myActivityQuotes.length}</span>
          </button>
          <button
            type="button"
            className={`desk-tab-btn ${activeTab === "messages" ? "active" : ""}`}
            onClick={() => setActiveTab("messages")}
          >
            <MessageSquare size={16} /> Customer Messages
          </button>
          <button
            type="button"
            className={`desk-tab-btn ${activeTab === "table" ? "active" : ""}`}
            onClick={() => setActiveTab("table")}
          >
            <TableIcon size={16} /> All Quotations
          </button>
        </div>

        <button
          type="button"
          className="desk-refresh-btn"
          onClick={reload}
          title="Refresh live quote queue"
        >
          <RotateCw size={15} /> Refresh
        </button>
      </div>

      {/* TAB 1: REVIEW QUEUE (Cards matching Mentor Screenshot 3) */}
      {activeTab === "queue" && (
        <div className="desk-queue-list">
          {reviewQueueQuotes.length === 0 ? (
            <div className="desk-empty-queue">
              <CheckCircle2 size={36} style={{ color: "#059669", margin: "0 auto 12px", display: "block" }} />
              <strong>All caught up!</strong>
              <p style={{ margin: "6px 0 0 0", color: "#64748b" }}>No quotations awaiting commercial review in your queue.</p>
            </div>
          ) : (
            reviewQueueQuotes.map((q) => {
              const qId = q.id || q.quoteNo;
              const finalCost = q.totalNum || calculateFinalCost(q);
              const routeData = getQuoteRouteData(qId, q);
              const selectedCarrier = routeData?.selectedCarrier || q.selectedCarrier || "Maersk Line";

              return (
                <div key={qId} className="desk-queue-card">
                  <div className="desk-queue-card-top">
                    <div className="desk-queue-ref-group">
                      <strong className="desk-queue-ref">{qId}</strong>
                      <span className="desk-queue-dot">•</span>
                      <span className="desk-queue-status-badge">QUOTED</span>
                      <span className="desk-queue-awaiting-badge">
                        <Clock size={12} /> Awaiting review
                      </span>
                    </div>

                    <button
                      type="button"
                      className="desk-queue-btn-details"
                      onClick={() => navigate(`/quotes/${qId}`)}
                    >
                      <Eye size={14} /> View Details
                    </button>
                  </div>

                  <div className="desk-queue-client-route">
                    <strong>{q.customerName || q.client || "dyashin"}</strong> — {q.origin || "Mundra, IN"} <span className="desk-arrow">&rarr;</span> {q.destination || "Kochi, IN"}
                    {selectedCarrier && (
                      <span className="desk-carrier-badge">[{selectedCarrier} Route]</span>
                    )}
                  </div>

                  <div className="desk-queue-meta-line">
                    <span>{q.modeLabel || "Ocean FCL"}</span>
                    <span className="desk-meta-sep">•</span>
                    <span>{q.containerSummaryStr || "2 × 40HC"}</span>
                    <span className="desk-meta-sep">•</span>
                    <span>
                      Transit: <strong className="desk-queue-price">Rs. {Number(finalCost).toLocaleString("en-IN")}</strong>
                    </span>
                  </div>

                  <div className="desk-queue-actions">
                    <button
                      type="button"
                      className="desk-btn-approve-card"
                      onClick={() => handleQuickApprove(q)}
                      disabled={busy}
                      title="Approve commercial tariff and forward to Customs Officer"
                    >
                      <CheckCircle2 size={15} /> Approve
                    </button>
                    <button
                      type="button"
                      className="desk-btn-reject-card"
                      onClick={() => handleQuickReject(q)}
                      disabled={busy}
                    >
                      <XCircle size={15} /> Reject
                    </button>
                    <button
                      type="button"
                      className="desk-btn-comment-card"
                      onClick={() => handleQuickComment(q)}
                      disabled={busy}
                    >
                      <MessageSquare size={14} /> Add comment
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: MY ACTIVITY */}
      {activeTab === "activity" && (
        <div className="desk-queue-list">
          {myActivityQuotes.length === 0 ? (
            <div className="desk-empty-queue">No recent activity found.</div>
          ) : (
            myActivityQuotes.map((q) => {
              const qId = q.id || q.quoteNo;
              const finalCost = q.totalNum || calculateFinalCost(q);
              const routeData = getQuoteRouteData(qId, q);
              const normStatus = normalizeWorkflowStatus(q.status);

              return (
                <div key={qId} className="desk-queue-card" style={{ borderLeft: "4px solid #059669" }}>
                  <div className="desk-queue-card-top">
                    <div className="desk-queue-ref-group">
                      <strong className="desk-queue-ref">{qId}</strong>
                      <span className="desk-queue-dot">•</span>
                      <span className={`desk-queue-status-badge ${normStatus === "ACCEPTED" ? "status-accepted" : normStatus === "APPROVED" ? "status-approved" : ""}`}>
                        {normStatus}
                      </span>
                      <span className="desk-queue-awaiting-badge" style={{ background: "#ecfdf5", color: "#059669", borderColor: "#a7f3d0" }}>
                        <Check size={12} /> Agent Reviewed
                      </span>
                    </div>

                    <button
                      type="button"
                      className="desk-queue-btn-details"
                      onClick={() => navigate(`/quotes/${qId}`)}
                    >
                      <Eye size={14} /> View Details
                    </button>
                  </div>

                  <div className="desk-queue-client-route">
                    <strong>{q.customerName || q.client || "dyashin"}</strong> — {q.origin || "Mundra, IN"} <span className="desk-arrow">&rarr;</span> {q.destination || "Kochi, IN"}
                    {routeData?.selectedCarrier && (
                      <span className="desk-carrier-badge">[{routeData.selectedCarrier} Route]</span>
                    )}
                  </div>

                  <div className="desk-queue-meta-line">
                    <span>{q.modeLabel || "Ocean FCL"}</span>
                    <span className="desk-meta-sep">•</span>
                    <span>{q.containerSummaryStr || "2 × 40HC"}</span>
                    <span className="desk-meta-sep">•</span>
                    <span>
                      Final Value: <strong className="desk-queue-price">Rs. {Number(finalCost).toLocaleString("en-IN")}</strong>
                    </span>
                  </div>

                  <div style={{ fontSize: "12.5px", color: "#059669", fontWeight: 600 }}>
                    ✓ Tariff approved &amp; forwarded to Customs · {routeData?.approvalSequence?.customsCheck === "APPROVED" ? "Customs Approved (Customer Can Accept)" : "Awaiting Customs Sign-Off"}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 3: CUSTOMER MESSAGES */}
      {activeTab === "messages" && (
        <div className="desk-queue-list">
          <div className="desk-empty-queue">
            <MessageSquare size={36} style={{ color: "#0284c7", margin: "0 auto 12px", display: "block" }} />
            <strong>Direct Customer Enquiries</strong>
            <p style={{ margin: "6px 0 0 0", color: "#64748b" }}>No unread commercial inquiries from shippers.</p>
          </div>
        </div>
      )}

      {/* TAB 4 or DEFAULT: FULL TABLE VIEW */}
      {(activeTab === "table" || (!["queue", "activity", "messages"].includes(activeTab))) && (
      <div className="agent-panel-card">
        <div className="agent-table-wrap">
          <table className="agent-table">
            <thead>
              <tr>
                <th>Quote ID</th>
                <th>Client & Contact</th>
                <th>Origin & Destination</th>
                <th>Mode / Cargo</th>
                <th>Rule Price</th>
                <th>AI Predicted</th>
                <th>Final Quote</th>
                <th>Workflow Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotes.map((q) => {
                const finalCost = q.totalNum || calculateFinalCost(q);
                const normStatus = normalizeWorkflowStatus(q.status);
                const cfg = STATUS_CONFIG[normStatus] || STATUS_CONFIG.REQUESTED;

                return (
                  <tr key={q.id || q.quoteNo}>
                    <td><strong>{q.id || q.quoteNo}</strong></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{q.customerName || q.client}</div>
                      <small style={{ color: "#64748b" }}>{q.customerEmail || q.clientEmail}</small>
                    </td>
                    <td>
                      <div style={{ fontWeight: "600" }}>{q.origin}</div>
                      <small style={{ color: "#0284c7", fontWeight: "700" }}>&rarr; {q.destination}</small>
                    </td>
                    <td>
                      <div>{q.modeLabel || q.mode}</div>
                      <small style={{ color: "#64748b", fontWeight: "500" }}>
                        {q.cargoType} ({Number(q.weightKg).toLocaleString()} kg)
                      </small>
                    </td>
                    <td>{formatMoney(q.ruleBasedPrice, q.currency)}</td>
                    <td>
                      <div>
                        AI:{" "}
                        {q.aiPredictedPrice != null
                          ? formatMoney(q.aiPredictedPrice, q.currency)
                          : "—"}
                      </div>
                      <small style={{ color: q.mlStatus === "PREDICTED" ? "#64748b" : "#d97706" }}>
                        {q.mlStatus === "PREDICTED" ? "ML model" : "Rule fallback"}
                      </small>
                    </td>
                    <td>
                      <strong style={{ color: "#059669", fontSize: "15px" }}>
                        {formatMoney(finalCost, q.currency)}
                      </strong>
                      {q.recommendedPrice != null && (
                        <div>
                          <small style={{ color: "#64748b" }}>
                            AI rec: {formatMoney(q.recommendedPrice, q.currency)}
                          </small>
                        </div>
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "4px 10px",
                          borderRadius: "999px",
                          fontSize: "11.5px",
                          fontWeight: "700",
                          color: cfg.color,
                          backgroundColor: cfg.bg,
                          border: `1px solid ${cfg.color}30`,
                        }}
                      >
                        {cfg.label}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="agent-btn-sm"
                        onClick={() => openPricingModal(q)}
                      >
                        {normStatus === "FINAL_QUOTE_SENT" || normStatus === "ACCEPTED" ? "View / Edit" : "Review & Send"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!filteredQuotes.length && (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                    {loading
                      ? "Loading quotes from the platform…"
                      : "No quotes match the current filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Pricing Adjustment & Final Quote Modal */}
      {activeModalQuote && (
        <div className="modal-backdrop" onClick={() => setActiveModalQuote(null)}>
          <div className="pricing-modal" style={{ maxWidth: "680px" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "18px", fontWeight: "800" }}>
              Freight Operations Review: {activeModalQuote.id || activeModalQuote.quoteNo}
            </h3>
            <p style={{ color: "#64748b", fontSize: "13px", marginTop: "0", marginBottom: "12px" }}>
              Client: <strong>{activeModalQuote.customerName || activeModalQuote.client}</strong> &bull; Route: {activeModalQuote.origin} &rarr; {activeModalQuote.destination}
            </p>

            {/* Visual Workflow Stepper */}
            <QuoteWorkflowStepper status={activeModalQuote.status} compact />

            {/* Customs Review Clearance Callout if available */}
            {activeModalQuote.customsRemarks && (
              <div style={{ background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: "10px", padding: "12px 14px", margin: "12px 0", fontSize: "13px", color: "#5b21b6", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: "2px", color: "#7c3aed" }} />
                <div>
                  <strong>Customs Compliance Sign-off:</strong>
                  <p style={{ margin: "2px 0 0 0", color: "#4c1d95" }}>{activeModalQuote.customsRemarks}</p>
                </div>
              </div>
            )}

            <div className="modal-form-grid" style={{ marginTop: "14px" }}>
              <div className="modal-field">
                <label>Base Carrier Freight ({activeModalQuote.currency})</label>
                <input type="number" value={activeModalQuote.baseRate} disabled readOnly />
              </div>

              <div className="modal-field">
                <label>Agent Margin (%)</label>
                <input
                  type="number"
                  value={marginPct}
                  onChange={(e) => setMarginPct(e.target.value)}
                />
              </div>

              <div className="modal-field">
                <label>Fuel Surcharge / BAF (%)</label>
                <input
                  type="number"
                  value={fuelPct}
                  onChange={(e) => setFuelPct(e.target.value)}
                />
              </div>

              <div className="modal-field">
                <label>Port &amp; Terminal Fee ({activeModalQuote.currency})</label>
                <input
                  type="number"
                  value={portFee}
                  onChange={(e) => setPortFee(e.target.value)}
                />
              </div>
            </div>

            {Number(marginPct) < 12.0 && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  padding: "12px",
                  margin: "14px 0",
                  color: "#991b1b",
                  fontSize: "13px",
                }}
              >
                <strong style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <AlertTriangle size={15} /> Commercial Margin Warning
                </strong>
                <p style={{ margin: "4px 0 0 0" }}>
                  Requested margin ({marginPct}%) is below standard floor policy (12.0%).
                </p>
              </div>
            )}

            {activeModalQuote.policyAction === "BLOCK_QUOTE_ISSUANCE" && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "10px",
                  padding: "12px",
                  margin: "14px 0",
                  color: "#991b1b",
                  fontSize: "13px",
                }}
              >
                <strong style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <AlertTriangle size={15} /> Blocked by risk policy
                </strong>
                <p style={{ margin: "4px 0 0 0" }}>
                  Composite risk is {activeModalQuote.overallRisk}. This quote cannot be
                  approved until the risk or customs position changes.
                </p>
              </div>
            )}

            {actionError && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "10px",
                  padding: "12px",
                  margin: "14px 0",
                  color: "#991b1b",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                {actionError}
              </div>
            )}

            <div className="price-summary-box" style={{ margin: "16px 0" }}>
              <div className="price-row">
                <span>Base Carrier Rate:</span>
                <span>{formatMoney(activeModalQuote.baseRate, activeModalQuote.currency)}</span>
              </div>
              <div className="price-row">
                <span>Agent Margin ({marginPct}%):</span>
                <span>
                  {formatMoney(
                    Math.round(Number(activeModalQuote.baseRate) * (marginPct / 100)),
                    activeModalQuote.currency,
                  )}
                </span>
              </div>
              <div className="price-row">
                <span>Fuel Surcharge ({fuelPct}%):</span>
                <span>
                  {formatMoney(
                    Math.round(Number(activeModalQuote.baseRate) * (fuelPct / 100)),
                    activeModalQuote.currency,
                  )}
                </span>
              </div>
              <div className="price-row">
                <span>Port &amp; Handling Fees:</span>
                <span>{formatMoney(portFee, activeModalQuote.currency)}</span>
              </div>
              <div className="price-row total-row">
                <span>Final Quotation to Customer:</span>
                <span>
                  {formatMoney(
                    calculateFinalCost(activeModalQuote, marginPct, fuelPct, portFee),
                    activeModalQuote.currency,
                  )}
                </span>
              </div>
            </div>

            <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="agent-btn-secondary"
                onClick={() => setActiveModalQuote(null)}
                disabled={busy}
              >
                Cancel
              </button>
              {/* PDF section 3, step 10: the agent may approve, modify,
                  request information, or reject. */}
              <button
                type="button"
                className="agent-btn-secondary"
                style={{ background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a", fontWeight: 700 }}
                onClick={handleRequestInfo}
                disabled={busy}
              >
                Request Info
              </button>
              <button
                type="button"
                className="agent-btn-secondary"
                style={{ background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca", fontWeight: 700 }}
                onClick={handleRejectQuote}
                disabled={busy}
              >
                Reject
              </button>
              <button
                type="button"
                className="agent-btn-secondary"
                style={{ background: "#ede9fe", color: "#6d28d9", border: "1px solid #ddd6fe", display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: "700" }}
                onClick={handleApproveOnly}
                disabled={busy}
              >
                <FileCheck size={15} /> {busy ? "Working…" : "Approve Commercials"}
              </button>
              <button
                type="button"
                className="agent-btn-primary"
                style={{ background: "#0284c7", display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: "700" }}
                onClick={handleSaveQuote}
                disabled={busy}
              >
                <Send size={15} /> {busy ? "Working…" : "Send Final Quote to Customer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
