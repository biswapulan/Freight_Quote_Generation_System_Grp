import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Inbox,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  Ship,
  Package,
  ArrowRight,
  RotateCw,
  MessageSquare,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  getVerificationRequest,
  listBookings,
  listVerificationRequests,
  submitVerificationCheck,
  submitVerificationDecision,
} from "../api/workflow";
import "./CompanyAgentPortal.css";

/**
 * The freight company's own desk (milestone 4, section 6).
 *
 * A customer picks one company's offer, and only that company's agents may act
 * on it. Everything here is scoped server-side by company membership, so this
 * screen never has to decide what the agent is allowed to see: if it came back
 * from the API, it belongs to them.
 */

const CHECK_RESULTS = [
  { value: "PASS", label: "Confirmed", tone: "ok" },
  { value: "ATTENTION", label: "Needs attention", tone: "warn" },
  { value: "FAIL", label: "Cannot be met", tone: "bad" },
];

// Wording the agent reads, rather than the raw status the API stores.
const STATUS_LABELS = {
  PENDING_COMPANY_VERIFICATION: "New request",
  UNDER_VERIFICATION: "Being checked",
  AWAITING_CUSTOMER_INFO: "Waiting on customer",
  REVISION_PENDING_CUSTOMER: "Revision sent",
  REVISION_ACCEPTED: "Revision accepted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ESCALATED: "Escalated",
  BOOKING_CONFIRMED: "Booked",
  BOOKING_CANCELLED: "Cancelled",
  RESELECT_QUOTE: "Customer moved on",
};

const STATUS_TONE = {
  PENDING_COMPANY_VERIFICATION: "new",
  UNDER_VERIFICATION: "active",
  AWAITING_CUSTOMER_INFO: "waiting",
  REVISION_PENDING_CUSTOMER: "waiting",
  APPROVED: "ok",
  REVISION_ACCEPTED: "ok",
  BOOKING_CONFIRMED: "ok",
  REJECTED: "bad",
  BOOKING_CANCELLED: "bad",
  ESCALATED: "warn",
  RESELECT_QUOTE: "muted",
};

const TABS = [
  { key: "incoming", label: "Incoming requests" },
  { key: "verifying", label: "Being checked" },
  { key: "manager", label: "With manager" },
  { key: "waiting", label: "Waiting on customer" },
  { key: "settled", label: "Approved & rejected" },
  { key: "bookings", label: "Bookings" },
];

