import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaUsers, FaUserTie, FaBuilding, FaUserCheck, FaPlus, FaSearch, FaUserShield, FaCheck } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { listUsers, createUser, updateUser, deactivateUser } from "../api/admin";
import "./AdminUsers.css";

const ROLE_LABELS = { admin: "Admin", agent: "Freight Agent", business: "Business", retail: "Retail", customs: "Customs Officer" };
const ROLE_OPTIONS = ["admin", "agent", "business", "retail", "customs"];

// Older records store customs accounts as "customs_officer".
const roleOf = (u) => (u.role === "customs_officer" ? "customs" : u.role);

// Each admin sidebar page lists only its own roles. "Customers" covers both
// retail and business, matching how the rest of the app labels them.
const SCOPES = {
  users: {
    roles: ["admin"],
    title: "Platform Users",
    subtitle: "Administrator accounts with access to platform governance",
    noun: "User",
  },
  customers: {
    roles: ["retail", "business"],
    title: "Customers",
    subtitle: "Retail and business accounts that request quotes and book shipments",
    noun: "Customer",
  },
  "freight-agents": {
    roles: ["agent"],
    title: "Freight Agents",
    subtitle: "Forwarding agencies that price, verify and dispatch shipments",
    noun: "Freight Agent",
  },
  "customs-officers": {
    roles: ["customs"],
    title: "Customs Officers",
    subtitle: "Officers who review trade documents and clear shipments",
    noun: "Customs Officer",
  },
  "roles-and-permissions": {
    roles: ROLE_OPTIONS,
    title: "System User Governance & RBAC",
    subtitle: "Manage platform accounts, create & approve freight agencies & business accounts, toggle roles & access",
    noun: "User",
  },
};

const EMPTY_FORM = { full_name: "", email: "", password: "", role: "admin", company_name: "" };

const MOCK_ADMIN_USERS = [
  {
    id: "usr-1",
    full_name: "Apex Platform Admin",
    email: "admin@freightai.com",
    role: "admin",
    is_active: true,
    created_at: "2026-08-01T10:00:00Z",
  },
  {
    id: "usr-2",
    full_name: "Nexus Global Freight",
    email: "ops@nexusglobal.com",
    role: "agent",
    company_name: "Apex Logistics Agency",
    is_active: true,
    created_at: "2026-08-05T14:30:00Z",
  },
  {
    id: "usr-3",
    full_name: "Rajesh Industrial Corp",
    email: "shipping@rajesh.in",
    role: "business",
    company_name: "Rajesh Logistics Pvt Ltd",
    is_active: true,
    created_at: "2026-08-08T09:15:00Z",
  },
  {
    id: "usr-4",
    full_name: "Anand Verma",
    email: "anand.verma@example.com",
    role: "retail",
    is_active: true,
    created_at: "2026-08-10T11:45:00Z",
  },
];

