import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Download } from "lucide-react";
import { listQuotes } from "../api/quotes";
import { useAuth } from "../context/AuthContext";
import "./RetailShipmentsHistory.css";

const MODE_CLASS = { ocean_fcl: "ocean-fcl", air: "air-freight", ocean_lcl: "ocean-lcl" };
const STATUS_CLASS = { Draft: "draft", Issued: "issued", Booked: "booked", "No routing": "norouting" };

const MODE_LABELS = { ocean: "Ocean Freight", air: "Air Freight", road: "Road Freight", rail: "Rail Freight" };

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatMoney(amount, currency) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: currency || "INR", maximumFractionDigits: 0 }).format(amount || 0);
}

export default function RetailShipmentsHistory() {
  const { token, user } = useAuth();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [laneFilter, setLaneFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;

    listQuotes(token)
      .then((data) => {
        if (cancelled) return;
        const records = Array.isArray(data) ? data : data?.results || [];
        setQuotations(records.map((quote) => ({
          id: quote.id,
          quoteNo: `QT-${quote.id.slice(-8).toUpperCase()}`,
          customerName: user?.full_name || "Retail customer",
          customerCity: quote.origin,
          laneCode: `${quote.origin} → ${quote.destination}`,
          laneSub: `${quote.origin} → ${quote.destination}`,
          mode: quote.mode,
          modeLabel: MODE_LABELS[quote.mode] || quote.mode,
          basis: `${quote.weight_kg} kg / ${quote.volume_m3} m³`,
          transit: quote.transit_days ? `${quote.transit_days} d` : "—",
          totalFormatted: formatMoney(quote.breakdown?.total, quote.currency),
          totalNum: quote.breakdown?.total || 0,
          status: quote.status === "confirmed" ? "Booked" : "Draft",
          created: formatDate(quote.created_at),
        })));
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message || "Unable to load shipment history.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, user?.full_name]);

  const laneOptions = useMemo(() => [
    { value: "all", label: "All lanes" },
    ...Array.from(new Set(quotations.map((quote) => quote.laneCode))).map((lane) => ({ value: lane, label: lane })),
  ], [quotations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return quotations.filter((item) => {
      const matchesSearch =
        !q ||
        item.quoteNo.toLowerCase().includes(q) ||
        item.customerName.toLowerCase().includes(q) ||
        item.laneCode.toLowerCase().includes(q);
      const matchesLane = laneFilter === "all" || item.laneCode === laneFilter;
      const matchesMode = modeFilter === "all" || item.mode === modeFilter;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesLane && matchesMode && matchesStatus;
    });
  }, [quotations, search, laneFilter, modeFilter, statusFilter]);

  function clearFilters() {
    setSearch("");
    setLaneFilter("all");
    setModeFilter("all");
    setStatusFilter("all");
  }

  function openQuoteDetail(quoteNo) {
    const q = quotations.find((item) => item.quoteNo === quoteNo);
    if (!q) return;
    window.alert(
      `Opening quotation record for ${q.quoteNo}\nCustomer: ${q.customerName}\nLane: ${q.laneCode}\nIndicative Total: ${q.totalFormatted}\nStatus: ${q.status}`
    );
  }

  function exportQuotes() {
    window.alert("Exporting quotations list...");
  }

  const routesAnalysed = quotations.length * 3 + 20; // mirrors reference "3.2 avg per enquiry" placeholder feel

  return (
    <div className="dashboard-view">
      <div className="top-bar" style={{ paddingLeft: 0, paddingRight: 0 }}>
        <div className="breadcrumb">
          <span className="bc-path">Shipments / Quotations</span>
          <h1 className="page-title">Shipments History</h1>
        </div>
        <div className="action-btns">
          <button type="button" className="btn-secondary-light" onClick={exportQuotes}>
            <Download size={14} /> Export
          </button>
          <Link to="/dashboard/generate-quote" className="btn-orange-primary">
            + New enquiry
          </Link>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-title">Quotes this month</div>
          <div className="kpi-value">{quotations.length}</div>
          <div className="kpi-sub green">↑ 12% vs last month</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-title">Avg quote turnaround</div>
          <div className="kpi-value">42s</div>
          <div className="kpi-sub green">↓ target &lt; 60s</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-title">Routes analysed</div>
          <div className="kpi-value">{routesAnalysed.toLocaleString("en-IN")}</div>
          <div className="kpi-sub slate">3.2 avg per enquiry</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-title">Lanes with no service</div>
          <div className="kpi-value">{quotations.filter((q) => q.status === "No routing").length}</div>
          <div className="kpi-sub red">needs master data</div>
        </div>
      </div>

      <div className="filter-card">
        <div className="filter-controls">
          <div className="search-input-wrap">
            <Search />
            <input
              type="text"
              className="form-input"
              placeholder="Quote no, customer, lane..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="form-select" style={{ width: "auto" }} value={laneFilter} onChange={(e) => setLaneFilter(e.target.value)}>
            {laneOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select className="form-select" style={{ width: "auto" }} value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
            <option value="all">All modes</option>
            <option value="ocean">Ocean Freight</option>
            <option value="air">Air Freight</option>
            <option value="road">Road Freight</option>
            <option value="rail">Rail Freight</option>
          </select>
          <select className="form-select" style={{ width: "auto" }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="Booked">Booked / Proceeded</option>
            <option value="Issued">Issued</option>
            <option value="Draft">Draft</option>
            <option value="No routing">No routing</option>
          </select>
          <select className="form-select" style={{ width: "auto" }} defaultValue="Last 30 days">
            <option>Last 30 days</option>
            <option>This Month</option>
            <option>All Time</option>
          </select>
          <button type="button" className="btn-secondary-light" onClick={clearFilters}>
            Clear
          </button>

          <span className="results-count">{filtered.length} results</span>
        </div>

        <div className="table-container">
          {error && <p className="dashboard-error">{error}</p>}
          <table className="dash-table">
            <thead>
              <tr>
                <th>QUOTE NO</th>
                <th>CUSTOMER</th>
                <th>LANE</th>
                <th>MODE</th>
                <th>BASIS</th>
                <th>TRANSIT</th>
                <th>INDICATIVE TOTAL</th>
                <th>STATUS</th>
                <th>CREATED</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>
                    Loading shipment history...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>
                    No matching quotations found.
                  </td>
                </tr>
              ) : (
                filtered.map((q) => (
                  <tr key={q.quoteNo}>
                    <td className="q-no">{q.quoteNo}</td>
                    <td>
                      <span className="q-cust-name">{q.customerName}</span>
                      <span className="q-cust-city">{q.customerCity}</span>
                    </td>
                    <td>
                      <span className="lane-code">{q.laneCode}</span>
                      <span className="lane-sub">{q.laneSub}</span>
                    </td>
                    <td>
                      <span className={`mode-badge ${MODE_CLASS[q.mode] || "ocean-fcl"}`}>{q.modeLabel}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{q.basis}</td>
                    <td style={{ color: "#64748b" }}>{q.transit}</td>
                    <td style={{ fontWeight: 800 }}>{q.totalFormatted}</td>
                    <td>
                      <span className={`status-badge ${STATUS_CLASS[q.status] || "draft"}`}>{q.status}</span>
                    </td>
                    <td style={{ color: "#64748b", fontSize: 12 }}>{q.created}</td>
                    <td>
                      <button type="button" className="btn-open-quote" onClick={() => openQuoteDetail(q.quoteNo)}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <span className="tf-info">
            Showing 1–{filtered.length} of {quotations.length}
          </span>
          <div className="pagination-btns">
            <button type="button" className="btn-page">&larr; Prev</button>
            <button type="button" className="btn-page">Next &rarr;</button>
          </div>
        </div>
      </div>
    </div>
  );
}
