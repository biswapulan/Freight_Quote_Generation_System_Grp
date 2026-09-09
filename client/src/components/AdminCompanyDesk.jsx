import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Users,
  Activity,
  TrendingUp,
  ShieldCheck,
  RotateCw,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  createCompanyAgent,
  getCompanyPerformance,
  listAllSelections,
  listCompanies,
  listCompanyAgents,
  listVerificationRequests,
  revokeCompanyAgent,
  updateCompany,
  updateCompanyAgent,
} from "../api/workflow";
import "./AdminCompanyDesk.css";

/**
 * The platform administrator's five M4 pages (milestone document, section 6).
 *
 * The admin manages who the providers are and who may act for them, then
 * watches the workflow rather than acting inside it. Approving on a company's
 * behalf would make that company's verification meaningless, so nothing here
 * decides a request: these screens are a register and a window.
 */

const STATUS_WORDS = {
  PENDING_COMPANY_VERIFICATION: "Waiting for company",
  UNDER_VERIFICATION: "Being checked",
  AWAITING_CUSTOMER_INFO: "Waiting on customer",
  REVISION_PENDING_CUSTOMER: "Revision with customer",
  REVISION_ACCEPTED: "Revision accepted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ESCALATED: "Escalated",
  BOOKING_CONFIRMED: "Booked",
  BOOKING_CANCELLED: "Cancelled",
  RESELECT_QUOTE: "Customer moved on",
  QUOTE_SELECTED: "Just selected",
};

