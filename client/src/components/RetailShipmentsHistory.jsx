import { useCallback, useEffect, useMemo, useState } from "react";
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
  decideQuoteInStore,
  formatMoney,
  isRouteConfirmed,
} from "../utils/quoteWorkflow";
import { listShipmentDocuments, uploadShipmentDocument } from "../api/workflow";
import { useAuth } from "../context/AuthContext";
import QuoteWorkflowStepper from "./QuoteWorkflowStepper";
import "./RetailShipmentsHistory.css";

const MODE_CLASS = { ocean_fcl: "ocean-fcl", air: "air-freight", ocean_lcl: "ocean-lcl", ocean: "ocean-fcl" };
const STATUS_CLASS = { Draft: "draft", Issued: "issued", Booked: "booked", "No routing": "norouting" };

// The company workflow (M4) behind a quote, in the words Selected Quotes uses.
const M4_STAGE = {
  QUOTE_SELECTED: "Sent to company",
  PENDING_COMPANY_VERIFICATION: "Sent to company",
  UNDER_VERIFICATION: "Being checked",
  AWAITING_CUSTOMER_INFO: "Needs your information",
  ESCALATED: "With the company's manager",
  REVISION_PENDING_CUSTOMER: "Revised offer for you",
  REVISION_ACCEPTED: "Revision accepted",
  APPROVED: "Approved",
  BOOKING_CONFIRMED: "Booked",
  BOOKING_CANCELLED: "Booking cancelled",
  REJECTED: "Declined by the company",
  RESELECT_QUOTE: "Closed, choose another company",
};

// Stages where the company, not the customer, has the next move.
const M4_WITH_COMPANY = new Set([
  "QUOTE_SELECTED",
  "PENDING_COMPANY_VERIFICATION",
  "UNDER_VERIFICATION",
  "ESCALATED",
]);

/** One line tying a quote to its company workflow: "Maersk · Booked · BK-2026-10009". */
function m4Line(m4) {
  if (!m4) return "";
  return [m4.companyName, M4_STAGE[m4.status] || m4.status, m4.bookingReference]
    .filter(Boolean)
    .join(" · ");
}