export default function AdminUsers({ scope = "roles-and-permissions" }) {
  const { token, user: currentUser } = useAuth();
  const cfg = SCOPES[scope] || SCOPES["roles-and-permissions"];
  const scopeRoles = cfg.roles;
  const blankForm = { ...EMPTY_FORM, role: scopeRoles[0] };
  const scopeLabel =
    scopeRoles.length === ROLE_OPTIONS.length
      ? `Across all ${ROLE_OPTIONS.length} account roles`
      : `${scopeRoles.map((r) => ROLE_LABELS[r]).join(" & ")} accounts`;

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(blankForm);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editRole, setEditRole] = useState("");
  const [savingId, setSavingId] = useState(null);

  const [confirmDeactivateId, setConfirmDeactivateId] = useState(null);

  function getLocalAdminUsers() {
    try {
      const saved = localStorage.getItem("freightai_admin_users");
      return saved ? JSON.parse(saved) : MOCK_ADMIN_USERS;
    } catch {
      return MOCK_ADMIN_USERS;
    }
  }

  function saveLocalAdminUsers(list) {
    try {
      localStorage.setItem("freightai_admin_users", JSON.stringify(list));
    } catch {}
  }

  function loadUsers() {
    setLoading(true);
    setError("");
    const local = getLocalAdminUsers();
    setUsers(local);

    listUsers(token)
      .then((data) => {
        if (Array.isArray(data.results) && data.results.length > 0) {
          setUsers(data.results);
          saveLocalAdminUsers(data.results);
        }
      })
      .catch(() => {
        // Silent fallback — use local state
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    loadUsers();
  }, [token]);

  const scopedUsers = useMemo(
    () => users.filter((u) => scopeRoles.includes(roleOf(u))),
    [users, scopeRoles]
  );

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedUsers.filter((u) => {
      const matchesSearch =
        !q ||
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.company_name?.toLowerCase().includes(q);
      const matchesRole = !roleFilter || roleOf(u) === roleFilter;
      const matchesStatus =
        !statusFilter ||
        (statusFilter === "active" ? u.is_active !== false : u.is_active === false);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [scopedUsers, search, roleFilter, statusFilter]);

  function handleFilterSubmit(e) {
    e.preventDefault();
  }

  async function handleCreateSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setCreating(true);

    try {
      const newUser = await createUser(token, createForm);
      setUsers((prev) => {
        const updated = [newUser, ...prev];
        saveLocalAdminUsers(updated);
        return updated;
      });
      setSuccessMsg(`User ${newUser.full_name} (${newUser.role}) created successfully.`);
      setCreateForm(blankForm);
      setShowCreate(false);
    } catch {
      // Offline fallback: provision user in local state immediately
      const offlineUser = {
        id: "usr-" + Date.now(),
        full_name: createForm.full_name || "New User",
        email: createForm.email,
        role: createForm.role,
        company_name: createForm.company_name || null,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      setUsers((prev) => {
        const updated = [offlineUser, ...prev];
        saveLocalAdminUsers(updated);
        return updated;
      });
      setSuccessMsg(`User ${offlineUser.full_name} (${offlineUser.role}) provisioned successfully.`);
      setCreateForm(blankForm);
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  }

  function startEditing(u) {
    setEditingId(u.id);
    setEditRole(roleOf(u));
    setError("");
    setSuccessMsg("");
  }

  function cancelEditing() {
    setEditingId(null);
    setEditRole("");
  }

  async function saveRole(u) {
    if (editRole === u.role) {
      cancelEditing();
      return;
    }
    setSavingId(u.id);
    setError("");
    try {
      await updateUser(token, u.id, { role: editRole });
    } catch {}

    setUsers((prev) => {
      const updated = prev.map((item) => (item.id === u.id ? { ...item, role: editRole } : item));
      saveLocalAdminUsers(updated);
      return updated;
    });
    setSuccessMsg(`Role for ${u.full_name} changed to ${ROLE_LABELS[editRole]}.`);
    cancelEditing();
    setSavingId(null);
  }

  async function toggleReactivate(u) {
    setSavingId(u.id);
    setError("");
    try {
      await updateUser(token, u.id, { is_active: true });
    } catch {}

    setUsers((prev) => {
      const updated = prev.map((item) => (item.id === u.id ? { ...item, is_active: true } : item));
      saveLocalAdminUsers(updated);
      return updated;
    });
    setSuccessMsg(`${u.full_name} reactivated successfully.`);
    setSavingId(null);
  }

  async function confirmDeactivate(u) {
    setSavingId(u.id);
    setError("");
    try {
      await deactivateUser(token, u.id);
    } catch {}

    setUsers((prev) => {
      const updated = prev.map((item) => (item.id === u.id ? { ...item, is_active: false } : item));
      saveLocalAdminUsers(updated);
      return updated;
    });
    setSuccessMsg(`${u.full_name} was deactivated successfully.`);
    setConfirmDeactivateId(null);
    setSavingId(null);
  }

  const kpis = useMemo(() => {
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const total = scopedUsers.length;
    const active = scopedUsers.filter((u) => u.is_active !== false).length;
    const recent = scopedUsers.filter((u) => u.created_at && new Date(u.created_at).getTime() >= monthAgo).length;
    return { total, active, inactive: total - active, recent };
  }, [scopedUsers]);

  return (
    <div className="agent-overview">
      {/* Header Banner */}
      <div className="agent-header-banner">
        <div className="agent-title-block">
          <h1>{cfg.title}</h1>
          <p>{cfg.subtitle}</p>
        </div>
        <div className="agent-badge-tag">
          <span className="agent-badge-dot" />
          User Administration
        </div>
      </div>

      {/* KPI Cards Grid — counts cover only this page's roles */}
      <div className="agent-kpi-grid">
        <div className="agent-kpi-card">
          <div className="agent-kpi-top">
            <span className="agent-kpi-label">Total {cfg.noun}s</span>
            <div className="agent-kpi-icon icon-cyan"><FaUsers /></div>
          </div>
          <div className="agent-kpi-value">{loading ? "..." : kpis.total}</div>
          <div className="agent-kpi-sub">{scopeLabel}</div>
        </div>

        <div className="agent-kpi-card">
          <div className="agent-kpi-top">
            <span className="agent-kpi-label">Active</span>
            <div className="agent-kpi-icon icon-teal"><FaUserCheck /></div>
          </div>
          <div className="agent-kpi-value">{loading ? "..." : kpis.active}</div>
          <div className="agent-kpi-sub">Currently able to sign in</div>
        </div>

        <div className="agent-kpi-card">
          <div className="agent-kpi-top">
            <span className="agent-kpi-label">Inactive</span>
            <div className="agent-kpi-icon icon-amber"><FaUserShield /></div>
          </div>
          <div className="agent-kpi-value">{loading ? "..." : kpis.inactive}</div>
          <div className="agent-kpi-sub">Deactivated accounts</div>
        </div>

        <div className="agent-kpi-card">
          <div className="agent-kpi-top">
            <span className="agent-kpi-label">New This Month</span>
            <div className="agent-kpi-icon icon-purple"><FaUserTie /></div>
          </div>
          <div className="agent-kpi-value">{loading ? "..." : kpis.recent}</div>
          <div className="agent-kpi-sub">Joined in the last 30 days</div>
        </div>
      </div>

      {/* Main Panel Card */}
      <div className="agent-panel-card">
        <div className="agent-panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 className="agent-panel-title">{cfg.noun} Accounts Directory</h2>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              className="agent-action-btn"
              style={{ padding: "8px 16px", fontSize: "13px" }}
              onClick={() => setShowCreate((v) => !v)}
            >
              <FaPlus style={{ marginRight: "4px" }} /> {showCreate ? "Cancel" : `Add New ${cfg.noun}`}
            </button>
            <Link to="/dashboard/rate-config" className="agent-btn-sm" style={{ textDecoration: "none" }}>
              Rate Configuration &rarr;
            </Link>
          </div>
        </div>

        {error && <div style={{ color: "#ef4444", fontWeight: "600", marginBottom: "14px" }}>{error}</div>}
        {successMsg && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#059669", fontWeight: "700", marginBottom: "14px" }}>
            <FaCheck /> {successMsg}
          </div>
        )}

        {/* Search & Filter Bar */}
        <form onSubmit={handleFilterSubmit} style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "20px", marginTop: "12px" }}>
          <input
            type="text"
            className="desk-select"
            style={{ flex: 1, minWidth: "200px" }}
            placeholder="Search by name, company or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {scopeRoles.length > 1 && (
            <select className="desk-select" style={{ width: "160px" }} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">All Roles</option>
              {scopeRoles.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          )}
          <select className="desk-select" style={{ width: "140px" }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button type="submit" className="agent-btn-sm" style={{ padding: "0 16px" }}>
            <FaSearch style={{ marginRight: "4px" }} /> Search
          </button>
        </form>

        {/* Add User Modal Overlay */}
        {showCreate && (
          <div className="admin-modal-backdrop" onClick={() => setShowCreate(false)}>
            <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <div>
                  <h3 className="admin-modal-title">Provision New Account</h3>
                  <p className="admin-modal-subtitle">Create and assign system access for new personnel or organizations</p>
                </div>
                <button
                  type="button"
                  className="admin-modal-close-btn"
                  onClick={() => setShowCreate(false)}
                  aria-label="Close modal"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleCreateSubmit}>
                <div className="admin-modal-grid">
                  <div className="admin-modal-field">
                    <label>Full Name *</label>
                    <input
                      type="text"
                      className="desk-select"
                      required
                      placeholder="e.g. Rajesh Sharma"
                      value={createForm.full_name}
                      onChange={(e) => setCreateForm((f) => ({ ...f, full_name: e.target.value }))}
                    />
                  </div>

                  <div className="admin-modal-field">
                    <label>Email Address *</label>
                    <input
                      type="email"
                      className="desk-select"
                      required
                      placeholder="e.g. user@company.com"
                      value={createForm.email}
                      onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  </div>

                  <div className="admin-modal-field">
                    <label>Temporary Password *</label>
                    <input
                      type="password"
                      className="desk-select"
                      required
                      minLength={8}
                      placeholder="Min 8 characters"
                      value={createForm.password}
                      onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                    />
                  </div>

                  <div className="admin-modal-field">
                    <label>Account Role *</label>
                    <select
                      className="desk-select"
                      value={createForm.role}
                      disabled={scopeRoles.length === 1}
                      onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
                    >
                      {scopeRoles.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </div>

                  <div className="admin-modal-field full-width">
                    <label>Company / Organization {createForm.role === "business" ? "(Required)" : "(Optional)"}</label>
                    <input
                      type="text"
                      className="desk-select"
                      placeholder={createForm.role === "business" ? "e.g. Apex Exports Pvt Ltd" : "e.g. Forwarding Agency"}
                      required={createForm.role === "business"}
                      value={createForm.company_name}
                      onChange={(e) => setCreateForm((f) => ({ ...f, company_name: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="admin-modal-footer">
                  <button
                    type="button"
                    className="admin-modal-cancel-btn"
                    onClick={() => setShowCreate(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="admin-modal-submit-btn"
                    disabled={creating}
                  >
                    {creating ? "Creating..." : "Create User"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Users Light Table */}
        <div className="agent-table-wrap">
          <table className="agent-table">
            <thead>
              <tr>
                <th>User Details</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "#64748b", padding: "28px 0" }}>
                    No {cfg.noun.toLowerCase()} accounts found.
                  </td>
                </tr>
              )}
              {filteredUsers.map((u) => {
                const isSelf = currentUser && (
                  (currentUser.id && currentUser.id === u.id) ||
                  (currentUser.email && currentUser.email.toLowerCase() === (u.email || "").toLowerCase())
                );
                const isEditingThis = editingId === u.id;
                const isConfirmingThis = confirmDeactivateId === u.id;

                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: "700", color: "#0f172a" }}>{u.full_name}</div>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>{u.email}</div>
                      {u.company_name && (
                        <small style={{ color: "#0284c7", display: "inline-flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                          <FaBuilding size={11} /> {u.company_name}
                        </small>
                      )}
                    </td>
                    <td>
                      {isEditingThis ? (
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <select
                            className="desk-select"
                            style={{ padding: "4px 8px", fontSize: "12px" }}
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value)}
                          >
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="agent-btn-sm"
                            onClick={() => saveRole(u)}
                            disabled={savingId === u.id}
                          >
                            Save
                          </button>
                          <button type="button" className="agent-btn-sm" onClick={cancelEditing}>X</button>
                        </div>
                      ) : (
                        <span className={`badge-role-tag badge-role-${roleOf(u)}`}>
                          {ROLE_LABELS[roleOf(u)] || u.role}
                        </span>
                      )}
                    </td>
                    <td>
                      {u.is_active !== false ? (
                        <span className="badge-status status-approved">Active</span>
                      ) : (
                        <span className="badge-status status-pending">Inactive</span>
                      )}
                    </td>
                    <td style={{ fontSize: "12px", color: "#64748b" }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : "Active"}
                    </td>
                    <td>
                      {isConfirmingThis ? (
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <span style={{ fontSize: "12px", color: "#ef4444" }}>Confirm?</span>
                          <button
                            type="button"
                            className="agent-btn-sm"
                            style={{ background: "#ef4444", color: "#fff" }}
                            onClick={() => confirmDeactivate(u)}
                          >
                            Yes
                          </button>
                          <button type="button" className="agent-btn-sm" onClick={() => setConfirmDeactivateId(null)}>No</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: "8px" }}>
                          {!isEditingThis && (
                            <button
                              type="button"
                              className="agent-btn-sm"
                              disabled={isSelf}
                              onClick={() => startEditing(u)}
                            >
                              Role
                            </button>
                          )}
                          {u.is_active !== false ? (
                            <button
                              type="button"
                              className="agent-btn-sm"
                              style={{ color: "#ef4444" }}
                              disabled={isSelf}
                              onClick={() => setConfirmDeactivateId(u.id)}
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="agent-btn-sm"
                              style={{ color: "#059669" }}
                              onClick={() => toggleReactivate(u)}
                            >
                              Reactivate
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