function money(amount, currency) {
  const value = Number(amount || 0);
  return `${currency === "INR" ? "₹ " : `${currency || ""} `}${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function pct(value) {
  return value == null ? "—" : `${value}%`;
}

export default function AdminCompanyDesk({ initialTab = "companies" }) {
  const { token } = useAuth();
  const [tab, setTab] = useState(initialTab);
  const [companies, setCompanies] = useState([]);
  const [agents, setAgents] = useState([]);
  const [selections, setSelections] = useState([]);
  const [summary, setSummary] = useState(null);
  const [requests, setRequests] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const [newAgent, setNewAgent] = useState({
    companyCode: "",
    userEmail: "",
    displayName: "",
    role: "AGENT",
  });

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [c, a, s, v, p] = await Promise.all([
        listCompanies(token),
        listCompanyAgents(token),
        listAllSelections(token),
        listVerificationRequests(token),
        getCompanyPerformance(token),
      ]);
      setCompanies(c.results || []);
      setAgents(a.results || []);
      setSelections(s.results || []);
      setSummary(s.summary || null);
      setRequests(v.results || []);
      setPerformance(p.results || []);
    } catch (err) {
      setError(err.message || "Could not load the administration data.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const overdue = useMemo(() => requests.filter((r) => r.isOverdue), [requests]);

  async function toggleCompany(company) {
    setBusy(true);
    try {
      const next = company.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
      await updateCompany(token, company.code, { status: next });
      setNotice({
        type: "success",
        text:
          next === "SUSPENDED"
            ? `${company.name} suspended. It will not be offered on new enquiries.`
            : `${company.name} is active again.`,
      });
      await load();
    } catch (err) {
      setNotice({ type: "error", text: err.message || "Could not update that company." });
    } finally {
      setBusy(false);
    }
  }

  async function addAgent(e) {
    e.preventDefault();
    if (!newAgent.companyCode || !newAgent.userEmail) {
      setNotice({ type: "error", text: "Pick a company and enter the agent's email." });
      return;
    }
    setBusy(true);
    try {
      await createCompanyAgent(token, newAgent);
      setNotice({
        type: "success",
        text: `${newAgent.userEmail} can now act for that company.`,
      });
      setNewAgent({ companyCode: "", userEmail: "", displayName: "", role: "AGENT" });
      await load();
    } catch (err) {
      setNotice({ type: "error", text: err.message || "Could not add that agent." });
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(agent, role) {
    setBusy(true);
    try {
      await updateCompanyAgent(token, agent.id, { role });
      await load();
    } catch (err) {
      setNotice({ type: "error", text: err.message || "Could not change that role." });
    } finally {
      setBusy(false);
    }
  }

  async function revoke(agent) {
    if (
      !window.confirm(
        `Revoke ${agent.userEmail}'s access to ${agent.companyName}?\n\n` +
          "They will immediately stop seeing that company's requests.",
      )
    )
      return;
    setBusy(true);
    try {
      await revokeCompanyAgent(token, agent.id);
      setNotice({ type: "success", text: `${agent.userEmail} no longer has access.` });
      await load();
    } catch (err) {
      setNotice({ type: "error", text: err.message || "Could not revoke that access." });
    } finally {
      setBusy(false);
    }
  }

  const TABS = [
    { key: "companies", label: "Companies", icon: <Building2 size={14} />, count: companies.length },
    { key: "agents", label: "Company agents", icon: <Users size={14} />, count: agents.length },
    { key: "selections", label: "Selected quotes", icon: <Activity size={14} />, count: selections.length },
    { key: "monitor", label: "Verification monitor", icon: <ShieldCheck size={14} />, count: requests.length },
    { key: "performance", label: "Performance", icon: <TrendingUp size={14} />, count: performance.length },
  ];

  return (
    <div className="acd-page">
      <header className="acd-header">
        <div>
          <p className="acd-eyebrow">Platform administration</p>
          <h1 className="acd-title">Freight companies</h1>
          <p className="acd-sub">
            Who the providers are, who may act for them, and how the verification
            workflow is running. Administrators watch this workflow; they do not
            decide inside it.
          </p>
        </div>
        <button type="button" className="acd-refresh" onClick={load} disabled={loading}>
          <RotateCw size={14} className={loading ? "acd-spin" : ""} /> Refresh
        </button>
      </header>

      {error && <div className="acd-banner error">{error}</div>}
      {notice && <div className={`acd-banner ${notice.type}`}>{notice.text}</div>}
      {overdue.length > 0 && (
        <div className="acd-banner warn">
          <AlertTriangle size={16} />
          {overdue.length} verification {overdue.length === 1 ? "request is" : "requests are"} past
          the company&apos;s stated response time.
        </div>
      )}

      <div className="acd-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`acd-tab${tab === t.key ? " active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.icon} {t.label}
            <span className="acd-tab-count">{t.count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="acd-empty">Loading...</div>
      ) : tab === "companies" ? (
        <Companies companies={companies} busy={busy} onToggle={toggleCompany} />
      ) : tab === "agents" ? (
        <Agents
          agents={agents}
          companies={companies}
          newAgent={newAgent}
          setNewAgent={setNewAgent}
          onAdd={addAgent}
          onRole={changeRole}
          onRevoke={revoke}
          busy={busy}
        />
      ) : tab === "selections" ? (
        <Selections selections={selections} summary={summary} />
      ) : tab === "monitor" ? (
        <Monitor requests={requests} />
      ) : (
        <Performance rows={performance} />
      )}
    </div>
  );
}

