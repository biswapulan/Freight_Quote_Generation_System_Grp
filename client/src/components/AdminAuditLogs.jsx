import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw, ScrollText } from "lucide-react";

import { listAuditLogs } from "../api/workflow";
import { useAuth } from "../context/AuthContext";
import ListFilterBar from "./ListFilterBar";
import { filterRows, optionsFrom } from "../utils/listFilters";
import "./AdminAuditLogs.css";

/**
 * Admin portal -> Audit Logs (PDF section 6).
 *
 * The nav item existed but rendered the dashboard; there was no audit table in
 * the backend at all. Every state-changing action now writes a record, and a
 * price override additionally carries the reason the agent gave for it (core
 * test scenario 9).
 */

// "all" is the toolbar's own value for "no restriction"; the API wants the
// filter left off entirely.
const ENTITY_FILTERS = [
  { value: "QUOTE", label: "Quotes" },
  { value: "SHIPMENT", label: "Shipments" },
  { value: "CUSTOMS_CHECK", label: "Customs checks" },
];

// What the table prints, which is what the search reads.
const AUDIT_SEARCH_FIELDS = [
  "action",
  "entity_id",
  "entity_type",
  "actor_email",
  "actor_id",
  "actor_role",
  "reason",
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
  const [entityType, setEntityType] = useState("all");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // The record type is the one filter the server applies; the rest narrow what
  // is already on screen.
  const serverEntityType = entityType === "all" ? "" : entityType;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await listAuditLogs(token, { entityType: serverEntityType, limit: 200 });
      setRows(data.results || []);
      setTotal(data.count || 0);
    } catch (err) {
      setError(err.message || "Could not load the audit trail.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token, serverEntityType]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * The visible trail: what was typed, who acted, and how long ago.
   *
   * An empty search shows every record; a row with no timestamp is never
   * hidden by a date choice.
   */
  const filtered = useMemo(() => {
    const now = Date.now();
    const days = dateFilter === "7days" ? 7 : dateFilter === "30days" ? 30 : 0;
    const cutoff = days ? now - days * 24 * 60 * 60 * 1000 : 0;

    return filterRows(rows, {
      search,
      fields: AUDIT_SEARCH_FIELDS,
      filters: [
        { value: roleFilter, matches: (row, role) => row.actor_role === role },
        {
          value: dateFilter,
          matches: (row) => {
            if (!cutoff || !row.created_at) return true;
            return new Date(row.created_at).getTime() >= cutoff;
          },
        },
      ],
    });
  }, [rows, search, roleFilter, dateFilter]);

  const roleFilterOptions = useMemo(
    () => optionsFrom(rows, (row) => row.actor_role),
    [rows],
  );

  const narrowed =
    Boolean(search.trim()) ||
    entityType !== "all" ||
    roleFilter !== "all" ||
    dateFilter !== "all";

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

      <ListFilterBar
        search={search}
        onSearch={setSearch}
        searchLabel="Search the audit trail"
        searchPlaceholder="Search action, record id, actor or reason…"
        filters={[
          {
            key: "entity",
            label: "All records",
            ariaLabel: "Filter by record type",
            value: entityType,
            options: ENTITY_FILTERS,
          },
          {
            key: "role",
            label: "All roles",
            ariaLabel: "Filter by the actor's role",
            value: roleFilter,
            options: roleFilterOptions,
          },
          {
            key: "date",
            label: "All Time",
            ariaLabel: "Filter by date",
            value: dateFilter,
            options: [
              { value: "7days", label: "Last 7 days" },
              { value: "30days", label: "Last 30 days" },
            ],
          },
        ]}
        onFilterChange={(key, value) => {
          if (key === "entity") setEntityType(value);
          else if (key === "role") setRoleFilter(value);
          else if (key === "date") setDateFilter(value);
        }}
        onClear={() => {
          setSearch("");
          setEntityType("all");
          setRoleFilter("all");
          setDateFilter("all");
        }}
        resultCount={filtered.length}
        resultNoun={`of ${total} record${total === 1 ? "" : "s"}`}
      />

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
                    : narrowed
                    ? "No audit records match your search."
                    : "No audit records on file yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
