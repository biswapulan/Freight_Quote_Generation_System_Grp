import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaShip } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { listQuotes } from "../api/quotes";
import "./Dashboard.css";

const ROLE_LABELS = { retail: "Retail account", business: "Business account", admin: "Admin" };

function Dashboard() {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const [quotes, setQuotes] = useState([]);
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    setLoadingQuotes(true);
    listQuotes(token)
      .then((data) => setQuotes(data.results || []))
      .catch((err) => setError(err.message || "Could not load quote history."))
      .finally(() => setLoadingQuotes(false));
  }, [token]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  if (!user) return null;

  return (
    <main className="dashboard-page">
      <section className="dashboard-panel dashboard-panel-wide">
        <div className="dashboard-brand">
          <FaShip className="dashboard-ship" />
          <span>FreightAI</span>
        </div>

        <div className="dashboard-content">
          <p className="dashboard-kicker">
            {ROLE_LABELS[user.role] || "Account"} dashboard
          </p>
          <h1>Welcome, {user.full_name}</h1>
          {user.role === "business" && user.company_name && (
            <p>{user.company_name}</p>
          )}
        </div>

        <div className="dashboard-actions">
          <Link to="/quote" className="dashboard-primary-btn">
            + New Quote
          </Link>
          {user.role === "admin" && (
            <Link to="/admin" className="dashboard-secondary-btn">
              Admin: Rate Config
            </Link>
          )}
        </div>

        <div className="dashboard-history">
          <h2>Quote History</h2>

          {loadingQuotes && <p className="dashboard-muted">Loading your quotes...</p>}
          {error && <p className="dashboard-error">{error}</p>}

          {!loadingQuotes && !error && quotes.length === 0 && (
            <p className="dashboard-muted">
              No quotes yet — generate your first one to see it here.
            </p>
          )}

          {!loadingQuotes && quotes.length > 0 && (
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Mode</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id}>
                    <td>
                      {q.origin} &rarr; {q.destination}
                    </td>
                    <td className="dashboard-mode">{q.mode}</td>
                    <td>
                      {q.currency} {q.breakdown.total.toLocaleString()}
                    </td>
                    <td>
                      <span className={`dashboard-status dashboard-status-${q.status}`}>
                        {q.status}
                      </span>
                    </td>
                    <td>{new Date(q.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <button type="button" className="dashboard-logout" onClick={handleLogout}>
          Log Out
        </button>
      </section>
    </main>
  );
}

export default Dashboard;
