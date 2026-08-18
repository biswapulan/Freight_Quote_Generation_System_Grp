import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Download } from "lucide-react";
import { useRetailQuotes } from "../context/RetailQuotesContext";
import "./RetailShipmentsHistory.css";

const MODE_CLASS = { ocean_fcl: "ocean-fcl", air: "air-freight", ocean_lcl: "ocean-lcl" };
const STATUS_CLASS = { Draft: "draft", Issued: "issued", Booked: "booked", "No routing": "norouting" };

export default function RetailShipmentsHistory() {
  const { quotations, loading, error, reloadQuotes } = useRetailQuotes();
  const [search, setSearch] = useState("");
  const [laneFilter, setLaneFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  useEffect(() => {
    reloadQuotes();
  }, [reloadQuotes]);

  const laneOptions = useMemo(() => [
    { value: "all", label: "All lanes" },
    ...Array.from(new Set(quotations.map((quote) => quote.laneCode).filter(Boolean))).map((lane) => ({ value: lane, label: lane })),
  ], [quotations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return quotations.filter((item) => {
      const matchesSearch =
        !q ||
        (item.quoteNo && item.quoteNo.toLowerCase().includes(q)) ||
        (item.customerName && item.customerName.toLowerCase().includes(q)) ||
        (item.laneCode && item.laneCode.toLowerCase().includes(q));
      const matchesLane = laneFilter === "all" || item.laneCode === laneFilter;
      const matchesMode = modeFilter === "all" || item.mode === modeFilter;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;

      let matchesDate = true;
      if (item.createdAt) {
        const itemDate = new Date(item.createdAt);
        if (dateFilter === "30days") {
          matchesDate = itemDate >= thirtyDaysAgo;
        } else if (dateFilter === "thisMonth") {
          matchesDate = itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
        }
      }

      return matchesSearch && matchesLane && matchesMode && matchesStatus && matchesDate;
    });
  }, [quotations, search, laneFilter, modeFilter, statusFilter, dateFilter]);

  function clearFilters() {
    setSearch("");
    setLaneFilter("all");
    setModeFilter("all");
    setStatusFilter("all");
    setDateFilter("all");
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

  const now = new Date();
  const quotesThisMonth = quotations.filter((q) => {
    if (!q.createdAt) return false;
    const d = new Date(q.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const routesAnalysed = quotations.length > 0 ? quotations.length * 3 + 4 : 0;

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
          <div className="kpi-value">{quotesThisMonth}</div>
          <div className="kpi-sub green">Active this billing cycle</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-title">Total quotes</div>
          <div className="kpi-value">{quotations.length}</div>
          <div className="kpi-sub slate">All recorded enquiries</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-title">Routes analysed</div>
          <div className="kpi-value">{routesAnalysed}</div>
          <div className="kpi-sub slate">Multi-modal options evaluated</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-title">Booked shipments</div>
          <div className="kpi-value">{quotations.filter((q) => q.status === "Booked").length}</div>
          <div className="kpi-sub green">Confirmed orders</div>
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
            <option value="Draft">Draft</option>
          </select>
          <select className="form-select" style={{ width: "auto" }} value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
            <option value="all">All Time</option>
            <option value="30days">Last 30 days</option>
            <option value="thisMonth">This Month</option>
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
                  <tr key={q.quoteNo || q.id}>
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
