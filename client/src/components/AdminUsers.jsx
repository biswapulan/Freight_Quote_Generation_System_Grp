import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { listUsers, createUser, updateUser, deactivateUser } from "../api/admin";
import "./AdminUsers.css";

const ROLE_LABELS = { admin: "Admin", business: "Business", retail: "Retail" };
const ROLE_OPTIONS = ["admin", "business", "retail"];

const EMPTY_FORM = { full_name: "", email: "", password: "", role: "admin", company_name: "" };

export default function AdminUsers() {
  const { token, user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editRole, setEditRole] = useState("");
  const [savingId, setSavingId] = useState(null);

  const [confirmDeactivateId, setConfirmDeactivateId] = useState(null);

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const data = await listUsers(token, {
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        search: search || undefined,
      });
      setUsers(data.results || []);
    } catch (err) {
      setError(err.message || "Could not load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function handleFilterSubmit(e) {
    e.preventDefault();
    loadUsers();
  }

  async function handleCreateSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setCreating(true);
    try {
      await createUser(token, createForm);
      setSuccessMsg(`${createForm.full_name} was added as ${ROLE_LABELS[createForm.role]}.`);
      setCreateForm(EMPTY_FORM);
      setShowCreate(false);
      loadUsers();
    } catch (err) {
      setError(err.message || "Could not create user.");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(u) {
    setEditingId(u.id);
    setEditRole(u.role);
    setError("");
    setSuccessMsg("");
  }

  async function saveRole(u) {
    setSavingId(u.id);
    setError("");
    try {
      await updateUser(token, u.id, { role: editRole });
      setEditingId(null);
      setSuccessMsg(`${u.full_name}'s role was updated to ${ROLE_LABELS[editRole]}.`);
      loadUsers();
    } catch (err) {
      setError(err.message || "Could not update role.");
    } finally {
      setSavingId(null);
    }
  }

  async function toggleActive(u) {
    setError("");
    setSuccessMsg("");
    if (u.is_active) {
      setConfirmDeactivateId(u.id);
      return;
    }
    setSavingId(u.id);
    try {
      await updateUser(token, u.id, { is_active: true });
      setSuccessMsg(`${u.full_name} was reactivated.`);
      loadUsers();
    } catch (err) {
      setError(err.message || "Could not reactivate user.");
    } finally {
      setSavingId(null);
    }
  }

  async function confirmDeactivate(u) {
    setSavingId(u.id);
    setError("");
    try {
      await deactivateUser(token, u.id);
      setSuccessMsg(`${u.full_name} was deactivated.`);
      setConfirmDeactivateId(null);
      loadUsers();
    } catch (err) {
      setError(err.message || "Could not deactivate user.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="admin-page">
      <div className="admin-panel admin-panel-wide">
        <div className="admin-top-row">
          <Link to="/dashboard" className="admin-back-link">
            &larr; Back to dashboard
          </Link>
          <Link to="/admin" className="admin-nav-link">
            Rate Configuration &rarr;
          </Link>
        </div>

        <h1>User Management</h1>
        <p className="admin-subtitle">
          Manage admin, business, and retail accounts — add new admins, change roles, and deactivate accounts.
        </p>

        {error && <p className="admin-error">{error}</p>}
        {successMsg && <p className="admin-success">{successMsg}</p>}

        <form className="admin-users-filters" onSubmit={handleFilterSubmit}>
          <input
            type="text"
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">All roles</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button type="submit" className="admin-filter-btn">Search</button>
          <button
            type="button"
            className="admin-save-btn admin-add-btn"
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? "Cancel" : "+ Add User"}
          </button>
        </form>

        {showCreate && (
          <form onSubmit={handleCreateSubmit} className="admin-create-form">
            <div className="admin-grid">
              <label className="admin-field">
                <span>Full name</span>
                <input
                  type="text"
                  required
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, full_name: e.target.value }))}
                />
              </label>
              <label className="admin-field">
                <span>Email</span>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                />
              </label>
              <label className="admin-field">
                <span>Temporary password</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={createForm.password}
                  onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                />
              </label>
              <label className="admin-field">
                <span>Role</span>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </label>
              {createForm.role === "business" && (
                <label className="admin-field">
                  <span>Company name</span>
                  <input
                    type="text"
                    required
                    value={createForm.company_name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, company_name: e.target.value }))}
                  />
                </label>
              )}
            </div>
            <button type="submit" className="admin-save-btn" disabled={creating}>
              {creating ? "Creating..." : "Create User"}
            </button>
          </form>
        )}

        {loading && <p className="admin-muted">Loading...</p>}

        {!loading && (
          <div className="admin-users-table-wrap">
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="admin-muted admin-empty-row">No users match these filters.</td>
                  </tr>
                )}
                {users.map((u) => {
                  const isSelf = currentUser && u.id === currentUser.id;
                  return (
                    <tr key={u.id} className={!u.is_active ? "admin-row-inactive" : ""}>
                      <td>{u.full_name}{isSelf && <span className="admin-you-tag"> (you)</span>}</td>
                      <td>{u.email}</td>
                      <td>
                        {editingId === u.id ? (
                          <select value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`admin-role-badge admin-role-${u.role}`}>{ROLE_LABELS[u.role] || u.role}</span>
                        )}
                      </td>
                      <td>
                        <span className={`admin-status-badge ${u.is_active ? "admin-status-active" : "admin-status-inactive"}`}>
                          {u.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="admin-muted">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="admin-row-actions">
                        {editingId === u.id ? (
                          <>
                            <button
                              className="admin-link-btn"
                              disabled={savingId === u.id}
                              onClick={() => saveRole(u)}
                            >
                              {savingId === u.id ? "Saving..." : "Save"}
                            </button>
                            <button className="admin-link-btn" onClick={() => setEditingId(null)}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="admin-link-btn"
                              disabled={isSelf}
                              title={isSelf ? "You can't change your own role" : ""}
                              onClick={() => startEdit(u)}
                            >
                              Edit role
                            </button>
                            <button
                              className={`admin-link-btn ${u.is_active ? "admin-link-danger" : ""}`}
                              disabled={isSelf || savingId === u.id}
                              title={isSelf ? "You can't deactivate your own account" : ""}
                              onClick={() => toggleActive(u)}
                            >
                              {u.is_active ? "Deactivate" : "Reactivate"}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmDeactivateId && (
        <div className="admin-modal-backdrop" onClick={() => setConfirmDeactivateId(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Deactivate this user?</h2>
            <p>They won't be able to log in until reactivated. This doesn't delete their history.</p>
            <div className="admin-modal-actions">
              <button className="admin-link-btn" onClick={() => setConfirmDeactivateId(null)}>
                Cancel
              </button>
              <button
                className="admin-save-btn admin-danger-btn"
                onClick={() => confirmDeactivate(users.find((u) => u.id === confirmDeactivateId))}
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
