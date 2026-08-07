import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaSearch, FaSyncAlt } from "react-icons/fa";
import { listQuotes } from "../api/quotes";
import { useAuth } from "../context/AuthContext";
import "./ShipmentsHistory.css";

const MODE_LABELS = { air: "Air", ocean: "Ocean", road: "Road", rail: "Rail" };
const STATUS_LABELS = { draft: "Draft", confirmed: "Booked" };

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatMoney(amount, currency) {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: currency || "INR", maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency || ""} ${amount}`;
  }
}

export default function ShipmentsHistory() {
  const { token } = useAuth();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await listQuotes(token);
      setQuotes(Array.isArray(data) ? data : data?.results || []);
    } catch (err) {
      setError(err.message || "Unable to load your shipment history.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return quotes.filter((item) => {
      const matchesSearch =
        !q ||
        item.origin?.toLowerCase().includes(q) ||
        item.destination?.toLowerCase().includes(q) ||
        item.id?.toLowerCase().includes(q);
      const matchesMode = modeFilter === "all" || item.mode === modeFilter;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesMode && matchesStatus;
    });
  }, [quotes, search, modeFilter, statusFilter]);

  const kpis = useMemo(() => {
    const now = new Date();
    const thisMonth = quotes.filter((q) => {
      const d = new Date(q.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const booked = quotes.filter((q) => q.status === "confirmed").length;
    const avgTransit =
      quotes.length > 0
        ? Math.round(quotes.reduce((sum, q) => sum + (q.transit_days || 0), 0) / quotes.length)
        : 0;
    return { total: quotes.length, thisMonth, booked, avgTransit };
  }, [quotes]);

  return (
    <section className="shp-page" aria-labelledby="shp-title">
      <header className="shp-header">
        <div>
          <p className="shp-eyebrow">Retail account</p>
          <h1 id="shp-title">Shipments History</h1>
          <p className="shp-sub">Every quote you&apos;ve generated and every shipment you&apos;ve booked, in one place.</p>
        </div>
        <div className="shp-header-actions">
          <button type="button" className="shp-btn-ghost" onClick={load} disabled={loading}>
            <FaSyncAlt className={loading ? "shp-spin" : ""} /> Refresh
          </button>
          <Link to="/dashboard/generate-quote" className="shp-btn-primary">
            + New quote
          </Link>
        </div>
      </header>

      <div className="shp-kpi-grid">
        <div className="shp-kpi-card">
          <span className="shp-kpi-label">Total quotes</span>
          <span className="shp-kpi-value">{kpis.total}</span>
        </div>
        <div className="shp-kpi-card">
          <span className="shp-kpi-label">This month</span>
          <span className="shp-kpi-value">{kpis.thisMonth}</span>
        </div>
        <div className="shp-kpi-card">
          <span className="shp-kpi-label">Booked shipments</span>
          <span className="shp-kpi-value">{kpis.booked}</span>
        </div>
        <div className="shp-kpi-card">
          <span className="shp-kpi-label">Avg. transit time</span>
          <span className="shp-kpi-value">{kpis.avgTransit ? `${kpis.avgTransit}d` : "—"}</span>
        </div>
      </div>

      <div className="shp-filter-card">
        <div className="shp-filter-controls">
          <div className="shp-search-wrap">
            <FaSearch />
            <input
              type="text"
              placeholder="Origin, destination or quote ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
            <option value="all">All modes</option>
            <option value="air">Air</option>
            <option value="ocean">Ocean</option>
            <option value="road">Road</option>
            <option value="rail">Rail</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="confirmed">Booked</option>
          </select>
          <span className="shp-results-count">{filtered.length} results</span>
        </div>

        {error && <p className="shp-error">{error}</p>}

        <div className="shp-table-wrap">
          <table className="shp-table">
            <thead>
              <tr>
                <th>Quote</th>
                <th>Lane</th>
                <th>Mode</th>
                <th>Weight / Volume</th>
                <th>Transit</th>
                <th>Total</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="shp-empty-row">Loading your shipment history…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="shp-empty-row">
                    No shipments yet. <Link to="/dashboard/generate-quote">Generate your first quote</Link>.
                  </td>
                </tr>
              ) : (
                filtered.map((q) => (
                  <tr key={q.id}>
                    <td className="shp-mono">#{q.id.slice(-6).toUpperCase()}</td>
                    <td>{q.origin} → {q.destination}</td>
                    <td>{MODE_LABELS[q.mode] || q.mode}</td>
                    <td>{q.weight_kg} kg / {q.volume_m3} m³</td>
                    <td>{q.transit_days ? `${q.transit_days}d` : "—"}</td>
                    <td>{formatMoney(q.breakdown?.total, q.currency)}</td>
                    <td>
                      <span className={`shp-status shp-status--${q.status}`}>
                        {STATUS_LABELS[q.status] || q.status}
                      </span>
                    </td>
                    <td>{formatDate(q.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
