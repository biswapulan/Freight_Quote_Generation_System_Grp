import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  RotateCw,
  Ship,
  Upload,
  FileUp,
  FileText,
  Check,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  listBookings,
  listMySelections,
  listShipmentDocuments,
  provideSelectionInformation,
  respondToRevision,
  submitFinalDecision,
  uploadShipmentDocument,
} from "../api/workflow";
import ListFilterBar from "./ListFilterBar";
import { filterRows, optionsFrom } from "../utils/listFilters";
import { refreshPlatformQuotes } from "../utils/quoteWorkflow";
import "./CustomerSelections.css";

/**
 * Where the customer tracks the company they chose (milestone 4, section 6).
 *
 * Selecting a company is a request, not a booking. This screen shows what that
 * company is doing with it, and puts the two things the customer may be asked
 * for, accepting a revised price and supplying missing paperwork, in front of
 * them rather than leaving them to wonder.
 */

const STAGES = [
  { key: "QUOTE_SELECTED", label: "Selected" },
  { key: "PENDING_COMPANY_VERIFICATION", label: "Sent to company" },
  { key: "UNDER_VERIFICATION", label: "Being checked" },
  { key: "APPROVED", label: "Company approved" },
  { key: "CUSTOMS_CLEARED", label: "Customs cleared" },
  { key: "BOOKING_CONFIRMED", label: "Booked" },
];

const EXPLAIN = {
  QUOTE_SELECTED: "You picked this company. We are passing it to them now.",
  PENDING_COMPANY_VERIFICATION:
    "Waiting for the company to pick up your request.",
  UNDER_VERIFICATION:
    "The company is checking capacity, route, documents and price.",
  AWAITING_CUSTOMER_INFO: "The company needs something from you before it can go further.",
  REVISION_PENDING_CUSTOMER:
    "The company has proposed different terms. Accept them, or choose another company.",
  REVISION_ACCEPTED: "You accepted the revised terms.",
  APPROVED: "The company has approved your shipment. It is going to customs.",
  PENDING_CUSTOMS_REVIEW:
    "The company approved it. Customs is now checking the consignment and its papers.",
  CUSTOMS_CLEARED:
    "Approved by the company and cleared by customs. Confirm the booking, or decline it.",
  CUSTOMS_REJECTED: "Customs could not clear this shipment. You can choose another company.",
  REJECTED: "This company cannot carry the shipment. You can choose another.",
  ESCALATED: "The company is getting internal approval for this one.",
  BOOKING_CONFIRMED: "Confirmed. Your booking reference is below.",
  BOOKING_CANCELLED: "This booking was cancelled.",
  RESELECT_QUOTE: "Closed. You can pick another company for this shipment.",
};

const TONE = {
  CUSTOMS_CLEARED: "warn",
  CUSTOMS_REJECTED: "bad",
  APPROVED: "ok",
  REVISION_ACCEPTED: "ok",
  BOOKING_CONFIRMED: "ok",
  REJECTED: "bad",
  BOOKING_CANCELLED: "bad",
  RESELECT_QUOTE: "muted",
  AWAITING_CUSTOMER_INFO: "warn",
  REVISION_PENDING_CUSTOMER: "warn",
  ESCALATED: "warn",
};

// The names customs uses for the papers a shipment needs, so an attachment
// lines up with the checklist item it answers.
const DOC_TYPES = [
  "Commercial Invoice",
  "Packing List",
  "Bill of Lading / Sea Waybill (B/L)",
  "Certificate of Origin (COO)",
  "Other supporting document",
];

const FOUR_TRADE_DOCS = [
  {
    name: "Commercial Invoice",
    docType: "Commercial Invoice",
    samplePath: "/sample_trade_documents/Commercial_Invoice_INV2026.pdf",
    fileName: "Commercial_Invoice_INV2026.pdf",
  },
  {
    name: "Packing List",
    docType: "Packing List",
    samplePath: "/sample_trade_documents/Packing_List_PL9921.pdf",
    fileName: "Packing_List_PL9921.pdf",
  },
  {
    name: "Bill of Lading Draft",
    docType: "Bill of Lading / Sea Waybill (B/L)",
    samplePath: "/sample_trade_documents/Bill_of_Lading_Draft_BL4810.pdf",
    fileName: "Bill_of_Lading_Draft_BL4810.pdf",
  },
  {
    name: "Certificate of Origin",
    docType: "Certificate of Origin (COO)",
    samplePath: "/sample_trade_documents/Certificate_of_Origin_COO2026.pdf",
    fileName: "Certificate_of_Origin_COO2026.pdf",
  },
];

