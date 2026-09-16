import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
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
  FileUp,
  RotateCw,
} from "lucide-react";
import { useRetailQuotes } from "../context/RetailQuotesContext";
import {
  normalizeWorkflowStatus,
  SHIPMENT_STATUS_CONFIG,
  normalizeShipmentStatus,
  getShipmentStatusFromQuoteStatus,
  getQuoteStatusDisplay,
  decideQuoteInStore,
  formatMoney,
  isRouteConfirmed,
} from "../utils/quoteWorkflow";
import { listShipmentDocuments, uploadShipmentDocument, submitFinalDecision } from "../api/workflow";
import { useAuth } from "../context/AuthContext";
import QuoteWorkflowStepper from "./QuoteWorkflowStepper";
import ListFilterBar from "./ListFilterBar";
import { filterRows } from "../utils/listFilters";
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
  PENDING_CUSTOMS_REVIEW: "With customs",
  CUSTOMS_CLEARED: "Cleared by customs, confirm your booking",
  CUSTOMS_REJECTED: "Rejected by customs",
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

// The toolbar's dropdown contents. They were inline in the JSX; the wording of
// every option is unchanged.
const HISTORY_FILTER_OPTIONS = {
  mode: [
    { value: "ocean", label: "Ocean Freight" },
    { value: "air", label: "Air Freight" },
    { value: "road", label: "Road Freight" },
    { value: "rail", label: "Rail Freight" },
  ],
  shipmentStatus: ["DRAFT", "SUBMITTED", "PROCESSING", "ANALYZED", "QUOTED", "CLOSED", "CANCELLED"].map(
    (status) => ({ value: status, label: status }),
  ),
  quoteStatus: ["DRAFT", "GENERATED", "PENDING_REVIEW", "APPROVED", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"].map(
    (status) => ({ value: status, label: status }),
  ),
  date: [
    { value: "30days", label: "Last 30 days" },
    { value: "thisMonth", label: "This Month" },
  ],
};

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
  const [batchUploading, setBatchUploading] = useState(false);
  const [batchProgress, setBatchProgress] = useState(null);
  const [search, setSearch] = useState("");
  const [laneFilter, setLaneFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [copied, setCopied] = useState(false);
  // The customer's last word on a cleared request, answered in this record.
  const [finalNote, setFinalNote] = useState("");
  const [finalBusy, setFinalBusy] = useState(false);
  const [finalError, setFinalError] = useState("");

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

  // The toolbar's own "All lanes" entry, so the options here are the real lanes
  // only — ListFilterBar renders the "everything" option from the filter label.
  // Order is the order the quotes arrive in, as it always was.
  const laneOptions = useMemo(
    () =>
      Array.from(new Set(quotations.map((quote) => quote.laneCode).filter(Boolean))).map(
        (lane) => ({ value: lane, label: lane }),
      ),
    [quotations],
  );

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
      return quotations.filter(
        (q) =>
          normalizeWorkflowStatus(q.status) === "ACCEPTED" ||
          q.status === "ACCEPTED" ||
          q.status === "BOOKED" ||
          q.m4?.status === "BOOKING_CONFIRMED" ||
          Boolean(q.m4?.bookingReference) ||
          q.shipmentStatus === "BOOKED" ||
          q.shipmentStatus === "CONFIRMED" ||
          q.shipmentStatus === "CLOSED" ||
          q.shipmentStatus === "IN_TRANSIT",
      );
    }
    return confirmedQuotations;
  }, [quotations, confirmedQuotations, isShipmentMode]);


  // The visible rows: the same four columns the table shows are what the search
  // reads, and each dropdown only excludes rows when it has been moved off
  // "all". The rules themselves live in utils/listFilters so every desk shares
  // them; this keeps the exact behaviour the toolbar always had.
  const filtered = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const effectiveStatusOf = (item) =>
      isShipmentMode
        ? item.shipmentStatus
          ? normalizeShipmentStatus(item.shipmentStatus)
          : getShipmentStatusFromQuoteStatus(item.status)
        : normalizeWorkflowStatus(item.status);

    return filterRows(baseList, {
      search,
      fields: ["quoteNo", "customerName", "laneCode", "destination"],
      filters: [
        { value: laneFilter, matches: (item, lane) => item.laneCode === lane },
        { value: modeFilter, matches: (item, mode) => item.mode === mode },
        { value: statusFilter, matches: (item, status) => effectiveStatusOf(item) === status },
        {
          value: dateFilter,
          matches: (item, range) => {
            // A row with no created date is never hidden by a date choice.
            if (!item.createdAt) return true;
            const itemDate = new Date(item.createdAt);
            if (range === "30days") return itemDate >= thirtyDaysAgo;
            if (range === "thisMonth") {
              return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
            }
            return true;
          },
        },
      ],
    });
  }, [baseList, search, laneFilter, modeFilter, statusFilter, dateFilter, isShipmentMode]);

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
    // A note typed against the last record must not carry into the next one.
    setFinalNote("");
    setFinalError("");
  }

  /**
   * Keep the open record in step with the list behind it.
   *
   * Reloading replaces every quote object, so without this the modal keeps the
   * copy it opened with — still "awaiting your decision" while the row behind
   * it has moved on to Booked.
   */
  useEffect(() => {
    if (!selectedQuote) return;
    const fresh = quotations.find((item) => item.id === selectedQuote.id);
    if (fresh && fresh !== selectedQuote) setSelectedQuote(fresh);
  }, [quotations, selectedQuote]);

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
      try {
        const bc = new BroadcastChannel("freight_quote_sync");
        bc.postMessage({ type: "QUOTE_ACCEPTED", quoteNo });
        bc.close();
      } catch (e) {}
    } catch (err) {
      setWorkflowError(err.message || `Could not record your ${decision.toLowerCase()}.`);
    } finally {
      setWorkflowBusy(false);
    }
  }

  const handleAcceptQuote = (quoteNo) => handleDecision(quoteNo, "ACCEPTED");
  const handleRejectQuote = (quoteNo) => handleDecision(quoteNo, "REJECTED");

  /**
   * The customer's final decision on a request the company approved and
   * customs cleared (M4).
   *
   * This goes through the platform's own final-decision endpoint, which is the
   * only thing that can create a booking, and which refuses a decline with no
   * reason. Its refusal is shown here rather than swallowed, so a customer is
   * never left thinking a decline was recorded when it was not.
   */
  async function submitCustomerFinalDecision(decision) {
    const m4 = selectedQuote?.m4;
    if (!m4?.selectionReference || finalBusy) return;

    const note = finalNote.trim();
    if (decision === "DECLINE" && !note) {
      setFinalError("Tell the company why you are declining.");
      return;
    }

    setFinalBusy(true);
    setFinalError("");
    try {
      const res = await submitFinalDecision(token, m4.selectionReference, {
        decision,
        note,
      });
      setFinalNote("");
      setWorkflowNotice(
        decision === "ACCEPT"
          ? `Booking confirmed${res?.booking?.reference ? ` · ${res.booking.reference}` : ""}. The company has been told.`
          : "Declined. You can now choose another company for this shipment.",
      );
      setTimeout(() => setWorkflowNotice(""), 8000);

      try {
        const bc = new BroadcastChannel("freight_quote_sync");
        bc.postMessage({ type: "BOOKING_CONFIRMED", selectionRef: m4.selectionReference });
        bc.close();
      } catch (e) {}

      // Re-read the quote so both this record and the list behind it show
      // Booked, rather than the state the modal opened with.
      await reloadQuotes();
    } catch (err) {

      setFinalError(err.message || "Could not record your decision.");
    } finally {
      setFinalBusy(false);
    }
  }

  const FOUR_TRADE_DOCS = [
    {
      name: "Commercial Invoice",
      samplePath: "/sample_trade_documents/Commercial_Invoice_INV2026.pdf",
      fileName: "Commercial_Invoice_INV2026.pdf",
    },
    {
      name: "Packing List",
      samplePath: "/sample_trade_documents/Packing_List_PL9921.pdf",
      fileName: "Packing_List_PL9921.pdf",
    },
    {
      name: "Bill of Lading Draft",
      samplePath: "/sample_trade_documents/Bill_of_Lading_Draft_BL4810.pdf",
      fileName: "Bill_of_Lading_Draft_BL4810.pdf",
    },
    {
      name: "Certificate of Origin",
      samplePath: "/sample_trade_documents/Certificate_of_Origin_COO2026.pdf",
      fileName: "Certificate_of_Origin_COO2026.pdf",
    },
  ];

  /**
   * Upload all 4 trade documents sequentially, updating the status of each
   * document to "UPLOADED" one by one in real-time.
   */
  async function handleUploadAllFourDocs(customFiles = null) {
    if (!selectedQuote || batchUploading) return;

    const shipmentId = selectedQuote.shipmentId;
    if (!shipmentId) {
      setWorkflowError("This quote is not linked to a shipment, so documents cannot be attached.");
      return;
    }

    setBatchUploading(true);
    setWorkflowError("");
    setWorkflowNotice("");

    try {
      for (let i = 0; i < FOUR_TRADE_DOCS.length; i++) {
        const item = FOUR_TRADE_DOCS[i];
        setBatchProgress({
          current: i + 1,
          total: FOUR_TRADE_DOCS.length,
          docName: item.name,
        });
        setUploadingDoc(item.name);

        let fileToUpload;
        if (customFiles && customFiles[i]) {
          fileToUpload = customFiles[i];
        } else {
          // Fetch the official sample PDF from public assets
          const res = await fetch(item.samplePath);
          const blob = await res.blob();
          fileToUpload = new File([blob], item.fileName, { type: "application/pdf" });
        }

        // Cache blob in memory so DocumentViewer and Customs Officer open it instantly
        if (typeof window !== "undefined") {
          window.__freightai_uploaded_blobs = window.__freightai_uploaded_blobs || {};
          window.__freightai_uploaded_blobs[fileToUpload.name] = URL.createObjectURL(fileToUpload);
        }

        const uploadResult = await uploadShipmentDocument(token, {
          shipmentId,
          documentType: item.name,
          file: fileToUpload,
          uploadedBy: user?.full_name || "Customer",
        });

        // Immediately update shipmentDocs so this document status turns to "UPLOADED" one by one
        setShipmentDocs((prev) => {
          const filtered = prev.filter(
            (u) => normalizeDocName(u.document_type) !== normalizeDocName(item.name)
          );
          const newDoc = uploadResult?.document || {
            id: uploadResult?.id || `doc-${Date.now()}-${i}`,
            shipment_id: shipmentId,
            document_type: item.name,
            file_name: fileToUpload.name,
            file_size: fileToUpload.size,
            verification_status: "PENDING",
            created_at: new Date().toISOString(),
          };
          return [...filtered, newDoc];
        });

        // Pause 650ms between uploads so the user visually sees each document change status to UPLOADED
        await new Promise((resolve) => setTimeout(resolve, 650));
      }

      await Promise.all([reloadQuotes(), loadShipmentDocs()]);

      // Broadcast to Customs Officer portal
      try {
        const bc = new BroadcastChannel("freight_quote_sync");
        bc.postMessage({ type: "DOCUMENTS_UPLOADED", shipmentId });
        bc.close();
      } catch (e) {}

      setWorkflowNotice("All 4 trade documents uploaded successfully! Sent to Customs Officer for verification.");
      setTimeout(() => setWorkflowNotice(""), 6000);
    } catch (err) {
      console.error("Batch upload error:", err);
      setWorkflowError(err.message || "Failed to upload all documents.");
    } finally {
      setBatchUploading(false);
      setBatchProgress(null);
      setUploadingDoc(null);
    }
  }

  /**
   * Upload a single trade document and immediately update status to UPLOADED.
   */
  async function handleFileSelected(docName, file) {
    if (!selectedQuote || !file || uploadingDoc || batchUploading) return;

    const shipmentId = selectedQuote.shipmentId;
    if (!shipmentId) {
      setWorkflowError("This quote is not linked to a shipment, so documents cannot be attached.");
      return;
    }

    setUploadingDoc(docName);
    setWorkflowError("");
    try {
      if (typeof window !== "undefined") {
        window.__freightai_uploaded_blobs = window.__freightai_uploaded_blobs || {};
        window.__freightai_uploaded_blobs[file.name] = URL.createObjectURL(file);
      }

      const res = await uploadShipmentDocument(token, {
        shipmentId,
        documentType: docName,
        file,
        uploadedBy: user?.full_name || "Customer",
      });

      // Optimistically update shipmentDocs immediately so status badge changes to UPLOADED
      setShipmentDocs((prev) => {
        const filtered = prev.filter(
          (u) => normalizeDocName(u.document_type) !== normalizeDocName(docName)
        );
        const newDoc = res?.document || {
          id: res?.id || `doc-${Date.now()}`,
          shipment_id: shipmentId,
          document_type: docName,
          file_name: file.name,
          file_size: file.size,
          verification_status: "PENDING",
          created_at: new Date().toISOString(),
        };
        return [...filtered, newDoc];
      });

      await Promise.all([reloadQuotes(), loadShipmentDocs()]);

      try {
        const bc = new BroadcastChannel("freight_quote_sync");
        bc.postMessage({ type: "DOCUMENTS_UPLOADED", shipmentId });
        bc.close();
      } catch (e) {}

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

      <ListFilterBar
        search={search}
        onSearch={setSearch}
        searchLabel={isShipmentMode ? "Search shipments" : "Search quotes"}
        searchPlaceholder={isShipmentMode ? "Tracking no, vessel, lane..." : "Quote no, customer, lane..."}
        filters={[
          { key: "lane", label: "All lanes", ariaLabel: "Filter by lane", value: laneFilter, options: laneOptions },
          { key: "mode", label: "All modes", ariaLabel: "Filter by mode", value: modeFilter, options: HISTORY_FILTER_OPTIONS.mode },
          {
            key: "status",
            label: "All statuses",
            ariaLabel: "Filter by status",
            value: statusFilter,
            options: isShipmentMode ? HISTORY_FILTER_OPTIONS.shipmentStatus : HISTORY_FILTER_OPTIONS.quoteStatus,
          },
          { key: "date", label: "All Time", ariaLabel: "Filter by date", value: dateFilter, options: HISTORY_FILTER_OPTIONS.date },
        ]}
        onFilterChange={(key, value) => {
          if (key === "lane") setLaneFilter(value);
          else if (key === "mode") setModeFilter(value);
          else if (key === "status") setStatusFilter(value);
          else if (key === "date") setDateFilter(value);
        }}
        onClear={clearFilters}
        resultCount={filtered.length}
        resultNoun={isShipmentMode ? "shipments" : "quotes"}
      >
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
                        const cfg = getQuoteStatusDisplay(q);
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
                            {cfg.label || normalizeWorkflowStatus(q.status)}
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
      </ListFilterBar>

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
                    const cfg = getQuoteStatusDisplay(selectedQuote);
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
                        Quote: {cfg.label || normalizeWorkflowStatus(selectedQuote.status)}
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
              {/* Multi-Role Quote Lifecycle Stepper. The company workflow
                  (M4), when this quote has one, takes the bar past the
                  agent's approval and through customs to the decision.
                  `shipmentStatus` is the same real value the header badge
                  shows, so the two rows cannot disagree. */}
              <QuoteWorkflowStepper
                status={selectedQuote.status}
                m4={selectedQuote.m4}
                shipmentStatus={selectedQuote.shipmentStatus}
              />

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
                      ["Customs", selectedQuote.m4.customsReference, selectedQuote.m4.customsStatus],
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
                    // An agent prices a revision from a total, so the offer's
                    // fee lines can still carry the original amounts. This is
                    // what makes the lines above add up to the total below.
                    // Anything under half a unit is the rounding of those lines
                    // against a rounded total: it would show as a zero row.
                    const adjustment = Number(m4?.offer?.adjustment || 0);
                    const showAdjustment = Math.round(adjustment) !== 0;
                    // The rows are shown in whole currency units, so each line is
                    // rounded for display and four roundings do not add up to the
                    // rounded total. Taking the row's amount from the figures on
                    // screen is what makes the sum below close exactly, rather
                    // than being a rupee out when the paise fall on either side
                    // of a rounding.
                    const displayedTotal = Math.round(Number(total) || 0);
                    const displayedLines = lines.reduce(
                      (sum, [, amount]) => sum + Math.round(Number(amount) || 0),
                      0,
                    );
                    // The company's counter-offer, pending or already accepted.
                    const revision = m4?.revision;
                    return (
                      <div className="rsh-fee-breakdown">
                        {lines.map(([label, amount]) => (
                          <div className="rsh-fee-row" key={label}>
                            <span>{label}</span>
                            <span>{formatMoney(amount, currency)}</span>
                          </div>
                        ))}
                        {showAdjustment && (
                          <div className="rsh-fee-row">
                            <span>{revision ? "Revision adjustment" : "Price adjustment"}</span>
                            <span>{formatMoney(displayedTotal - displayedLines, currency)}</span>
                          </div>
                        )}
                        <div className="rsh-fee-divider"></div>
                        <div className="rsh-fee-total-row">
                          <div>
                            <span className="rsh-total-label">
                              {m4
                                ? m4.bookingReference || m4.wasRevised
                                  ? "Agreed total"
                                  : `${m4.companyName} offer`
                                : "Total quote"}
                            </span>
                            <span className="rsh-total-sub">
                              {m4 ? `${m4.companyName}'s rate card at the AI market rate` : "Platform rule-based pricing"}
                            </span>
                          </div>
                          <div className="rsh-total-val">{formatMoney(total, currency)}</div>
                        </div>

                        {/* What happened to the price. A record that quietly
                            showed the original amount beside a revised one left
                            the customer unable to tell which they were
                            confirming. */}
                        {revision && (
                          <div className={`rsh-revision-note${revision.accepted ? "" : " pending"}`}>
                            <AlertTriangle size={13} />
                            <span>
                              {revision.accepted ? (
                                <>
                                  Revised from {formatMoney(revision.originalTotal, currency)} to{" "}
                                  {formatMoney(revision.revisedTotal, currency)}. This is the total
                                  you are booking at.
                                </>
                              ) : (
                                <>
                                  {m4.companyName} has revised this offer to{" "}
                                  {formatMoney(revision.revisedTotal, currency)} (was{" "}
                                  {formatMoney(revision.originalTotal, currency)}). The total above is
                                  still the original one — accept or decline the revision in{" "}
                                  <Link to="/dashboard/selected-quotes" onClick={() => setSelectedQuote(null)}>
                                    Selected Quotes
                                  </Link>{" "}
                                  to move it.
                                </>
                              )}
                              {revision.reason ? <> Reason: {revision.reason}</> : null}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Trade & Customs Documents Panel */}
                <div className="rsh-card-panel docs-panel" style={{ gridColumn: "1 / -1", marginTop: "16px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "18px" }}>
                  <div className="rsh-panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", color: "#0f172a" }}>
                      <FileText size={17} style={{ color: "#0284c7" }} />
                      <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "800" }}>Trade &amp; Customs Documents (Regulatory Clearance Gate)</h4>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>
                        HS Code: <strong style={{ color: "#0f172a" }}>{selectedQuote.hsCode || "8471.30"}</strong> &bull; Cargo: <strong style={{ color: "#0f172a" }}>{selectedQuote.cargoType || "General Commercial Goods"}</strong>
                      </span>
                      <span style={{ color: "#cbd5e1" }}>&bull;</span>
                      <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Sample Templates:</span>
                      <a href="/sample_trade_documents/Commercial_Invoice_INV2026.pdf" download style={{ fontSize: "11px", color: "#0284c7", fontWeight: 700, textDecoration: "underline" }}>Invoice</a>
                      <a href="/sample_trade_documents/Packing_List_PL9921.pdf" download style={{ fontSize: "11px", color: "#0284c7", fontWeight: 700, textDecoration: "underline" }}>Packing List</a>
                      <a href="/sample_trade_documents/Bill_of_Lading_Draft_BL4810.pdf" download style={{ fontSize: "11px", color: "#0284c7", fontWeight: 700, textDecoration: "underline" }}>B/L Draft</a>
                      <a href="/sample_trade_documents/Certificate_of_Origin_COO2026.pdf" download style={{ fontSize: "11px", color: "#0284c7", fontWeight: 700, textDecoration: "underline" }}>Origin Cert</a>
                    </div>
                  </div>

                  {/* Batch Upload Action Controls */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                      flexWrap: "wrap",
                      padding: "10px 14px",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      marginBottom: "14px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="rsh-upload-all-btn"
                        onClick={() => handleUploadAllFourDocs()}
                        disabled={batchUploading || !!uploadingDoc}
                        style={{
                          background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "8px",
                          padding: "8px 16px",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: batchUploading ? "wait" : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          boxShadow: "0 2px 6px rgba(2, 132, 199, 0.25)",
                          transition: "all 0.2s ease",
                        }}
                      >
                        {batchUploading ? (
                          <>
                            <RotateCw size={14} className="spin-icon" />
                            <span>Uploading {batchProgress?.current || 1}/4: {batchProgress?.docName || "..."}</span>
                          </>
                        ) : (
                          <>
                            <FileUp size={14} />
                            <span>Upload All 4 Documents</span>
                          </>
                        )}
                      </button>

                      <label
                        style={{
                          background: "#ffffff",
                          color: "#334155",
                          border: "1px solid #cbd5e1",
                          borderRadius: "8px",
                          padding: "7px 14px",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: batchUploading || !!uploadingDoc ? "not-allowed" : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <Upload size={13} style={{ color: "#64748b" }} />
                        <span>Choose 4 Local Files</span>
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.csv"
                          style={{ display: "none" }}
                          disabled={batchUploading || !!uploadingDoc}
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            if (files.length > 0) handleUploadAllFourDocs(files);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>

                    <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 500 }}>
                      ⚡ Uploads documents sequentially and transitions each status badge to <strong>UPLOADED</strong> in real-time.
                    </div>
                  </div>

                  {/* Sequential Upload Progress Banner */}
                  {batchUploading && batchProgress && (
                    <div
                      style={{
                        background: "#eff6ff",
                        border: "1px solid #bfdbfe",
                        borderRadius: "10px",
                        padding: "12px 16px",
                        marginBottom: "14px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#1e40af", fontWeight: 700, fontSize: "12.5px" }}>
                          <RotateCw size={15} className="spin-icon" style={{ color: "#2563eb" }} />
                          <span>Uploading document {batchProgress.current} of {batchProgress.total}: <strong style={{ color: "#0f172a" }}>{batchProgress.docName}</strong></span>
                        </div>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#2563eb" }}>
                          {Math.round((batchProgress.current / batchProgress.total) * 100)}%
                        </span>
                      </div>
                      <div style={{ width: "100%", height: "6px", background: "#dbeafe", borderRadius: "999px", overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${(batchProgress.current / batchProgress.total) * 100}%`,
                            height: "100%",
                            background: "linear-gradient(90deg, #2563eb 0%, #0284c7 100%)",
                            borderRadius: "999px",
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Document Cards Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px", marginBottom: "12px" }}>
                    {FOUR_TRADE_DOCS.map((doc, idx) => {
                      const match = shipmentDocs.find(
                        (u) => normalizeDocName(u.document_type) === normalizeDocName(doc.name),
                      );
                      const effective = checklistStatus(doc);
                      const isVerified = effective === "VERIFIED";
                      const isUploaded = effective === "UPLOADED";
                      const isCurrentUploading = uploadingDoc === doc.name;

                      return (
                        <div
                          key={idx}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "12px 14px",
                            background: isVerified
                              ? "#fafffb"
                              : isCurrentUploading
                              ? "#f0f9ff"
                              : isUploaded
                              ? "#f0f9ff"
                              : "#f8fafc",
                            border: `1px solid ${
                              isVerified
                                ? "#86efac"
                                : isCurrentUploading
                                ? "#38bdf8"
                                : isUploaded
                                ? "#93c5fd"
                                : "#e2e8f0"
                            }`,
                            borderRadius: "10px",
                            gap: "12px",
                            transition: "all 0.3s ease",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                            <div
                              style={{
                                width: "34px",
                                height: "34px",
                                borderRadius: "8px",
                                background: isVerified
                                  ? "#dcfce7"
                                  : isCurrentUploading
                                  ? "#e0f2fe"
                                  : isUploaded
                                  ? "#e0f2fe"
                                  : "#f1f5f9",
                                color: isVerified
                                  ? "#16a34a"
                                  : isCurrentUploading
                                  ? "#0284c7"
                                  : isUploaded
                                  ? "#0284c7"
                                  : "#64748b",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              {isCurrentUploading ? (
                                <RotateCw size={16} className="spin-icon" />
                              ) : isVerified ? (
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
                              {isCurrentUploading ? (
                                <div style={{ fontSize: "11px", color: "#0284c7", fontWeight: 600 }}>
                                  Uploading document file...
                                </div>
                              ) : isUploaded && match?.file_name ? (
                                <div style={{ fontSize: "11px", color: "#0369a1", maxWidth: "170px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>
                                  {match.file_name} {match.file_size ? `(${Math.round(match.file_size / 1024)} KB)` : ""}
                                </div>
                              ) : (
                                <div style={{ fontSize: "11px", color: isVerified ? "#16a34a" : isUploaded ? "#0284c7" : "#d97706" }}>
                                  {isVerified ? "Clearance Approved" : isUploaded ? "Under Officer Review" : "Required for Clearance"}
                                </div>
                              )}
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                            {isCurrentUploading ? (
                              <span style={{ fontSize: "11px", fontWeight: 700, color: "#0284c7", background: "#e0f2fe", padding: "4px 9px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                <RotateCw size={11} className="spin-icon" /> UPLOADING
                              </span>
                            ) : isVerified ? (
                              <span style={{ fontSize: "11px", fontWeight: 700, color: "#15803d", background: "#dcfce7", padding: "4px 9px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                <CheckCircle2 size={11} /> VERIFIED
                              </span>
                            ) : isUploaded ? (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ fontSize: "11px", fontWeight: 700, color: "#0369a1", background: "#e0f2fe", padding: "4px 8px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                  <Check size={11} /> UPLOADED
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
                                    cursor: batchUploading ? "not-allowed" : "pointer",
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
                                    disabled={batchUploading || !!uploadingDoc}
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
                                  cursor: batchUploading ? "not-allowed" : "pointer",
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
                                  disabled={batchUploading || !!uploadingDoc}
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

            {/* The customer's final decision.
                The company has verified this shipment and customs has cleared
                it, so the only move left is the customer's: book it at the
                agreed price, or decline it and choose another company. That
                step lived only in Selected Quotes, so the record a customer
                opened to check the final quote offered them no way to act on
                it. Shown for this state alone — every other state belongs to
                the company, customs or the legacy review flow. */}
            {selectedQuote.m4?.status === "CUSTOMS_CLEARED" && (
              <div className="rsh-final-decision">
                <div className="rsh-final-decision-head">
                  <ShieldCheck size={16} />
                  <div>
                    <strong>Final quote ready — confirm your booking</strong>
                    <span>
                      {selectedQuote.m4.companyName} approved this shipment and customs cleared
                      it. Confirming books it at{" "}
                      {formatMoney(
                        selectedQuote.m4.agreedTotal ?? selectedQuote.m4.selectedTotal,
                        selectedQuote.m4.currency,
                      )}
                      .
                    </span>
                  </div>
                </div>
                <div className="rsh-final-decision-form">
                  <input
                    type="text"
                    value={finalNote}
                    onChange={(e) => setFinalNote(e.target.value)}
                    placeholder="Note for the company (a reason is required if you decline)"
                    aria-label="Note for the company"
                    disabled={finalBusy}
                  />
                  {finalError && <div className="rsh-final-decision-error">{finalError}</div>}
                  <div className="rsh-final-decision-actions">
                    <button
                      type="button"
                      className="btn-secondary-light"
                      onClick={() => submitCustomerFinalDecision("DECLINE")}
                      disabled={finalBusy}
                    >
                      <ThumbsDown size={14} /> Decline
                    </button>
                    <button
                      type="button"
                      className="btn-orange-primary"
                      onClick={() => submitCustomerFinalDecision("ACCEPT")}
                      disabled={finalBusy}
                    >
                      <ThumbsUp size={14} /> {finalBusy ? "Recording…" : "Confirm booking"}
                    </button>
                  </div>
                </div>
              </div>
            )}

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
