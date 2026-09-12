import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  RotateCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  decideCustomsClearance,
  listCustomsClearances,
  verifyShipmentDocument,
} from "../api/workflow";
import DocumentViewer from "./DocumentViewer";
import { alertText } from "../utils/alerts";
import "./CustomsClearanceDesk.css";

/**
 * Customs' booking clearance desk (M4, between company approval and booking).
 *
 * A company's approval is not yet a booking. Each approved request lands here,
 * where a customs officer reads the consignment, its papers and M3's customs
 * risk, then clears it for the customer to confirm, or rejects it with a
 * reason the customer and the company both read.
 */

const TABS = [
  { key: "PENDING", label: "Waiting for clearance" },
  { key: "CLEARED", label: "Cleared" },
  { key: "REJECTED", label: "Rejected" },
];

const STATUS_WORDS = {
  PENDING: "Waiting for customs",
  CLEARED: "Cleared",
  REJECTED: "Rejected",
};

const TONE = { PENDING: "active", CLEARED: "ok", REJECTED: "bad" };

// How each required paper stands with customs.
const REQUIRED_TONE = { VERIFIED: "ok", PENDING: "waiting", REJECTED: "missing", MISSING: "missing" };
const REQUIRED_WORDS = {
  VERIFIED: "verified",
  PENDING: "on file · awaiting your check",
  REJECTED: "rejected",
  MISSING: "not uploaded",
};
const REVIEW_WORDS = { VERIFIED: "verified", REJECTED: "rejected", PENDING: "awaiting your check" };