function money(amount, currency) {
  const value = Number(amount || 0);
  const symbol = currency === "INR" ? "₹ " : `${currency || ""} `;
  return `${symbol}${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function hoursAgo(iso) {
  if (!iso) return null;
  const diff = (Date.now() - new Date(iso).getTime()) / 36e5;
  if (diff < 1) return `${Math.max(1, Math.round(diff * 60))}m ago`;
  if (diff < 24) return `${Math.round(diff)}h ago`;
  return `${Math.round(diff / 24)}d ago`;
}

export default function CompanyAgentPortal({ initialTab = "incoming" }) {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [requests, setRequests] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  // Companies the signed-in agent manages; escalations there are theirs to decide.
  const [managerOf, setManagerOf] = useState([]);

  const [openRef, setOpenRef] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // Decision composer state
  const [decisionAction, setDecisionAction] = useState(null);
  const [reason, setReason] = useState("");
  const [revisedPrice, setRevisedPrice] = useState("");
  const [revisedTransit, setRevisedTransit] = useState("");
  const [infoItems, setInfoItems] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [reqData, bookData] = await Promise.all([
        listVerificationRequests(token),
        listBookings(token).catch(() => ({ results: [] })),
      ]);
      setRequests(reqData.results || []);
      setManagerOf(reqData.viewer?.managerOf || []);
      setBookings(bookData.results || []);
    } catch (err) {
      setError(err.message || "Could not load your queue.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const buckets = useMemo(() => {
    const incoming = requests.filter(
      (r) => r.status === "PENDING_COMPANY_VERIFICATION",
    );
    const verifying = requests.filter((r) => r.status === "UNDER_VERIFICATION");
    // Escalated requests wait for a manager, so they get a list of their own.
    const manager = requests.filter((r) => r.status === "ESCALATED");
    const waiting = requests.filter((r) =>
      ["AWAITING_CUSTOMER_INFO", "REVISION_PENDING_CUSTOMER"].includes(r.status),
    );
    const settled = requests.filter((r) =>
      ["APPROVED", "REJECTED", "REVISION_ACCEPTED", "BOOKING_CONFIRMED",
       "BOOKING_CANCELLED", "RESELECT_QUOTE"].includes(r.status),
    );
    return { incoming, verifying, manager, waiting, settled };
  }, [requests]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const decidedToday = requests.filter(
      (r) => r.decidedAt && new Date(r.decidedAt).toDateString() === today,
    );
    const responded = requests.filter((r) => r.responseHours != null);
    const avg = responded.length
      ? responded.reduce((s, r) => s + r.responseHours, 0) / responded.length
      : null;
    return {
      incoming: buckets.incoming.length,
      verifying: buckets.verifying.length,
      approvedToday: decidedToday.filter((r) =>
        ["APPROVED", "BOOKING_CONFIRMED"].includes(r.status),
      ).length,
      rejectedToday: decidedToday.filter((r) => r.status === "REJECTED").length,
      overdue: requests.filter((r) => r.isOverdue).length,
      avgResponse: avg,
    };
  }, [requests, buckets]);

  const openRequest = useCallback(
    async (reference) => {
      setOpenRef(reference);
      setDetail(null);
      setDetailLoading(true);
      resetComposer();
      try {
        const data = await getVerificationRequest(token, reference);
        setDetail(data);
      } catch (err) {
        setError(err.message || "Could not open that request.");
        setOpenRef(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [token],
  );

  function resetComposer() {
    setDecisionAction(null);
    setReason("");
    setRevisedPrice("");
    setRevisedTransit("");
    setInfoItems("");
  }

  function closeDetail() {
    setOpenRef(null);
    setDetail(null);
    resetComposer();
    load();
  }

  async function recordCheck(area, result) {
    if (!detail || busy) return;
    let remarks = "";
    if (result === "FAIL" || result === "ATTENTION") {
      remarks =
        window.prompt(
          `Why is this ${result === "FAIL" ? "not possible" : "a concern"}? ` +
            "The customer sees this if it leads to a rejection or a revision.",
        ) || "";
      if (!remarks.trim()) {
        setNotice({ type: "error", text: "A flagged check needs an explanation." });
        return;
      }
    }
    setBusy(true);
    try {
      await submitVerificationCheck(token, detail.reference, {
        area,
        result,
        remarks,
      });
      const fresh = await getVerificationRequest(token, detail.reference);
      setDetail(fresh);
    } catch (err) {
      setNotice({ type: "error", text: err.message || "Could not record that check." });
    } finally {
      setBusy(false);
    }
  }

  async function sendDecision() {
    if (!detail || !decisionAction || busy) return;

    if (!reason.trim()) {
      setNotice({ type: "error", text: "A reason is required. The customer reads it." });
      return;
    }

    const payload = { action: decisionAction, reason: reason.trim() };

    if (decisionAction === "MODIFY") {
      const price = Number(revisedPrice);
      if (!price || price <= 0) {
        setNotice({ type: "error", text: "Enter the revised total price." });
        return;
      }
      payload.revision = {
        total_price: price,
        transit_days: revisedTransit ? Number(revisedTransit) : undefined,
      };
    }

    if (decisionAction === "REQUEST_INFO") {
      const items = infoItems
        .split("\n")
        .map((i) => i.trim())
        .filter(Boolean);
      if (!items.length) {
        setNotice({ type: "error", text: "List what the customer must provide." });
        return;
      }
      payload.requestedInformation = items;
    }

    setBusy(true);
    try {
      const updated = await submitVerificationDecision(token, detail.reference, payload);
      setDetail(updated);
      resetComposer();
      setNotice({
        type: "success",
        text:
          updated.status === "ESCALATED" && decisionAction !== "ESCALATE"
            ? "This needs a manager, so it has gone to your company's manager for approval. The customer has been told it is under review."
            : `Recorded as ${STATUS_LABELS[updated.status] || updated.status}. The customer has been told.`,
      });
      load();
    } catch (err) {
      setNotice({ type: "error", text: err.message || "Could not record that decision." });
    } finally {
      setBusy(false);
    }
  }

  const visible =
    activeTab === "incoming"
      ? buckets.incoming
      : activeTab === "verifying"
      ? buckets.verifying
      : activeTab === "manager"
      ? buckets.manager
      : activeTab === "waiting"
      ? buckets.waiting
      : activeTab === "settled"
      ? buckets.settled
      : [];

  return (
    <div className="cap-page">
      <header className="cap-header">
        <div>
          <p className="cap-eyebrow">Freight company desk</p>
          <h1 className="cap-title">Verification &amp; Booking</h1>
          <p className="cap-sub">
            Requests where a customer chose your company. Only your company&apos;s
            agents can see or act on these.
          </p>
        </div>
        <button type="button" className="cap-refresh" onClick={load} disabled={loading}>
          <RotateCw size={14} className={loading ? "cap-spin" : ""} /> Refresh
        </button>
      </header>

      {error && <div className="cap-banner error">{error}</div>}
      {notice && <div className={`cap-banner ${notice.type}`}>{notice.text}</div>}

      <div className="cap-kpis">
        <Kpi icon={<Inbox size={18} />} tone="new" label="New requests" value={stats.incoming} />
        <Kpi icon={<ShieldCheck size={18} />} tone="active" label="Being checked" value={stats.verifying} />
        <Kpi icon={<CheckCircle2 size={18} />} tone="ok" label="Approved today" value={stats.approvedToday} />
        <Kpi icon={<XCircle size={18} />} tone="bad" label="Rejected today" value={stats.rejectedToday} />
        <Kpi
          icon={<Clock size={18} />}
          tone={stats.overdue ? "warn" : "muted"}
          label="Past SLA"
          value={stats.overdue}
        />
        <Kpi
          icon={<TrendingUp size={18} />}
          tone="muted"
          label="Avg response"
          value={stats.avgResponse == null ? "—" : `${stats.avgResponse.toFixed(1)}h`}
        />
      </div>

      <div className="cap-tabs">
        {TABS.map((t) => {
          const count =
            t.key === "bookings" ? bookings.length : (buckets[t.key] || []).length;
          return (
            <button
              key={t.key}
              type="button"
              className={`cap-tab${activeTab === t.key ? " active" : ""}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.key === "manager" && managerOf.length ? "Needs your approval" : t.label}
              <span className="cap-tab-count">{count}</span>
            </button>
          );
        })}
      </div>

      {activeTab === "bookings" ? (
        <BookingsTable bookings={bookings} loading={loading} />
      ) : (
        <RequestsTable
          rows={visible}
          loading={loading}
          onOpen={openRequest}
          emptyLabel={
            activeTab === "incoming"
              ? "No new requests. When a customer picks your company, it lands here."
              : activeTab === "manager"
              ? managerOf.length
                ? "Nothing is waiting for your approval."
                : "No requests are with a manager. High-value and high-risk approvals go here."
              : "Nothing in this list right now."
          }
        />
      )}

      {openRef && (
        <RequestDetail
          detail={detail}
          loading={detailLoading}
          busy={busy}
          agentName={user?.full_name}
          onClose={closeDetail}
          onCheck={recordCheck}
          decisionAction={decisionAction}
          setDecisionAction={setDecisionAction}
          reason={reason}
          setReason={setReason}
          revisedPrice={revisedPrice}
          setRevisedPrice={setRevisedPrice}
          revisedTransit={revisedTransit}
          setRevisedTransit={setRevisedTransit}
          infoItems={infoItems}
          setInfoItems={setInfoItems}
          onSend={sendDecision}
        />
      )}
    </div>
  );
}