function Companies({ companies, busy, onToggle }) {
  if (!companies.length)
    return <div className="acd-empty">No freight companies registered yet.</div>;

  return (
    <div className="acd-card">
      <table className="acd-table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Service</th>
            <th>Rate card</th>
            <th>On time</th>
            <th>Agents</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => {
            const card = c.rateCards?.[0];
            return (
              <tr key={c.id}>
                <td>
                  <strong>{c.name}</strong>
                  <span className="acd-sub-line">{c.code}</span>
                </td>
                <td className="acd-muted">{c.serviceName || "—"}</td>
                <td className="acd-muted">
                  {card
                    ? `${card.ratePerKm}/km · ${card.ratePerKg}/kg · ${card.fuelSurchargePct}% fuel`
                    : "No rate card"}
                </td>
                <td className="acd-muted">{pct(c.onTimePerformance)}</td>
                <td className="acd-muted">{c.agentCount}</td>
                <td>
                  <span className={`acd-pill ${c.status === "ACTIVE" ? "ok" : "bad"}`}>
                    {c.status}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="acd-btn"
                    disabled={busy}
                    onClick={() => onToggle(c)}
                  >
                    {c.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="acd-foot">
        A suspended company stops being offered on new enquiries. Requests it has
        already accepted are unaffected.
      </p>
    </div>
  );
}

function Agents({ agents, companies, newAgent, setNewAgent, onAdd, onRole, onRevoke, busy }) {
  return (
    <>
      <form className="acd-card acd-form" onSubmit={onAdd}>
        <h3>
          <Plus size={15} /> Map an agent to a company
        </h3>
        <p className="acd-form-note">
          This is the only thing that grants access to a company&apos;s requests.
          The email must match an existing platform account.
        </p>
        <div className="acd-form-row">
          <label>
            Company
            <select
              value={newAgent.companyCode}
              onChange={(e) => setNewAgent({ ...newAgent, companyCode: e.target.value })}
            >
              <option value="">Choose...</option>
              {companies.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Agent email
            <input
              type="email"
              value={newAgent.userEmail}
              placeholder="agent@company.com"
              onChange={(e) => setNewAgent({ ...newAgent, userEmail: e.target.value })}
            />
          </label>
          <label>
            Display name
            <input
              type="text"
              value={newAgent.displayName}
              placeholder="Optional"
              onChange={(e) => setNewAgent({ ...newAgent, displayName: e.target.value })}
            />
          </label>
          <label>
            Role
            <select
              value={newAgent.role}
              onChange={(e) => setNewAgent({ ...newAgent, role: e.target.value })}
            >
              <option value="AGENT">Agent</option>
              <option value="MANAGER">Manager</option>
            </select>
          </label>
          <button type="submit" className="acd-primary" disabled={busy}>
            Grant access
          </button>
        </div>
      </form>

      <div className="acd-card">
        <table className="acd-table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Company</th>
              <th>Role</th>
              <th>Linked account</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.id}>
                <td>
                  <strong>{a.userEmail}</strong>
                  <span className="acd-sub-line">{a.displayName || "—"}</span>
                </td>
                <td className="acd-muted">{a.companyName}</td>
                <td>
                  <select
                    className="acd-inline-select"
                    value={a.role}
                    disabled={busy}
                    onChange={(e) => onRole(a, e.target.value)}
                  >
                    <option value="AGENT">Agent</option>
                    <option value="MANAGER">Manager</option>
                  </select>
                </td>
                <td className="acd-muted">
                  {a.userId ? (
                    <span className="acd-linked">
                      <CheckCircle2 size={12} /> linked
                    </span>
                  ) : (
                    <span className="acd-unlinked">
                      <AlertTriangle size={12} /> no account
                    </span>
                  )}
                </td>
                <td>
                  <span className={`acd-pill ${a.isActive ? "ok" : "bad"}`}>
                    {a.isActive ? "ACTIVE" : "DISABLED"}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="acd-btn danger"
                    disabled={busy}
                    onClick={() => onRevoke(a)}
                  >
                    <Trash2 size={13} /> Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="acd-foot">
          &quot;No account&quot; means no platform user has that email yet, so the
          agent cannot sign in and will not receive notifications.
        </p>
      </div>
    </>
  );
}

function Selections({ selections, summary }) {
  return (
    <>
      {summary && (
        <div className="acd-kpis">
          <Kpi label="Selections" value={summary.total} tone="muted" />
          <Kpi label="With companies" value={summary.awaitingCompany} tone="active" />
          <Kpi label="With customers" value={summary.awaitingCustomer} tone="warn" />
          <Kpi label="Booked" value={summary.booked} tone="ok" />
          <Kpi label="Lost" value={summary.lost} tone="bad" />
        </div>
      )}
      <div className="acd-card">
        <table className="acd-table">
          <thead>
            <tr>
              <th>Selection</th>
              <th>Customer</th>
              <th>Company</th>
              <th>Selected</th>
              <th>Revisions</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {selections.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.reference}</strong>
                  <span className="acd-sub-line">{s.shipmentId}</span>
                </td>
                <td className="acd-muted">{s.customer_email}</td>
                <td className="acd-muted">{s.companyName}</td>
                <td>
                  <strong>{money(s.selectedTotalPrice, s.selectedCurrency)}</strong>
                  <span className="acd-sub-line">{s.selectedTransitDays} d</span>
                </td>
                <td className="acd-muted">{s.revisionCount || 0}</td>
                <td>
                  <span className="acd-pill muted">
                    {STATUS_WORDS[s.status] || s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Monitor({ requests }) {
  const sorted = [...requests].sort(
    (a, b) => Number(b.isOverdue) - Number(a.isOverdue),
  );
  if (!sorted.length)
    return <div className="acd-empty">No verification requests on the platform yet.</div>;

  return (
    <div className="acd-card">
      <table className="acd-table">
        <thead>
          <tr>
            <th>Request</th>
            <th>Company</th>
            <th>Assigned to</th>
            <th>Status</th>
            <th>Response</th>
            <th>SLA</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className={r.isOverdue ? "acd-row-overdue" : ""}>
              <td>
                <strong>{r.reference}</strong>
                <span className="acd-sub-line">{r.selection?.reference}</span>
              </td>
              <td className="acd-muted">{r.companyName}</td>
              <td className="acd-muted">{r.assignedAgent || "unassigned"}</td>
              <td>
                <span className="acd-pill muted">
                  {STATUS_WORDS[r.status] || r.status}
                </span>
              </td>
              <td className="acd-muted">
                {r.responseHours != null ? `${r.responseHours} h` : "—"}
              </td>
              <td>
                {r.isOverdue ? (
                  <span className="acd-pill bad">Overdue</span>
                ) : r.decidedAt ? (
                  <span className="acd-pill ok">Met</span>
                ) : (
                  <span className="acd-pill muted">Running</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Performance({ rows }) {
  return (
    <div className="acd-card">
      <table className="acd-table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Selections</th>
            <th>Decided</th>
            <th>Pending</th>
            <th>Approved</th>
            <th>Rejected</th>
            <th>Approval rate</th>
            <th>Conversion</th>
            <th>Response</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.companyId}>
              <td>
                <strong>{r.companyName}</strong>
                <span className="acd-sub-line">{r.agents} agents</span>
              </td>
              <td className="acd-muted">{r.selections}</td>
              <td className="acd-muted">{r.decided}</td>
              <td>
                {r.overdue > 0 ? (
                  <span className="acd-pill bad">
                    {r.pending} ({r.overdue} late)
                  </span>
                ) : (
                  <span className="acd-muted">{r.pending}</span>
                )}
              </td>
              <td className="acd-muted">{r.approved}</td>
              <td className="acd-muted">{r.rejected}</td>
              <td>
                <strong>{pct(r.approvalRate)}</strong>
              </td>
              <td>
                <strong>{pct(r.conversionRate)}</strong>
                <span className="acd-sub-line">{r.bookings} booked</span>
              </td>
              <td className="acd-muted">
                {r.avgResponseHours != null ? `${r.avgResponseHours} h` : "—"}
                {r.statedResponseHours != null && (
                  <span className="acd-sub-line">
                    stated {r.statedResponseHours} h
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="acd-foot">
        Conversion is bookings as a share of selections: how often choosing this
        company actually ends in a shipment. Every figure is counted from the
        workflow records, so it cannot drift from what happened.
      </p>
    </div>
  );
}

function Kpi({ label, value, tone }) {
  return (
    <div className={`acd-kpi ${tone}`}>
      <span className="acd-kpi-value">{value}</span>
      <span className="acd-kpi-label">{label}</span>
    </div>
  );
}
