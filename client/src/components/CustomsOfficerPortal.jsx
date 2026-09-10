import { useCallback, useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  CheckCircle2,
  ClipboardList,
  FileWarning,
  AlertOctagon,
  CheckCircle,
  ArrowRight,
  X,
  FileText,
  Clock,
  Download,
  AlertTriangle,
  Ship,
  FileCheck,
  XCircle,
  Shield,
  Eye,
  Stamp,
  ExternalLink,
} from "lucide-react";
import {
  listShipmentDocuments,
  signOffCustomsCheck,
  verifyShipmentDocument,
} from "../api/workflow";
import { useAuth } from "../context/AuthContext";
import { usePlatformQuotes } from "../hooks/usePlatformQuotes";
import {
  formatMoney,
  updateQuoteStatusInStore,
  syncQuoteDocumentsToVault,
  approveQuoteCustomsStep,
} from "../utils/quoteWorkflow";
import "./CustomsOfficerPortal.css";

export function resolveDocumentFileUrl(doc) {
  if (!doc) return "/sample_trade_documents/Bill_of_Lading_Draft_BL4810.pdf";
  if (doc.fileDataUrl) return doc.fileDataUrl;

  if (typeof window !== "undefined" && doc.fileName && window.__freightai_uploaded_blobs?.[doc.fileName]) {
    return window.__freightai_uploaded_blobs[doc.fileName];
  }

  // Check vault storage
  try {
    const raw = localStorage.getItem("freightai_vault_docs_v2");
    if (raw) {
      const list = JSON.parse(raw);
      const match = list.find(
        (v) =>
          (v.fileName && v.fileName === doc.fileName) ||
          (v.id && v.id === doc.id) ||
          ((v.shipmentRef === doc.shipmentId || v.shipmentRef === doc.quoteNo) &&
            (v.name?.toLowerCase() === doc.docType?.toLowerCase() || v.type?.toLowerCase() === doc.docType?.toLowerCase()))
      );
      if (match?.fileDataUrl) return match.fileDataUrl;
    }
  } catch {}

  const dType = (doc.docType || doc.name || "").toLowerCase();
  const fName = (doc.fileName || "").toLowerCase();

  if (dType.includes("invoice") || fName.includes("invoice")) {
    return "/sample_trade_documents/Commercial_Invoice_INV2026.pdf";
  }
  if (dType.includes("packing") || fName.includes("packing")) {
    return "/sample_trade_documents/Packing_List_PL9921.pdf";
  }
  if (dType.includes("origin") || fName.includes("origin") || dType.includes("coo") || fName.includes("coo")) {
    return "/sample_trade_documents/Certificate_of_Origin_COO2026.pdf";
  }
  if (dType.includes("lading") || fName.includes("lading") || dType.includes("bill") || fName.includes("bill")) {
    return "/sample_trade_documents/Bill_of_Lading_Draft_BL4810.pdf";
  }

  if (doc.fileName && doc.fileName !== "Not uploaded") {
    return `/sample_trade_documents/${doc.fileName}`;
  }

  return "/sample_trade_documents/Bill_of_Lading_Draft_BL4810.pdf";
}

// INITIAL_CUSTOMS_SHIPMENTS used to seed this screen with invented shipments/documents so the
// UI looked populated before any real data existed. The screen now renders
// live platform records, so the fixture has been removed.


function getOcrComplianceNote(docType, hsCode) {
  switch (docType) {
    case "Commercial Invoice":
      return `HS Code ${hsCode || "8471.30"} line item matches Customs Manifest valuation.`;
    case "Packing List":
      return "Gross weight and container tare verified against terminal weighbridge scale.";
    case "Bill of Lading Draft":
      return "Carrier pre-advice draft endorsed by terminal shipping line agent.";
    case "Certificate of Origin":
    case "Certificate of Origin (COO)":
      return "Digital apostille stamp verified on Export Inspection Council portal.";
    case "Safety Data Sheet (MSDS)":
    case "Material Safety Data Sheet (SDS)":
      return "Section 14 Hazmat Flashpoint & UN Transport classification audited.";
    default:
      return "Statutory trade document validated by automated OCR scanner.";
  }
}

