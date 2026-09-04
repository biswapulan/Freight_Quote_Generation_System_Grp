import { useState, useEffect, useMemo } from "react";
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
  Shield,
  Eye,
  Stamp,
  ExternalLink,
} from "lucide-react";
import { signOffCustoms } from "../api/customs";
import {
  getPlatformQuotes,
  updateQuoteStatusInStore,
  syncQuoteDocumentsToVault,
} from "../utils/quoteWorkflow";
import "./CustomsOfficerPortal.css";

const INITIAL_CUSTOMS_SHIPMENTS = [
  {
    id: "SHP-1001",
    quoteNo: "FQ-9001",
    customer: "ABC Electronics Pvt Ltd",
    consignee: "Rotterdam High-Tech Logistics B.V.",
    origin: "Chennai Port (INMAA)",
    destination: "Rotterdam Port (NLRTM)",
    cargoType: "High-Tech Electronics",
    hsCode: "8517.12",
    documentsStatus: "4/4 Verified",
    riskLevel: "MEDIUM",
    riskScore: 35,
    status: "PENDING_REVIEW",
    assignedOfficer: "Officer Sharma",
    slaRemaining: "2h 15m (Urgent)",
    slaUrgent: true,
    vessel: "MSC Paloma V.24",
    berth: "Berth 4, Terminal Gate 2",
    containers: "2 × 40HC (24,000 kg)",
    declaredValue: "₹ 1,48,500",
    dutyEstimate: "₹ 11,137 (7.5% BCD)",
    holdReason: "",
    clearanceCertNo: "CC-IN-2026-9001",
    documents: [
      { name: "Commercial Invoice", status: "VERIFIED", fileName: "Commercial_Invoice_INV2026.pdf", fileSize: "1.4 MB" },
      { name: "Packing List", status: "VERIFIED", fileName: "Packing_List_PL9921.pdf", fileSize: "320 KB" },
      { name: "Bill of Lading Draft", status: "VERIFIED", fileName: "Bill_of_Lading_Draft_BL4810.pdf", fileSize: "840 KB" },
      { name: "Certificate of Origin", status: "VERIFIED", fileName: "Certificate_of_Origin_COO2026.pdf", fileSize: "950 KB" },
    ],
  },
  {
    id: "SHP-1002",
    quoteNo: "FQ-9002",
    customer: "Apex Chemical Industries",
    consignee: "Hamburg Pharma Import GmbH",
    origin: "Mumbai Port (INBOM)",
    destination: "Hamburg Port (DEHAM)",
    cargoType: "Industrial Chemicals (Class 3 Hazmat)",
    hsCode: "2902.11",
    documentsStatus: "Missing SDS Flashpoint",
    riskLevel: "HIGH",
    riskScore: 78,
    status: "FLAGGED",
    assignedOfficer: "Officer Verma",
    slaRemaining: "1h 30m (Critical Hold)",
    slaUrgent: true,
    vessel: "CMA CGM Voltaire",
    berth: "Hazmat Berth 7, Gate 1",
    containers: "1 × 20FT Tank (18,000 kg)",
    declaredValue: "₹ 2,88,000",
    dutyEstimate: "₹ 28,800 (10% BCD)",
    holdReason: "Dangerous Goods UN 1993 missing accredited lab flashpoint certificate. Detained at Terminal Hazmat Yard.",
    clearanceCertNo: "",
    documents: [
      { name: "Commercial Invoice", status: "VERIFIED", fileName: "Chemical_Invoice_2026.pdf", fileSize: "1.1 MB" },
      { name: "Dangerous Goods Declaration (DGD)", status: "VERIFIED", fileName: "DGD_Hazmat_Declaration.pdf", fileSize: "750 KB" },
      { name: "Safety Data Sheet (SDS)", status: "ACTION_REQUIRED", fileName: "Safety_Data_Sheet_MSDS_Chem.pdf", fileSize: "3.2 MB" },
    ],
  },
  {
    id: "SHP-1003",
    quoteNo: "FQ-9003",
    customer: "Global Textiles Co",
    consignee: "London Apparel Gateway Ltd",
    origin: "Tirupur / Nhava Sheva (INNSA)",
    destination: "London Gateway (GBLGP)",
    cargoType: "Organic Cotton Apparel",
    hsCode: "5208.11",
    documentsStatus: "All Documents Verified",
    riskLevel: "LOW",
    riskScore: 12,
    status: "APPROVED",
    assignedOfficer: "Officer Sharma",
    slaRemaining: "Completed",
    slaUrgent: false,
    vessel: "Maersk Mc-Kinney Moller",
    berth: "Berth 12, Gate 4",
    containers: "1 × 40HC (16,500 kg)",
    declaredValue: "₹ 56,340",
    dutyEstimate: "₹ 0 (Free Trade Agreement)",
    holdReason: "",
    clearanceCertNo: "CC-IN-2026-8841",
    documents: [
      { name: "Commercial Invoice", status: "VERIFIED", fileName: "Textile_Invoice_993.pdf", fileSize: "920 KB" },
      { name: "Certificate of Origin", status: "VERIFIED", fileName: "Certificate_of_Origin_Textiles.pdf", fileSize: "950 KB" },
    ],
  },
  {
    id: "SHP-1004",
    quoteNo: "FQ-9004",
    customer: "Global Trade Hub",
    consignee: "Al-Maktoum Auto Spares LLC",
    origin: "Mundra Port (INMUN)",
    destination: "Jebel Ali Port (AEJEA)",
    cargoType: "Automotive Transmission Parts",
    hsCode: "8708.29",
    documentsStatus: "All Documents Verified",
    riskLevel: "LOW",
    riskScore: 15,
    status: "APPROVED",
    assignedOfficer: "Officer Sharma",
    slaRemaining: "Completed",
    slaUrgent: false,
    vessel: "Ever Given V.108",
    berth: "Berth 2, Gate 5",
    containers: "1 × 20FT Standard (8,500 kg)",
    declaredValue: "₹ 1,10,400",
    dutyEstimate: "₹ 8,280 (7.5% BCD)",
    holdReason: "",
    clearanceCertNo: "CC-IN-2026-9921",
    documents: [
      { name: "Commercial Invoice", status: "VERIFIED", fileName: "AutoParts_Invoice_8708.pdf", fileSize: "1.2 MB" },
      { name: "Bill of Lading", status: "VERIFIED", fileName: "Bill_of_Lading_MAEU9921.pdf", fileSize: "840 KB" },
      { name: "Certificate of Origin (COO)", status: "VERIFIED", fileName: "COO_AutoParts_Dubai.pdf", fileSize: "670 KB" },
    ],
  },
];

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
    case "CE Certificate of Conformity":
      return "EU Directives 2014/53/EU and RoHS compliance certificate validated.";
    default:
      return "Statutory trade document validated by automated OCR scanner.";
  }
}

