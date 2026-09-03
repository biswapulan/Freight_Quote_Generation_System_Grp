import { useState, useEffect } from "react";
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
} from "lucide-react";
import { signOffCustoms } from "../api/customs";
import { getPlatformQuotes, updateQuoteStatusInStore, normalizeWorkflowStatus } from "../utils/quoteWorkflow";
import QuoteWorkflowStepper from "./QuoteWorkflowStepper";
import "./CustomsOfficerPortal.css";

const INITIAL_CUSTOMS_SHIPMENTS = [
  {
    id: "SHP-1001",
    quoteNo: "FQ-9001",
    customer: "ABC Electronics Pvt Ltd",
    origin: "Chennai, India",
    destination: "Rotterdam, Netherlands",
    cargoType: "Electronics",
    hsCode: "8517.12",
    documentsStatus: "3/3 Verified",
    riskLevel: "MEDIUM",
    riskScore: 40,
    status: "PENDING_REVIEW",
    assignedOfficer: "Officer Sharma",
    documents: [
      { name: "Commercial Invoice", status: "VERIFIED" },
      { name: "Bill of Lading", status: "VERIFIED" },
      { name: "CE Certificate of Conformity", status: "VERIFIED" },
    ],
  },
  {
    id: "SHP-1002",
    quoteNo: "FQ-9002",
    customer: "Apex Chemical Industries",
    origin: "Mumbai, India",
    destination: "Hamburg, Germany",
    cargoType: "Industrial Solvents (Class 3)",
    hsCode: "2902.11",
    documentsStatus: "Missing SDS",
    riskLevel: "HIGH",
    riskScore: 78,
    status: "PENDING_REVIEW",
    assignedOfficer: "Officer Verma",
    documents: [
      { name: "Commercial Invoice", status: "VERIFIED" },
      { name: "Dangerous Goods Declaration (DGD)", status: "VERIFIED" },
      { name: "Safety Data Sheet (SDS)", status: "MISSING" },
    ],
  },
  {
    id: "SHP-1003",
    quoteNo: "FQ-9003",
    customer: "Global Textiles Co",
    origin: "Tirupur, India",
    destination: "London Gateway, UK",
    cargoType: "Organic Cotton Apparel",
    hsCode: "5208.11",
    documentsStatus: "2/2 Verified",
    riskLevel: "LOW",
    riskScore: 12,
    status: "APPROVED",
    assignedOfficer: "Officer Sharma",
    documents: [
      { name: "Commercial Invoice", status: "VERIFIED" },
      { name: "Certificate of Origin", status: "VERIFIED" },
    ],
  },
  {
    id: "SHP-1004",
    quoteNo: "FQ-9004",
    customer: "PharmaMed Global",
    origin: "Hyderabad, India",
    destination: "New York JFK, USA",
    cargoType: "API Bulk Drugs (Cold Chain)",
    hsCode: "3004.90",
    documentsStatus: "Pending FDA Release",
    riskLevel: "HIGH",
    riskScore: 65,
    status: "FLAGGED",
    assignedOfficer: "Officer Rao",
    documents: [
      { name: "Commercial Invoice", status: "VERIFIED" },
      { name: "FDA 2877 Declaration", status: "PENDING" },
      { name: "Temperature Log Chart", status: "VERIFIED" },
    ],
  },
];

