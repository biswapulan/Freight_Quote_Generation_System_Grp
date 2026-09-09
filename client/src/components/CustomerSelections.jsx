import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  RotateCw,
  Ship,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  listBookings,
  listMySelections,
  provideSelectionInformation,
  respondToRevision,
} from "../api/workflow";
import "./CustomerSelections.css";

/**
 * Where the customer tracks the company they chose (milestone 4, section 6).
 *
 * Selecting a company is a request, not a booking. This screen shows what that
 * company is doing with it, and puts the two things the customer may be asked
 * for, accepting a revised price and supplying missing paperwork, in front of
 * them rather than leaving them to wonder.
 */

const STAGES = [
  { key: "QUOTE_SELECTED", label: "Selected" },
  { key: "PENDING_COMPANY_VERIFICATION", label: "Sent to company" },
  { key: "UNDER_VERIFICATION", label: "Being checked" },
  { key: "APPROVED", label: "Approved" },
  { key: "BOOKING_CONFIRMED", label: "Booked" },
];

const EXPLAIN = {
  QUOTE_SELECTED: "You picked this company. We are passing it to them now.",
  PENDING_COMPANY_VERIFICATION:
    "Waiting for the company to pick up your request.",
  UNDER_VERIFICATION:
    "The company is checking capacity, route, documents and price.",
  AWAITING_CUSTOMER_INFO: "The company needs something from you before it can go further.",
  REVISION_PENDING_CUSTOMER:
    "The company has proposed different terms. Accept them, or choose another company.",
  REVISION_ACCEPTED: "You accepted the revised terms.",
  APPROVED: "The company has approved your shipment.",
  REJECTED: "This company cannot carry the shipment. You can choose another.",
  ESCALATED: "The company is getting internal approval for this one.",
  BOOKING_CONFIRMED: "Confirmed. Your booking reference is below.",
  BOOKING_CANCELLED: "This booking was cancelled.",
  RESELECT_QUOTE: "Closed. You can pick another company for this shipment.",
};

const TONE = {
  APPROVED: "ok",
  REVISION_ACCEPTED: "ok",
  BOOKING_CONFIRMED: "ok",
  REJECTED: "bad",
  BOOKING_CANCELLED: "bad",
  RESELECT_QUOTE: "muted",
  AWAITING_CUSTOMER_INFO: "warn",
  REVISION_PENDING_CUSTOMER: "warn",
  ESCALATED: "warn",
};