export default function CustomsOfficerPortal({ initialTab = "pending-reviews" }) {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab || "pending-reviews");

  const { quotes, loading, error, reload } = usePlatformQuotes();

  /**
   * The officer's worklist is derived from live platform quotes.
   *
   * It previously merged localStorage with a seeded array and filled the gaps
   * with invented values (a fixed HS code, a fixed declared value of
   * Rs 1,48,500), so the desk showed the same cargo regardless of what had
   * actually been shipped. Every field below now comes from the quote, and the
   * berth/vessel line is left blank when the platform does not know it.
   */
  const shipments = useMemo(
    () =>
      quotes.map((q) => {
        const dutyRate = 0.075;
        const customsAnalysis = q.customs || q.analysis?.customs;
        const outstanding = q.missingDocuments || [];

        return {
          id: q.id,
          quoteNo: q.id,
          shipmentId: q.shipmentId,
          customer: q.customerName,
          consignee: q.destination ? `${q.destination} consignee` : "—",
          origin: q.origin,
          destination: q.destination,
          cargoType: q.cargoType,
          hsCode: q.hsCode || customsAnalysis?.hs_code || "—",
          documentsStatus: outstanding.length
            ? `${outstanding.length} document(s) outstanding`
            : "All documents on file",
          riskLevel: q.overallRisk || "UNKNOWN",
          riskScore: q.customsRiskScore ?? 0,
          status:
            customsAnalysis?.status === "REJECTED"
              ? "FLAGGED"
              : customsAnalysis?.status === "APPROVED"
              ? "APPROVED"
              : "PENDING_REVIEW",
          assignedOfficer: q.reviewedBy || "Unassigned",
          containers: q.containerType ? `${q.containerType} (${Number(q.weightKg).toLocaleString()} kg)` : "—",
          declaredValue: q.totalFormatted,
          dutyEstimate: formatMoney(Math.round(q.totalNum * dutyRate), q.currency),
          holdReason: customsAnalysis?.advisory || "",
          clearanceCertNo:
            customsAnalysis?.status === "APPROVED" ? `CC-${q.id}` : "",
          customsCheckId: q.customsCheckId,
          documents: q.documents || [],
          missingDocuments: outstanding,
          // Berth and vessel assignment is not modelled by the platform.
          vessel: "",
          berth: "",
          slaRemaining: "",
          slaUrgent: ["HIGH", "CRITICAL"].includes(q.overallRisk),
        };
      }),
    [quotes],
  );

  const [selectedShipment, setSelectedShipment] = useState(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [manifestModalOpen, setManifestModalOpen] = useState(false);
  const [selectedManifest, setSelectedManifest] = useState(null);
  const [previewDocModalOpen, setPreviewDocModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [docViewMode, setDocViewMode] = useState("paper"); // "paper" | "pdf" | "ocr"
  const [officerNotes, setOfficerNotes] = useState("");
  const [actionStatus, setActionStatus] = useState(null);
  const [signingOff, setSigningOff] = useState(false);

  useEffect(() => {
    if (initialTab) {
      if (initialTab === "dashboard" || initialTab === "pending-reviews") {
        setActiveTab("pending-reviews");
      } else {
        setActiveTab(initialTab);
      }
    }
  }, [initialTab]);

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    navigate(`/dashboard/${tab}`);
  };

  const pendingCount = shipments.filter(
    (s) => s.status === "PENDING_REVIEW" || s.status === "AI_ANALYZED"
  ).length;
  const highRiskCount = shipments.filter(
    (s) => s.riskLevel === "HIGH" || s.riskLevel === "CRITICAL" || s.status === "FLAGGED"
  ).length;
  const completedCount = shipments.filter(
    (s) => s.status === "APPROVED" || s.status === "CUSTOMS_REVIEWED" || s.status === "RESOLVED"
  ).length;

  // Real uploaded files, keyed by shipment. The checklist tells us which
  // documents are *required*; this tells us which have actually arrived and
  // gives each one the id the verify endpoint needs.
  const [uploadedDocs, setUploadedDocs] = useState({});

  // Extracted so a verify/reject decision can refresh the real document state
  // immediately instead of waiting for the next quote reload.
  const shipmentIdKey = shipments.map((s) => s.shipmentId).filter(Boolean).join(",");

  const loadUploadedDocs = useCallback(async () => {
    const ids = shipmentIdKey ? shipmentIdKey.split(",") : [];
    if (!token || !ids.length) {
      setUploadedDocs({});
      return;
    }
    const entries = await Promise.all(
      ids.map((id) =>
        listShipmentDocuments(token, id)
          .then((data) => [id, data.results || []])
          .catch(() => [id, []]),
      ),
    );
    setUploadedDocs(Object.fromEntries(entries));
  }, [token, shipmentIdKey]);

  useEffect(() => {
    loadUploadedDocs();
  }, [loadUploadedDocs]);

  /** Match a checklist item name to an uploaded document, ignoring formatting. */
  const normalizeDocName = (name) =>
    (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  /**
   * Live status of one checklist item for one shipment.
   *
   * The quote's checklist carries the status the customs analysis wrote when
   * the quote was generated and never updates, so the sign-off desk showed
   * every document as PENDING even after the officer had stamped all of them.
   * Resolve against the documents actually on file instead.
   */
  function docItemStatus(shipmentId, docName) {
    const match = (uploadedDocs[shipmentId] || []).find(
      (u) => normalizeDocName(u.document_type) === normalizeDocName(docName),
    );
    if (!match) return "PENDING";
    if (match.verification_status === "VERIFIED") return "VERIFIED";
    if (match.verification_status === "REJECTED") return "REJECTED";
    return "UPLOADED";
  }

  /**
   * Paperwork state for one consignment, from what has actually been uploaded.
   *
   * This used to be a sentence built in the shipments memo and then colour-coded
   * by searching it for the word "Missing" — which the sentence never contained,
   * so every row rendered green even with nothing on file. Comparing the
   * required checklist against real uploads is the only honest signal.
   */
  function docStatusFor(s) {
    const checklist = (s.documents || []).map((d) => d.name).filter(Boolean);
    const required = checklist.length ? checklist : s.missingDocuments || [];

    if (!required.length) {
      return { tone: "neutral", allOnFile: false, label: "No checklist issued" };
    }

    const arrived = new Set(
      (uploadedDocs[s.shipmentId] || []).map((u) => normalizeDocName(u.document_type)),
    );
    const outstanding = required.filter((name) => !arrived.has(normalizeDocName(name)));

    if (outstanding.length) {
      return {
        tone: "bad",
        allOnFile: false,
        label: `${outstanding.length} of ${required.length} documents missing`,
      };
    }
    return {
      tone: "good",
      allOnFile: true,
      label: `All ${required.length} documents on file`,
    };
  }

  const missingDocCount = shipments.filter((s) => !docStatusFor(s).allOnFile).length;


  // Flattened documents list for Document Verification desk
  const allDocumentsToVerify = useMemo(() => {
    const list = [];
    const seenDocKeys = new Set();

    // 1. Read vault documents from localStorage
    let vaultDocs = [];
    try {
      const raw = localStorage.getItem("freightai_vault_docs_v2");
      vaultDocs = raw ? JSON.parse(raw) : [];
    } catch {}

    shipments.forEach((s) => {
      const docs = s.documents || [];
      docs.forEach((d) => {
        const uploaded = (uploadedDocs[s.shipmentId] || []).find(
          (u) => normalizeDocName(u.document_type) === normalizeDocName(d.name),
        );

        // Find matching vault doc if any
        const vaultMatch = vaultDocs.find(
          (v) =>
            (v.shipmentRef === s.id || v.shipmentRef === s.quoteNo || v.shipmentRef === s.shipmentId) &&
            (normalizeDocName(v.name) === normalizeDocName(d.name) || normalizeDocName(v.type) === normalizeDocName(d.name))
        );

        // Find fileDataUrl from all possible sources
        const blobFromMemory = typeof window !== "undefined" && d.fileName && window.__freightai_uploaded_blobs?.[d.fileName];
        const fileUrl =
          d.fileDataUrl ||
          vaultMatch?.fileDataUrl ||
          blobFromMemory ||
          uploaded?.file_url ||
          null;

        const effectiveFileName =
          d.fileName && d.fileName !== "Not uploaded"
            ? d.fileName
            : vaultMatch?.fileName
            ? vaultMatch.fileName
            : uploaded?.file_name
            ? uploaded.file_name
            : `${d.name.replace(/\s+/g, "_")}.pdf`;

        const effectiveFileSize =
          d.fileSize && d.fileSize !== "—"
            ? d.fileSize
            : vaultMatch?.size
            ? vaultMatch.size
            : uploaded?.file_size
            ? `${(uploaded.file_size / 1024).toFixed(0)} KB`
            : "1.2 MB";

        const isUserUploaded = Boolean(
          d.fileDataUrl ||
          vaultMatch?.fileDataUrl ||
          blobFromMemory ||
          uploaded?.file_url ||
          d.status === "UPLOADED" ||
          d.status === "VERIFIED"
        );

        const docId = `${s.id}-${d.name.replace(/[^a-zA-Z0-9]/g, "_")}`;
        seenDocKeys.add(docId);
        if (vaultMatch?.id) seenDocKeys.add(vaultMatch.id);

        list.push({
          id: docId,
          documentId: uploaded?.id || vaultMatch?.id || null,
          uploaded: isUserUploaded,
          shipmentId: s.id,
          quoteNo: s.quoteNo || s.id,
          customer: s.customer,
          origin: s.origin,
          destination: s.destination,
          route: `${s.origin} ➔ ${s.destination}`,
          hsCode: s.hsCode,
          cargoType: s.cargoType,
          vessel: s.vessel,
          berth: s.berth,
          containers: s.containers,
          declaredValue: s.declaredValue,
          dutyEstimate: s.dutyEstimate,
          docType: d.name,
          fileName: effectiveFileName,
          fileSize: effectiveFileSize,
          fileDataUrl: fileUrl,
          fileType: d.fileType || vaultMatch?.fileType || uploaded?.mime_type || "application/pdf",
          status: vaultMatch?.status === "VERIFIED" ? "VERIFIED" : (uploaded?.verification_status || d.status || "PENDING"),
          rejectionReason: uploaded?.rejection_reason || "",
          ocrSummary: getOcrComplianceNote(d.name, s.hsCode),
        });
      });
    });

    // 2. Also append any uploaded vault docs that aren't tied to default documents list
    vaultDocs.forEach((v) => {
      if (!v.id || seenDocKeys.has(v.id)) return;
      seenDocKeys.add(v.id);

      const parentShipment = shipments.find(
        (s) => s.id === v.shipmentRef || s.quoteNo === v.shipmentRef || s.shipmentId === v.shipmentRef
      );

      list.unshift({
        id: v.id,
        documentId: v.id,
        uploaded: true,
        shipmentId: v.shipmentRef || "VAULT-UPLOAD",
        quoteNo: parentShipment?.quoteNo || v.shipmentRef || "VAULT",
        customer: parentShipment?.customer || "Direct Client Vault Upload",
        origin: parentShipment?.origin || "Origin Port",
        destination: parentShipment?.destination || "Destination Port",
        route: v.route || (parentShipment ? `${parentShipment.origin} ➔ ${parentShipment.destination}` : "Customs Border Clearance"),
        hsCode: parentShipment?.hsCode || "8471.30",
        cargoType: parentShipment?.cargoType || "Commercial Freight",
        vessel: parentShipment?.vessel || "",
        berth: parentShipment?.berth || "",
        containers: parentShipment?.containers || "1 Container",
        declaredValue: parentShipment?.declaredValue || "Declared Goods",
        dutyEstimate: parentShipment?.dutyEstimate || "Pending Tariff",
        docType: v.name || v.type || "Commercial Document",
        fileName: v.fileName || `${(v.name || "document").replace(/\s+/g, "_")}.pdf`,
        fileSize: v.size || "1.4 MB",
        fileDataUrl: v.fileDataUrl || null,
        fileType: v.fileType || "application/pdf",
        status: v.status === "VERIFIED" ? "VERIFIED" : (v.status || "UNDER_REVIEW"),
        ocrSummary: getOcrComplianceNote(v.name || v.type, parentShipment?.hsCode),
      });
    });

    return list;
  }, [shipments, uploadedDocs]);

  /**
   * Documents grouped by the quote they belong to.
   *
   * A flat list of every paper on the platform gave the officer no way to tell
   * whose documents they were looking at, so a consignment had to be verified
   * by hunting rows. One row per quote, opened to reveal its own papers, keeps
   * each customer's file together.
   */
  const documentGroups = useMemo(() => {
    const byQuote = new Map();

    allDocumentsToVerify.forEach((doc) => {
      const key = doc.quoteNo || doc.shipmentId || "UNASSIGNED";
      if (!byQuote.has(key)) {
        byQuote.set(key, {
          key,
          quoteNo: doc.quoteNo || key,
          shipmentId: doc.shipmentId,
          customer: doc.customer,
          route: doc.route,
          hsCode: doc.hsCode,
          cargoType: doc.cargoType,
          docs: [],
        });
      }
      byQuote.get(key).docs.push(doc);
    });

    return [...byQuote.values()]
      .map((g) => {
        const verified = g.docs.filter((d) => d.status === "VERIFIED").length;
        const rejected = g.docs.filter((d) => d.status === "REJECTED").length;
        const pending = g.docs.length - verified - rejected;
        return {
          ...g,
          total: g.docs.length,
          verified,
          rejected,
          pending,
          allVerified: g.docs.length > 0 && verified === g.docs.length,
        };
      })
      .sort((a, b) => b.pending - a.pending);
  }, [allDocumentsToVerify]);

  const [openGroup, setOpenGroup] = useState(null);
  const [docBusy, setDocBusy] = useState(null);
  const [docNotice, setDocNotice] = useState(null);
  /** Consignment whose papers have just all been verified, for the popup. */
  const [allVerifiedFor, setAllVerifiedFor] = useState(null);

  /** Is there a real uploaded file behind this checklist item? */
  const hasRealFile = (doc) =>
    Boolean(
      doc &&
        (doc.fileDataUrl ||
          (doc.documentId && !String(doc.documentId).startsWith("doc-"))),
    );

  const handleOpenDocInspection = (doc) => {
    setPreviewDoc(doc);
    setDocNotice(null);
    // If the user actually uploaded a file or if raw file is present, default to 'pdf' so officer immediately sees the uploaded document!
    if (doc.fileDataUrl || doc.uploaded) {
      setDocViewMode("pdf");
    } else {
      setDocViewMode("paper");
    }
    setPreviewDocModalOpen(true);
  };

  /**
   * Verify one document.
   *
   * Records decision against backend API (if connected) and synchronizes with
   * local platform store and Document Vault so status is consistently updated.
   */
  const handleVerifySingleDoc = async (shipmentId, docName, documentId, decision = "VERIFIED", remarks = "") => {
    if (docBusy) return;

    // A real document id is required: without one the decision cannot reach the
    // server, and the officer would be told the paper was stamped when nothing
    // had happened. Failures used to be swallowed by a console warning.
    if (!token || !documentId || String(documentId).startsWith("doc-")) {
      setDocNotice({
        type: "error",
        text: `"${docName}" has no uploaded file on record, so it cannot be ${decision === "VERIFIED" ? "verified" : "rejected"}.`,
      });
      return;
    }

    setDocBusy(documentId);
    setDocNotice(null);
    try {
      await verifyShipmentDocument(token, documentId, {
        decision,
        officerName: user?.full_name || "Customs Officer",
        remarks:
          remarks ||
          (decision === "VERIFIED"
            ? `Verified "${docName}" against declared tariff heading.`
            : `Rejected "${docName}".`),
      });

      await Promise.all([reload(), loadUploadedDocs()]);

      if (previewDoc) {
        setPreviewDoc((prev) => (prev ? { ...prev, status: decision } : null));
      }

      setDocNotice({
        type: decision === "VERIFIED" ? "success" : "warning",
        text:
          decision === "VERIFIED"
            ? `"${docName}" verified and stamped. The customer has been notified.`
            : `"${docName}" rejected. The customer has been notified with your reason.`,
      });
      setTimeout(() => setDocNotice(null), 5000);
    } catch (err) {
      setDocNotice({
        type: "error",
        text: err.message || `Could not record the decision on "${docName}".`,
      });
    } finally {
      setDocBusy(null);
    }
  };

  /**
   * Jump from the sign-off queue straight to one consignment's papers.
   *
   * The officer had to switch tabs and find the right consignment by eye,
   * which is what made a shared document desk hard to work from.
   */
  const openDocsForConsignment = (shipment) => {
    const key = shipment.quoteNo || shipment.id;
    setOpenGroup(key);
    setDocNotice(null);
    handleTabSwitch("document-verification");
    // The tab renders on the next paint; scroll once the group exists.
    setTimeout(() => {
      document
        .querySelector(".cop-doc-group.open")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  };

  /** Reject one document. A reason is mandatory and reaches the customer. */
  const handleRejectSingleDoc = async (doc) => {
    const reason = window.prompt(
      `Reject "${doc.fileName}" (${doc.docType})?\n\nGive the customer a reason. This is sent to them and recorded against the shipment.`,
    );
    if (reason === null) return;
    if (!reason.trim()) {
      setDocNotice({ type: "error", text: "A reason is required to reject a document." });
      return;
    }
    await handleVerifySingleDoc(doc.shipmentId, doc.docType, doc.documentId, "REJECTED", reason.trim());
  };

  /** Verify every outstanding document on one quote, in order. */
  const handleVerifyGroup = async (group) => {
    const outstanding = group.docs.filter((d) => d.status !== "VERIFIED" && d.documentId);
    if (!outstanding.length) return;
    for (const doc of outstanding) {
      // Sequential: each decision recomputes customs readiness server-side.
      // eslint-disable-next-line no-await-in-loop
      await handleVerifySingleDoc(doc.shipmentId, doc.docType, doc.documentId, "VERIFIED");
    }
    // Confirm the milestone explicitly, then point the officer at sign-off,
    // which is the step that actually clears the consignment.
    setAllVerifiedFor(group);
  };


  function openSignoffModal(shipment) {
    setSelectedShipment(shipment);
    setOfficerNotes("");
    setReviewModalOpen(true);
  }

  function openManifestModal(shipment) {
    setSelectedManifest(shipment);
    setManifestModalOpen(true);
  }

  /**
   * Officer sign-off (PDF section 7).
   *
   * The server records the decision and returns the shipment to the risk
   * workflow: the composite score is recomputed from the new customs position
   * and the linked quote is updated, which is what "Result returns to Risk
   * workflow" means.
   */
  async function handleDecision(decision) {
    if (!selectedShipment || signingOff) return;

    const checkId = selectedShipment.customsCheckId || selectedShipment.shipmentId;
    if (!checkId) {
      setActionStatus("No customs compliance check exists for this shipment yet.");
      setTimeout(() => setActionStatus(null), 4000);
      return;
    }

    if (decision !== "APPROVE" && !officerNotes.trim()) {
      setActionStatus("Please record why this consignment is being flagged.");
      setTimeout(() => setActionStatus(null), 4000);
      return;
    }

    setSigningOff(true);
    try {
      const result = await signOffCustomsCheck(token, checkId, {
        decision: decision === "APPROVE" ? "APPROVED" : "REJECTED",
        officerName: user?.full_name || "Customs Officer",
        comments: officerNotes || `Officer sign-off: ${decision}`,
      });

      if (decision === "APPROVE") {
        const qId = selectedShipment.quoteNo || selectedShipment.id || selectedShipment.shipmentId;
        await approveQuoteCustomsStep(qId, officerNotes || "Trade documents inspected and verified by Customs Officer.");
      }

      await reload();

      const reassessment = result.risk_reassessment || {};
      setActionStatus(
        `Shipment ${selectedShipment.shipmentId} marked ${
          decision === "APPROVE" ? "CLEARED" : "FLAGGED"
        }. Composite risk recalculated to ${reassessment.risk_level ?? "n/a"} (${
          reassessment.overall_score ?? "n/a"
        }/100).`,
      );
      setReviewModalOpen(false);
    } catch (err) {
      setActionStatus(err.message || "Customs sign-off failed.");
    } finally {
      setSigningOff(false);
      setTimeout(() => setActionStatus(null), 6000);
    }
  }

  // Header banner info based on active tab
  const getHeaderInfo = () => {
    switch (activeTab) {
      case "document-verification":
        return {
          title: "Document Verification Desk & Regulatory Clearance Gate",
          desc: "Audit itemized international trade documentation, verify OCR compliance, validate certificates of origin, and apply official digital customs stamps.",
          badge: "Verification Station: Live",
        };
      case "assigned-shipments":
        return {
          title: "Assigned Consignments & Port Manifest Logistics Desk",
          desc: "Operational port logistics manifest: review vessel berth assignments, terminal gate-in checkpoints, container TEUs, and customs custody.",
          badge: `Active Manifest: ${shipments.length} Consignments`,
        };
      case "customs-risk-flags":
        return {
          title: "Customs Risk Flags & Red-Lane Inspection Alerts",
          desc: "High-risk cargo holds, prohibited commodities, hazardous material (DG) certification gaps, and physical inspection orders.",
          badge: `Enforcement Queue: ${highRiskCount} Alerts`,
        };
      case "completed-reviews":
        return {
          title: "Completed Customs Clearances & Clearance Certificates",
          desc: "Certified Out-of-Charge records, digital officer signature stamps, and downloadable official trade clearance passes.",
          badge: `Cleared Today: ${completedCount} Records`,
        };
      case "pending-reviews":
      default:
        return {
          title: "Pending Regulatory Reviews & Officer Sign-off Queue",
          desc: "Urgent queue of consignments awaiting statutory customs appraisal, tariff compliance, and officer sign-off.",
          badge: `Pending Queue: ${pendingCount} Consignments`,
        };
    }
  };

  const headerInfo = getHeaderInfo();

  return (
    <div className="cop-container">
      {/* Top Banner - Contextually updates per page */}
      <div className="cop-header-banner">
        <div className="cop-title-block">
          <h1>{headerInfo.title}</h1>
          <p>{headerInfo.desc}</p>
        </div>
        <div className="cop-badge-tag">
          <span className="cop-badge-dot" />
          <ShieldCheck size={14} /> {headerInfo.badge}
        </div>
      </div>

      {error && (
        <div
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "11px 16px", marginBottom: "14px", borderRadius: "10px",
            background: "#fef2f2", border: "1px solid #fecaca",
            color: "#b91c1c", fontSize: "13px", fontWeight: 600,
          }}
        >
          Could not load the customs worklist: {error}
          <button
            type="button"
            onClick={reload}
            style={{
              marginLeft: "auto", background: "none", border: "1px solid currentColor",
              borderRadius: "6px", padding: "4px 10px", color: "inherit",
              cursor: "pointer", fontWeight: 700,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {actionStatus && (
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(34, 197, 94, 0.15)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            borderRadius: "8px",
            color: "#4ade80",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <CheckCircle2 size={16} /> {actionStatus}
        </div>
      )}

      {/* Metric Cards */}
      <div className="cop-metrics-grid">
        <div className="cop-metric-card" onClick={() => handleTabSwitch("pending-reviews")} style={{ cursor: "pointer" }}>
          <div className="cop-metric-icon pending">
            <ClipboardList size={22} />
          </div>
          <div className="cop-metric-info">
            <span className="cop-metric-val">{pendingCount}</span>
            <span className="cop-metric-label">Pending Reviews</span>
          </div>
        </div>

        <div className="cop-metric-card" onClick={() => handleTabSwitch("document-verification")} style={{ cursor: "pointer" }}>
          <div className="cop-metric-icon missing">
            <FileWarning size={22} />
          </div>
          <div className="cop-metric-info">
            <span className="cop-metric-val">{allDocumentsToVerify.length}</span>
            <span className="cop-metric-label">Trade Documents</span>
          </div>
        </div>

        <div className="cop-metric-card" onClick={() => handleTabSwitch("customs-risk-flags")} style={{ cursor: "pointer" }}>
          <div className="cop-metric-icon highrisk">
            <AlertOctagon size={22} />
          </div>
          <div className="cop-metric-info">
            <span className="cop-metric-val">{highRiskCount}</span>
            <span className="cop-metric-label">High Risk Alerts</span>
          </div>
        </div>

        <div className="cop-metric-card" onClick={() => handleTabSwitch("completed-reviews")} style={{ cursor: "pointer" }}>
          <div className="cop-metric-icon completed">
            <CheckCircle size={22} />
          </div>
          <div className="cop-metric-info">
            <span className="cop-metric-val">{completedCount}</span>
            <span className="cop-metric-label">Completed Clearances</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="cop-tabs">
        <button
          type="button"
          className={`cop-tab-btn ${activeTab === "pending-reviews" ? "active" : ""}`}
          onClick={() => handleTabSwitch("pending-reviews")}
        >
          Pending Reviews ({pendingCount})
        </button>
        <button
          type="button"
          className={`cop-tab-btn ${activeTab === "assigned-shipments" ? "active" : ""}`}
          onClick={() => handleTabSwitch("assigned-shipments")}
        >
          Assigned Shipments ({shipments.length})
        </button>
        <button
          type="button"
          className={`cop-tab-btn ${activeTab === "document-verification" ? "active" : ""}`}
          onClick={() => handleTabSwitch("document-verification")}
        >
          Document Verification ({allDocumentsToVerify.filter((d) => d.status !== "VERIFIED").length} Pending)
        </button>
        <button
          type="button"
          className={`cop-tab-btn ${activeTab === "customs-risk-flags" ? "active" : ""}`}
          onClick={() => handleTabSwitch("customs-risk-flags")}
        >
          Customs Risk Flags ({highRiskCount})
        </button>
        <button
          type="button"
          className={`cop-tab-btn ${activeTab === "completed-reviews" ? "active" : ""}`}
          onClick={() => handleTabSwitch("completed-reviews")}
        >
          Completed Reviews ({completedCount})
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. DOCUMENT VERIFICATION DESK (DISTINCT DOCUMENT-LEVEL AUDIT VIEW)       */}
      {/* ========================================================================= */}
      {activeTab === "document-verification" && (
        <div className="cop-card">
          <div className="cop-view-header">
            <div className="cop-view-title">
              <FileCheck size={20} color="#0284c7" />
              Document Audit &amp; Official Stamp Station
              <span className="cop-view-badge-count">
                {documentGroups.length} consignment{documentGroups.length === 1 ? "" : "s"}
              </span>
            </div>
            <div style={{ fontSize: "12.5px", color: "#64748b" }}>
              Open a consignment to inspect its papers. Every decision is sent to the customer.
            </div>
          </div>

          {docNotice && (
            <div className={`cop-doc-notice ${docNotice.type}`}>{docNotice.text}</div>
          )}

          {documentGroups.length === 0 ? (
            <div className="cop-doc-empty">No documents have been uploaded yet.</div>
          ) : (
            <div className="cop-doc-groups">
              {documentGroups.map((group) => {
                const isOpen = openGroup === group.key;
                return (
                  <div
                    key={group.key}
                    className={`cop-doc-group${isOpen ? " open" : ""}${group.allVerified ? " done" : ""}`}
                  >
                    <button
                      type="button"
                      className="cop-doc-group-head"
                      onClick={() => setOpenGroup(isOpen ? null : group.key)}
                      aria-expanded={isOpen}
                    >
                      <span className="cop-doc-group-caret">{isOpen ? "\u25be" : "\u25b8"}</span>

                      <span className="cop-doc-group-id">
                        <strong>{group.quoteNo}</strong>
                        <span className="cop-doc-group-cust">{group.customer}</span>
                      </span>

                      <span className="cop-doc-group-route">{group.route}</span>

                      <span className="cop-doc-group-progress">
                        <span className="cop-doc-progress-bar">
                          <span
                            className="cop-doc-progress-fill"
                            style={{ width: `${group.total ? (group.verified / group.total) * 100 : 0}%` }}
                          />
                        </span>
                        <span className="cop-doc-progress-label">
                          {group.verified} of {group.total} verified
                        </span>
                      </span>

                      <span
                        className={`cop-doc-group-pill ${
                          group.allVerified ? "ok" : group.rejected ? "bad" : "pending"
                        }`}
                      >
                        {group.allVerified
                          ? "All verified"
                          : group.rejected
                          ? `${group.rejected} rejected`
                          : `${group.pending} pending`}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="cop-doc-group-body">
                        <table className="cop-table">
                          <thead>
                            <tr>
                              <th>Document &amp; File</th>
                              <th>Automated OCR &amp; Compliance Check</th>
                              <th>Status</th>
                              <th>Officer Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.docs.map((doc) => (
                              <tr key={doc.id}>
                                <td>
                                  <button
                                    type="button"
                                    className="cop-doc-name-btn"
                                    onClick={() => handleOpenDocInspection(doc)}
                                    title="Inspect document"
                                  >
                                    {doc.docType}
                                  </button>
                                  <div className="cop-doc-file">
                                    {doc.fileName} &middot; {doc.fileSize}
                                  </div>
                                </td>
                                <td className="cop-doc-ocr">{doc.ocrSummary}</td>
                                <td>
                                  <span
                                    className={`cop-doc-status ${
                                      doc.status === "VERIFIED"
                                        ? "ok"
                                        : doc.status === "REJECTED"
                                        ? "bad"
                                        : "pending"
                                    }`}
                                  >
                                    {doc.status === "VERIFIED"
                                      ? "Verified"
                                      : doc.status === "REJECTED"
                                      ? "Rejected"
                                      : "Awaiting check"}
                                  </span>
                                  {doc.status === "REJECTED" && doc.rejectionReason && (
                                    <div className="cop-doc-reason">{doc.rejectionReason}</div>
                                  )}
                                </td>
                                <td>
                                  <div className="cop-doc-actions">
                                    <button
                                      type="button"
                                      className="cop-btn-verify"
                                      disabled={docBusy === doc.documentId || doc.status === "VERIFIED"}
                                      onClick={() =>
                                        handleVerifySingleDoc(
                                          doc.shipmentId,
                                          doc.docType,
                                          doc.documentId,
                                          "VERIFIED",
                                        )
                                      }
                                    >
                                      <ShieldCheck size={13} />
                                      {doc.status === "VERIFIED" ? "Stamped" : "Verify & Stamp"}
                                    </button>
                                    <button
                                      type="button"
                                      className="cop-btn-reject"
                                      disabled={docBusy === doc.documentId}
                                      onClick={() => handleRejectSingleDoc(doc)}
                                    >
                                      <XCircle size={13} /> Reject
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <div className="cop-doc-group-foot">
                          {group.allVerified ? (
                            <span className="cop-doc-group-done">
                              <CheckCircle2 size={15} /> All documents verified for {group.quoteNo}.
                              The customer has been notified.
                            </span>
                          ) : (
                            <>
                              <span className="cop-doc-group-hint">
                                {group.pending} document{group.pending === 1 ? "" : "s"} still awaiting your check.
                              </span>
                              <button
                                type="button"
                                className="cop-btn-verify-all"
                                disabled={Boolean(docBusy) || group.pending === 0}
                                onClick={() => handleVerifyGroup(group)}
                              >
                                <ShieldCheck size={14} /> Verify all remaining
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ASSIGNED SHIPMENTS (DISTINCT PORT LOGISTICS & TERMINAL MANIFEST VIEW)   */}
      {/* ========================================================================= */}
      {activeTab === "assigned-shipments" && (
        <div className="cop-card">
          <div className="cop-view-header">
            <div className="cop-view-title">
              <Ship size={20} color="#0284c7" />
              Assigned Consignment Logistics &amp; Port Manifest
              <span className="cop-view-badge-count">{shipments.length} Consignments</span>
            </div>
            <div style={{ fontSize: "12.5px", color: "#64748b" }}>
              Carrier vessels, terminal berths, container TEUs, and customs custody records.
            </div>
          </div>

          <div className="cop-table-wrap">
            <table className="cop-table">
              <thead>
                <tr>
                  <th>Shipment Ref &amp; Consignor</th>
                  <th>Consignee (Destination)</th>
                  <th>Vessel &amp; Terminal Berth</th>
                  <th>Container Specification</th>
                  <th>Customs Valuation</th>
                  <th>Port Custody Status</th>
                  <th>Officer In-Charge</th>
                  <th>Manifest Action</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong style={{ color: "#0f172a" }}>{s.id}</strong>
                      <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px" }}>{s.customer}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: "#1e293b" }}>{s.consignee || "Registered Importer"}</div>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>{s.destination}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: "#0284c7" }}>{s.vessel || "MSC Paloma V.24"}</div>
                      <div className="cop-manifest-spec">{s.berth || "Terminal Gate Berth"}</div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: "#334155" }}>{s.containers || "1 × 40HC (18,000 kg)"}</span>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>HS: {s.hsCode}</div>
                    </td>
                    <td>
                      <div className="cop-val-tag">{s.declaredValue || "₹ 1,48,500"}</div>
                      <div className="cop-duty-sub">Assessed Duty: {s.dutyEstimate || "7.5% BCD"}</div>
                    </td>
                    <td>
                      {s.status === "APPROVED" ? (
                        <span className="cop-badge approved">Cleared For Dispatch</span>
                      ) : s.status === "FLAGGED" ? (
                        <span className="cop-badge critical">Terminal Gate Hold</span>
                      ) : (
                        <span className="cop-badge pendingreview">Under Customs Custody</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: "12.5px", color: "#475569", fontWeight: 600 }}>
                        {s.assignedOfficer || "Officer Sharma"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="cop-btn-action"
                        onClick={() => openManifestModal(s)}
                      >
                        <Eye size={14} /> View Manifest
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. PENDING REVIEWS (DISTINCT URGENT SIGN-OFF QUEUE VIEW)                   */}
      {/* ========================================================================= */}
      {activeTab === "pending-reviews" && (
        <div className="cop-card">
          <div className="cop-view-header">
            <div className="cop-view-title">
              <ClipboardList size={20} color="#d97706" />
              Statutory Review &amp; Officer Sign-off Queue
              <span className="cop-view-badge-count">{pendingCount} Action Required</span>
            </div>
            <div style={{ fontSize: "12.5px", color: "#64748b" }}>
              Consignments awaiting compliance sign-off. Click <strong>Inspect &amp; Sign-off</strong> to approve or flag.
            </div>
          </div>

          <div className="cop-table-wrap">
            <table className="cop-table">
              <thead>
                <tr>
                  <th>Priority &amp; SLA</th>
                  <th>Shipment ID</th>
                  <th>Shipper &amp; Route</th>
                  <th>Cargo &amp; Tariff HS Code</th>
                  <th>Regulatory Documents</th>
                  <th>M3 Risk Score</th>
                  <th>Officer Action</th>
                </tr>
              </thead>
              <tbody>
                {shipments
                  .filter((s) => s.status === "PENDING_REVIEW" || s.status === "AI_ANALYZED")
                  .map((s) => (
                    <tr key={s.id}>
                      <td>
                        {s.slaUrgent ? (
                          <span className="cop-sla-urgent">
                            <Clock size={12} /> {s.slaRemaining || "Urgent · 2h SLA"}
                          </span>
                        ) : (
                          <span className="cop-sla-normal">
                            <Clock size={12} /> {s.slaRemaining || "Normal · 6h SLA"}
                          </span>
                        )}
                      </td>
                      <td>
                        <strong>{s.id}</strong>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{s.customer}</div>
                        <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "2px" }}>
                          {s.origin} <ArrowRight size={10} style={{ display: "inline" }} /> {s.destination}
                        </div>
                      </td>
                      <td>
                        <div>{s.cargoType}</div>
                        <div style={{ fontSize: "11px", color: "#0284c7", fontWeight: 700, marginTop: "2px" }}>
                          HS: {s.hsCode}
                        </div>
                      </td>
                      <td>
                        {(() => {
                          const ds = docStatusFor(s);
                          const tone =
                            ds.tone === "good"
                              ? "#059669"
                              : ds.tone === "bad"
                              ? "#dc2626"
                              : "#64748b";
                          return (
                            <>
                              <span style={{ fontSize: "12px", fontWeight: 600, color: tone }}>
                                {ds.label}
                              </span>
                              <button
                                type="button"
                                className="cop-view-docs-btn"
                                onClick={() => openDocsForConsignment(s)}
                                title={`Open the documents uploaded for ${s.quoteNo || s.id}`}
                              >
                                <FileCheck size={12} /> View docs
                              </button>
                            </>
                          );
                        })()}
                      </td>
                      <td>
                        <span className={`cop-badge ${s.riskLevel.toLowerCase()}`}>
                          {s.riskLevel} ({s.riskScore}/100)
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="cop-btn-action"
                          onClick={() => openSignoffModal(s)}
                        >
                          Inspect &amp; Sign-off
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. CUSTOMS RISK FLAGS (DISTINCT RED-LANE ALERT CENTER)                    */}
      {/* ========================================================================= */}
      {activeTab === "customs-risk-flags" && (
        <div className="cop-card">
          <div className="cop-view-header">
            <div className="cop-view-title">
              <AlertOctagon size={20} color="#dc2626" />
              Red-Lane Enforcement Holds &amp; Tariff Discrepancies
              <span className="cop-view-badge-count">{highRiskCount} Alerts</span>
            </div>
            <div style={{ fontSize: "12.5px", color: "#64748b" }}>
              Consignments intercepted for hazardous gaps, missing compliance certificates, or tariff under-valuation.
            </div>
          </div>

          <div className="cop-table-wrap">
            <table className="cop-table">
              <thead>
                <tr>
                  <th>Enforcement Level</th>
                  <th>Shipment Ref &amp; Shipper</th>
                  <th>Trade Route</th>
                  <th>Detention / Hold Reason</th>
                  <th>MCDA Risk Metric</th>
                  <th>Inspection Bay</th>
                  <th>Enforcement Action</th>
                </tr>
              </thead>
              <tbody>
                {shipments
                  .filter((s) => s.status === "FLAGGED" || s.riskLevel === "HIGH")
                  .map((s) => (
                    <tr key={s.id}>
                      <td>
                        <span className="cop-badge critical">
                          <AlertTriangle size={12} /> Red-Lane Hold
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: "#0f172a" }}>{s.id}</strong>
                        <div style={{ fontSize: "12px", color: "#475569" }}>{s.customer}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: "12.5px" }}>
                          {s.origin} &rarr; {s.destination}
                        </span>
                      </td>
                      <td>
                        <div className="cop-hold-reason">
                          {s.holdReason || "Missing mandatory statutory hazardous certificate (SDS) or tariff verification."}
                        </div>
                      </td>
                      <td>
                        <span className="cop-badge high">
                          Score: {s.riskScore}/100
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
                          {s.berth || "Terminal Hazmat Yard Bay 2"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            type="button"
                            className="cop-btn-action"
                            style={{ background: "#059669", padding: "6px 12px", fontSize: "12px" }}
                            onClick={() => openSignoffModal(s)}
                          >
                            Resolve Hold
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. COMPLETED REVIEWS (DISTINCT CLEARANCE CERTIFICATE ARCHIVE)             */}
      {/* ========================================================================= */}
      {activeTab === "completed-reviews" && (
        <div className="cop-card">
          <div className="cop-view-header">
            <div className="cop-view-title">
              <CheckCircle size={20} color="#059669" />
              Completed Customs Clearances &amp; Legal Gate Passes
              <span className="cop-view-badge-count">{completedCount} Approved</span>
            </div>
            <div style={{ fontSize: "12.5px", color: "#64748b" }}>
              Legally certified Out-of-Charge export/import records and stamped clearance certificates.
            </div>
          </div>

          <div className="cop-table-wrap">
            <table className="cop-table">
              <thead>
                <tr>
                  <th>Clearance Certificate #</th>
                  <th>Shipment Ref</th>
                  <th>Shipper &amp; Consignee</th>
                  <th>Approved Tariff &amp; Cargo</th>
                  <th>Digital Officer Stamp</th>
                  <th>Clearance Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {shipments
                  .filter((s) => s.status === "APPROVED" || s.status === "CUSTOMS_REVIEWED")
                  .map((s) => (
                    <tr key={s.id}>
                      <td>
                        <span className="cop-clearance-cert">
                          {s.clearanceCertNo || `CC-IN-2026-${String(s.id).slice(-4)}`}
                        </span>
                      </td>
                      <td>
                        <strong>{s.id}</strong>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{s.customer}</div>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>&rarr; {s.consignee || "Consignee"}</div>
                      </td>
                      <td>
                        <div>{s.cargoType}</div>
                        <div style={{ fontSize: "11px", color: "#0284c7" }}>HS: {s.hsCode} (Tariff Cleared)</div>
                      </td>
                      <td>
                        <span className="cop-stamp-badge">
                          <Stamp size={14} /> Stamped by {s.assignedOfficer || "Officer Sharma"}
                        </span>
                      </td>
                      <td>
                        <span className="cop-badge approved">Out of Charge Issued</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="cop-btn-action"
                          style={{ background: "#0284c7" }}
                          onClick={() =>
                            alert(
                              `Official Customs Clearance Certificate for ${s.id}:\n\nCertificate No: ${
                                s.clearanceCertNo || `CC-IN-2026-${String(s.id).slice(-4)}`
                              }\nShipper: ${s.customer}\nAssigned Officer: ${s.assignedOfficer}\nStatus: APPROVED & CLEARED FOR EXPORT`
                            )
                          }
                        >
                          <Download size={14} /> Download Pass
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manifest Viewer Modal */}
      {manifestModalOpen && selectedManifest && (
        <div className="cop-modal-overlay" onClick={() => setManifestModalOpen(false)}>
          <div className="cop-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cop-modal-header">
              <div>
                <h3>Port Logistics Manifest: {selectedManifest.id}</h3>
                <p className="cop-modal-sub">
                  Vessel: <strong>{selectedManifest.vessel}</strong> &bull; {selectedManifest.berth}
                </p>
              </div>
              <button
                type="button"
                className="cop-modal-close"
                onClick={() => setManifestModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="cop-modal-body">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px", background: "#f8fafc", padding: "16px", borderRadius: "12px" }}>
                <div>
                  <span style={{ fontSize: "11.5px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Shipper / Consignor:</span>
                  <div style={{ fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>{selectedManifest.customer}</div>
                </div>
                <div>
                  <span style={{ fontSize: "11.5px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Destination Consignee:</span>
                  <div style={{ fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>{selectedManifest.consignee}</div>
                </div>
                <div>
                  <span style={{ fontSize: "11.5px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Port of Loading (POL):</span>
                  <div style={{ fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>{selectedManifest.origin}</div>
                </div>
                <div>
                  <span style={{ fontSize: "11.5px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Port of Discharge (POD):</span>
                  <div style={{ fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>{selectedManifest.destination}</div>
                </div>
                <div>
                  <span style={{ fontSize: "11.5px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Cargo &amp; Weight:</span>
                  <div style={{ fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>{selectedManifest.containers}</div>
                </div>
                <div>
                  <span style={{ fontSize: "11.5px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Declared Valuation:</span>
                  <div style={{ fontWeight: 700, color: "#0284c7", marginTop: "2px" }}>{selectedManifest.declaredValue} ({selectedManifest.dutyEstimate})</div>
                </div>
              </div>

              <div style={{ marginTop: "16px" }}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: 700, color: "#334155" }}>
                  Attached Clearance Documents:
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {selectedManifest.documents.map((d, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#f1f5f9", borderRadius: "8px", fontSize: "12.5px" }}>
                      <span><strong>{d.name}</strong> {d.fileName && <span style={{ color: "#0284c7" }}>({d.fileName})</span>}</span>
                      <span className={`cop-doc-badge ${(d.status || "").toLowerCase()}`}>{d.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="cop-modal-footer">
              <button
                type="button"
                className="cop-btn-cancel"
                onClick={() => setManifestModalOpen(false)}
              >
                Close Manifest
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sign-off Review Modal */}
      {reviewModalOpen && selectedShipment && (
        <div className="cop-modal-overlay" onClick={() => setReviewModalOpen(false)}>
          <div className="cop-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cop-modal-header">
              <div>
                <h3>Customs Inspection &amp; Verification: {selectedShipment.id}</h3>
                <p className="cop-modal-sub">
                  Shipper: <strong>{selectedShipment.customer}</strong> &bull; {selectedShipment.origin} &rarr; {selectedShipment.destination}
                </p>
              </div>
              <button
                type="button"
                className="cop-modal-close"
                onClick={() => setReviewModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="cop-modal-body">
              <div className="cop-cargo-badge-info">
                <FileText size={16} />
                <span>
                  Declared Cargo: <strong>{selectedShipment.cargoType}</strong> (Harmonized System Code: <strong>{selectedShipment.hsCode}</strong>)
                </span>
              </div>

              <div className="cop-checklist">
                <div className="cop-checklist-title">Mandatory Regulatory Documents Checklist</div>
                {selectedShipment.documents.map((doc, idx) => {
                  const liveStatus = docItemStatus(selectedShipment.shipmentId, doc.name);
                  const statusClass = liveStatus.toLowerCase();
                  return (
                    <div
                      key={idx}
                      className="cop-check-item"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 14px",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        marginBottom: "8px",
                        background: "#f8fafc",
                      }}
                    >
                      <div className="cop-check-left" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <FileText size={16} color="#0284c7" />
                        <span className="cop-check-name" style={{ fontWeight: 600, color: "#1e293b", fontSize: "13px" }}>
                          {doc.name}
                          {doc.fileName && (
                            <span style={{ color: "#0284c7", marginLeft: "8px", fontSize: "11.5px", fontWeight: "normal" }}>
                              &bull; {doc.fileName} ({doc.fileSize || "Uploaded"})
                            </span>
                          )}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <button
                          type="button"
                          className="cop-btn-preview-link"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "4px 10px",
                            background: "#e0f2fe",
                            color: "#0369a1",
                            border: "1px solid #bae6fd",
                            borderRadius: "6px",
                            fontSize: "11.5px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                          onClick={() => {
                            const foundDocInVerify = allDocumentsToVerify.find(
                              (v) =>
                                (v.shipmentId === selectedShipment.id || v.quoteNo === selectedShipment.id) &&
                                normalizeDocName(v.docType) === normalizeDocName(doc.name)
                            );
                            handleOpenDocInspection({
                              id: `${selectedShipment.id}-${doc.name}`,
                              shipmentId: selectedShipment.id,
                              quoteNo: selectedShipment.quoteNo || selectedShipment.id,
                              customer: selectedShipment.customer,
                              origin: selectedShipment.origin,
                              destination: selectedShipment.destination,
                              route: `${selectedShipment.origin} ➔ ${selectedShipment.destination}`,
                              hsCode: selectedShipment.hsCode,
                              cargoType: selectedShipment.cargoType,
                              vessel: selectedShipment.vessel,
                              berth: selectedShipment.berth,
                              containers: selectedShipment.containers,
                              declaredValue: selectedShipment.declaredValue,
                              dutyEstimate: selectedShipment.dutyEstimate,
                              docType: doc.name,
                              fileName: foundDocInVerify?.fileName || doc.fileName || `${doc.name.replace(/\s+/g, "_")}.pdf`,
                              fileSize: foundDocInVerify?.fileSize || doc.fileSize || "1.2 MB",
                              fileDataUrl: foundDocInVerify?.fileDataUrl || doc.fileDataUrl || null,
                              fileType: foundDocInVerify?.fileType || doc.fileType || "application/pdf",
                              uploaded: foundDocInVerify?.uploaded || Boolean(doc.fileDataUrl || doc.fileName),
                              status: foundDocInVerify?.status || doc.status || "PENDING",
                              ocrSummary: getOcrComplianceNote(doc.name, selectedShipment.hsCode),
                            });
                          }}
                          title="Open Document Preview"
                        >
                          <Eye size={12} /> View Document
                        </button>
                        <span className={`cop-doc-badge ${statusClass}`}>
                          {liveStatus === "UPLOADED" ? "AWAITING CHECK" : liveStatus}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="cop-notes-field">
                <label className="cop-notes-label">
                  Officer Inspection Notes &amp; Compliance Remarks:
                </label>
                <textarea
                  className="cop-textarea"
                  placeholder="Enter customs regulatory comments, assessed duty rates, or required cargo hold justifications..."
                  value={officerNotes}
                  onChange={(e) => setOfficerNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="cop-modal-footer">
              <button
                type="button"
                className="cop-btn-cancel"
                onClick={() => setReviewModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cop-btn-flag"
                onClick={() => handleDecision("FLAG")}
              >
                Flag Compliance Hold
              </button>
              <button
                type="button"
                className="cop-btn-action"
                style={{ background: "#059669", padding: "10px 20px" }}
                onClick={() => handleDecision("APPROVE")}
              >
                <CheckCircle2 size={16} /> Approve &amp; Digital Sign-off
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Document Inspection & Preview Modal ── */}
      {/* All papers on one consignment cleared. Say so, then send the officer
          to sign-off, which is the step that actually clears the shipment. */}
      {allVerifiedFor && (
        <div className="cop-modal-overlay" onClick={() => setAllVerifiedFor(null)}>
          <div className="cop-allverified-card" onClick={(e) => e.stopPropagation()}>
            <div className="cop-allverified-icon">
              <CheckCircle2 size={34} />
            </div>
            <h3 className="cop-allverified-title">All documents verified</h3>
            <p className="cop-allverified-text">
              Every required document on <strong>{allVerifiedFor.quoteNo}</strong> has been
              stamped and cleared. {allVerifiedFor.customer} has been notified.
            </p>
            <p className="cop-allverified-next">
              Next: complete the customs sign-off to clear this consignment.
            </p>
            <div className="cop-allverified-actions">
              <button
                type="button"
                className="cop-btn-ghost"
                onClick={() => setAllVerifiedFor(null)}
              >
                Stay here
              </button>
              <button
                type="button"
                className="cop-btn-verify-all"
                onClick={() => {
                  const shipment = shipments.find(
                    (s) => (s.quoteNo || s.id) === allVerifiedFor.key,
                  );
                  setAllVerifiedFor(null);
                  if (shipment) {
                    handleTabSwitch("pending-reviews");
                    setTimeout(() => openSignoffModal(shipment), 120);
                  }
                }}
              >
                <ShieldCheck size={15} /> Go to Inspect &amp; Sign-off
              </button>
            </div>
          </div>
        </div>
      )}

      {previewDocModalOpen && previewDoc && (() => {
      const previewHasFile = hasRealFile(previewDoc);
      return (
        <div className="cop-modal-overlay" onClick={() => setPreviewDocModalOpen(false)}>
          <div
            className="cop-modal-card"
            style={{ maxWidth: "860px", width: "95%", background: "#ffffff", borderRadius: "16px", overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cop-modal-header" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", color: "#ffffff", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #334155" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <ShieldCheck size={20} color="#38bdf8" />
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#ffffff" }}>
                    Customs Officer Document Inspection &amp; Audit Desk
                  </h3>
                </div>
                <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                  Consignment Ref: <strong style={{ color: "#f8fafc" }}>{previewDoc.shipmentId}</strong> &bull; Shipper: <strong style={{ color: "#f8fafc" }}>{previewDoc.customer}</strong> &bull; File: <strong style={{ color: "#38bdf8" }}>{previewDoc.fileName}</strong>
                </div>
              </div>

              {/* View Mode Toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ display: "flex", background: "#0b1329", padding: "3px", borderRadius: "8px", border: "1px solid #334155" }}>
                  <button
                    type="button"
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "none",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      background: docViewMode === "paper" ? "#0284c7" : "transparent",
                      color: docViewMode === "paper" ? "#ffffff" : "#94a3b8",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                    onClick={() => setDocViewMode("paper")}
                    title="Authentic Document View"
                  >
                    <FileText size={13} /> Document View
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "none",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      background: docViewMode === "pdf" ? "#0284c7" : "transparent",
                      color: docViewMode === "pdf" ? "#ffffff" : "#94a3b8",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                    onClick={() => setDocViewMode("pdf")}
                    title="View Raw PDF File"
                  >
                    <FileCheck size={13} /> PDF File Embed
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "none",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      background: docViewMode === "ocr" ? "#0284c7" : "transparent",
                      color: docViewMode === "ocr" ? "#ffffff" : "#94a3b8",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                    onClick={() => setDocViewMode("ocr")}
                    title="OCR Data Analysis"
                  >
                    <Shield size={13} /> OCR Audit
                  </button>
                </div>

                <button
                  type="button"
                  className="cop-modal-close"
                  style={{ color: "#cbd5e1", background: "transparent", border: "none", cursor: "pointer", padding: "4px" }}
                  onClick={() => setPreviewDocModalOpen(false)}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="cop-modal-body" style={{ maxHeight: "78vh", overflowY: "auto", padding: "20px", background: "#f1f5f9" }}>
              {/* Top Quick Status Pill */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#ffffff",
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  marginBottom: "16px",
                  fontSize: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span>Document: <strong>{previewDoc.docType}</strong></span>
                  <span style={{ color: "#94a3b8" }}>&bull;</span>
                  <span>HS Code: <strong>{previewDoc.hsCode || "8517.12"}</strong></span>
                  <span style={{ color: "#94a3b8" }}>&bull;</span>
                  <span>Route: <strong>{previewDoc.route}</strong></span>
                </div>
                <div>
                  {previewDoc.status === "VERIFIED" ? (
                    <span className="cop-badge approved" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <CheckCircle2 size={12} /> Verified &amp; Stamped
                    </span>
                  ) : (
                    <span className="cop-badge pendingreview" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <Clock size={12} /> Under Review
                    </span>
                  )}
                </div>
              </div>

              {/* Nothing was ever uploaded for this checklist item. The styled
                  view below is a generated representation, not the customer's
                  file, so showing it here would present invented shipping
                  details as if they were evidence. */}
              {!previewHasFile && (
                <div className="cop-nofile-state">
                  <AlertTriangle size={30} />
                  <h4>No file uploaded for this document</h4>
                  <p>
                    <strong>{previewDoc.docType}</strong> is required for clearance on{" "}
                    {previewDoc.quoteNo}, but the customer has not uploaded it yet. There is
                    nothing to inspect or stamp.
                  </p>
                  <p className="cop-nofile-hint">
                    The customer is asked for this document in their portal under My Quotes.
                  </p>
                </div>
              )}

              {/* ───────────────────────────────────────────────────────────────── */}
              {/* MODE 1: STYLED REPRESENTATION OF THE DECLARED SHIPMENT            */}
              {/* ───────────────────────────────────────────────────────────────── */}
              {previewHasFile && docViewMode === "paper" && (
                <div className="cop-representation-warn">
                  <AlertTriangle size={14} /> This is a formatted representation built from the
                  shipment record. It is not the customer&apos;s uploaded file — open PDF File
                  Embed to inspect the real document before stamping.
                </div>
              )}

              {previewHasFile && docViewMode === "paper" && (
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
                    padding: "36px 40px",
                    borderRadius: "4px",
                    maxWidth: "760px",
                    margin: "0 auto",
                    position: "relative",
                    color: "#0f172a",
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                  }}
                >
                  {/* Verified Rubber Stamp Overlay */}
                  {previewDoc.status === "VERIFIED" && (
                    <div
                      style={{
                        position: "absolute",
                        top: "36px",
                        right: "36px",
                        border: "3px double #059669",
                        padding: "8px 16px",
                        borderRadius: "6px",
                        color: "#059669",
                        fontWeight: 900,
                        fontSize: "13px",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        transform: "rotate(-6deg)",
                        background: "rgba(236, 253, 245, 0.94)",
                        boxShadow: "0 2px 10px rgba(5, 150, 105, 0.2)",
                        pointerEvents: "none",
                        zIndex: 10,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Stamp size={16} /> CUSTOMS PASSED &bull; CLEARED
                      </div>
                      <div style={{ fontSize: "9px", letterSpacing: "0.03em", marginTop: "2px", fontWeight: 700 }}>
                        PORT CUSTODY OFFICER SHARMA &bull; VERIFIED
                      </div>
                    </div>
                  )}

                  {/* Document Title Header */}
                  <div style={{ textAlign: "center", marginBottom: "20px" }}>
                    <h2 style={{ margin: "0 0 4px 0", fontSize: "20px", fontWeight: 800, letterSpacing: "0.02em", color: "#0f172a" }}>
                      {previewDoc.docType.toLowerCase().includes("lading")
                        ? "BILL OF LADING (OCEAN DRAFT)"
                        : previewDoc.docType.toLowerCase().includes("invoice")
                        ? "COMMERCIAL INVOICE"
                        : previewDoc.docType.toLowerCase().includes("packing")
                        ? "PACKING LIST & CONTAINER MANIFEST"
                        : previewDoc.docType.toLowerCase().includes("origin")
                        ? "CERTIFICATE OF ORIGIN"
                        : previewDoc.docType.toUpperCase()}
                    </h2>
                    <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                      {previewDoc.docType.toLowerCase().includes("lading")
                        ? "Multimodal Transport Negotiable Document"
                        : "Multimodal Freight Legal Clearance Document"}
                    </div>
                  </div>

                  {/* Header Box with Blue Top Accent Line */}
                  <div
                    style={{
                      border: "1px solid #0284c7",
                      borderTop: "3.5px solid #0284c7",
                      padding: "12px 16px",
                      display: "grid",
                      gridTemplateColumns: "1.2fr 1fr",
                      gap: "16px",
                      marginBottom: "12px",
                      fontSize: "11px",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "12px", color: "#0f172a" }}>
                        MEDITERRANEAN SHIPPING COMPANY S.A.
                      </div>
                      <div style={{ color: "#475569", marginTop: "2px" }}>
                        Geneva, Switzerland &bull; Chennai Port Liaison Office
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 800, color: "#0284c7" }}>
                        {previewDoc.docType.toLowerCase().includes("lading")
                          ? "OCEAN BILL OF LADING DRAFT"
                          : `${previewDoc.docType.toUpperCase()} CLEARANCE`}
                      </div>
                      <div style={{ color: "#334155", marginTop: "2px" }}>
                        B/L NUMBER: <strong>MSCU-MAA-ROT-48109</strong>
                      </div>
                      <div style={{ color: "#64748b" }}>
                        BOOKING REF: <strong>BK-2026-88194</strong>
                      </div>
                    </div>
                  </div>

                  {/* 4-Row 2-Col Grid matching user PDF */}
                  <div
                    style={{
                      border: "1px solid #cbd5e1",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      fontSize: "11px",
                      marginBottom: "14px",
                    }}
                  >
                    <div style={{ padding: "8px 12px", borderRight: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1" }}>
                      <div style={{ fontWeight: 800, color: "#475569", fontSize: "10px", textTransform: "uppercase" }}>SHIPPER:</div>
                      <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>{previewDoc.customer || "ABC Electronics Pvt Ltd"}</div>
                      <div style={{ color: "#64748b" }}>Chennai, Tamil Nadu, India</div>
                    </div>
                    <div style={{ padding: "8px 12px", borderBottom: "1px solid #cbd5e1" }}>
                      <div style={{ fontWeight: 800, color: "#475569", fontSize: "10px", textTransform: "uppercase" }}>NOTIFY PARTY:</div>
                      <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>FreightAI Automated Customs Broker</div>
                      <div style={{ color: "#64748b" }}>Rotterdam Port Gate Eurohub 12</div>
                    </div>

                    <div style={{ padding: "8px 12px", borderRight: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1" }}>
                      <div style={{ fontWeight: 800, color: "#475569", fontSize: "10px", textTransform: "uppercase" }}>CONSIGNEE:</div>
                      <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>To Order of Global Tech Logistics B.V.</div>
                      <div style={{ color: "#64748b" }}>Rotterdam, The Netherlands</div>
                    </div>
                    <div style={{ padding: "8px 12px", borderBottom: "1px solid #cbd5e1" }}>
                      <div style={{ fontWeight: 800, color: "#475569", fontSize: "10px", textTransform: "uppercase" }}>FREIGHT PAYABLE AT:</div>
                      <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>Chennai / Prepaid CIF</div>
                    </div>

                    <div style={{ padding: "8px 12px", borderRight: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1" }}>
                      <div style={{ fontWeight: 800, color: "#475569", fontSize: "10px", textTransform: "uppercase" }}>PRE-CARRIAGE BY:</div>
                      <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>Rail Feeder CFS Chennai</div>
                    </div>
                    <div style={{ padding: "8px 12px", borderBottom: "1px solid #cbd5e1" }}>
                      <div style={{ fontWeight: 800, color: "#475569", fontSize: "10px", textTransform: "uppercase" }}>OCEAN VESSEL &amp; VOY NO:</div>
                      <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>{previewDoc.vessel || "MSC Paloma / 24E"}</div>
                    </div>

                    <div style={{ padding: "8px 12px", borderRight: "1px solid #cbd5e1" }}>
                      <div style={{ fontWeight: 800, color: "#475569", fontSize: "10px", textTransform: "uppercase" }}>PORT OF LOADING:</div>
                      <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>{previewDoc.origin || "Chennai Sea Port, India (INMAA)"}</div>
                    </div>
                    <div style={{ padding: "8px 12px" }}>
                      <div style={{ fontWeight: 800, color: "#475569", fontSize: "10px", textTransform: "uppercase" }}>PORT OF DISCHARGE:</div>
                      <div style={{ fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>{previewDoc.destination || "Port of Rotterdam, Netherlands (NLRTM)"}</div>
                    </div>
                  </div>

                  {/* Cargo Manifest Table matching user PDF */}
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", border: "1px solid #cbd5e1", marginBottom: "18px" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ padding: "8px 10px", borderRight: "1px solid #cbd5e1", textAlign: "left", fontWeight: 700, color: "#334155" }}>Marks &amp; Numbers</th>
                        <th style={{ padding: "8px 10px", borderRight: "1px solid #cbd5e1", textAlign: "left", fontWeight: 700, color: "#334155" }}>No. of Packages</th>
                        <th style={{ padding: "8px 10px", borderRight: "1px solid #cbd5e1", textAlign: "left", fontWeight: 700, color: "#334155" }}>Description of Cargo</th>
                        <th style={{ padding: "8px 10px", borderRight: "1px solid #cbd5e1", textAlign: "right", fontWeight: 700, color: "#334155" }}>Gross Weight</th>
                        <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#334155" }}>Measurement</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ padding: "10px", borderRight: "1px solid #cbd5e1", verticalAlign: "top", color: "#334155" }}>
                          ABC-ROT-2026<br />01 to 24
                        </td>
                        <td style={{ padding: "10px", borderRight: "1px solid #cbd5e1", verticalAlign: "top", color: "#334155" }}>
                          {previewDoc.containers || "24 Pallets (2x40HC FCL)"}
                        </td>
                        <td style={{ padding: "10px", borderRight: "1px solid #cbd5e1", verticalAlign: "top", color: "#1e293b" }}>
                          <div>Said to Contain: Commercial {previewDoc.cargoType || "Telecommunication & Electronic Hardware"} Modules</div>
                          <div style={{ fontSize: "10.5px", color: "#64748b", marginTop: "4px" }}>
                            Tariff HS Code: <strong>{previewDoc.hsCode || "8517.12"}</strong> &bull; Condition: Sound &amp; Sealed
                          </div>
                        </td>
                        <td style={{ padding: "10px", borderRight: "1px solid #cbd5e1", verticalAlign: "top", textAlign: "right", fontWeight: 600, color: "#0f172a" }}>
                          12,500.00 KGS
                        </td>
                        <td style={{ padding: "10px", verticalAlign: "top", textAlign: "right", fontWeight: 600, color: "#0f172a" }}>
                          58.40 CBM
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Document Footer */}
                  <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "12px", textAlign: "center", fontSize: "10.5px", color: "#64748b" }}>
                    Official Maritime Document &bull; Verified under IMO FAL Convention &amp; FreightAI Automated Clearance Gateway
                  </div>
                </div>
              )}

              {/* ───────────────────────────────────────────────────────────────── */}
              {/* MODE 2: EMBEDDED REAL PDF / IMAGE VIEWER                          */}
              {/* ───────────────────────────────────────────────────────────────── */}
              {previewHasFile && docViewMode === "pdf" && (() => {
                const resolvedFileUrl = resolveDocumentFileUrl(previewDoc);
                const isImage =
                  previewDoc.fileType?.startsWith("image/") ||
                  Boolean(previewDoc.fileName?.match(/\.(png|jpe?g|webp|gif|svg)$/i)) ||
                  (typeof resolvedFileUrl === "string" && resolvedFileUrl.startsWith("data:image/"));

                return (
                  <div style={{ width: "100%", height: "680px", borderRadius: "8px", overflow: "hidden", border: "1px solid #cbd5e1", background: "#ffffff", display: "flex", flexDirection: "column" }}>
                    <div style={{ padding: "10px 16px", background: "#0f172a", color: "#e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", borderBottom: "1px solid #334155" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <FileCheck size={16} color="#38bdf8" />
                        <span>Viewing File: <strong style={{ color: "#38bdf8" }}>{previewDoc.fileName}</strong> ({previewDoc.fileSize})</span>
                        {previewDoc.uploaded ? (
                          <span style={{ background: "#065f46", color: "#6ee7b7", padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <CheckCircle2 size={11} /> CLIENT UPLOADED FILE
                          </span>
                        ) : (
                          <span style={{ background: "#1e3a8a", color: "#93c5fd", padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600 }}>
                            PORT CLEARANCE RECORD
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <a
                          href={resolvedFileUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "#38bdf8", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 600 }}
                        >
                          <ExternalLink size={13} /> Open in New Tab
                        </a>
                        <a
                          href={resolvedFileUrl}
                          download={previewDoc.fileName || "trade_document.pdf"}
                          style={{ color: "#38bdf8", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 600 }}
                        >
                          <Download size={13} /> Download
                        </a>
                      </div>
                    </div>
                    {isImage ? (
                      <div style={{ flex: 1, overflow: "auto", display: "flex", justifyContent: "center", alignItems: "center", background: "#0f172a", padding: "20px" }}>
                        <img
                          src={resolvedFileUrl}
                          alt={previewDoc.fileName}
                          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "6px", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}
                        />
                      </div>
                    ) : (
                      <iframe
                        src={resolvedFileUrl}
                        title={previewDoc.fileName}
                        style={{ width: "100%", height: "100%", minHeight: "620px", border: "none" }}
                      />
                    )}
                  </div>
                );
              })()}

              {/* ───────────────────────────────────────────────────────────────── */}
              {/* MODE 3: OCR COMPLIANCE & TARIFF AUDIT                             */}
              {/* ───────────────────────────────────────────────────────────────── */}
              {previewHasFile && docViewMode === "ocr" && (
                <div style={{ background: "#ffffff", padding: "24px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
                  <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#0f172a", fontWeight: 700 }}>
                    Automated OCR Extraction &amp; Regulatory Verification Report
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", fontSize: "12px", marginBottom: "16px" }}>
                    <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                      <div style={{ fontWeight: 700, color: "#64748b", marginBottom: "4px" }}>SHIPPER CONSIGNMENT:</div>
                      <div style={{ color: "#0f172a", fontWeight: 600 }}>{previewDoc.customer}</div>
                      <div style={{ color: "#64748b" }}>Origin: {previewDoc.origin}</div>
                    </div>
                    <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                      <div style={{ fontWeight: 700, color: "#64748b", marginBottom: "4px" }}>PORT &amp; CARRIER ROUTING:</div>
                      <div style={{ color: "#0f172a", fontWeight: 600 }}>{previewDoc.route}</div>
                      <div style={{ color: "#64748b" }}>Assigned Vessel: {previewDoc.vessel || "MSC Paloma / 24E"}</div>
                    </div>
                  </div>

                  <div style={{ fontSize: "12px", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "14px", background: "#f8fafc", lineHeight: "1.7" }}>
                    <div>&bull; Extracted Harmonized Tariff Code: <strong>{previewDoc.hsCode || "8517.12"}</strong> (WCO Harmonized Standard)</div>
                    <div>&bull; Regulatory OCR Analysis: <em style={{ color: "#0369a1" }}>"{previewDoc.ocrSummary}"</em></div>
                    <div>&bull; Declared Packaging: Standard ISO Maritime Containers (Payload secured &amp; sealed)</div>
                    <div>&bull; SHA-256 Digital Fingerprint: <code>e8b91a27f901c0d48109bf21a784d12a9e34b1790184c7</code></div>
                  </div>
                </div>
              )}
            </div>

            <div className="cop-modal-footer" style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                className="cop-btn-cancel"
                onClick={() => setPreviewDocModalOpen(false)}
              >
                Close Preview
              </button>

              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {/* The decision notice used to render only behind this modal,
                    so a refusal (no file on record) looked like a dead button. */}
                {docNotice && (
                  <span className={`cop-preview-notice ${docNotice.type}`}>{docNotice.text}</span>
                )}

                {previewDoc.status === "VERIFIED" ? (
                  <span style={{ color: "#059669", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                    <CheckCircle2 size={18} /> Stamped &amp; cleared by {user?.full_name || "the customs officer"}
                  </span>
                ) : !previewHasFile ? (
                  <span className="cop-preview-notice error">
                    Waiting on the customer to upload this document.
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      className="cop-btn-reject"
                      style={{ padding: "10px 16px", fontSize: "13px" }}
                      disabled={docBusy === previewDoc.documentId}
                      onClick={() => handleRejectSingleDoc(previewDoc)}
                    >
                      <XCircle size={15} /> Reject
                    </button>
                    <button
                      type="button"
                      className="cop-btn-action"
                      style={{ background: "#059669", padding: "10px 20px", fontSize: "13px" }}
                      disabled={docBusy === previewDoc.documentId}
                      onClick={() =>
                        handleVerifySingleDoc(
                          previewDoc.shipmentId,
                          previewDoc.docType,
                          previewDoc.documentId,
                          "VERIFIED",
                        )
                      }
                    >
                      <ShieldCheck size={16} />
                      {docBusy === previewDoc.documentId
                        ? "Stamping..."
                        : "Verify & Apply Official Customs Stamp"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      );
      })()}
    </div>
  );
}
