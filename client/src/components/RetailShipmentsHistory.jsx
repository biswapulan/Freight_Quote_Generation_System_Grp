import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Download,
  X,
  Copy,
  Check,
  MapPin,
  Ship,
  Clock,
  Box,
  User,
  Printer,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  FileText,
  ThumbsUp,
  ThumbsDown,
  Cpu,
  Zap,
  AlertTriangle,
  Send,
  Upload,
} from "lucide-react";
import { useRetailQuotes } from "../context/RetailQuotesContext";
import {
  STATUS_CONFIG,
  normalizeWorkflowStatus,
  SHIPMENT_STATUS_CONFIG,
  normalizeShipmentStatus,
  getShipmentStatusFromQuoteStatus,
  getPlatformQuotes,
  updateQuoteStatusInStore,
} from "../utils/quoteWorkflow";
import QuoteWorkflowStepper from "./QuoteWorkflowStepper";
import "./RetailShipmentsHistory.css";

const MODE_CLASS = { ocean_fcl: "ocean-fcl", air: "air-freight", ocean_lcl: "ocean-lcl", ocean: "ocean-fcl" };
const STATUS_CLASS = { Draft: "draft", Issued: "issued", Booked: "booked", "No routing": "norouting" };

export default function RetailShipmentsHistory({ viewMode = "quotes" }) {
  const { quotations, loading, error, reloadQuotes } = useRetailQuotes();
  const [search, setSearch] = useState("");
  const [laneFilter, setLaneFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [copied, setCopied] = useState(false);

  const isShipmentMode = viewMode === "shipments";

  useEffect(() => {
    reloadQuotes();
  }, [reloadQuotes]);

  // Close modal on escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setSelectedQuote(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const laneOptions = useMemo(() => [
    { value: "all", label: "All lanes" },
    ...Array.from(new Set(quotations.map((quote) => quote.laneCode).filter(Boolean))).map((lane) => ({ value: lane, label: lane })),
  ], [quotations]);

  // If in shipments mode, focus on confirmed/booked cargo orders
  const baseList = useMemo(() => {
    if (isShipmentMode) {
      return quotations.filter((q) => q.status === "Booked" || q.status === "confirmed" || q.status === "Issued");
    }
    return quotations;
  }, [quotations, isShipmentMode]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return baseList.filter((item) => {
      const matchesSearch =
        !q ||
        (item.quoteNo && item.quoteNo.toLowerCase().includes(q)) ||
        (item.customerName && item.customerName.toLowerCase().includes(q)) ||
        (item.laneCode && item.laneCode.toLowerCase().includes(q)) ||
        (item.destination && item.destination.toLowerCase().includes(q));
      const matchesLane = laneFilter === "all" || item.laneCode === laneFilter;
      const matchesMode = modeFilter === "all" || item.mode === modeFilter;
      const effectiveStatus = isShipmentMode
        ? (item.shipmentStatus ? normalizeShipmentStatus(item.shipmentStatus) : getShipmentStatusFromQuoteStatus(item.status))
        : normalizeWorkflowStatus(item.status);
      const matchesStatus = statusFilter === "all" || effectiveStatus === statusFilter;

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
  }, [baseList, search, laneFilter, modeFilter, statusFilter, dateFilter]);

  function clearFilters() {
    setSearch("");
    setLaneFilter("all");
    setModeFilter("all");
    setStatusFilter("all");
    setDateFilter("all");
  }

  function openQuoteDetail(quoteNo) {
    const q = quotations.find((item) => item.quoteNo === quoteNo || item.id === quoteNo);
    if (!q) return;
    setSelectedQuote(q);
    setCopied(false);
  }

  function handleAcceptQuote(quoteNo) {
    updateQuoteStatusInStore(quoteNo, "ACCEPTED", {
      agentRemarks: "Customer accepted quotation. Space locked on vessel.",
      confirmedAt: new Date().toISOString(),
    });
    reloadQuotes();
    if (selectedQuote) {
      setSelectedQuote((prev) => ({ ...prev, status: "ACCEPTED" }));
    }
  }

  function handleRejectQuote(quoteNo) {
    updateQuoteStatusInStore(quoteNo, "REJECTED", {
      agentRemarks: "Customer declined terms / cancelled request.",
      rejectedAt: new Date().toISOString(),
    });
    reloadQuotes();
    if (selectedQuote) {
      setSelectedQuote((prev) => ({ ...prev, status: "REJECTED" }));
    }
  }

  function handleCustomerRequestQuote(quoteNo) {
    const extra = {
      status: "REQUESTED",
      shipmentStatus: "SUBMITTED",
      agentRemarks: "Customer submitted official quote request. Forwarded to Operations & Customs Review queue.",
      customsRemarks: "Shipment enquiry requested. Awaiting customs compliance verification.",
      requiresCustomsReview: true,
      lastWorkflowTransitionAt: new Date().toISOString(),
    };
    updateQuoteStatusInStore(quoteNo, "REQUESTED", extra);
    reloadQuotes();
    if (selectedQuote) {
      setSelectedQuote((prev) => ({ ...prev, ...extra }));
    }
  }

  function handleFileSelected(docName, file) {
    if (!selectedQuote || !file) return;
    const qId = selectedQuote.quoteNo || selectedQuote.id;
    const currentDocs = selectedQuote.documents || [
      { name: "Commercial Invoice", status: "PENDING" },
      { name: "Packing List", status: "PENDING" },
      { name: "Bill of Lading Draft", status: "PENDING" },
      { name: "Certificate of Origin", status: "PENDING" },
    ];

    const sizeStr = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;

    const updatedDocs = currentDocs.map((d) =>
      d.name.toLowerCase() === docName.toLowerCase()
        ? {
            ...d,
            status: "UPLOADED",
            fileName: file.name,
            fileSize: sizeStr,
            uploadedAt: new Date().toISOString(),
          }
        : d
    );

    const uploadedCount = updatedDocs.filter((d) => d.status === "VERIFIED" || d.status === "UPLOADED").length;

    const extra = {
      documents: updatedDocs,
      documentsStatus: `${uploadedCount}/${updatedDocs.length} Uploaded (Pending Customs Review)`,
      customsRemarks: `Customer uploaded "${file.name}" for ${docName}. Pending verification by Customs Officer.`,
      status: selectedQuote.status === "DRAFT" ? "REQUESTED" : "PENDING_REVIEW",
      shipmentStatus: "ANALYZED",
      lastWorkflowTransitionAt: new Date().toISOString(),
    };

    updateQuoteStatusInStore(qId, extra.status, extra);
    reloadQuotes();
    if (selectedQuote) {
      setSelectedQuote((prev) => ({ ...prev, ...extra }));
    }
  }

  function copyQuoteId(id) {
    if (!id) return;
    navigator.clipboard?.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function exportQuotes() {
    if (!filtered || filtered.length === 0) {
      return;
    }
    const filenamePrefix = isShipmentMode ? "freightai_cargo_shipments" : "freightai_quotations";
    const headers = isShipmentMode
      ? ["B/L Tracking No", "Consignee", "Port Origin", "Port Destination", "Vessel", "Cargo Basis", "Transit Time", "Status", "Date"]
      : ["Quote No", "Customer", "City", "Lane", "Mode", "Basis", "Transit", "Total", "Status", "Created Date"];
    
    const rows = filtered.map((q) => isShipmentMode ? [
      `BL-${(q.quoteNo || "").replace("QT-", "")}`,
      q.customerName || "",
      q.origin || "",
      q.destination || "",
      "MSC Paloma V.24",
      q.basis || "",
      q.transit || "",
      q.status || "",
      q.created || ""
    ] : [
      q.quoteNo || "",
      q.customerName || "",
      q.customerCity || "",
      q.laneCode || "",
      q.modeLabel || q.mode || "",
      q.basis || "",
      q.transit || "",
      q.totalFormatted || q.totalNum || "",
      q.status || "",
      q.created || ""
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const now = new Date();
  const quotesThisMonth = quotations.filter((q) => {
    if (!q.createdAt) return false;
    const d = new Date(q.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const bookedCount = quotations.filter((q) => q.status === "Booked" || q.status === "confirmed").length;
  const routesAnalysed = quotations.length > 0 ? quotations.length * 3 + 4 : 0;

  return (
    <div className="dashboard-view">
      <div className="top-bar" style={{ paddingLeft: 0, paddingRight: 0 }}>
        <div className="breadcrumb">
          <span className="bc-path">
            {isShipmentMode ? "Logistics / Cargo Execution" : "Shipments / Quotations"}
          </span>
          <h1 className="page-title">
            {isShipmentMode ? "My Cargo Shipments & Tracking" : "My Quotations & Inquiries"}
          </h1>
        </div>
        <div className="action-btns">
          <button type="button" className="btn-secondary-light" onClick={exportQuotes}>
            <Download size={14} /> {isShipmentMode ? "Export Manifest" : "Export Quotes"}
          </button>
          <Link to="/dashboard/request-quote" className="btn-orange-primary">
            {isShipmentMode ? "+ Book Shipment" : "+ New enquiry"}
          </Link>
        </div>
      </div>

      {/* Differentiated KPI Cards */}
      <div className="kpi-grid">
        {isShipmentMode ? (
          <>
            <div className="kpi-card">
              <div className="kpi-title">Active Transits</div>
              <div className="kpi-value">{bookedCount}</div>
              <div className="kpi-sub green">In maritime route</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">Customs Compliance</div>
              <div className="kpi-value">100%</div>
              <div className="kpi-sub green">All documents approved</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">Average Sea Transit</div>
              <div className="kpi-value">14.5 d</div>
              <div className="kpi-sub slate">On-schedule velocity</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">Confirmed Orders</div>
              <div className="kpi-value">{bookedCount}</div>
              <div className="kpi-sub green">B/L issued & moving</div>
            </div>
          </>
        ) : (
          <>
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
              <div className="kpi-value">{bookedCount}</div>
              <div className="kpi-sub green">Confirmed orders</div>
            </div>
          </>
        )}
      </div>

      <div className="filter-card">
        <div className="filter-controls">
          <div className="search-input-wrap">
            <Search />
            <input
              type="text"
              className="form-input"
              placeholder={isShipmentMode ? "Tracking no, vessel, lane..." : "Quote no, customer, lane..."}
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
            {isShipmentMode ? (
              <>
                <option value="DRAFT">DRAFT</option>
                <option value="SUBMITTED">SUBMITTED</option>
                <option value="PROCESSING">PROCESSING</option>
                <option value="ANALYZED">ANALYZED</option>
                <option value="QUOTED">QUOTED</option>
                <option value="CLOSED">CLOSED</option>
                <option value="CANCELLED">CANCELLED</option>
              </>
            ) : (
              <>
                <option value="DRAFT">DRAFT</option>
                <option value="GENERATED">GENERATED</option>
                <option value="PENDING_REVIEW">PENDING_REVIEW</option>
                <option value="APPROVED">APPROVED</option>
                <option value="SENT">SENT</option>
                <option value="ACCEPTED">ACCEPTED</option>
                <option value="REJECTED">REJECTED</option>
                <option value="EXPIRED">EXPIRED</option>
              </>
            )}
          </select>
          <select className="form-select" style={{ width: "auto" }} value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
            <option value="all">All Time</option>
            <option value="30days">Last 30 days</option>
            <option value="thisMonth">This Month</option>
          </select>
          <button type="button" className="btn-secondary-light" onClick={clearFilters}>
            Clear
          </button>

          <span className="results-count">{filtered.length} {isShipmentMode ? "shipments" : "quotes"}</span>
        </div>

        <div className="table-container">
          {error && <p className="dashboard-error">{error}</p>}
          <table className="dash-table">
            <thead>
              {isShipmentMode ? (
                <tr>
                  <th>TRACKING / B/L</th>
                  <th>LANE & VESSEL</th>
                  <th>CONTAINER / BASIS</th>
                  <th>TRANSIT PROGRESS</th>
                  <th>ESTIMATED ETA</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              ) : (
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
              )}
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>
                    Loading {isShipmentMode ? "shipments" : "quotations"}...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>
                    No matching {isShipmentMode ? "active shipments" : "quotations"} found.
                  </td>
                </tr>
              ) : isShipmentMode ? (
                /* Shipment Specific Table Rows */
                filtered.map((q, idx) => (
                  <tr key={q.quoteNo || q.id}>
                    <td className="q-no">
                      <span className="bl-track-code">{`BL-${(q.quoteNo || "").replace("QT-", "")}`}</span>
                      <span className="bl-ref-sub">Ref: {q.quoteNo}</span>
                    </td>
                    <td>
                      <span className="lane-code">{q.laneCode}</span>
                      <span className="lane-sub">Vessel: {idx % 2 === 0 ? "MSC Paloma V.24" : "Maersk Voyager"}</span>
                    </td>
                    <td>
                      <span className="font-semibold text-slate-800">{q.basis}</span>
                      <span className="bl-ref-sub">Container: {idx % 2 === 0 ? "MSCU-884920-1" : "MAEU-440192-9"}</span>
                    </td>
                    <td>
                      <div className="ship-progress-cell">
                        <div className="ship-progress-bar">
                          <div
                            className="ship-progress-fill"
                            style={{ width: q.status === "Booked" ? "65%" : "25%" }}
                          ></div>
                        </div>
                        <span className="ship-progress-label">
                          {q.status === "Booked" ? "High Seas · In Transit" : "Depot Gate-In"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="font-semibold text-slate-800">{q.transit}</span>
                      <span className="bl-ref-sub">ETA: On schedule</span>
                    </td>
                    <td>
                      {(() => {
                        const shipStatus = q.shipmentStatus ? normalizeShipmentStatus(q.shipmentStatus) : getShipmentStatusFromQuoteStatus(q.status);
                        const cfg = SHIPMENT_STATUS_CONFIG[shipStatus] || SHIPMENT_STATUS_CONFIG.SUBMITTED;
                        return (
                          <span
                            className="status-badge"
                            style={{
                              backgroundColor: cfg.bg || "#f1f5f9",
                              color: cfg.color || "#0f172a",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              letterSpacing: "0.03em",
                              textTransform: "uppercase",
                              border: `1px solid ${cfg.color}33`,
                              padding: "4px 8px",
                              borderRadius: "6px",
                            }}
                          >
                            {cfg.label || shipStatus}
                          </span>
                        );
                      })()}
                    </td>
                    <td>
                      <button type="button" className="btn-open-quote" onClick={() => openQuoteDetail(q.quoteNo)}>
                        Track & Details
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                /* Quotations Specific Table Rows */
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
                      {(() => {
                        const norm = normalizeWorkflowStatus(q.status);
                        const cfg = STATUS_CONFIG[norm] || { label: q.status, badgeClass: "status-tag-draft", color: "#64748b", bg: "#f1f5f9" };
                        return (
                          <span
                            className="status-badge"
                            style={{
                              backgroundColor: cfg.bg || "#f1f5f9",
                              color: cfg.color || "#0f172a",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              letterSpacing: "0.03em",
                              textTransform: "uppercase",
                              border: `1px solid ${cfg.color}33`,
                              padding: "4px 8px",
                              borderRadius: "6px",
                            }}
                          >
                            {cfg.label || norm}
                          </span>
                        );
                      })()}
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

      {/* Professional Shipment Details Modal */}
      {selectedQuote && (
        <div className="rsh-modal-backdrop" onClick={() => setSelectedQuote(null)}>
          <div className="rsh-modal-card" onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="rsh-modal-header">
              <div className="rsh-modal-header-left">
                <div className="rsh-quote-ref-wrap">
                  <span className="rsh-quote-ref-label">QUOTATION RECORD</span>
                  <div className="rsh-quote-ref-val">
                    <strong>{selectedQuote.quoteNo}</strong>
                    <button
                      type="button"
                      className="rsh-copy-btn"
                      title="Copy Quote Reference"
                      onClick={() => copyQuoteId(selectedQuote.quoteNo)}
                    >
                      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>
                <div className="rsh-header-badges">
                  {(() => {
                    const norm = normalizeWorkflowStatus(selectedQuote.status);
                    const cfg = STATUS_CONFIG[norm] || { label: selectedQuote.status, color: "#0284c7", bg: "#e0f2fe" };
                    return (
                      <span
                        className="status-badge"
                        style={{
                          backgroundColor: cfg.bg,
                          color: cfg.color,
                          fontWeight: 700,
                          fontSize: "0.75rem",
                          letterSpacing: "0.03em",
                          textTransform: "uppercase",
                          border: `1px solid ${cfg.color}33`,
                          padding: "4px 10px",
                          borderRadius: "6px",
                        }}
                      >
                        Quote: {cfg.label || norm}
                      </span>
                    );
                  })()}
                  {(() => {
                    const shipStatus = selectedQuote.shipmentStatus ? normalizeShipmentStatus(selectedQuote.shipmentStatus) : getShipmentStatusFromQuoteStatus(selectedQuote.status);
                    const cfg = SHIPMENT_STATUS_CONFIG[shipStatus] || SHIPMENT_STATUS_CONFIG.SUBMITTED;
                    return (
                      <span
                        className="status-badge"
                        style={{
                          backgroundColor: cfg.bg,
                          color: cfg.color,
                          fontWeight: 700,
                          fontSize: "0.75rem",
                          letterSpacing: "0.03em",
                          textTransform: "uppercase",
                          border: `1px solid ${cfg.color}33`,
                          padding: "4px 10px",
                          borderRadius: "6px",
                        }}
                      >
                        Shipment: {cfg.label || shipStatus}
                      </span>
                    );
                  })()}
                  <span className={`mode-badge ${MODE_CLASS[selectedQuote.mode] || "ocean-fcl"}`}>
                    <Ship size={12} style={{ display: "inline", marginRight: 4 }} />
                    {selectedQuote.modeLabel || "Ocean Freight"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="rsh-modal-close"
                onClick={() => setSelectedQuote(null)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="rsh-modal-body">
              {/* Multi-Role 5-Step Quote Lifecycle Stepper */}
              <QuoteWorkflowStepper status={selectedQuote.status} />

              {/* Route Summary Ribbon */}
              <div className="rsh-route-ribbon">
                <div className="rsh-route-node origin">
                  <div className="rsh-node-icon origin">
                    <MapPin size={16} />
                  </div>
                  <div className="rsh-node-info">
                    <span className="rsh-node-label">ORIGIN</span>
                    <strong className="rsh-node-name">{selectedQuote.origin || selectedQuote.customerCity || "Origin Port"}</strong>
                    <span className="rsh-node-sub">{selectedQuote.laneSub ? selectedQuote.laneSub.split("→")[0]?.trim() : "INMAA"}</span>
                  </div>
                </div>

                <div className="rsh-route-transit">
                  <span className="rsh-transit-pill">
                    <Clock size={12} /> {selectedQuote.transit || "14-16 days"}
                  </span>
                  <div className="rsh-route-line">
                    <div className="rsh-route-line-track"></div>
                    <div className="rsh-route-ship-indicator">
                      <Ship size={14} />
                    </div>
                  </div>
                  <span className="rsh-transit-sub">Direct Maritime Transit</span>
                </div>

                <div className="rsh-route-node destination">
                  <div className="rsh-node-icon dest">
                    <MapPin size={16} />
                  </div>
                  <div className="rsh-node-info">
                    <span className="rsh-node-label">DESTINATION</span>
                    <strong className="rsh-node-name">{selectedQuote.destination || "Destination Port"}</strong>
                    <span className="rsh-node-sub">{selectedQuote.laneSub ? selectedQuote.laneSub.split("→")[1]?.trim() : "SGSIN"}</span>
                  </div>
                </div>
              </div>

              {/* Live Cargo Milestone Telemetry Stepper for Booked Shipments */}
              {(isShipmentMode || normalizeWorkflowStatus(selectedQuote.status) === "ACCEPTED") && (
                <div className="rsh-tracking-stepper-wrap">
                  <div className="rsh-stepper-head">
                    <div className="rsh-stepper-title">
                      <Ship size={16} className="text-orange-500" />
                      <strong>Live Cargo Milestone Telemetry</strong>
                    </div>
                    <span className="rsh-stepper-eta">ETA: {selectedQuote.transit || "14d"} · On Schedule</span>
                  </div>
                  <div className="rsh-milestone-steps">
                    <div className="rsh-step completed">
                      <div className="rsh-step-marker"><Check size={12} /></div>
                      <div className="rsh-step-info">
                        <span className="rsh-step-title">1. Gate-In & Laden</span>
                        <span className="rsh-step-sub">Port CFS · Completed</span>
                      </div>
                    </div>
                    <div className="rsh-step-connector completed"></div>
                    <div className="rsh-step completed">
                      <div className="rsh-step-marker"><Check size={12} /></div>
                      <div className="rsh-step-info">
                        <span className="rsh-step-title">2. Customs Cleared</span>
                        <span className="rsh-step-sub">Export Passed · 0 Flags</span>
                      </div>
                    </div>
                    <div className="rsh-step-connector active"></div>
                    <div className="rsh-step active">
                      <div className="rsh-step-marker"><Ship size={12} /></div>
                      <div className="rsh-step-info">
                        <span className="rsh-step-title">3. Sea Transit</span>
                        <span className="rsh-step-sub">MSC Paloma V.24 · Moving</span>
                      </div>
                    </div>
                    <div className="rsh-step-connector"></div>
                    <div className="rsh-step">
                      <div className="rsh-step-marker">4</div>
                      <div className="rsh-step-info">
                        <span className="rsh-step-title">4. Port Berth</span>
                        <span className="rsh-step-sub">Discharge · Scheduled</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Grid 2 Columns: Shipment Specs + Financial Breakdown */}
              <div className="rsh-details-grid">
                
                {/* Column 1: Consignee & Freight Details */}
                <div className="rsh-card-panel">
                  <div className="rsh-panel-head">
                    <User size={15} />
                    <h4>Consignee & Cargo Specifications</h4>
                  </div>
                  <div className="rsh-spec-rows">
                    <div className="rsh-spec-row">
                      <span className="rsh-spec-lbl">Customer Name</span>
                      <span className="rsh-spec-val highlight">{selectedQuote.customerName || "Anand Verma"}</span>
                    </div>
                    <div className="rsh-spec-row">
                      <span className="rsh-spec-lbl">City / Region</span>
                      <span className="rsh-spec-val">{selectedQuote.customerCity || "Chennai, India"}</span>
                    </div>
                    <div className="rsh-spec-row">
                      <span className="rsh-spec-lbl">Cargo Basis</span>
                      <span className="rsh-spec-val font-semibold">{selectedQuote.basis || "12,500 kg / 1 × 40HC"}</span>
                    </div>
                    <div className="rsh-spec-row">
                      <span className="rsh-spec-lbl">Freight Mode</span>
                      <span className="rsh-spec-val">{selectedQuote.modeLabel || "Ocean Freight"}</span>
                    </div>
                    <div className="rsh-spec-row">
                      <span className="rsh-spec-lbl">Booking Date</span>
                      <span className="rsh-spec-val">{selectedQuote.created || "Today"}</span>
                    </div>
                  </div>

                  <div className="rsh-compliance-callout">
                    <ShieldCheck size={16} className="text-emerald-600" />
                    <div>
                      <strong>AI Customs & Risk Cleared</strong>
                      <p>MCDA risk score 18/100 · Open-Meteo route clear · 0 trade restrictions.</p>
                    </div>
                  </div>
                </div>

                {/* Column 2: Commercial Pricing Breakdown */}
                <div className="rsh-card-panel price-panel">
                  <div className="rsh-panel-head">
                    <FileText size={15} />
                    <h4>Commercial Pricing Breakdown</h4>
                  </div>
                  
                  <div className="rsh-fee-breakdown">
                    <div className="rsh-fee-row">
                      <span>Base Freight Handling</span>
                      <span>{selectedQuote.breakdown?.base_handling_fee ? `₹ ${Number(selectedQuote.breakdown.base_handling_fee).toLocaleString("en-IN")}` : "₹ 14,500"}</span>
                    </div>
                    <div className="rsh-fee-row">
                      <span>Sea Distance Transit Fee</span>
                      <span>{selectedQuote.breakdown?.distance_cost ? `₹ ${Number(selectedQuote.breakdown.distance_cost).toLocaleString("en-IN")}` : "₹ 1,15,000"}</span>
                    </div>
                    <div className="rsh-fee-row">
                      <span>Bunker Fuel Surcharge (BAF)</span>
                      <span>{selectedQuote.breakdown?.fuel_surcharge ? `₹ ${Number(selectedQuote.breakdown.fuel_surcharge).toLocaleString("en-IN")}` : "₹ 19,000"}</span>
                    </div>
                    {selectedQuote.breakdown?.container_cost && (
                      <div className="rsh-fee-row">
                        <span>Equipment Multiplier</span>
                        <span>₹ {Number(selectedQuote.breakdown.container_cost).toLocaleString("en-IN")}</span>
                      </div>
                    )}
                    <div className="rsh-fee-divider"></div>
                    <div className="rsh-fee-total-row">
                      <div>
                        <span className="rsh-total-label">Total Indicative Freight</span>
                        <span className="rsh-total-sub">All port surcharges & taxes included</span>
                      </div>
                      <div className="rsh-total-val">
                        {selectedQuote.totalFormatted || `₹ ${Number(selectedQuote.totalNum || 148500).toLocaleString("en-IN")}`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Trade & Customs Documents Panel */}
                <div className="rsh-card-panel docs-panel" style={{ gridColumn: "1 / -1", marginTop: "16px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "18px" }}>
                  <div className="rsh-panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", color: "#0f172a" }}>
                      <FileText size={17} style={{ color: "#0284c7" }} />
                      <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "800" }}>Trade &amp; Customs Documents (Regulatory Clearance Gate)</h4>
                    </div>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      HS Code: <strong style={{ color: "#0f172a" }}>{selectedQuote.hsCode || "8471.30"}</strong> &bull; Cargo: <strong style={{ color: "#0f172a" }}>{selectedQuote.cargoType || "General Commercial Goods"}</strong>
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px", marginBottom: "12px" }}>
                    {(selectedQuote.documents || [
                      { name: "Commercial Invoice", status: "PENDING" },
                      { name: "Packing List", status: "PENDING" },
                      { name: "Bill of Lading Draft", status: "PENDING" },
                      { name: "Certificate of Origin", status: "PENDING" },
                    ]).map((doc, idx) => {
                      const isVerified = doc.status === "VERIFIED";
                      const isUploaded = doc.status === "UPLOADED";
                      return (
                        <div
                          key={idx}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "12px 14px",
                            background: isVerified ? "#fafffb" : isUploaded ? "#f0f9ff" : "#f8fafc",
                            border: `1px solid ${isVerified ? "#86efac" : isUploaded ? "#93c5fd" : "#e2e8f0"}`,
                            borderRadius: "10px",
                            gap: "12px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                            <div
                              style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "8px",
                                background: isVerified ? "#dcfce7" : isUploaded ? "#e0f2fe" : "#f1f5f9",
                                color: isVerified ? "#16a34a" : isUploaded ? "#0284c7" : "#64748b",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              {isVerified ? (
                                <CheckCircle2 size={16} />
                              ) : isUploaded ? (
                                <Clock size={16} />
                              ) : (
                                <AlertTriangle size={16} />
                              )}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {doc.name}
                              </div>
                              {doc.fileName ? (
                                <div style={{ fontSize: "11px", color: "#64748b", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {doc.fileName} {doc.fileSize ? `(${doc.fileSize})` : ""}
                                </div>
                              ) : (
                                <div style={{ fontSize: "11px", color: isVerified ? "#16a34a" : isUploaded ? "#0284c7" : "#d97706" }}>
                                  {isVerified ? "Clearance Approved" : isUploaded ? "Under Officer Review" : "Required for Clearance"}
                                </div>
                              )}
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                            {isVerified ? (
                              <span style={{ fontSize: "11px", fontWeight: 700, color: "#15803d", background: "#dcfce7", padding: "4px 9px", borderRadius: "6px" }}>
                                VERIFIED
                              </span>
                            ) : isUploaded ? (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ fontSize: "11px", fontWeight: 700, color: "#0369a1", background: "#e0f2fe", padding: "4px 8px", borderRadius: "6px" }}>
                                  UPLOADED
                                </span>
                                <label
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: 600,
                                    color: "#475569",
                                    background: "#ffffff",
                                    border: "1px solid #cbd5e1",
                                    padding: "3px 8px",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "3px",
                                  }}
                                >
                                  <Upload size={11} /> Replace
                                  <input
                                    type="file"
                                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.csv"
                                    style={{ display: "none" }}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleFileSelected(doc.name, file);
                                      e.target.value = "";
                                    }}
                                  />
                                </label>
                              </div>
                            ) : (
                              <label
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  color: "#ffffff",
                                  background: "#f97316",
                                  border: "none",
                                  padding: "5px 12px",
                                  borderRadius: "6px",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  boxShadow: "0 2px 5px rgba(249, 115, 22, 0.2)",
                                }}
                              >
                                <Upload size={12} /> Upload File
                                <input
                                  type="file"
                                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.csv"
                                  style={{ display: "none" }}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileSelected(doc.name, file);
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selectedQuote.customsRemarks && (
                    <div style={{ fontSize: "12px", color: "#334155", background: "#f8fafc", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                      <ShieldCheck size={16} color="#0284c7" />
                      <div>
                        <strong>Customs Officer Review Note:</strong> {selectedQuote.customsRemarks}
                      </div>
                    </div>
                  )}
                </div>

              </div>

            </div>

            {/* Modal Footer with Customer Accept / Reject Actions */}
            <div className="rsh-modal-footer">
              <div className="rsh-footer-left">
                <button
                  type="button"
                  className="btn-secondary-light"
                  onClick={() => window.print()}
                >
                  <Printer size={14} /> Print Summary
                </button>
                {(() => {
                  const norm = normalizeWorkflowStatus(selectedQuote.status);
                  if (norm === "PENDING_REVIEW") {
                    return (
                      <span className="rsh-footer-notice-pill" style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>
                        <ShieldCheck size={14} color="#d97706" /> Under Customs &amp; Freight Agent Review — Awaiting Final Quote
                      </span>
                    );
                  }
                  if (norm === "REQUESTED" || norm === "GENERATED") {
                    return (
                      <span className="rsh-footer-notice-pill" style={{ background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd" }}>
                        <Clock size={14} color="#0284c7" /> Quote Requested &amp; AI Evaluated — In Operations &amp; Customs Queue
                      </span>
                    );
                  }
                  if (norm === "CUSTOMS_FLAGGED") {
                    return (
                      <span className="rsh-footer-notice-pill" style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca" }}>
                        <AlertTriangle size={14} color="#dc2626" /> Customs Inspection Hold — Please upload requested documents above
                      </span>
                    );
                  }
                  if (norm === "APPROVED") {
                    return (
                      <span className="rsh-footer-notice-pill" style={{ background: "#ede9fe", color: "#6d28d9", border: "1px solid #ddd6fe" }}>
                        <CheckCircle2 size={14} color="#7c3aed" /> Commercials Approved — Freight Agent finalizing official quotation dispatch
                      </span>
                    );
                  }
                  if (norm === "ACCEPTED") {
                    return (
                      <span className="rsh-footer-notice-pill" style={{ background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0" }}>
                        <CheckCircle2 size={14} color="#059669" /> Booking Confirmed &amp; Dispatched (Space Locked)
                      </span>
                    );
                  }
                  if (norm === "REJECTED") {
                    return (
                      <span className="rsh-footer-notice-pill" style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
                        <X size={14} color="#dc2626" /> Quotation Declined / Archived
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>

              <div className="rsh-footer-actions">
                {(() => {
                  const norm = normalizeWorkflowStatus(selectedQuote.status);
                  const qId = selectedQuote.quoteNo || selectedQuote.id;

                  if (norm === "SENT") {
                    return (
                      <>
                        <button
                          type="button"
                          style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "8px 16px", borderRadius: "8px", fontWeight: "700", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                          onClick={() => handleRejectQuote(qId)}
                        >
                          <ThumbsDown size={14} /> Decline Quote
                        </button>
                        <button
                          type="button"
                          style={{ background: "#059669", color: "#ffffff", border: "none", padding: "8px 18px", borderRadius: "8px", fontWeight: "700", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px", boxShadow: "0 4px 12px rgba(5, 150, 105, 0.25)" }}
                          onClick={() => handleAcceptQuote(qId)}
                        >
                          <ThumbsUp size={15} /> Accept Quote &amp; Confirm Booking
                        </button>
                      </>
                    );
                  }

                  if (norm === "DRAFT") {
                    return (
                      <button
                        type="button"
                        style={{ background: "#0284c7", color: "#ffffff", border: "none", padding: "8px 16px", borderRadius: "8px", fontWeight: "700", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12.5px" }}
                        onClick={() => handleCustomerRequestQuote(qId)}
                      >
                        <Send size={14} /> Submit Quote Request
                      </button>
                    );
                  }

                  return null;
                })()}

                <button
                  type="button"
                  className="btn-secondary-light"
                  onClick={() => setSelectedQuote(null)}
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