export default function CustomsOfficerPortal({ initialTab = "pending-reviews" }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(initialTab || "pending-reviews");

  const [shipments, setShipments] = useState(() => {
    try {
      const saved = localStorage.getItem("freightai_customs_shipments");
      const list = saved ? JSON.parse(saved) : INITIAL_CUSTOMS_SHIPMENTS;
      const platformQuotes = getPlatformQuotes();

      const platformAsShipments = platformQuotes.map((q) => {
        const qId = q.id || q.quoteNo;
        return {
          id: qId,
          quoteNo: q.quoteNo || qId,
          customer: q.customerName || q.client || "Shipper",
          consignee: q.consignee || `${q.destination || "Destination"} Importer Ltd`,
          origin: q.origin || "Nhava Sheva Port (INNSA)",
          destination: q.destination || "Port of Singapore (SGSIN)",
          cargoType: q.cargoType || q.cargoClass || "General Commercial Goods",
          hsCode: q.hsCode || "8471.30",
          documentsStatus: q.documentsStatus || "Documents Uploaded",
          riskLevel: q.overallRisk || (q.customsRiskScore > 50 ? "HIGH" : "LOW"),
          riskScore: q.customsRiskScore || 20,
          status:
            q.status === "APPROVED" || q.status === "SENT" || q.status === "ACCEPTED"
              ? "APPROVED"
              : q.status === "CUSTOMS_FLAGGED"
              ? "FLAGGED"
              : "PENDING_REVIEW",
          assignedOfficer: "Officer Sharma",
          slaRemaining: "3h 45m (Standard)",
          slaUrgent: false,
          vessel: "MSC Paloma V.24",
          berth: "Berth 3, Gate 4",
          containers: q.basis || "1 × 40HC (12,500 kg)",
          declaredValue: q.totalFormatted || "₹ 1,48,500",
          dutyEstimate: `₹ ${Math.round((q.totalNum || 148500) * 0.075).toLocaleString("en-IN")}`,
          holdReason: q.status === "CUSTOMS_FLAGGED" ? "Customs scrutiny required on tariff classification." : "",
          clearanceCertNo: q.status === "APPROVED" ? `CC-IN-2026-${qId.slice(-4)}` : "",
          documents: q.documents || [
            { name: "Commercial Invoice", status: "VERIFIED", fileName: "Commercial_Invoice_INV2026.pdf", fileSize: "1.4 MB" },
            { name: "Packing List", status: "VERIFIED", fileName: "Packing_List_PL9921.pdf", fileSize: "320 KB" },
            { name: "Bill of Lading Draft", status: "PENDING", fileName: "Bill_of_Lading_Draft_BL4810.pdf", fileSize: "840 KB" },
            { name: "Certificate of Origin", status: "PENDING", fileName: "Certificate_of_Origin_COO2026.pdf", fileSize: "950 KB" },
          ],
        };
      });

      const merged = [...list];
      platformAsShipments.forEach((ps) => {
        if (!merged.some((m) => m.id === ps.id || m.quoteNo === ps.quoteNo)) {
          merged.unshift(ps);
        }
      });
      return merged;
    } catch {
      return INITIAL_CUSTOMS_SHIPMENTS;
    }
  });

  const [selectedShipment, setSelectedShipment] = useState(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [manifestModalOpen, setManifestModalOpen] = useState(false);
  const [selectedManifest, setSelectedManifest] = useState(null);
  const [previewDocModalOpen, setPreviewDocModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [officerNotes, setOfficerNotes] = useState("");
  const [actionStatus, setActionStatus] = useState(null);

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
  const missingDocCount = shipments.filter(
    (s) =>
      s.documentsStatus.toLowerCase().includes("missing") ||
      s.documentsStatus.toLowerCase().includes("pending")
  ).length;
  const highRiskCount = shipments.filter(
    (s) => s.riskLevel === "HIGH" || s.riskLevel === "CRITICAL" || s.status === "FLAGGED"
  ).length;
  const completedCount = shipments.filter(
    (s) => s.status === "APPROVED" || s.status === "CUSTOMS_REVIEWED" || s.status === "RESOLVED"
  ).length;

  // Flattened documents list for Document Verification desk
  const allDocumentsToVerify = useMemo(() => {
    const list = [];
    shipments.forEach((s) => {
      const docs = s.documents || [];
      docs.forEach((d) => {
        list.push({
          id: `${s.id}-${d.name.replace(/[^a-zA-Z0-9]/g, "_")}`,
          shipmentId: s.id,
          quoteNo: s.quoteNo || s.id,
          customer: s.customer,
          route: `${s.origin} ➔ ${s.destination}`,
          hsCode: s.hsCode,
          docType: d.name,
          fileName: d.fileName || `${d.name.replace(/\s+/g, "_")}.pdf`,
          fileSize: d.fileSize || "1.2 MB",
          status: d.status || "PENDING",
          ocrSummary: getOcrComplianceNote(d.name, s.hsCode),
        });
      });
    });
    return list;
  }, [shipments]);

  // 1-Click Verify and Stamp individual document
  const handleVerifySingleDoc = (shipmentId, docName) => {
    const updated = shipments.map((s) => {
      if (s.id === shipmentId || s.quoteNo === shipmentId) {
        const updatedDocs = (s.documents || []).map((d) =>
          d.name === docName ? { ...d, status: "VERIFIED" } : d
        );
        const verifiedCount = updatedDocs.filter((d) => d.status === "VERIFIED").length;
        const total = updatedDocs.length;
        const allVerified = verifiedCount === total;
        return {
          ...s,
          documents: updatedDocs,
          documentsStatus: allVerified
            ? "All Documents Verified & Cleared"
            : `${verifiedCount}/${total} Documents Verified`,
          status: allVerified ? "APPROVED" : s.status,
        };
      }
      return s;
    });

    setShipments(updated);
    try {
      localStorage.setItem("freightai_customs_shipments", JSON.stringify(updated));
    } catch {}

    const target = updated.find((s) => s.id === shipmentId || s.quoteNo === shipmentId);
    if (target) {
      updateQuoteStatusInStore(target.quoteNo || target.id, target.status, {
        documents: target.documents,
        documentsStatus: target.documentsStatus,
        customsRemarks: `Customs Officer Sharma verified "${docName}". Regulatory clearance stamp applied.`,
      });
      syncQuoteDocumentsToVault(target, target.documents);
    }

    setActionStatus(`"${docName}" for shipment ${shipmentId} officially verified and stamped.`);
    setTimeout(() => setActionStatus(null), 4000);
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

  async function handleDecision(decision) {
    if (!selectedShipment) return;

    const newStatus = decision === "APPROVE" ? "APPROVED" : "FLAGGED";
    const verifiedDocs = (selectedShipment.documents || []).map((d) => ({
      ...d,
      status: decision === "APPROVE" ? "VERIFIED" : d.status,
    }));
    const docsSummary =
      decision === "APPROVE" ? "All Documents Verified & Cleared" : "Inspection Hold (Discrepancy)";

    try {
      await signOffCustoms({
        check_id: selectedShipment.id,
        decision: decision === "APPROVE" ? "APPROVED" : "FLAGGED",
        officer_name: selectedShipment.assignedOfficer || "Customs Officer Sharma",
        comments: officerNotes || `Officer sign-off: ${decision}`,
      }).catch(() => {});

      const updated = shipments.map((s) =>
        s.id === selectedShipment.id
          ? {
              ...s,
              status: newStatus,
              riskLevel: decision === "APPROVE" ? "LOW" : "HIGH",
              officerNotes: officerNotes || `Signed off as ${decision}`,
              documents: verifiedDocs,
              documentsStatus: docsSummary,
              clearanceCertNo: decision === "APPROVE" ? `CC-IN-2026-${s.id.slice(-4)}` : "",
            }
          : s
      );

      setShipments(updated);
      try {
        localStorage.setItem("freightai_customs_shipments", JSON.stringify(updated));
      } catch {}

      const qId = selectedShipment.quoteNo || selectedShipment.id;
      updateQuoteStatusInStore(qId, decision === "APPROVE" ? "PENDING_REVIEW" : "CUSTOMS_FLAGGED", {
        documents: verifiedDocs,
        documentsStatus: docsSummary,
        customsRemarks:
          officerNotes ||
          `Customs review: ${
            decision === "APPROVE"
              ? "All regulatory trade documents approved and released"
              : "Flagged on Hold"
          } by Officer Sharma. HS code statutory compliance certified.`,
        customsReviewedAt: new Date().toISOString(),
        requiresCustomsReview: false,
        customsRiskScore: decision === "APPROVE" ? 10 : 75,
        customsRiskLevel: decision === "APPROVE" ? "Low (10/100)" : "High (75/100)",
      });

      const updatedTarget = updated.find((s) => s.id === selectedShipment.id);
      if (updatedTarget) {
        syncQuoteDocumentsToVault(updatedTarget, verifiedDocs);
      }

      setActionStatus(
        `Shipment ${selectedShipment.id} successfully marked as ${
          decision === "APPROVE" ? "CUSTOMS REVIEWED & APPROVED" : "FLAGGED ON HOLD"
        }. Forwarded to Freight Agent queue.`
      );
      setReviewModalOpen(false);
      setTimeout(() => setActionStatus(null), 4000);
    } catch (err) {
      console.error(err);
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
              Itemized Document Audit &amp; Official Stamp Station
              <span className="cop-view-badge-count">{allDocumentsToVerify.length} Total Papers</span>
            </div>
            <div style={{ fontSize: "12.5px", color: "#64748b" }}>
              Click <strong>Verify &amp; Stamp</strong> to approve individual documents. Updates sync to Customer &amp; Vault instantly.
            </div>
          </div>

          <div className="cop-table-wrap">
            <table className="cop-table">
              <thead>
                <tr>
                  <th>Document Type &amp; Uploaded File</th>
                  <th>Shipment Ref &amp; Shipper</th>
                  <th>Trade Route</th>
                  <th>Automated OCR &amp; Compliance Check</th>
                  <th>Status</th>
                  <th>Officer Action</th>
                </tr>
              </thead>
              <tbody>
                {allDocumentsToVerify.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                        <div
                          style={{
                            padding: "8px",
                            background: "#f0f9ff",
                            borderRadius: "8px",
                            color: "#0284c7",
                            cursor: "pointer",
                          }}
                          onClick={() => {
                            setPreviewDoc(doc);
                            setPreviewDocModalOpen(true);
                          }}
                          title="Inspect Document"
                        >
                          <FileText size={18} />
                        </div>
                        <div>
                          <div
                            style={{
                              fontWeight: 700,
                              color: "#0284c7",
                              cursor: "pointer",
                              textDecoration: "underline",
                              textDecorationColor: "#bae6fd",
                            }}
                            onClick={() => {
                              setPreviewDoc(doc);
                              setPreviewDocModalOpen(true);
                            }}
                            title="Click to preview & audit document"
                          >
                            {doc.docType}
                          </div>
                          <div style={{ fontSize: "12px", color: "#64748b", display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                            <span style={{ color: "#0369a1", fontWeight: 500 }}>{doc.fileName}</span>
                            <span style={{ color: "#94a3b8" }}>&bull; {doc.fileSize}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong style={{ color: "#0f172a" }}>{doc.shipmentId}</strong>
                      <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "2px" }}>{doc.customer}</div>
                    </td>
                    <td>
                      <span style={{ fontSize: "12.5px", color: "#334155" }}>{doc.route}</span>
                    </td>
                    <td>
                      <div className="cop-ocr-indicator">
                        {doc.ocrSummary}
                      </div>
                    </td>
                    <td>
                      {doc.status === "VERIFIED" ? (
                        <span className="cop-badge approved">
                          <CheckCircle2 size={12} /> Verified
                        </span>
                      ) : (
                        <span className="cop-badge pendingreview">
                          <Clock size={12} /> Under Review
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="cop-btn-view"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "6px 12px",
                            background: "#f0f9ff",
                            color: "#0284c7",
                            border: "1px solid #bae6fd",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                          onClick={() => {
                            setPreviewDoc(doc);
                            setPreviewDocModalOpen(true);
                          }}
                          title="Open Document for Inspection"
                        >
                          <Eye size={13} /> View Document
                        </button>
                        {doc.status === "VERIFIED" ? (
                          <span className="cop-stamp-badge">
                            <ShieldCheck size={14} /> Stamped by Officer
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="cop-btn-action"
                            style={{ background: "#059669", padding: "6px 14px", fontSize: "12px" }}
                            onClick={() => handleVerifySingleDoc(doc.shipmentId, doc.docType)}
                          >
                            <ShieldCheck size={13} /> Verify &amp; Stamp
                          </button>
                        )}
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
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            color: s.documentsStatus.includes("Missing") ? "#dc2626" : "#059669",
                          }}
                        >
                          {s.documentsStatus}
                        </span>
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
                          {s.clearanceCertNo || `CC-IN-2026-${s.id.slice(-4)}`}
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
                                s.clearanceCertNo || `CC-IN-2026-${s.id.slice(-4)}`
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
                  const statusClass = (doc.status || "").toLowerCase();
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
                            setPreviewDoc({
                              id: `${selectedShipment.id}-${doc.name}`,
                              shipmentId: selectedShipment.id,
                              quoteNo: selectedShipment.quoteNo || selectedShipment.id,
                              customer: selectedShipment.customer,
                              route: `${selectedShipment.origin} ➔ ${selectedShipment.destination}`,
                              hsCode: selectedShipment.hsCode,
                              docType: doc.name,
                              fileName: doc.fileName || `${doc.name}.pdf`,
                              fileSize: doc.fileSize || "1.2 MB",
                              status: doc.status || "PENDING",
                              ocrSummary: getOcrComplianceNote(doc.name, selectedShipment.hsCode),
                            });
                            setPreviewDocModalOpen(true);
                          }}
                          title="Open Document Preview"
                        >
                          <Eye size={12} /> View Document
                        </button>
                        <span className={`cop-doc-badge ${statusClass}`}>
                          {doc.status}
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
      {previewDocModalOpen && previewDoc && (
        <div className="cop-modal-overlay" onClick={() => setPreviewDocModalOpen(false)}>
          <div
            className="cop-modal-card"
            style={{ maxWidth: "860px", width: "95%", background: "#ffffff", borderRadius: "16px", overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cop-modal-header" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", color: "#ffffff", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <ShieldCheck size={20} color="#38bdf8" />
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#ffffff" }}>
                    Customs Officer Document Inspection &amp; Audit Desk
                  </h3>
                </div>
                <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                  Consignment Ref: <strong style={{ color: "#f8fafc" }}>{previewDoc.shipmentId}</strong> &bull; Shipper: <strong style={{ color: "#f8fafc" }}>{previewDoc.customer}</strong> &bull; Document: <strong style={{ color: "#38bdf8" }}>{previewDoc.docType}</strong>
                </div>
              </div>
              <button
                type="button"
                className="cop-modal-close"
                style={{ color: "#cbd5e1", background: "transparent", border: "none", cursor: "pointer" }}
                onClick={() => setPreviewDocModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="cop-modal-body" style={{ maxHeight: "76vh", overflowY: "auto", padding: "22px" }}>
              {/* Document Overview Strip */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                  gap: "12px",
                  background: "#f8fafc",
                  padding: "14px 18px",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                  marginBottom: "20px",
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Document Title</div>
                  <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>{previewDoc.docType}</div>
                  <div style={{ fontSize: "11px", color: "#0284c7" }}>{previewDoc.fileName}</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Declared HS Code</div>
                  <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>{previewDoc.hsCode || "8471.30"}</div>
                  <div style={{ fontSize: "11px", color: "#16a34a" }}>WCO Harmonized</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Maritime Route</div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#334155", marginTop: "2px" }}>{previewDoc.route}</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Customs Audit Status</div>
                  <div style={{ marginTop: "4px" }}>
                    {previewDoc.status === "VERIFIED" ? (
                      <span className="cop-badge approved" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <CheckCircle2 size={12} /> Verified &amp; Stamped
                      </span>
                    ) : (
                      <span className="cop-badge pendingreview" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <Clock size={12} /> Pending Verification
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Document Visual Preview Sheet */}
              <div
                style={{
                  background: "#ffffff",
                  border: "2px solid #cbd5e1",
                  borderRadius: "12px",
                  padding: "24px",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
                  fontFamily: "monospace, sans-serif",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Official Stamp Overlay if verified */}
                {previewDoc.status === "VERIFIED" && (
                  <div
                    style={{
                      position: "absolute",
                      top: "24px",
                      right: "24px",
                      border: "3px double #059669",
                      padding: "8px 18px",
                      borderRadius: "8px",
                      color: "#059669",
                      fontWeight: 900,
                      fontSize: "13px",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      transform: "rotate(-6deg)",
                      background: "rgba(236, 253, 245, 0.94)",
                      boxShadow: "0 2px 10px rgba(5, 150, 105, 0.2)",
                      pointerEvents: "none",
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

                {/* Header of paper document */}
                <div style={{ borderBottom: "2px solid #0f172a", paddingBottom: "12px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: 900, color: "#0f172a", letterSpacing: "0.04em" }}>
                      {previewDoc.docType.toUpperCase()}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                      INTERNATIONAL MARITIME TRADE MANIFEST &bull; REF: {previewDoc.shipmentId}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", fontSize: "11px", color: "#64748b" }}>
                    <div>AUDIT DATE: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</div>
                    <div>STATUS: <strong style={{ color: previewDoc.status === "VERIFIED" ? "#059669" : "#d97706" }}>{previewDoc.status}</strong></div>
                  </div>
                </div>

                {/* Itemized Table of the document */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", fontSize: "12px", marginBottom: "16px" }}>
                  <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>SHIPPER / EXPORTER:</div>
                    <div style={{ color: "#334155", fontWeight: 600 }}>{previewDoc.customer}</div>
                    <div style={{ color: "#64748b" }}>Terminal Facility &bull; Port of Origin</div>
                  </div>
                  <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>PORT &amp; CARRIER ROUTING:</div>
                    <div style={{ color: "#334155", fontWeight: 600 }}>{previewDoc.route}</div>
                    <div style={{ color: "#64748b" }}>Assigned Berth: Berth 3, Gate 4</div>
                  </div>
                </div>

                {/* Cargo breakdown & OCR extracted lines */}
                <div style={{ fontSize: "12px", borderTop: "1px dashed #cbd5e1", paddingTop: "12px", marginBottom: "16px" }}>
                  <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: "8px" }}>EXTRACTED LINE ITEMS (OCR REGULATORY PARSER):</div>
                  <div style={{ background: "#f1f5f9", padding: "12px", borderRadius: "6px", lineHeight: "1.7", color: "#1e293b", border: "1px solid #e2e8f0" }}>
                    <div>&bull; Item Description: Commercial Consignment under HS Tariff Code <strong>{previewDoc.hsCode || "8471.30"}</strong></div>
                    <div>&bull; Automated OCR Verification: <em style={{ color: "#0369a1" }}>"{previewDoc.ocrSummary}"</em></div>
                    <div>&bull; Declared Packaging: Standard ISO Maritime Containers (Payload secured &amp; sealed)</div>
                    <div>&bull; Digital File Signature: SHA-256 Verified (Integrity Confirmed)</div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "#64748b", borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
                  <div>Security Seal: SEAL-INNSA-982173</div>
                  <div>Official Customs Port Authority &bull; Government of India</div>
                </div>
              </div>
            </div>

            <div className="cop-modal-footer" style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                className="cop-btn-cancel"
                onClick={() => setPreviewDocModalOpen(false)}
              >
                Close Preview
              </button>

              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                {previewDoc.status === "VERIFIED" ? (
                  <span style={{ color: "#059669", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                    <CheckCircle2 size={18} /> Stamped by Customs Officer Sharma
                  </span>
                ) : (
                  <button
                    type="button"
                    className="cop-btn-action"
                    style={{ background: "#059669", padding: "10px 20px", fontSize: "13px" }}
                    onClick={() => {
                      handleVerifySingleDoc(previewDoc.shipmentId, previewDoc.docType);
                    }}
                  >
                    <ShieldCheck size={16} /> Verify &amp; Apply Official Customs Stamp
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