export default function RetailShipmentsHistory({ viewMode = "quotes" }) {
  const { quotations, loading, error, reloadQuotes } = useRetailQuotes();
  const { token, user } = useAuth();
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [workflowError, setWorkflowError] = useState("");
  const [workflowNotice, setWorkflowNotice] = useState("");
  const [uploadingDoc, setUploadingDoc] = useState(null);
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

  // My Quotes lists quotes that have been sent for review. A quote gets here
  // only when the customer picks a carrier in the Request Quote flow's final
  // modal; before that it is still an unfinished enquiry.
  const confirmedQuotations = useMemo(
    () => quotations.filter((q) => isRouteConfirmed(q.id || q.quoteNo, q)),
    [quotations]
  );

  // If in shipments mode, focus on confirmed/booked cargo orders
  const baseList = useMemo(() => {
    if (isShipmentMode) {
      // A shipment exists once the customer accepts the quote. This used to
      // filter on "Booked", "confirmed" and "Issued", none of which the status
      // normaliser can ever produce, so My Shipments was permanently empty no
      // matter how many bookings had been confirmed.
      return quotations.filter((q) => normalizeWorkflowStatus(q.status) === "ACCEPTED");
    }
    return confirmedQuotations;
  }, [quotations, confirmedQuotations, isShipmentMode]);

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

  /**
   * Documents actually on file for the open quote.
   *
   * The clearance checklist takes its status from the customs analysis, which
   * is a snapshot taken when the quote was generated and never changes. So an
   * uploaded file was stored server-side and shown in the vault while this
   * panel still said "Required for Clearance" and offered Upload File again.
   */
  const [shipmentDocs, setShipmentDocs] = useState([]);

  const loadShipmentDocs = useCallback(async () => {
    const shipmentId = selectedQuote?.shipmentId;
    if (!token || !shipmentId) {
      setShipmentDocs([]);
      return;
    }
    try {
      const data = await listShipmentDocuments(token, shipmentId);
      setShipmentDocs(data.results || []);
    } catch {
      setShipmentDocs([]);
    }
  }, [token, selectedQuote?.shipmentId]);

  useEffect(() => {
    loadShipmentDocs();
  }, [loadShipmentDocs]);

  const normalizeDocName = (name) => (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  /** Effective status of one checklist item, from real uploads. */
  function checklistStatus(doc) {
    const match = shipmentDocs.find(
      (u) => normalizeDocName(u.document_type) === normalizeDocName(doc.name),
    );
    if (!match) return doc.status === "VERIFIED" ? "VERIFIED" : "PENDING";
    if (match.verification_status === "VERIFIED") return "VERIFIED";
    if (match.verification_status === "REJECTED") return "REJECTED";
    return "UPLOADED";
  }

  /**
   * Customer decision (PDF section 3, step 12).
   *
   * Goes through the platform API, which validates that the quote actually
   * reached the customer: a quote still sitting in the agent's review queue
   * cannot be accepted.
   */
  async function handleDecision(quoteNo, decision) {
    if (workflowBusy) return;
    setWorkflowBusy(true);
    setWorkflowError("");
    try {
      await decideQuoteInStore(quoteNo, decision);
      if (selectedQuote) setSelectedQuote((prev) => ({ ...prev, status: decision }));
    } catch (err) {
      setWorkflowError(err.message || `Could not record your ${decision.toLowerCase()}.`);
    } finally {
      setWorkflowBusy(false);
    }
  }

  const handleAcceptQuote = (quoteNo) => handleDecision(quoteNo, "ACCEPTED");
  const handleRejectQuote = (quoteNo) => handleDecision(quoteNo, "REJECTED");

  /**
   * Upload a trade document.
   *
   * The file is sent to the platform rather than being base64-encoded into
   * localStorage, so the customs officer can actually open what was uploaded.
   */
  async function handleFileSelected(docName, file) {
    if (!selectedQuote || !file || uploadingDoc) return;

    const shipmentId = selectedQuote.shipmentId;
    if (!shipmentId) {
      setWorkflowError("This quote is not linked to a shipment, so documents cannot be attached.");
      return;
    }

    setUploadingDoc(docName);
    setWorkflowError("");
    try {
      await uploadShipmentDocument(token, {
        shipmentId,
        documentType: docName,
        file,
        uploadedBy: user?.full_name || "Customer",
      });
      // Refresh the real document list, not just the quotes: the checklist
      // status comes from what is actually on file now.
      await Promise.all([reloadQuotes(), loadShipmentDocs()]);
      setWorkflowNotice(`"${file.name}" uploaded for ${docName}. Queued for customs verification.`);
      setTimeout(() => setWorkflowNotice(""), 5000);
    } catch (err) {
      setWorkflowError(err.message || `Could not upload "${file.name}".`);
    } finally {
      setUploadingDoc(null);
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
      ? ["Booking", "Quote", "Shipment", "Consignee", "Origin", "Destination", "Carrier", "Cargo Basis", "Transit Time", "Status", "Date"]
      : ["Quote No", "Customer", "City", "Lane", "Mode", "Basis", "Transit", "Total", "Status", "Created Date"];
    
    const rows = filtered.map((q) => isShipmentMode ? [
      q.m4?.bookingReference || "",
      q.quoteNo || "",
      q.shipmentId || "",
      q.customerName || "",
      q.origin || "",
      q.destination || "",
      q.m4?.companyName || q.selectedCarrier || "",
      q.basis || "",
      q.transit || "",
      q.m4 ? M4_STAGE[q.m4.status] || q.m4.status : q.status || "",
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
  const quotesThisMonth = confirmedQuotations.filter((q) => {
    if (!q.createdAt) return false;
    const d = new Date(q.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const bookedCount = quotations.filter(
    (q) => normalizeWorkflowStatus(q.status) === "ACCEPTED",
  ).length;
  // Every figure below comes from the quotes and their company workflow. The
  // cards used to show "routes analysed" (confirmed quotes x 3 + 4), a fixed
  // 100% customs compliance and a fixed 14.5-day average transit.
  const withCompany = confirmedQuotations.filter((q) => M4_WITH_COMPANY.has(q.m4?.status)).length;
  const confirmedShipments = quotations.filter((q) => normalizeWorkflowStatus(q.status) === "ACCEPTED");
  const companyBookings = confirmedShipments.filter((q) => q.m4?.bookingReference).length;
  const cancelledBookings = quotations.filter((q) => q.m4?.bookingStatus === "CANCELLED").length;
  const withTransit = confirmedShipments.filter((q) => Number(q.transitDays) > 0);
  const averageTransit = withTransit.length
    ? (withTransit.reduce((sum, q) => sum + Number(q.transitDays), 0) / withTransit.length).toFixed(1)
    : null;

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
              <div className="kpi-title">Confirmed shipments</div>
              <div className="kpi-value">{bookedCount}</div>
              <div className="kpi-sub green">Accepted and booked</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">Booked with a company</div>
              <div className="kpi-value">{companyBookings}</div>
              <div className="kpi-sub slate">Verified by the carrier</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">Average transit</div>
              <div className="kpi-value">{averageTransit ? `${averageTransit} d` : "—"}</div>
              <div className="kpi-sub slate">Across confirmed shipments</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">Cancelled bookings</div>
              <div className="kpi-value">{cancelledBookings}</div>
              <div className="kpi-sub slate">Cancelled after booking</div>
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
              <div className="kpi-value">{confirmedQuotations.length}</div>
              <div className="kpi-sub slate">Carrier route confirmed</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">With a company</div>
              <div className="kpi-value">{withCompany}</div>
              <div className="kpi-sub slate">Being verified right now</div>
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
                  <th>BOOKING</th>
                  <th>LANE & CARRIER</th>
                  <th>CONTAINER / BASIS</th>
                  <th>COMPANY WORKFLOW</th>
                  <th>TRANSIT</th>
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
                    {/* An empty list after a failed request is not an empty
                        account. Saying "none found" there sent people looking
                        for a missing quote instead of signing back in. */}
                    {error
                      ? "We couldn't load your quotes. Please resolve the message above and try again."
                      : isShipmentMode
                      ? "No matching active shipments found."
                      : quotations.some((q) => !isRouteConfirmed(q.id || q.quoteNo, q))
                      ? "No quotes sent for review yet. Finish an enquiry and send it to the freight agent to see it here."
                      : "No matching quotations found."}
                  </td>
                </tr>
              ) : isShipmentMode ? (
                /* Shipment Specific Table Rows */
                filtered.map((q) => (
                  <tr key={q.quoteNo || q.id}>
                    <td className="q-no">
                      <span className="bl-track-code">{q.m4?.bookingReference || q.quoteNo}</span>
                      <span className="bl-ref-sub">
                        {q.m4?.bookingReference
                          ? `Quote ${q.quoteNo} · Shipment ${q.shipmentId || "—"}`
                          : `Shipment ${q.shipmentId || "—"}`}
                      </span>
                    </td>
                    <td>
                      <span className="lane-code">{q.laneCode}</span>
                      <span className="lane-sub">Carrier: {q.m4?.companyName || q.selectedCarrier || "—"}</span>
                    </td>
                    <td>
                      <span className="font-semibold text-slate-800">{q.basis}</span>
                      <span className="bl-ref-sub">Container: {q.containerType || "—"}</span>
                    </td>
                    <td>
                      <span className="font-semibold text-slate-800">
                        {q.m4 ? M4_STAGE[q.m4.status] || q.m4.status : "Accepted quote"}
                      </span>
                      <span className="bl-ref-sub">
                        {q.m4
                          ? [q.m4.selectionReference, q.m4.verificationReference].filter(Boolean).join(" · ")
                          : `Shipment ${q.shipmentId || "—"}`}
                      </span>
                    </td>
                    <td>
                      <span className="font-semibold text-slate-800">{q.transit}</span>
                      <span className="bl-ref-sub">Planned transit</span>
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
                    <td className="q-no">
                      {q.quoteNo}
                      {q.shipmentId && <span className="bl-ref-sub">Shipment {q.shipmentId}</span>}
                    </td>
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
                      {q.m4 && (
                        <span className="lane-sub" style={{ display: "block", marginTop: 4 }}>
                          {m4Line(q.m4)}
                        </span>
                      )}
                    </td>
                    <td style={{ color: "#64748b", fontSize: 12 }}>{q.created}</td>
                    <td style={{ display: "flex", gap: "6px", alignItems: "center", paddingTop: "14px" }}>
                      {/* Carrier selection belongs to the Request Quote flow,
                          so My Quotes shows status only and never reopens the
                          route picker. */}
                      <button
                        type="button"
                        className="btn-open-quote"
                        onClick={() => openQuoteDetail(q.quoteNo)}
                        title="View quote status and approval progress"
                      >
                        View Status
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
            {/* Counted against the list this page shows, not every quote on file. */}
            Showing {filtered.length ? `1–${filtered.length}` : 0} of {baseList.length}
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

            {(workflowError || workflowNotice) && (
              <div
                style={{
                  margin: "12px 16px 0",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  background: workflowError ? "#fef2f2" : "#ecfdf5",
                  border: `1px solid ${workflowError ? "#fecaca" : "#a7f3d0"}`,
                  color: workflowError ? "#b91c1c" : "#047857",
                }}
              >
                {workflowError || workflowNotice}
              </div>
            )}

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
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button
                  type="button"
                  className="rsh-modal-close"
                  onClick={() => setSelectedQuote(null)}
                  aria-label="Close dialog"
                >
                  <X size={18} />
                </button>
              </div>
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

              {/* Every id from quote to booking, from the company workflow. This
                  was a "live telemetry" panel with an invented vessel and
                  milestones that no system had ever recorded. */}
              {selectedQuote.m4 && (
                <div className="rsh-tracking-stepper-wrap">
                  <div className="rsh-stepper-head">
                    <div className="rsh-stepper-title">
                      <Ship size={16} className="text-orange-500" />
                      <strong>Company verification &amp; booking</strong>
                    </div>
                    <span className="rsh-stepper-eta">{m4Line(selectedQuote.m4)}</span>
                  </div>
                  <div className="rsh-milestone-steps">
                    {[
                      ["Quote", selectedQuote.quoteNo, normalizeWorkflowStatus(selectedQuote.status)],
                      ["Shipment", selectedQuote.shipmentId, selectedQuote.shipmentStatus],
                      ["Selection", selectedQuote.m4.selectionReference, selectedQuote.m4.status],
                      ["Verification", selectedQuote.m4.verificationReference, selectedQuote.m4.verificationStatus],
                      ["Booking", selectedQuote.m4.bookingReference, selectedQuote.m4.bookingStatus],
                    ].flatMap(([label, ref, state], i) => {
                      const step = (
                        <div key={label} className={`rsh-step${ref ? " completed" : ""}`}>
                          <div className="rsh-step-marker">{ref ? <Check size={12} /> : i + 1}</div>
                          <div className="rsh-step-info">
                            <span className="rsh-step-title">{label}</span>
                            <span className="rsh-step-sub">
                              {ref ? `${ref} · ${String(state || "").replaceAll("_", " ").toLowerCase()}` : "Not yet"}
                            </span>
                          </div>
                        </div>
                      );
                      return i === 0
                        ? [step]
                        : [<div key={`${label}-line`} className={`rsh-step-connector${ref ? " completed" : ""}`} />, step];
                    })}
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
                      <span className="rsh-spec-val highlight">{selectedQuote.customerName || "—"}</span>
                    </div>
                    <div className="rsh-spec-row">
                      <span className="rsh-spec-lbl">Lane</span>
                      <span className="rsh-spec-val">{selectedQuote.laneSub || "—"}</span>
                    </div>
                    <div className="rsh-spec-row">
                      <span className="rsh-spec-lbl">Cargo Basis</span>
                      <span className="rsh-spec-val font-semibold">{selectedQuote.basis || "—"}</span>
                    </div>
                    <div className="rsh-spec-row">
                      <span className="rsh-spec-lbl">Freight Mode</span>
                      <span className="rsh-spec-val">{selectedQuote.modeLabel || "Ocean Freight"}</span>
                    </div>
                    <div className="rsh-spec-row">
                      <span className="rsh-spec-lbl">Quote date</span>
                      <span className="rsh-spec-val">{selectedQuote.created || "Today"}</span>
                    </div>
                  </div>

                  {/* The quote's own risk scores. This was a fixed "risk 18/100,
                      cleared" message shown on every quote. */}
                  {selectedQuote.overallRiskScore != null && (
                    <div className="rsh-compliance-callout">
                      <ShieldCheck size={16} className="text-emerald-600" />
                      <div>
                        <strong>AI risk assessment: {selectedQuote.overallRisk || "assessed"}</strong>
                        <p>
                          Overall {Math.round(selectedQuote.overallRiskScore)}/100 · weather{" "}
                          {Math.round(selectedQuote.weatherRiskScore ?? 0)} · customs{" "}
                          {Math.round(selectedQuote.customsRiskScore ?? 0)} · route{" "}
                          {Math.round(selectedQuote.routeRiskScore ?? 0)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Column 2: Commercial Pricing Breakdown */}
                <div className="rsh-card-panel price-panel">
                  <div className="rsh-panel-head">
                    <FileText size={15} />
                    <h4>Commercial Pricing Breakdown</h4>
                  </div>
                  
                  {(() => {
                    // The chosen company's offer when there is one, otherwise the
                    // platform's rule-based quote, each in its own currency. This
                    // fell back to invented rupee figures, and set a company's
                    // rupee total beside the platform's dollar charges.
                    const m4 = selectedQuote.m4;
                    const currency = m4?.currency || selectedQuote.currency;
                    const lines = m4?.offer
                      ? [
                          ["Base freight", m4.offer.baseFreight],
                          ["Fuel surcharge", m4.offer.fuelSurcharge],
                          ["Handling", m4.offer.handlingFee],
                          ["Documentation", m4.offer.documentationFee],
                        ]
                      : [
                          ["Base charge", selectedQuote.baseRate],
                          ["Distance charge", selectedQuote.distanceCharge],
                          ["Weight charge", selectedQuote.weightCharge],
                          ["Fuel surcharge", selectedQuote.fuelSurcharge],
                        ];
                    const total = m4 ? m4.agreedTotal ?? m4.selectedTotal : selectedQuote.totalNum;
                    return (
                      <div className="rsh-fee-breakdown">
                        {lines.map(([label, amount]) => (
                          <div className="rsh-fee-row" key={label}>
                            <span>{label}</span>
                            <span>{formatMoney(amount, currency)}</span>
                          </div>
                        ))}
                        {m4?.wasRevised && (
                          <div className="rsh-fee-row">
                            <span>Offer before revision</span>
                            <span>{formatMoney(m4.selectedTotal, currency)}</span>
                          </div>
                        )}
                        <div className="rsh-fee-divider"></div>
                        <div className="rsh-fee-total-row">
                          <div>
                            <span className="rsh-total-label">
                              {m4?.agreedTotal != null ? "Agreed total" : m4 ? `${m4.companyName} offer` : "Total quote"}
                            </span>
                            <span className="rsh-total-sub">
                              {m4 ? `${m4.companyName}'s rate card at the AI market rate` : "Platform rule-based pricing"}
                            </span>
                          </div>
                          <div className="rsh-total-val">{formatMoney(total, currency)}</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Trade & Customs Documents Panel */}
                <div className="rsh-card-panel docs-panel" style={{ gridColumn: "1 / -1", marginTop: "16px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "18px" }}>
                  <div className="rsh-panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", color: "#0f172a" }}>
                      <FileText size={17} style={{ color: "#0284c7" }} />
                      <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "800" }}>Trade &amp; Customs Documents (Regulatory Clearance Gate)</h4>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                        HS Code: <strong style={{ color: "#0f172a" }}>{selectedQuote.hsCode || "8471.30"}</strong> &bull; Cargo: <strong style={{ color: "#0f172a" }}>{selectedQuote.cargoType || "General Commercial Goods"}</strong>
                      </span>
                      <span style={{ color: "#cbd5e1" }}>&bull;</span>
                      <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Get Sample Docs:</span>
                      <a href="/sample_trade_documents/Commercial_Invoice_INV2026.pdf" download style={{ fontSize: "11px", color: "#0284c7", fontWeight: 700, textDecoration: "underline" }}>Invoice</a>
                      <a href="/sample_trade_documents/Packing_List_PL9921.pdf" download style={{ fontSize: "11px", color: "#0284c7", fontWeight: 700, textDecoration: "underline" }}>Packing List</a>
                      <a href="/sample_trade_documents/Bill_of_Lading_Draft_BL4810.pdf" download style={{ fontSize: "11px", color: "#0284c7", fontWeight: 700, textDecoration: "underline" }}>B/L Draft</a>
                      <a href="/sample_trade_documents/Certificate_of_Origin_COO2026.pdf" download style={{ fontSize: "11px", color: "#0284c7", fontWeight: 700, textDecoration: "underline" }}>Origin Cert</a>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px", marginBottom: "12px" }}>
                    {(selectedQuote.documents || [
                      { name: "Commercial Invoice", status: "PENDING" },
                      { name: "Packing List", status: "PENDING" },
                      { name: "Bill of Lading Draft", status: "PENDING" },
                      { name: "Certificate of Origin", status: "PENDING" },
                    ]).map((doc, idx) => {
                      const effective = checklistStatus(doc);
                      const isVerified = effective === "VERIFIED";
                      const isUploaded = effective === "UPLOADED";
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

                  {/* Customs clearance, from the live compliance state. The
                      customer could see their documents but never whether
                      customs had actually cleared the consignment. */}
                  {(() => {
                    const cs = selectedQuote.customs?.status || selectedQuote.customsStatus;
                    if (!cs) return null;
                    const cleared = cs === "APPROVED";
                    const held = cs === "REJECTED";
                    return (
                      <div className={`rsh-customs-state ${cleared ? "ok" : held ? "bad" : "wait"}`}>
                        <ShieldCheck size={16} />
                        <div>
                          <strong>
                            {cleared
                              ? "Customs cleared"
                              : held
                              ? "Customs hold"
                              : cs === "NEEDS_REVIEW"
                              ? "Documents verified, awaiting officer sign-off"
                              : "Awaiting customs documents"}
                          </strong>
                          <div className="rsh-customs-sub">
                            {cleared
                              ? "Your freight agent will send the final quote for you to accept or decline."
                              : held
                              ? "Customs could not clear this consignment. See the officer note below."
                              : cs === "NEEDS_REVIEW"
                              ? "Every required document has passed verification. The customs officer is completing sign-off."
                              : "Upload the documents listed above so customs can begin verification."}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

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
                  if (selectedQuote.m4) {
                    const booked = selectedQuote.m4.status === "BOOKING_CONFIRMED";
                    return (
                      <span
                        className="rsh-footer-notice-pill"
                        style={{
                          background: booked ? "#ecfdf5" : "#fef3c7",
                          color: booked ? "#059669" : "#92400e",
                          border: `1px solid ${booked ? "#a7f3d0" : "#fde68a"}`,
                        }}
                      >
                        {booked ? <CheckCircle2 size={14} color="#059669" /> : <ShieldCheck size={14} color="#d97706" />}{" "}
                        {m4Line(selectedQuote.m4)}
                      </span>
                    );
                  }
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

                  // A company's verification decides this quote now, and the
                  // customer answers it in Selected Quotes. The accept button
                  // below would book it without the company ever verifying it.
                  if (selectedQuote.m4) {
                    return (
                      <Link
                        to="/dashboard/selected-quotes"
                        className="btn-orange-primary"
                        onClick={() => setSelectedQuote(null)}
                      >
                        Open in Selected Quotes
                      </Link>
                    );
                  }

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

                  // A quote in review is with the freight team; the customer can
                  // only accept or reject once it has been approved and sent.
                  if (["REQUESTED", "GENERATED", "PENDING_REVIEW", "CUSTOMS_FLAGGED"].includes(norm)) {
                    return (
                      <span style={{ fontSize: "12.5px", color: "#64748b", fontWeight: 600 }}>
                        <Send size={14} style={{ verticalAlign: "-2px" }} /> With our freight team for
                        review — you'll be notified when the final quote is ready.
                      </span>
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