export default function CustomsOfficerPortal({ initialTab = "pending-reviews" }) {
  const [activeTab, setActiveTab] = useState(initialTab || "pending-reviews");
  const [shipments, setShipments] = useState(() => {
    try {
      const saved = localStorage.getItem("freightai_customs_shipments");
      return saved ? JSON.parse(saved) : INITIAL_CUSTOMS_SHIPMENTS;
    } catch {
      return INITIAL_CUSTOMS_SHIPMENTS;
    }
  });
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
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

  const pendingCount = shipments.filter((s) => s.status === "PENDING_REVIEW" || s.status === "AI_ANALYZED").length;
  const missingDocCount = shipments.filter((s) => s.documentsStatus.toLowerCase().includes("missing") || s.documentsStatus.toLowerCase().includes("pending")).length;
  const highRiskCount = shipments.filter((s) => s.riskLevel === "HIGH" || s.riskLevel === "CRITICAL" || s.status === "FLAGGED").length;
  const completedCount = shipments.filter((s) => s.status === "APPROVED" || s.status === "CUSTOMS_REVIEWED" || s.status === "RESOLVED").length;

  function openSignoffModal(shipment) {
    setSelectedShipment(shipment);
    setOfficerNotes("");
    setReviewModalOpen(true);
  }

  async function handleDecision(decision) {
    if (!selectedShipment) return;

    const newStatus = decision === "APPROVE" ? "APPROVED" : "FLAGGED";
    const workflowStatus = decision === "APPROVE" ? "CUSTOMS_REVIEWED" : "CUSTOMS_FLAGGED";

    try {
      await signOffCustoms({
        check_id: selectedShipment.id,
        decision: decision === "APPROVE" ? "APPROVED" : "FLAGGED",
        officer_name: selectedShipment.assignedOfficer || "Customs Officer",
        comments: officerNotes || `Officer sign-off: ${decision}`,
      }).catch(() => {});

      const updated = shipments.map((s) =>
        s.id === selectedShipment.id
          ? {
              ...s,
              status: newStatus,
              riskLevel: decision === "APPROVE" ? "LOW" : "HIGH",
              officerNotes: officerNotes || `Signed off as ${decision}`,
            }
          : s
      );

      setShipments(updated);
      try {
        localStorage.setItem("freightai_customs_shipments", JSON.stringify(updated));
      } catch {}

      // Synchronize with platform quotes store for Freight Agent and Customer
      if (selectedShipment.quoteNo || selectedShipment.id) {
        updateQuoteStatusInStore(
          selectedShipment.quoteNo || selectedShipment.id,
          workflowStatus,
          {
            customsRemarks: officerNotes || `Customs verification: ${decision === "APPROVE" ? "Approved & Released" : "Flagged on Hold"} by ${selectedShipment.assignedOfficer || "Officer Sharma"}`,
            customsReviewedAt: new Date().toISOString()
          }
        );
      }

      setActionStatus(`Shipment ${selectedShipment.id} successfully marked as ${decision === "APPROVE" ? "CUSTOMS REVIEWED & APPROVED" : "FLAGGED ON HOLD"}. Forwarded to Freight Agent queue.`);
      setReviewModalOpen(false);
      setTimeout(() => setActionStatus(null), 4000);
    } catch (err) {
      console.error(err);
    }
  }

  const filteredShipments = shipments.filter((s) => {
    if (activeTab === "pending-reviews") return s.status === "PENDING_REVIEW" || s.status === "AI_ANALYZED";
    if (activeTab === "customs-risk-flags") return s.status === "FLAGGED" || s.riskLevel === "HIGH";
    if (activeTab === "completed-reviews") return s.status === "APPROVED" || s.status === "CUSTOMS_REVIEWED";
    return true; // assigned-shipments, document-verification or all
  });

  return (
    <div className="cop-container">
      {/* Top Banner */}
      <div className="cop-header-banner">
        <div className="cop-title-block">
          <h1>Customs Compliance &amp; Regulatory Gate</h1>
          <p>
            Verify international trade compliance, HS code classifications, legal document checklists, and digital officer sign-off.
          </p>
        </div>
        <div className="cop-badge-tag">
          <span className="cop-badge-dot" />
          <ShieldCheck size={14} /> Customs Officer Station Active
        </div>
      </div>

      {actionStatus && (
        <div style={{ padding: "12px 16px", background: "rgba(34, 197, 94, 0.15)", border: "1px solid rgba(34, 197, 94, 0.3)", borderRadius: "8px", color: "#4ade80", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
          <CheckCircle2 size={16} /> {actionStatus}
        </div>
      )}

      {/* Metric Cards (PDF Page 7) */}
      <div className="cop-metrics-grid">
        <div className="cop-metric-card">
          <div className="cop-metric-icon pending">
            <ClipboardList size={22} />
          </div>
          <div className="cop-metric-info">
            <span className="cop-metric-val">{pendingCount}</span>
            <span className="cop-metric-label">Pending Reviews</span>
          </div>
        </div>

        <div className="cop-metric-card">
          <div className="cop-metric-icon missing">
            <FileWarning size={22} />
          </div>
          <div className="cop-metric-info">
            <span className="cop-metric-val">{missingDocCount}</span>
            <span className="cop-metric-label">Missing Documents</span>
          </div>
        </div>

        <div className="cop-metric-card">
          <div className="cop-metric-icon highrisk">
            <AlertOctagon size={22} />
          </div>
          <div className="cop-metric-info">
            <span className="cop-metric-val">{highRiskCount}</span>
            <span className="cop-metric-label">High Risk Cargo</span>
          </div>
        </div>

        <div className="cop-metric-card">
          <div className="cop-metric-icon completed">
            <CheckCircle size={22} />
          </div>
          <div className="cop-metric-info">
            <span className="cop-metric-val">{completedCount}</span>
            <span className="cop-metric-label">Completed Today</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation (PDF Page 7 Sidebar items) */}
      <div className="cop-tabs">
        <button
          type="button"
          className={`cop-tab-btn ${activeTab === "pending-reviews" ? "active" : ""}`}
          onClick={() => setActiveTab("pending-reviews")}
        >
          Pending Reviews ({pendingCount})
        </button>
        <button
          type="button"
          className={`cop-tab-btn ${activeTab === "assigned-shipments" ? "active" : ""}`}
          onClick={() => setActiveTab("assigned-shipments")}
        >
          Assigned Shipments ({shipments.length})
        </button>
        <button
          type="button"
          className={`cop-tab-btn ${activeTab === "document-verification" ? "active" : ""}`}
          onClick={() => setActiveTab("document-verification")}
        >
          Document Verification
        </button>
        <button
          type="button"
          className={`cop-tab-btn ${activeTab === "customs-risk-flags" ? "active" : ""}`}
          onClick={() => setActiveTab("customs-risk-flags")}
        >
          Customs Risk Flags ({highRiskCount})
        </button>
        <button
          type="button"
          className={`cop-tab-btn ${activeTab === "completed-reviews" ? "active" : ""}`}
          onClick={() => setActiveTab("completed-reviews")}
        >
          Completed Reviews ({completedCount})
        </button>
      </div>

      {/* Data Table */}
      <div className="cop-card">
        <div className="cop-table-wrap">
          <table className="cop-table">
            <thead>
              <tr>
                <th>Shipment ID</th>
                <th>Shipper</th>
                <th>Route (Origin to Dest)</th>
                <th>Cargo &amp; HS Code</th>
                <th>Documents Status</th>
                <th>Customs Risk</th>
                <th>Status</th>
                <th>Officer Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredShipments.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.id}</strong></td>
                  <td>{s.customer}</td>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      {s.origin} <ArrowRight size={12} /> {s.destination}
                    </span>
                  </td>
                  <td>
                    {s.cargoType}
                    <div style={{ fontSize: "11px", color: "#38bdf8", marginTop: "2px" }}>
                      HS: {s.hsCode}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: "12px", color: s.documentsStatus.includes("Missing") ? "#f87171" : "#e2e8f0" }}>
                      {s.documentsStatus}
                    </span>
                  </td>
                  <td>
                    <span className={`cop-badge ${s.riskLevel.toLowerCase()}`}>
                      {s.riskLevel} ({s.riskScore}/100)
                    </span>
                  </td>
                  <td>
                    <span className={`cop-badge ${s.status.toLowerCase().replace(/_/g, "")}`}>
                      {s.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="cop-btn-action"
                      onClick={() => openSignoffModal(s)}
                    >
                      Inspect & Sign-off
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sign-off Review Modal */}
      {reviewModalOpen && selectedShipment && (
        <div className="cop-modal-overlay" onClick={() => setReviewModalOpen(false)}>
          <div className="cop-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
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
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
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
                    <label key={idx} className="cop-check-item">
                      <div className="cop-check-left">
                        <input type="checkbox" defaultChecked={doc.status === "VERIFIED"} />
                        <span className="cop-check-name">{doc.name}</span>
                      </div>
                      <span className={`cop-doc-badge ${statusClass}`}>
                        {doc.status}
                      </span>
                    </label>
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

            {/* Modal Footer */}
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
    </div>
  );
}