function money(amount, currency) {
  const value = Number(amount || 0);
  return `${currency === "INR" ? "₹ " : `${currency || ""} `}${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function CustomerSelections() {
  const { token } = useAuth();
  const [selections, setSelections] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(null);

  const [revisionFor, setRevisionFor] = useState(null);
  const [infoFor, setInfoFor] = useState(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [sel, book] = await Promise.all([
        listMySelections(token),
        listBookings(token).catch(() => ({ results: [] })),
      ]);
      setSelections(sel.results || []);
      setBookings(book.results || []);
    } catch (err) {
      setError(err.message || "Could not load your selections.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const bookingFor = (reference) =>
    bookings.find((b) => b.selectionReference === reference);

  async function answerRevision(decision) {
    if (!revisionFor || busy) return;
    if (decision === "DECLINE" && !note.trim()) {
      setNotice({ type: "error", text: "Tell the company why you are declining." });
      return;
    }
    setBusy(revisionFor.reference);
    try {
      const res = await respondToRevision(token, revisionFor.reference, {
        decision,
        note: note.trim(),
      });
      setNotice({
        type: decision === "ACCEPT" ? "success" : "info",
        text:
          decision === "ACCEPT"
            ? "Revised terms accepted. Your booking is being confirmed."
            : "Declined. You can now choose another company for this shipment.",
      });
      setRevisionFor(null);
      setNote("");
      await load();
      return res;
    } catch (err) {
      setNotice({ type: "error", text: err.message || "Could not record your response." });
    } finally {
      setBusy(null);
    }
  }

  async function sendInformation() {
    if (!infoFor || busy) return;
    if (!note.trim()) {
      setNotice({ type: "error", text: "Describe what you are providing." });
      return;
    }
    setBusy(infoFor.reference);
    try {
      await provideSelectionInformation(token, infoFor.reference, {
        note: note.trim(),
      });
      setNotice({
        type: "success",
        text: "Sent. The company will pick your request back up.",
      });
      setInfoFor(null);
      setNote("");
      await load();
    } catch (err) {
      setNotice({ type: "error", text: err.message || "Could not send that." });
    } finally {
      setBusy(null);
    }
  }

  const needsYou = selections.filter((s) => s.awaitingYou);

  return (
    <div className="csel-page">
      <header className="csel-header">
        <div>
          <p className="csel-eyebrow">Shipments / Selected quotes</p>
          <h1 className="csel-title">Your selected companies</h1>
          <p className="csel-sub">
            Picking a company starts their verification. This is where you see what
            they decided, and answer anything they need.
          </p>
        </div>
        <div className="csel-head-actions">
          <button type="button" className="csel-refresh" onClick={load} disabled={loading}>
            <RotateCw size={14} className={loading ? "csel-spin" : ""} /> Refresh
          </button>
          <Link to="/dashboard/request-quote" className="csel-primary">
            + New enquiry
          </Link>
        </div>
      </header>

      {error && <div className="csel-banner error">{error}</div>}
      {notice && <div className={`csel-banner ${notice.type}`}>{notice.text}</div>}

      {needsYou.length > 0 && (
        <div className="csel-banner warn">
          <AlertTriangle size={16} />
          {needsYou.length} {needsYou.length === 1 ? "request needs" : "requests need"} your
          response below.
        </div>
      )}

      {loading ? (
        <div className="csel-empty">Loading...</div>
      ) : selections.length === 0 ? (
        <div className="csel-empty">
          You have not selected a company yet. Raise an enquiry, compare the offers,
          and pick one.
        </div>
      ) : (
        <div className="csel-list">
          {selections.map((s) => {
            const booking = bookingFor(s.reference);
            const tone = TONE[s.status] || "active";
            return (
              <article key={s.id} className={`csel-card ${tone}`}>
                <div className="csel-card-head">
                  <div>
                    <span className="csel-company">{s.companyName}</span>
                    <span className="csel-ref">{s.reference}</span>
                  </div>
                  <span className={`csel-pill ${tone}`}>
                    {s.status.replaceAll("_", " ").toLowerCase()}
                  </span>
                </div>

                <p className="csel-explain">{EXPLAIN[s.status] || ""}</p>

                <Progress status={s.status} />

                <div className="csel-terms">
                  <Term label="You selected" value={money(s.selectedTotalPrice, s.selectedCurrency)} />
                  <Term label="Transit" value={`${s.selectedTransitDays ?? "—"} days`} />
                  <Term label="Shipment" value={s.shipmentId} />
                  {s.priceChanged && (
                    <Term label="Agreed after revision" value="see below" tone="warn" />
                  )}
                </div>

                {s.pendingRevision && (
                  <div className="csel-revision">
                    <div className="csel-revision-head">
                      <AlertTriangle size={16} />
                      <strong>{s.companyName} proposed different terms</strong>
                    </div>
                    <div className="csel-compare">
                      <div>
                        <span className="csel-compare-label">You selected</span>
                        <span className="csel-compare-old">
                          {money(s.pendingRevision.originalTotalPrice, s.pendingRevision.currency)}
                        </span>
                        <span className="csel-compare-sub">
                          {s.pendingRevision.originalTransitDays} days
                        </span>
                      </div>
                      <ArrowRight size={18} className="csel-compare-arrow" />
                      <div>
                        <span className="csel-compare-label">They now offer</span>
                        <span className="csel-compare-new">
                          {money(s.pendingRevision.revisedTotalPrice, s.pendingRevision.currency)}
                        </span>
                        <span className="csel-compare-sub">
                          {s.pendingRevision.revisedTransitDays} days
                        </span>
                      </div>
                      <span
                        className={`csel-delta ${s.pendingRevision.priceDelta > 0 ? "up" : "down"}`}
                      >
                        {s.pendingRevision.priceDelta > 0 ? "+" : ""}
                        {s.pendingRevision.priceDeltaPct}%
                      </span>
                    </div>
                    <p className="csel-reason">
                      <strong>Their reason:</strong> {s.pendingRevision.reason}
                    </p>
                    <button
                      type="button"
                      className="csel-primary"
                      onClick={() => {
                        setRevisionFor(s);
                        setNote("");
                      }}
                    >
                      Review this revision
                    </button>
                  </div>
                )}

                {s.status === "AWAITING_CUSTOMER_INFO" && (
                  <div className="csel-info-request">
                    <p>
                      {s.companyName} needs more from you before they can confirm.
                    </p>
                    <button
                      type="button"
                      className="csel-primary"
                      onClick={() => {
                        setInfoFor(s);
                        setNote("");
                      }}
                    >
                      Respond
                    </button>
                  </div>
                )}

                {booking && (
                  <div className="csel-booking">
                    <ShieldCheck size={16} />
                    <div>
                      <strong>Booking {booking.reference}</strong>
                      <span className="csel-compare-sub">
                        {money(booking.agreedTotalPrice, booking.agreedCurrency)} ·{" "}
                        {booking.agreedTransitDays} days · {booking.status.toLowerCase()}
                      </span>
                    </div>
                  </div>
                )}

                {(s.status === "REJECTED" || s.status === "RESELECT_QUOTE") && (
                  <Link
                    to="/dashboard/my-quotes"
                    className="csel-secondary"
                  >
                    Choose another company <ArrowRight size={13} />
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      )}

      {revisionFor && (
        <Modal
          title={`${revisionFor.companyName} revised your quote`}
          onClose={() => setRevisionFor(null)}
        >
          <p className="csel-modal-text">
            Accepting takes the new terms and confirms your booking. Declining does
            not cancel your shipment: you can pick another company.
          </p>
          <div className="csel-compare boxed">
            <div>
              <span className="csel-compare-label">You selected</span>
              <span className="csel-compare-old">
                {money(revisionFor.pendingRevision.originalTotalPrice, revisionFor.pendingRevision.currency)}
              </span>
            </div>
            <ArrowRight size={18} className="csel-compare-arrow" />
            <div>
              <span className="csel-compare-label">They now offer</span>
              <span className="csel-compare-new">
                {money(revisionFor.pendingRevision.revisedTotalPrice, revisionFor.pendingRevision.currency)}
              </span>
            </div>
          </div>
          <label className="csel-field">
            Note to the company (required if you decline)
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional if accepting."
            />
          </label>
          <div className="csel-modal-actions">
            <button
              type="button"
              className="csel-decline"
              disabled={Boolean(busy)}
              onClick={() => answerRevision("DECLINE")}
            >
              <XCircle size={15} /> Decline and look elsewhere
            </button>
            <button
              type="button"
              className="csel-primary"
              disabled={Boolean(busy)}
              onClick={() => answerRevision("ACCEPT")}
            >
              <CheckCircle2 size={15} /> Accept revised terms
            </button>
          </div>
        </Modal>
      )}

      {infoFor && (
        <Modal
          title={`${infoFor.companyName} needs more information`}
          onClose={() => setInfoFor(null)}
        >
          <p className="csel-modal-text">
            Describe what you are supplying. Upload any files in Documents first, then
            tell them here. Your request goes straight back to their desk.
          </p>
          <label className="csel-field">
            Your response
            <textarea
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Uploaded the commercial invoice and packing list to Documents."
            />
          </label>
          <div className="csel-modal-actions">
            <button type="button" className="csel-secondary" onClick={() => setInfoFor(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="csel-primary"
              disabled={Boolean(busy)}
              onClick={sendInformation}
            >
              Send to {infoFor.companyName}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Progress({ status }) {
  // Off-path states get their own note rather than a misleading position on
  // the happy path.
  const offPath = ["REJECTED", "BOOKING_CANCELLED", "RESELECT_QUOTE"].includes(status);
  if (offPath) return null;

  const order = STAGES.map((s) => s.key);
  let reached = order.indexOf(status);
  if (status === "REVISION_PENDING_CUSTOMER" || status === "AWAITING_CUSTOMER_INFO") {
    reached = order.indexOf("UNDER_VERIFICATION");
  }
  if (status === "REVISION_ACCEPTED" || status === "ESCALATED") {
    reached = order.indexOf("UNDER_VERIFICATION");
  }

  return (
    <ol className="csel-progress">
      {STAGES.map((stage, i) => (
        <li
          key={stage.key}
          className={i <= reached ? "done" : ""}
        >
          <span className="csel-dot">{i <= reached ? <CheckCircle2 size={12} /> : i + 1}</span>
          {stage.label}
        </li>
      ))}
    </ol>
  );
}

function Term({ label, value, tone }) {
  return (
    <div className={`csel-term ${tone || ""}`}>
      <span className="csel-term-label">{label}</span>
      <span className="csel-term-value">{value}</span>
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="csel-backdrop" onClick={onClose}>
      <div className="csel-modal" onClick={(e) => e.stopPropagation()}>
        <div className="csel-modal-head">
          <h2>
            <Ship size={18} /> {title}
          </h2>
          <button type="button" className="csel-close" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="csel-modal-body">{children}</div>
      </div>
    </div>
  );
}