function Kpi({ icon, label, value, tone }) {
  return (
    <div className={`cap-kpi ${tone}`}>
      <span className="cap-kpi-icon">{icon}</span>
      <span className="cap-kpi-body">
        <span className="cap-kpi-value">{value}</span>
        <span className="cap-kpi-label">{label}</span>
      </span>
    </div>
  );
}

function StatusPill({ status }) {
  return (
    <span className={`cap-pill ${STATUS_TONE[status] || "muted"}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function RequestsTable({ rows, loading, onOpen, emptyLabel }) {
  if (loading) return <div className="cap-empty">Loading your queue...</div>;
  if (!rows.length) return <div className="cap-empty">{emptyLabel}</div>;

  return (
    <div className="cap-card">
      <table className="cap-table">
        <thead>
          <tr>
            <th>Request</th>
            <th>Customer &amp; lane</th>
            <th>Cargo</th>
            <th>Offer</th>
            <th>Status</th>
            <th>Received</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const sel = r.selection || {};
            return (
              <tr key={r.id} className={r.isOverdue ? "cap-row-overdue" : ""}>
                <td>
                  <strong className="cap-ref">{r.reference}</strong>
                  <span className="cap-sub-line">{sel.reference}</span>
                </td>
                <td>
                  <span className="cap-strong">{sel.customer_email || "—"}</span>
                  <span className="cap-sub-line">{sel.shipmentId}</span>
                </td>
                <td className="cap-muted">{sel.quoteId}</td>
                <td>
                  <strong>
                    {money(sel.selectedTotalPrice, sel.selectedCurrency)}
                  </strong>
                  <span className="cap-sub-line">
                    {sel.selectedTransitDays} days
                  </span>
                </td>
                <td>
                  <StatusPill status={r.status} />
                  {r.isOverdue && (
                    <span className="cap-overdue">
                      <AlertTriangle size={11} /> past SLA
                    </span>
                  )}
                </td>
                <td className="cap-muted">{hoursAgo(r.created_at)}</td>
                <td>
                  <button
                    type="button"
                    className="cap-open"
                    onClick={() => onOpen(r.reference)}
                  >
                    Open <ArrowRight size={13} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BookingsTable({ bookings, loading }) {
  if (loading) return <div className="cap-empty">Loading...</div>;
  if (!bookings.length)
    return <div className="cap-empty">No bookings yet. Approving a request creates one.</div>;

  return (
    <div className="cap-card">
      <table className="cap-table">
        <thead>
          <tr>
            <th>Booking</th>
            <th>Customer</th>
            <th>Lane</th>
            <th>Agreed</th>
            <th>Transit</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b.id}>
              <td>
                <strong className="cap-ref">{b.reference}</strong>
                {b.wasRevised && <span className="cap-tag">revised</span>}
              </td>
              <td className="cap-muted">{b.customer_email}</td>
              <td className="cap-muted">
                {b.origin} &rarr; {b.destination}
              </td>
              <td>
                <strong>{money(b.agreedTotalPrice, b.agreedCurrency)}</strong>
              </td>
              <td className="cap-muted">{b.agreedTransitDays} d</td>
              <td>
                <span className={`cap-pill ${b.status === "CONFIRMED" ? "ok" : "bad"}`}>
                  {b.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RequestDetail(props) {
  const {
    detail,
    loading,
    busy,
    onClose,
    onCheck,
    decisionAction,
    setDecisionAction,
    reason,
    setReason,
    revisedPrice,
    setRevisedPrice,
    revisedTransit,
    setRevisedTransit,
    infoItems,
    setInfoItems,
    onSend,
  } = props;

  const sel = detail?.selection || {};
  const checks = detail?.checks || [];
  const done = checks.filter((c) => c.result !== "PENDING").length;
  const blocking = checks.filter((c) => c.result === "FAIL");
  // Whether the request is still open comes from its status, not from whether
  // anyone has decided before: an escalation is a decision, but the manager
  // still has to act on it.
  const actionable = ["PENDING_COMPANY_VERIFICATION", "UNDER_VERIFICATION", "ESCALATED"].includes(
    detail?.status,
  );
  const decided = !actionable;
  const escalated = detail?.status === "ESCALATED";
  const canCheck = detail?.canCheck ?? actionable;
  const canDecide = detail?.canDecide ?? actionable;

  return (
    <div className="cap-modal-backdrop" onClick={onClose}>
      <div className="cap-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cap-modal-head">
          <div>
            <span className="cap-eyebrow">Verification request</span>
            <h2>{detail?.reference || "Loading..."}</h2>
            {detail && <StatusPill status={detail.status} />}
          </div>
          <button type="button" className="cap-close" onClick={onClose}>
            Close
          </button>
        </div>

        {loading || !detail ? (
          <div className="cap-empty">Opening the request...</div>
        ) : (
          <div className="cap-modal-body">
            <section className="cap-facts">
              <Fact icon={<Ship size={14} />} label="Shipment" value={sel.shipmentId} />
              <Fact icon={<FileText size={14} />} label="Quote" value={sel.quoteId} />
              <Fact
                icon={<Package size={14} />}
                label="Customer"
                value={sel.customer_email}
              />
              <Fact
                icon={<CheckCircle2 size={14} />}
                label="Offer selected"
                value={`${money(sel.selectedTotalPrice, sel.selectedCurrency)} · ${sel.selectedTransitDays} days`}
              />
            </section>

            <AiAnalysis insights={detail.aiInsights} />

            <DocumentsOnFile documents={detail.documents} />

            {detail.requestedInformation?.length > 0 && (
              <div className="cap-note info">
                <MessageSquare size={15} />
                <div>
                  <strong>You asked the customer for:</strong>
                  <ul>
                    {detail.requestedInformation.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {detail.revisions?.length > 0 && (
              <div className="cap-note warn">
                <AlertTriangle size={15} />
                <div>
                  <strong>Revisions</strong>
                  {detail.revisions.map((rev) => (
                    <div key={rev.id} className="cap-rev-line">
                      #{rev.revisionNumber} {money(rev.originalTotalPrice, rev.currency)}{" "}
                      &rarr; {money(rev.revisedTotalPrice, rev.currency)} (
                      {rev.priceDeltaPct > 0 ? "+" : ""}
                      {rev.priceDeltaPct}%) &mdash; {rev.status.toLowerCase()}
                      <span className="cap-sub-line">{rev.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <section className="cap-checklist">
              <div className="cap-checklist-head">
                <h3>Verification checklist</h3>
                <span className="cap-muted">
                  {done} of {checks.length} checked
                  {blocking.length ? ` · ${blocking.length} blocking` : ""}
                </span>
              </div>
              {checks.map((c) => (
                <div key={c.id} className={`cap-check ${c.result.toLowerCase()}`}>
                  <div className="cap-check-text">
                    <strong>{c.area}</strong>
                    <span>{c.prompt}</span>
                    {c.remarks && <em className="cap-check-remark">{c.remarks}</em>}
                  </div>
                  <div className="cap-check-actions">
                    {CHECK_RESULTS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`cap-check-btn ${opt.tone}${c.result === opt.value ? " on" : ""}`}
                        disabled={busy || !canCheck}
                        onClick={() => onCheck(c.area, opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            {decided ? (
              <div className="cap-note ok">
                <CheckCircle2 size={15} />
                <div>
                  <strong>Decided.</strong> {detail.decision_reason}
                  <span className="cap-sub-line">
                    by {detail.assignedAgent} &middot;{" "}
                    {detail.responseHours != null
                      ? `${detail.responseHours}h response`
                      : ""}
                  </span>
                </div>
              </div>
            ) : !canDecide ? (
              <div className="cap-note info">
                <ShieldCheck size={15} />
                <div>
                  {escalated ? (
                    <>
                      <strong>Waiting for a {detail.companyName} manager.</strong>{" "}
                      {detail.decision_reason}
                      <span className="cap-sub-line">
                        A manager approves, revises or rejects it. You can still record checks.
                      </span>
                    </>
                  ) : (
                    <strong>You can view this request but not decide it.</strong>
                  )}
                </div>
              </div>
            ) : (
              <section className="cap-decide">
                <h3>Your decision</h3>
                {escalated && (
                  <div className="cap-note warn">
                    <ShieldCheck size={15} />
                    <div>
                      <strong>Escalated to you for manager approval.</strong>{" "}
                      {detail.decision_reason}
                    </div>
                  </div>
                )}
                <div className="cap-actions">
                  {[
                    ["APPROVE", "Approve", "ok"],
                    ["MODIFY", "Revise terms", "warn"],
                    ["REQUEST_INFO", "Request info", "info"],
                    ["ESCALATE", "Escalate", "info"],
                    ["REJECT", "Reject", "bad"],
                  ]
                    // A manager settles an escalation; it cannot be escalated again.
                    .filter(([value]) => !escalated || ["APPROVE", "MODIFY", "REJECT"].includes(value))
                    .map(([value, label, tone]) => (
                    <button
                      key={value}
                      type="button"
                      className={`cap-action ${tone}${decisionAction === value ? " on" : ""}`}
                      onClick={() => setDecisionAction(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {decisionAction && (
                  <div className="cap-composer">
                    {decisionAction === "MODIFY" && (
                      <div className="cap-fields">
                        <label>
                          Revised total ({sel.selectedCurrency})
                          <input
                            type="number"
                            value={revisedPrice}
                            placeholder={String(sel.selectedTotalPrice ?? "")}
                            onChange={(e) => setRevisedPrice(e.target.value)}
                          />
                        </label>
                        <label>
                          Revised transit (days)
                          <input
                            type="number"
                            value={revisedTransit}
                            placeholder={String(sel.selectedTransitDays ?? "")}
                            onChange={(e) => setRevisedTransit(e.target.value)}
                          />
                        </label>
                      </div>
                    )}

                    {decisionAction === "REQUEST_INFO" && (
                      <label className="cap-field-block">
                        What must the customer provide? One per line.
                        <textarea
                          rows={3}
                          value={infoItems}
                          placeholder={"Commercial invoice\nPacking list with per-carton weights"}
                          onChange={(e) => setInfoItems(e.target.value)}
                        />
                      </label>
                    )}

                    <label className="cap-field-block">
                      Reason (the customer reads this)
                      <textarea
                        rows={2}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Explain your decision in a sentence."
                      />
                    </label>

                    <button
                      type="button"
                      className="cap-send"
                      onClick={onSend}
                      disabled={busy}
                    >
                      {busy ? "Recording..." : "Submit decision"}
                    </button>
                  </div>
                )}
              </section>
            )}

            {detail.history?.length > 0 && (
              <section className="cap-history">
                <h3>History</h3>
                {detail.history.map((h) => (
                  <div key={h.id} className="cap-history-row">
                    <span className="cap-muted">
                      {STATUS_LABELS[h.newStatus] || h.newStatus}
                    </span>
                    <span className="cap-history-reason">{h.reason}</span>
                    <span className="cap-muted">{h.changedBy}</span>
                  </div>
                ))}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Fact({ icon, label, value }) {
  return (
    <div className="cap-fact">
      <span className="cap-fact-label">
        {icon} {label}
      </span>
      <span className="cap-fact-value">{value || "—"}</span>
    </div>
  );
}

const RISK_BARS = [
  ["weather", "Weather"],
  ["customs", "Customs"],
  ["route", "Route"],
];

function scoreTone(score) {
  if (score >= 67) return "high";
  if (score >= 34) return "medium";
  return "low";
}

function signedPct(pct) {
  return `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct)}%`;
}

/**
 * What M2 and M3 concluded about this shipment. The checklist asks the agent
 * to weigh the commercial terms and the weather, customs and route risk; this
 * is the analysis those checks are about, so it sits right above them.
 */
function AiAnalysis({ insights }) {
  if (!insights) return null;
  const risk = insights.risk || {};

  return (
    <section className="cap-ai">
      <div className="cap-ai-head">
        <h3>
          <Sparkles size={15} /> AI analysis of this shipment
        </h3>
        {risk.overallLevel && (
          <span className={`cap-risk ${risk.overallLevel.toLowerCase()}`}>
            {risk.overallLevel} risk
            {risk.overallScore != null ? ` · ${Math.round(risk.overallScore)}/100` : ""}
          </span>
        )}
      </div>

      <div className="cap-facts">
        <Fact
          label="Standard rate"
          value={insights.standardPrice != null ? money(insights.standardPrice, "INR") : null}
        />
        <Fact
          label="AI predicted"
          value={
            insights.aiPredictedPrice != null
              ? money(insights.aiPredictedPrice, "INR")
              : "Model unavailable"
          }
        />
        <Fact
          label="AI recommended"
          value={insights.recommendedPrice != null ? money(insights.recommendedPrice, "INR") : null}
        />
      </div>

      <p className="cap-ai-line">
        {insights.offerAdjustmentPct != null
          ? `The AI market rate for this lane moved this offer's freight rate ${signedPct(insights.offerAdjustmentPct)} from your rate card${
              insights.riskPremiumPct
                ? `, including a ${insights.riskPremiumPct}% loading for ${risk.overallLevel} risk`
                : ""
            }.`
          : "This offer was priced from your rate card alone, before the AI market rate applied."}
      </p>

      <div className="cap-ai-bars">
        {RISK_BARS.map(([key, label]) => {
          const score = risk[key]?.score;
          if (score == null) return null;
          return (
            <div key={key} className="cap-ai-bar" title={risk[key]?.summary || ""}>
              <span>{label}</span>
              <span className="cap-ai-track">
                <span
                  className={`cap-ai-fill ${scoreTone(score)}`}
                  style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                />
              </span>
              <strong>{Math.round(score)}/100</strong>
            </div>
          );
        })}
      </div>

      {risk.summary && <p className="cap-ai-line">{risk.summary}</p>}
      {insights.alerts?.length > 0 && (
        <ul className="cap-ai-alerts">
          {insights.alerts.map((alert) => (
            <li key={alert}>{alert}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

const DOC_TONE = { VERIFIED: "ok", REJECTED: "bad" };

/** The paperwork behind the DOCUMENTS check: what the customer has uploaded. */
function DocumentsOnFile({ documents }) {
  if (!documents) return null;
  return (
    <section className="cap-docs">
      <h3>
        <FileText size={14} /> Documents on file
      </h3>
      {documents.length === 0 ? (
        <p className="cap-muted">
          The customer has not uploaded any documents for this shipment yet.
        </p>
      ) : (
        <ul>
          {documents.map((doc) => (
            <li key={doc.id}>
              <span className="cap-doc-type">{doc.documentType}</span>
              {doc.fileUrl ? (
                <a href={doc.fileUrl} target="_blank" rel="noreferrer">
                  {doc.fileName}
                </a>
              ) : (
                <span>{doc.fileName}</span>
              )}
              <span className={`cap-pill ${DOC_TONE[doc.status] || "waiting"}`}>
                {(doc.status || "pending").toLowerCase()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