function money(amount, currency) {
  const value = Number(amount || 0);
  return `${currency === "INR" ? "₹ " : `${currency || ""} `}${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

function when(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CustomsClearanceDesk() {
  const { token, user } = useAuth();
  const [tab, setTab] = useState("PENDING");
  // The paper an officer has open: { doc, canVerify }.
  const [viewing, setViewing] = useState(null);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [canDecide, setCanDecide] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [openRef, setOpenRef] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await listCustomsClearances(token);
      setRows(data.results || []);
      setSummary(data.summary || {});
      setCanDecide(Boolean(data.canDecide));
    } catch (err) {
      setError(err.message || "Could not load the clearance queue.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => rows.filter((r) => r.status === tab), [rows, tab]);

  // Customs' verdict on one paper, given from the viewer once it is open.
  // Errors reach the viewer, which shows them beside the buttons.
  async function verifyDocument(doc, decision, remarks) {
    await verifyShipmentDocument(token, doc.id, {
      decision,
      officerName: user?.full_name || user?.email || "Customs officer",
      remarks,
    });
    setNotice({
      type: decision === "VERIFIED" ? "success" : "info",
      text:
        decision === "VERIFIED"
          ? `${doc.documentType} verified.`
          : `${doc.documentType} rejected. The customer has been told why.`,
    });
    await load();
  }

  function toggle(reference) {
    setOpenRef((current) => (current === reference ? null : reference));
    setReason("");
  }

  async function decide(row, decision) {
    if (busy) return;
    if (decision === "REJECT" && !reason.trim()) {
      setNotice({
        type: "error",
        text: "Give the reason for rejecting. The customer and the company both read it.",
      });
      return;
    }
    setBusy(true);
    try {
      await decideCustomsClearance(token, row.reference, {
        decision,
        reason: reason.trim(),
      });
      const company = row.selection?.companyName || "the company";
      setNotice({
        type: decision === "CLEAR" ? "success" : "info",
        text:
          decision === "CLEAR"
            ? `${row.reference} cleared. The customer now confirms or declines the booking with ${company}.`
            : `${row.reference} rejected. The customer and ${company} have been told why.`,
      });
      setOpenRef(null);
      setReason("");
      await load();
    } catch (err) {
      setNotice({ type: "error", text: err.message || "Could not record that decision." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ccd-page">
      <header className="ccd-header">
        <div>
          <p className="ccd-eyebrow">Customs / Booking clearances</p>
          <h1 className="ccd-title">Booking clearances</h1>
          <p className="ccd-sub">
            Shipments a company has approved. Clear the consignment so the customer can
            confirm the booking, or reject it with a reason.
          </p>
        </div>
        <button type="button" className="ccd-refresh" onClick={load} disabled={loading}>
          <RotateCw size={14} className={loading ? "ccd-spin" : ""} /> Refresh
        </button>
      </header>

      {error && <div className="ccd-banner error">{error}</div>}
      {notice && <div className={`ccd-banner ${notice.type}`}>{notice.text}</div>}

      <div className="ccd-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`ccd-tab${tab === t.key ? " active" : ""}`}
            onClick={() => {
              setTab(t.key);
              setOpenRef(null);
            }}
          >
            {t.label} <span className="ccd-count">{summary[t.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="ccd-empty">Loading...</div>
      ) : shown.length === 0 ? (
        <div className="ccd-empty">
          {tab === "PENDING"
            ? "Nothing is waiting. A shipment appears here as soon as a company approves it."
            : "None yet."}
        </div>
      ) : (
        <div className="ccd-list">
          {shown.map((row) => (
            <Clearance
              key={row.id}
              row={row}
              open={openRef === row.reference}
              canDecide={canDecide && row.status === "PENDING"}
              onToggle={() => toggle(row.reference)}
              reason={reason}
              setReason={setReason}
              busy={busy}
              onDecide={(decision) => decide(row, decision)}
              onOpenDoc={(doc, canVerify) => setViewing({ doc, canVerify })}
            />
          ))}
        </div>
      )}

      {viewing && (
        <DocumentViewer
          document={viewing.doc}
          reviewerLabel="Customs"
          currentStatus={viewing.doc.customsStatus}
          onDecide={
            viewing.canVerify
              ? (decision, remarks) => verifyDocument(viewing.doc, decision, remarks)
              : null
          }
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

function Clearance({ row, open, canDecide, onToggle, reason, setReason, busy, onDecide, onOpenDoc }) {
  const shipment = row.shipment || {};
  const selection = row.selection || {};
  const insights = row.aiInsights || {};
  const customsRisk = insights.risk?.customs || {};
  const required = row.requiredDocuments || [];
  const documents = row.documents || [];
  const alerts = insights.alerts || [];
  const readiness = row.documentReadiness || null;
  const ready = !readiness || readiness.ready;
  const tone = TONE[row.status] || "active";
  const riskScore = customsRisk.score;

  return (
    <article className={`ccd-card ${tone}`}>
      <div className="ccd-card-head">
        <div>
          <span className="ccd-lane">
            {shipment.origin} → {shipment.destination}
          </span>
          <span className="ccd-refs">
            {row.reference} · Quote {selection.quoteId} · Shipment {selection.shipmentId} ·{" "}
            {selection.reference} · {row.verification?.reference}
          </span>
        </div>
        <span className={`ccd-pill ${tone}`}>{STATUS_WORDS[row.status] || row.status}</span>
      </div>

      <div className="ccd-terms">
        <Term label="Company" value={selection.companyName} />
        <Term label="Cargo" value={shipment.cargoType} />
        <Term label="HS code" value={shipment.hsCode || "Not given"} tone={shipment.hsCode ? "" : "warn"} />
        <Term
          label="Weight / volume"
          value={`${Number(shipment.weightKg || 0).toLocaleString("en-IN")} kg / ${shipment.volumeCbm ?? "—"} CBM`}
        />
        <Term
          label="Mode / equipment"
          value={`${capitalize(shipment.transportMode) || "—"} · ${shipment.containerType || "—"}`}
        />
        <Term label="Freight agreed" value={money(selection.agreedTotalPrice, selection.selectedCurrency)} />
        <Term
          label="AI customs risk"
          value={riskScore != null ? `${Math.round(riskScore)} / 100` : "—"}
          tone={riskScore >= 60 ? "bad" : riskScore >= 35 ? "warn" : ""}
        />
        <Term
          label="Papers verified by customs"
          value={
            readiness
              ? `${readiness.verified} of ${readiness.required}`
              : `${documents.length} uploaded`
          }
          tone={ready ? "" : "warn"}
        />
      </div>

      {row.verification?.decisionReason && (
        <p className="ccd-approval">
          <ShieldCheck size={14} />
          <span>
            <strong>{selection.companyName} approved</strong>
            {row.verification.decidedBy ? ` (${row.verification.decidedBy})` : ""}:{" "}
            {row.verification.decisionReason}
          </span>
        </p>
      )}

      {alerts.length > 0 && (
        <ul className="ccd-alerts">
          {alerts.map((alert, i) => (
            <li key={i}>
              <AlertTriangle size={13} /> {alertText(alert)}
            </li>
          ))}
        </ul>
      )}

      {row.status !== "PENDING" && (
        <p className={`ccd-outcome ${tone}`}>
          {row.status === "CLEARED" ? "Cleared" : "Rejected"} by {row.officerEmail || "customs"} on{" "}
          {when(row.decidedAt)}
          {row.reason ? `: ${row.reason}` : "."}
        </p>
      )}

      <div className="ccd-actions">
        <button type="button" className={canDecide ? "ccd-primary" : "ccd-secondary"} onClick={onToggle}>
          <FileText size={14} /> {open ? "Close" : canDecide ? "Review and decide" : "View papers"}
        </button>
      </div>

      {open && (
        <div className="ccd-detail">
          <div className="ccd-detail-cols">
            <div>
              <h3>Required on this lane</h3>
              {required.length ? (
                <ul className="ccd-docs">
                  {required.map((doc) => {
                    const state = doc.onFile ? doc.customsStatus : "MISSING";
                    return (
                      <li key={doc.name} className={REQUIRED_TONE[state] || "waiting"}>
                        {state === "VERIFIED" ? (
                          <CheckCircle2 size={13} />
                        ) : state === "PENDING" ? (
                          <Clock size={13} />
                        ) : (
                          <XCircle size={13} />
                        )}{" "}
                        {doc.name}
                        <span className="ccd-muted"> · {REQUIRED_WORDS[state] || state.toLowerCase()}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="ccd-muted">M3 issued no document checklist for this lane.</p>
              )}
            </div>
            <div>
              <h3>Uploaded by the customer</h3>
              {documents.length ? (
                <ul className="ccd-docs">
                  {documents.map((doc) => (
                    <li key={doc.id}>
                      <button
                        type="button"
                        className="ccd-doc-link"
                        onClick={() => onOpenDoc(doc, canDecide)}
                        title="Open this document"
                      >
                        <FileText size={13} /> {doc.documentType}
                        <span className="ccd-muted"> · {doc.fileName}</span>
                      </button>
                      <span className="ccd-muted">
                        {" "}
                        · {REVIEW_WORDS[doc.customsStatus] || "awaiting your check"}
                      </span>
                      <button
                        type="button"
                        className="ccd-doc-open"
                        onClick={() => onOpenDoc(doc, canDecide)}
                      >
                        {canDecide && doc.customsStatus !== "VERIFIED" ? "Open & verify" : "Open"}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ccd-muted">No documents uploaded yet.</p>
              )}
            </div>
          </div>

          {canDecide && (
            <div className="ccd-decide">
              <label className="ccd-field">
                Note to the customer and the company (required to reject)
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. HS code matches the invoice and the papers are in order."
                />
              </label>
              {!ready && (
                <p className="ccd-hint">
                  Open and verify every document above before clearing. You can still reject.
                </p>
              )}
              <div className="ccd-decide-actions">
                <button type="button" className="ccd-reject" disabled={busy} onClick={() => onDecide("REJECT")}>
                  <XCircle size={15} /> Reject
                </button>
                <button
                  type="button"
                  className="ccd-clear"
                  disabled={busy || !ready}
                  onClick={() => onDecide("CLEAR")}
                >
                  <ShieldCheck size={15} /> Clear for booking
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function Term({ label, value, tone }) {
  return (
    <div className={`ccd-term ${tone || ""}`}>
      <span className="ccd-term-label">{label}</span>
      <span className="ccd-term-value">{value || "—"}</span>
    </div>
  );
}
