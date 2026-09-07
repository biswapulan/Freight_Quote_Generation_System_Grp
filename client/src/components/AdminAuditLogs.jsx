import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, ScrollText, Search } from "lucide-react";

import { listAuditLogs } from "../api/workflow";
import { useAuth } from "../context/AuthContext";
import "./AdminAuditLogs.css";

/**
 * Admin portal -> Audit Logs (PDF section 6).
 *
 * The nav item existed but rendered the dashboard; there was no audit table in
 * the backend at all. Every state-changing action now writes a record, and a
 * price override additionally carries the reason the agent gave for it (core
 * test scenario 9).
 */

const ENTITY_FILTERS = [
  { value: "", label: "All records" },
  { value: "QUOTE", label: "Quotes" },
  { value: "SHIPMENT", label: "Shipments" },
  { value: "CUSTOMS_CHECK", label: "Customs checks" },
];

const ACTION_TONE = {
  QUOTE_PRICE_MODIFIED: { color: "#b45309", bg: "#fef3c7" },
  QUOTE_APPROVED: { color: "#6d28d9", bg: "#ede9fe" },
  QUOTE_SENT: { color: "#0369a1", bg: "#e0f2fe" },
  QUOTE_REJECTED: { color: "#b91c1c", bg: "#fee2e2" },
  QUOTE_GENERATED: { color: "#0f766e", bg: "#ccfbf1" },
  CUSTOMER_DECISION: { color: "#047857", bg: "#ecfdf5" },
  CUSTOMS_SIGN_OFF: { color: "#b45309", bg: "#fef3c7" },
  DEFAULT: { color: "#475569", bg: "#f1f5f9" },
};

function formatChange(changes) {
  if (!changes) return null;
  return Object.entries(changes).map(([field, delta]) => {
    const from = delta?.from ?? "—";
    const to = delta?.to ?? "—";
    return (
      <div key={field} className="aal-change">
        <span className="aal-change-field">{field}</span>
        <span className="aal-change-from">{String(from)}</span>
        <span className="aal-change-arrow">→</span>
        <span className="aal-change-to">{String(to)}</span>
      </div>
    );
  });
}

export default function AdminAuditLogs() {
  const { token } = useAuth();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [entityType, setEntityType] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await listAuditLogs(token, { entityType, limit: 200 });
      setRows(data.results || []);
      setTotal(data.count || 0);
    } catch (err) {
      setError(err.message || "Could not load the audit trail.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token, entityType]);

  useEffect(() => {
    load();
  }, [load]);

  const term = search.trim().toLowerCase();
  const filtered = term
    ? rows.filter((row) =>
        [row.action, row.entity_id, row.actor_email, row.actor_role, row.reason]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(term)),
      )
    : rows;

  return (
    <div className="aal-container">
      <div className="aal-header">
        <div className="aal-title-block">
          <h1>
            <ScrollText size={22} /> Audit Logs
          </h1>
          <p>
            An immutable record of every state-changing action: who did it, what
            changed, and the reason they gave.
          </p>
        </div>
        <button type="button" className="aal-refresh" onClick={load} disabled={loading}>
          <RefreshCw size={15} className={loading ? "aal-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="aal-controls">
        <div className="aal-search">
          <Search size={15} />
          <input
            type="text"
            placeholder="Search action, record id, actor or reason…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
          {ENTITY_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <span className="aal-count">
          {filtered.length} of {total} record{total === 1 ? "" : "s"}
        </span>
      </div>

      {error && (
        <div className="aal-error">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <div className="aal-table-wrap">
        <table className="aal-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Record</th>
              <th>Change</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const tone = ACTION_TONE[row.action] || ACTION_TONE.DEFAULT;
              return (
                <tr key={row.id}>
                  <td className="aal-when">
                    {new Date(row.created_at).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td>
                    <div className="aal-actor">{row.actor_email || row.actor_id}</div>
                    <small className="aal-actor-role">{row.actor_role}</small>
                  </td>
                  <td>
                    <span
                      className="aal-action-pill"
                      style={{ color: tone.color, background: tone.bg }}
                    >
                      {row.action}
                    </span>
                  </td>
                  <td className="aal-record">
                    <div>{row.entity_id}</div>
                    <small>{row.entity_type}</small>
                  </td>
                  <td>{formatChange(row.changes) || <span className="aal-muted">—</span>}</td>
                  <td className="aal-reason">
                    {row.reason || <span className="aal-muted">—</span>}
                  </td>
                </tr>
              );
            })}

            {!filtered.length && (
              <tr>
                <td colSpan={6} className="aal-empty">
                  {loading
                    ? "Loading the audit trail…"
                    : error
                    ? "The audit trail could not be loaded."
                    : "No audit records match this filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