const normalizeDocName = (name) => (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");

function money(amount, currency) {
  const value = Number(amount || 0);
  return `${currency === "INR" ? "₹ " : `${currency || ""} `}${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function CustomerSelections() {
  const { token } = useAuth();
  const [selections, setSelections] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(null);

  const [revisionFor, setRevisionFor] = useState(null);
  // The cleared request the customer is booking or declining.
  const [finalFor, setFinalFor] = useState(null);
  const [infoFor, setInfoFor] = useState(null);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState([]);
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [modalDocs, setModalDocs] = useState({});
  const [batchUploading, setBatchUploading] = useState(false);
  const [batchProgress, setBatchProgress] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(null);

  function closeInfo() {
    setInfoFor(null);
    setFiles([]);
    setModalDocs({});
    setBatchUploading(false);
    setBatchProgress(null);
    setUploadingDoc(null);
  }

  // Load existing documents for the active shipment when modal opens
  useEffect(() => {
    if (!infoFor?.shipmentId || !token) {
      setModalDocs({});
      setBatchUploading(false);
      setBatchProgress(null);
      setUploadingDoc(null);
      return;
    }

    let active = true;
    listShipmentDocuments(token, infoFor.shipmentId)
      .then((data) => {
        if (!active) return;
        const initial = {};
        const existing = data.results || [];
        FOUR_TRADE_DOCS.forEach((d) => {
          const match = existing.find(
            (u) =>
              normalizeDocName(u.document_type) === normalizeDocName(d.name) ||
              normalizeDocName(u.document_type) === normalizeDocName(d.docType),
          );
          if (match) {
            initial[d.name] = {
              status: "UPLOADED",
              fileName: match.file_name,
              fileSize: match.file_size,
            };
          } else {
            initial[d.name] = {
              status: "PENDING",
              fileName: null,
              fileSize: null,
            };
          }
        });
        setModalDocs(initial);
      })
      .catch(() => {
        const initial = {};
        FOUR_TRADE_DOCS.forEach((d) => {
          initial[d.name] = { status: "PENDING" };
        });
        setModalDocs(initial);
      });

    return () => {
      active = false;
    };
  }, [infoFor, token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [sel, book] = await Promise.all([
        listMySelections(token),
        listBookings(token).catch(() => ({ results: [] })),
      ]);
      setSelections(sel.results || []);
      setBookings(book.results || []);
    } catch (err) {
      setError(err.message || "Could not load your selections.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const bookingFor = (reference) =>
    bookings.find((b) => b.selectionReference === reference);

  async function answerRevision(decision) {
    if (!revisionFor || busy) return;
    if (decision === "DECLINE" && !note.trim()) {
      setNotice({ type: "error", text: "Tell the company why you are declining." });
      return;
    }
    setBusy(revisionFor.reference);
    try {
      const res = await respondToRevision(token, revisionFor.reference, {
        decision,
        note: note.trim(),
      });
      setNotice({
        type: decision === "ACCEPT" ? "success" : "info",
        text:
          decision === "ACCEPT"
            ? "Revised terms accepted. The shipment now goes to customs for clearance."
            : "Declined. You can now choose another company for this shipment.",
      });
      setRevisionFor(null);
      setNote("");
      await load();
      return res;
    } catch (err) {
      setNotice({ type: "error", text: err.message || "Could not record your response." });
    } finally {
      setBusy(null);
    }
  }

  async function answerFinal(decision) {
    if (!finalFor || busy) return;
    if (decision === "DECLINE" && !note.trim()) {
      setNotice({ type: "error", text: "Tell the company why you are declining." });
      return;
    }
    setBusy(finalFor.reference);
    try {
      const res = await submitFinalDecision(token, finalFor.reference, {
        decision,
        note: note.trim(),
      });
      setNotice({
        type: decision === "ACCEPT" ? "success" : "info",
        text:
          decision === "ACCEPT"
            ? `Booked. Your booking reference is ${res.booking?.reference || "shown below"}.`
            : "Declined. You can now choose another company for this shipment.",
      });
      setFinalFor(null);
      setNote("");
      try {
        const bc = new BroadcastChannel("freight_quote_sync");
        bc.postMessage({ type: "BOOKING_CONFIRMED", selectionRef: finalFor.reference });
        bc.close();
      } catch (e) {}
      await load();
      try {
        await refreshPlatformQuotes();
      } catch (e) {}
    } catch (err) {
      setNotice({ type: "error", text: err.message || "Could not record your decision." });
    } finally {
      setBusy(null);
    }

  }

  /**
   * Upload all 4 trade documents sequentially, updating the status of each
   * document to "UPLOADED" one by one in real-time.
   */
  async function handleUploadAllFourDocs(customFiles = null) {
    if (!infoFor?.shipmentId || batchUploading) return;
    const shipmentId = infoFor.shipmentId;
    setBatchUploading(true);
    setNotice(null);

    try {
      for (let i = 0; i < FOUR_TRADE_DOCS.length; i++) {
        const item = FOUR_TRADE_DOCS[i];
        setUploadingDoc(item.name);
        setBatchProgress({
          current: i + 1,
          total: FOUR_TRADE_DOCS.length,
          docName: item.name,
        });

        // 1. Visually mark document as UPLOADING
        setModalDocs((prev) => ({
          ...prev,
          [item.name]: {
            ...prev[item.name],
            status: "UPLOADING",
          },
        }));

        let fileToUpload;
        if (customFiles && customFiles[i]) {
          fileToUpload = customFiles[i];
        } else {
          const res = await fetch(item.samplePath);
          const blob = await res.blob();
          fileToUpload = new File([blob], item.fileName, { type: "application/pdf" });
        }

        if (typeof window !== "undefined") {
          window.__freightai_uploaded_blobs = window.__freightai_uploaded_blobs || {};
          window.__freightai_uploaded_blobs[fileToUpload.name] = URL.createObjectURL(fileToUpload);
        }

        await uploadShipmentDocument(token, {
          shipmentId,
          documentType: item.name,
          file: fileToUpload,
        });

        // 2. Visually transition status to UPLOADED one by one
        setModalDocs((prev) => ({
          ...prev,
          [item.name]: {
            status: "UPLOADED",
            fileName: fileToUpload.name,
            fileSize: fileToUpload.size,
          },
        }));

        setFiles((prev) => [...prev.filter((f) => f.name !== fileToUpload.name), fileToUpload]);

        // Pause 650ms so user visibly sees each status change one by one
        await new Promise((resolve) => setTimeout(resolve, 650));
      }

      setNote((prev) =>
        prev.trim()
          ? prev
          : "All 4 required trade documents (Commercial Invoice, Packing List, Bill of Lading Draft, Certificate of Origin) attached.",
      );

      try {
        const bc = new BroadcastChannel("freight_quote_sync");
        bc.postMessage({ type: "DOCUMENTS_UPLOADED", shipmentId });
        bc.close();
      } catch (e) {}

      setNotice({
        type: "success",
        text: `All 4 trade documents uploaded successfully! Click "Send to ${infoFor.companyName}" to submit.`,
      });
    } catch (err) {
      console.error("Batch upload error:", err);
      setNotice({
        type: "error",
        text: err.message || "Failed to upload all documents.",
      });
    } finally {
      setBatchUploading(false);
      setBatchProgress(null);
      setUploadingDoc(null);
    }
  }

  /**
   * Upload an individual trade document.
   */
  async function handleUploadSingleModalDoc(docItem, file) {
    if (!infoFor?.shipmentId || !file || batchUploading) return;
    const shipmentId = infoFor.shipmentId;
    setUploadingDoc(docItem.name);
    setModalDocs((prev) => ({
      ...prev,
      [docItem.name]: { ...prev[docItem.name], status: "UPLOADING" },
    }));

    try {
      if (typeof window !== "undefined") {
        window.__freightai_uploaded_blobs = window.__freightai_uploaded_blobs || {};
        window.__freightai_uploaded_blobs[file.name] = URL.createObjectURL(file);
      }
      await uploadShipmentDocument(token, {
        shipmentId,
        documentType: docItem.name,
        file,
      });
      setModalDocs((prev) => ({
        ...prev,
        [docItem.name]: {
          status: "UPLOADED",
          fileName: file.name,
          fileSize: file.size,
        },
      }));
      setFiles((prev) => [...prev.filter((f) => f.name !== file.name), file]);
      try {
        const bc = new BroadcastChannel("freight_quote_sync");
        bc.postMessage({ type: "DOCUMENTS_UPLOADED", shipmentId });
        bc.close();
      } catch (e) {}
    } catch (err) {
      setModalDocs((prev) => ({
        ...prev,
        [docItem.name]: { ...prev[docItem.name], status: "PENDING" },
      }));
      setNotice({ type: "error", text: err.message || "Failed to upload document." });
    } finally {
      setUploadingDoc(null);
    }
  }

  async function sendInformation() {
    if (!infoFor || busy) return;
    const hasAnyUploaded = FOUR_TRADE_DOCS.some((d) => modalDocs[d.name]?.status === "UPLOADED");
    if (!note.trim() && !files.length && !hasAnyUploaded) {
      setNotice({ type: "error", text: "Attach documents or describe what you are providing." });
      return;
    }
    setBusy(infoFor.reference);
    try {
      const names = files.map((f) => f.name);
      FOUR_TRADE_DOCS.forEach((d) => {
        if (modalDocs[d.name]?.fileName && !names.includes(modalDocs[d.name].fileName)) {
          names.push(modalDocs[d.name].fileName);
        }
      });
      const attached = names.length ? `Attached: ${names.join(", ")}.` : "";
      await provideSelectionInformation(token, infoFor.reference, {
        note: [note.trim(), attached].filter(Boolean).join(" "),
        provided: names,
      });
      setNotice({
        type: "success",
        text: names.length
          ? `Sent with ${names.length} file${names.length === 1 ? "" : "s"}. The company will pick your request back up.`
          : "Sent. The company will pick your request back up.",
      });
      closeInfo();
      setNote("");
      await load();
      try {
        const bc = new BroadcastChannel("freight_quote_sync");
        bc.postMessage({ type: "INFO_PROVIDED", selectionRef: infoFor.reference });
        bc.close();
      } catch (e) {}
    } catch (err) {
      setNotice({ type: "error", text: err.message || "Could not send that." });
    } finally {
      setBusy(null);
    }
  }

  const needsYou = selections.filter((s) => s.awaitingYou);

  /**
   * Search and dropdown state for the list toolbar.
   *
   * The search reads what each card prints — the company, the selection and
   * shipment references, and the customs reference once there is one. An empty
   * search shows every selection, as before.
   */
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");

  const visibleSelections = useMemo(
    () =>
      filterRows(selections, {
        search,
        fields: [
          "reference",
          "companyName",
          "shipmentId",
          "quoteId",
          "customer_email",
          (s) => s.customs?.reference,
        ],
        filters: [
          { value: statusFilter, matches: (s, status) => s.status === status },
          {
            value: actionFilter,
            matches: (s, action) => (action === "yours") === Boolean(s.awaitingYou),
          },
        ],
      }),
    [selections, search, statusFilter, actionFilter],
  );

  const statusFilterOptions = useMemo(
    () =>
      optionsFrom(
        selections,
        (s) => s.status,
        (status) => status.replaceAll("_", " "),
      ),
    [selections],
  );

  const narrowed = Boolean(search.trim()) || statusFilter !== "all" || actionFilter !== "all";

  return (
    <div className="csel-page">
      <header className="csel-header">
        <div>
          <p className="csel-eyebrow">Shipments / Selected quotes</p>
          <h1 className="csel-title">Your selected companies</h1>
          <p className="csel-sub">
            Picking a company starts their verification. This is where you see what
            they decided, and answer anything they need.
          </p>
        </div>
        <div className="csel-head-actions">
          <button type="button" className="csel-refresh" onClick={load} disabled={loading}>
            <RotateCw size={14} className={loading ? "csel-spin" : ""} /> Refresh
          </button>
          <Link to="/dashboard/request-quote" className="csel-primary">
            + New enquiry
          </Link>
        </div>
      </header>

      {error && <div className="csel-banner error">{error}</div>}
      {notice && <div className={`csel-banner ${notice.type}`}>{notice.text}</div>}

      {needsYou.length > 0 && (
        <div className="csel-banner warn">
          <AlertTriangle size={16} />
          {needsYou.length} {needsYou.length === 1 ? "request needs" : "requests need"} your
          response below.
        </div>
      )}

      {loading ? (
        <div className="csel-empty">Loading...</div>
      ) : selections.length === 0 ? (
        <div className="csel-empty">
          You have not selected a company yet. Raise an enquiry, compare the offers,
          and pick one.
        </div>
      ) : (
        <div className="csel-list">
          <ListFilterBar
            search={search}
            onSearch={setSearch}
            searchLabel="Search your selected companies"
            searchPlaceholder="Selection ref, company, shipment, quote..."
            filters={[
              {
                key: "status",
                label: "All statuses",
                ariaLabel: "Filter by status",
                value: statusFilter,
                options: statusFilterOptions,
              },
              {
                key: "action",
                label: "Everything",
                ariaLabel: "Filter by what is waiting on you",
                value: actionFilter,
                options: [
                  { value: "yours", label: "Needs your response" },
                  { value: "theirs", label: "Waiting on the company" },
                ],
              },
            ]}
            onFilterChange={(key, value) => {
              if (key === "status") setStatusFilter(value);
              else if (key === "action") setActionFilter(value);
            }}
            onClear={() => {
              setSearch("");
              setStatusFilter("all");
              setActionFilter("all");
            }}
            resultCount={visibleSelections.length}
            resultNoun="selections"
          />

          {visibleSelections.length === 0 ? (
            <div className="csel-empty">
              {narrowed
                ? "No selections match your search."
                : "Nothing to show for this selection yet."}
            </div>
          ) : (
            visibleSelections.map((s) => {
            const booking = bookingFor(s.reference);
            const tone = TONE[s.status] || "active";
            return (
              <article key={s.id} className={`csel-card ${tone}`}>
                <div className="csel-card-head">
                  <div>
                    <span className="csel-company">{s.companyName}</span>
                    <span className="csel-ref">{s.reference}</span>
                  </div>
                  <span className={`csel-pill ${tone}`}>
                    {s.status.replaceAll("_", " ").toLowerCase()}
                  </span>
                </div>

                <p className="csel-explain">{EXPLAIN[s.status] || ""}</p>

                <Progress status={s.status} />

                <div className="csel-terms">
                  <Term label="You selected" value={money(s.selectedTotalPrice, s.selectedCurrency)} />
                  <Term label="Transit" value={`${s.selectedTransitDays ?? "—"} days`} />
                  <Term label="Shipment" value={s.shipmentId} />
                  <Term label="Quote" value={s.quoteId} />
                  {s.customs && <Term label="Customs" value={s.customs.reference} />}
                  {s.priceChanged && (
                    <Term label="Agreed after revision" value="see below" tone="warn" />
                  )}
                </div>

                {s.pendingRevision && (
                  <div className="csel-revision">
                    <div className="csel-revision-head">
                      <AlertTriangle size={16} />
                      <strong>{s.companyName} proposed different terms</strong>
                    </div>
                    <div className="csel-compare">
                      <div>
                        <span className="csel-compare-label">You selected</span>
                        <span className="csel-compare-old">
                          {money(s.pendingRevision.originalTotalPrice, s.pendingRevision.currency)}
                        </span>
                        <span className="csel-compare-sub">
                          {s.pendingRevision.originalTransitDays} days
                        </span>
                      </div>
                      <ArrowRight size={18} className="csel-compare-arrow" />
                      <div>
                        <span className="csel-compare-label">They now offer</span>
                        <span className="csel-compare-new">
                          {money(s.pendingRevision.revisedTotalPrice, s.pendingRevision.currency)}
                        </span>
                        <span className="csel-compare-sub">
                          {/* A price-only revision keeps the original transit time. */}
                          {s.pendingRevision.revisedTransitDays ?? s.pendingRevision.originalTransitDays} days
                        </span>
                      </div>
                      <span
                        className={`csel-delta ${s.pendingRevision.priceDelta > 0 ? "up" : "down"}`}
                      >
                        {s.pendingRevision.priceDelta > 0 ? "+" : ""}
                        {s.pendingRevision.priceDeltaPct}%
                      </span>
                    </div>
                    <p className="csel-reason">
                      <strong>Their reason:</strong> {s.pendingRevision.reason}
                    </p>
                    <button
                      type="button"
                      className="csel-primary"
                      onClick={() => {
                        setRevisionFor(s);
                        setNote("");
                      }}
                    >
                      Review this revision
                    </button>
                  </div>
                )}

                {s.status === "AWAITING_CUSTOMER_INFO" && (
                  <div className="csel-info-request">
                    <p>
                      {s.companyName} needs more from you before they can confirm.
                    </p>
                    <button
                      type="button"
                      className="csel-primary"
                      onClick={() => {
                        setInfoFor(s);
                        setNote("");
                      }}
                    >
                      Respond
                    </button>
                  </div>
                )}

                {s.customs?.reason && (
                  <p className="csel-customs-note">
                    <strong>Customs:</strong> {s.customs.reason}
                  </p>
                )}

                {s.status === "CUSTOMS_CLEARED" && (
                  <div className="csel-final">
                    <div>
                      <strong>Approved by {s.companyName} and cleared by customs</strong>
                      <span className="csel-compare-sub">
                        Book it at {money(s.agreedTotalPrice, s.selectedCurrency)}, or decline
                        and choose another company.
                      </span>
                    </div>
                    <button
                      type="button"
                      className="csel-primary"
                      onClick={() => {
                        setFinalFor(s);
                        setNote("");
                      }}
                    >
                      Make your decision
                    </button>
                  </div>
                )}

                {booking && (
                  <div className="csel-booking">
                    <ShieldCheck size={16} />
                    <div>
                      <strong>Booking {booking.reference}</strong>
                      <span className="csel-compare-sub">
                        {money(booking.agreedTotalPrice, booking.agreedCurrency)} ·{" "}
                        {booking.agreedTransitDays} days · {booking.status.toLowerCase()}
                      </span>
                    </div>
                  </div>
                )}

                {["REJECTED", "CUSTOMS_REJECTED", "RESELECT_QUOTE"].includes(s.status) && (
                  <Link
                    to="/dashboard/my-quotes"
                    className="csel-secondary"
                  >
                    Choose another company <ArrowRight size={13} />
                  </Link>
                )}
              </article>
            );
            })
          )}
        </div>
      )}

      {revisionFor && (
        <Modal
          title={`${revisionFor.companyName} revised your quote`}
          onClose={() => setRevisionFor(null)}
        >
          <p className="csel-modal-text">
            Accepting takes the new terms; customs then clears the shipment and you
            confirm the booking. Declining does not cancel your shipment: you can pick
            another company.
          </p>
          <div className="csel-compare boxed">
            <div>
              <span className="csel-compare-label">You selected</span>
              <span className="csel-compare-old">
                {money(revisionFor.pendingRevision.originalTotalPrice, revisionFor.pendingRevision.currency)}
              </span>
            </div>
            <ArrowRight size={18} className="csel-compare-arrow" />
            <div>
              <span className="csel-compare-label">They now offer</span>
              <span className="csel-compare-new">
                {money(revisionFor.pendingRevision.revisedTotalPrice, revisionFor.pendingRevision.currency)}
              </span>
            </div>
          </div>
          <label className="csel-field">
            Note to the company (required if you decline)
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional if accepting."
            />
          </label>
          <div className="csel-modal-actions">
            <button
              type="button"
              className="csel-decline"
              disabled={Boolean(busy)}
              onClick={() => answerRevision("DECLINE")}
            >
              <XCircle size={15} /> Decline and look elsewhere
            </button>
            <button
              type="button"
              className="csel-primary"
              disabled={Boolean(busy)}
              onClick={() => answerRevision("ACCEPT")}
            >
              <CheckCircle2 size={15} /> Accept revised terms
            </button>
          </div>
        </Modal>
      )}

      {finalFor && (
        <Modal
          title={`Book with ${finalFor.companyName}?`}
          onClose={() => setFinalFor(null)}
        >
          <p className="csel-modal-text">
            {finalFor.companyName} approved this shipment and customs has cleared it.
            Confirming creates your booking. Declining does not cancel your shipment:
            you can choose another company.
          </p>
          <div className="csel-compare boxed">
            <div>
              <span className="csel-compare-label">Booking price</span>
              <span className="csel-compare-new">
                {money(finalFor.agreedTotalPrice, finalFor.selectedCurrency)}
              </span>
              <span className="csel-compare-sub">
                {finalFor.reference} · customs {finalFor.customs?.reference}
              </span>
            </div>
          </div>
          <label className="csel-field">
            Note to the company (required if you decline)
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional if confirming."
            />
          </label>
          <div className="csel-modal-actions">
            <button
              type="button"
              className="csel-decline"
              disabled={Boolean(busy)}
              onClick={() => answerFinal("DECLINE")}
            >
              <XCircle size={15} /> Decline
            </button>
            <button
              type="button"
              className="csel-primary"
              disabled={Boolean(busy)}
              onClick={() => answerFinal("ACCEPT")}
            >
              <CheckCircle2 size={15} /> Confirm booking
            </button>
          </div>
        </Modal>
      )}

      {infoFor && (
        <Modal
          title={`${infoFor.companyName} needs more information`}
          onClose={closeInfo}
        >
          <p className="csel-modal-text">
            Attach the documents they asked for, or describe what you are supplying.
            The company&apos;s agent sees the files straight away, and your request goes
            back to their desk.
          </p>

          {/* Action header with Upload All 4 Documents */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              flexWrap: "wrap",
              padding: "12px 14px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              margin: "14px 0 12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="csel-primary"
                onClick={() => handleUploadAllFourDocs()}
                disabled={batchUploading || !!uploadingDoc}
                style={{
                  padding: "7px 14px",
                  fontSize: "12px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: batchUploading ? "wait" : "pointer",
                }}
              >
                {batchUploading ? (
                  <>
                    <RotateCw size={13} className="spin-icon" />
                    <span>Uploading {batchProgress?.current || 1}/4: {batchProgress?.docName || "..."}</span>
                  </>
                ) : (
                  <>
                    <FileUp size={13} />
                    <span>Upload All 4 Documents</span>
                  </>
                )}
              </button>

              <label
                style={{
                  background: "#ffffff",
                  color: "#334155",
                  border: "1px solid #cbd5e1",
                  borderRadius: "7px",
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: batchUploading || !!uploadingDoc ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <Upload size={12} style={{ color: "#64748b" }} />
                <span>Choose 4 Local Files</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv,.doc,.docx"
                  style={{ display: "none" }}
                  disabled={batchUploading || !!uploadingDoc}
                  onChange={(e) => {
                    const filesArr = Array.from(e.target.files || []);
                    if (filesArr.length > 0) handleUploadAllFourDocs(filesArr);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>

            <div style={{ fontSize: "11px", color: "#64748b" }}>
              Sample Docs:{" "}
              <a href="/sample_trade_documents/Commercial_Invoice_INV2026.pdf" download style={{ color: "#0284c7", fontWeight: 600, textDecoration: "underline" }}>Invoice</a> &bull;{" "}
              <a href="/sample_trade_documents/Packing_List_PL9921.pdf" download style={{ color: "#0284c7", fontWeight: 600, textDecoration: "underline" }}>Packing</a> &bull;{" "}
              <a href="/sample_trade_documents/Bill_of_Lading_Draft_BL4810.pdf" download style={{ color: "#0284c7", fontWeight: 600, textDecoration: "underline" }}>B/L</a> &bull;{" "}
              <a href="/sample_trade_documents/Certificate_of_Origin_COO2026.pdf" download style={{ color: "#0284c7", fontWeight: 600, textDecoration: "underline" }}>Origin</a>
            </div>
          </div>

          {/* Sequential Progress Banner */}
          {batchUploading && batchProgress && (
            <div
              style={{
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: "8px",
                padding: "10px 14px",
                marginBottom: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "7px", color: "#1e40af", fontWeight: 700, fontSize: "12px" }}>
                  <RotateCw size={14} className="spin-icon" style={{ color: "#2563eb" }} />
                  <span>Uploading {batchProgress.current} of {batchProgress.total}: <strong>{batchProgress.docName}</strong></span>
                </div>
                <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#2563eb" }}>
                  {Math.round((batchProgress.current / batchProgress.total) * 100)}%
                </span>
              </div>
              <div style={{ width: "100%", height: "5px", background: "#dbeafe", borderRadius: "999px", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${(batchProgress.current / batchProgress.total) * 100}%`,
                    height: "100%",
                    background: "#2563eb",
                    borderRadius: "999px",
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>
          )}

          {/* 4 Trade Document Status Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
            {FOUR_TRADE_DOCS.map((docItem) => {
              const info = modalDocs[docItem.name] || { status: "PENDING" };
              const isUploaded = info.status === "UPLOADED";
              const isCurrentUploading = uploadingDoc === docItem.name || info.status === "UPLOADING";

              return (
                <div
                  key={docItem.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 12px",
                    background: isUploaded ? "#f0fdf4" : isCurrentUploading ? "#eff6ff" : "#f8fafc",
                    border: `1px solid ${isUploaded ? "#86efac" : isCurrentUploading ? "#93c5fd" : "#e2e8f0"}`,
                    borderRadius: "8px",
                    gap: "10px",
                    transition: "all 0.3s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "9px", minWidth: 0 }}>
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "6px",
                        background: isUploaded ? "#dcfce7" : isCurrentUploading ? "#dbeafe" : "#f1f5f9",
                        color: isUploaded ? "#16a34a" : isCurrentUploading ? "#2563eb" : "#64748b",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {isCurrentUploading ? (
                        <RotateCw size={14} className="spin-icon" />
                      ) : isUploaded ? (
                        <CheckCircle2 size={15} />
                      ) : (
                        <Clock size={15} />
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#0f172a" }}>
                        {docItem.name}
                      </div>
                      <div style={{ fontSize: "11px", color: isUploaded ? "#16a34a" : isCurrentUploading ? "#2563eb" : "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {isCurrentUploading
                          ? "Uploading file to shipment..."
                          : isUploaded
                          ? info.fileName ? `${info.fileName} (${info.fileSize ? Math.round(info.fileSize / 1024) + " KB" : "Ready"})` : "Uploaded successfully"
                          : "Required trade document"}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                    {isCurrentUploading ? (
                      <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#1d4ed8", background: "#dbeafe", padding: "3px 8px", borderRadius: "5px", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                        <RotateCw size={10} className="spin-icon" /> UPLOADING...
                      </span>
                    ) : isUploaded ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#15803d", background: "#dcfce7", padding: "3px 8px", borderRadius: "5px", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                          <Check size={11} /> UPLOADED
                        </span>
                        <label
                          style={{
                            fontSize: "10.5px",
                            fontWeight: 600,
                            color: "#475569",
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            padding: "3px 7px",
                            borderRadius: "5px",
                            cursor: batchUploading ? "not-allowed" : "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                          }}
                        >
                          <Upload size={10} /> Replace
                          <input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv,.doc,.docx"
                            style={{ display: "none" }}
                            disabled={batchUploading || !!uploadingDoc}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadSingleModalDoc(docItem, file);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                    ) : (
                      <label
                        style={{
                          fontSize: "10.5px",
                          fontWeight: 700,
                          color: "#ffffff",
                          background: "#f97316",
                          border: "none",
                          padding: "4px 10px",
                          borderRadius: "5px",
                          cursor: batchUploading ? "not-allowed" : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <Upload size={11} /> Upload
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv,.doc,.docx"
                          style={{ display: "none" }}
                          disabled={batchUploading || !!uploadingDoc}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadSingleModalDoc(docItem, file);
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

          <label className="csel-field">
            Your response
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Commercial invoice, packing list, bill of lading, and certificate of origin attached."
            />
          </label>

          <div className="csel-modal-actions">
            <button type="button" className="csel-secondary" onClick={closeInfo} disabled={batchUploading}>
              Cancel
            </button>
            <button
              type="button"
              className="csel-primary"
              disabled={Boolean(busy) || batchUploading}
              onClick={sendInformation}
            >
              Send to {infoFor.companyName}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Progress({ status }) {
  // Off-path states get their own note rather than a misleading position on
  // the happy path.
  const offPath = ["REJECTED", "CUSTOMS_REJECTED", "BOOKING_CANCELLED", "RESELECT_QUOTE"].includes(
    status,
  );
  if (offPath) return null;

  const order = STAGES.map((s) => s.key);
  let reached = order.indexOf(status);
  if (status === "REVISION_PENDING_CUSTOMER" || status === "AWAITING_CUSTOMER_INFO") {
    reached = order.indexOf("UNDER_VERIFICATION");
  }
  if (status === "REVISION_ACCEPTED" || status === "ESCALATED") {
    reached = order.indexOf("UNDER_VERIFICATION");
  }
  if (status === "PENDING_CUSTOMS_REVIEW") {
    reached = order.indexOf("APPROVED");
  }

  return (
    <ol className="csel-progress">
      {STAGES.map((stage, i) => (
        <li
          key={stage.key}
          className={i <= reached ? "done" : ""}
        >
          <span className="csel-dot">{i <= reached ? <CheckCircle2 size={12} /> : i + 1}</span>
          {stage.label}
        </li>
      ))}
    </ol>
  );
}

function Term({ label, value, tone }) {
  return (
    <div className={`csel-term ${tone || ""}`}>
      <span className="csel-term-label">{label}</span>
      <span className="csel-term-value">{value}</span>
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="csel-backdrop" onClick={onClose}>
      <div className="csel-modal" onClick={(e) => e.stopPropagation()}>
        <div className="csel-modal-head">
          <h2>
            <Ship size={18} /> {title}
          </h2>
          <button type="button" className="csel-close" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="csel-modal-body">{children}</div>
      </div>
    </div>
  );
}
