import { useState, useEffect } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  ClipboardList,
  FileWarning,
  AlertOctagon,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import { signOffCustoms } from "../api/customs";
import "./CustomsOfficerPortal.css";

const INITIAL_CUSTOMS_SHIPMENTS = [
  {
    id: "SHP-1001",
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
    customer: "Apex Chemical Industries",
    origin: "Mumbai, India",
    destination: "Hamburg, Germany",
    cargoType: "Industrial Solvents (Class 3)",
    hsCode: "2902.11",
    documentsStatus: "Missing SDS",
    riskLevel: "HIGH",
    riskScore: 78,
    status: "FLAGGED",
    assignedOfficer: "Officer Sharma",
    documents: [
      { name: "Commercial Invoice", status: "VERIFIED" },
      { name: "Bill of Lading", status: "PENDING" },
      { name: "Safety Data Sheet (SDS)", status: "MISSING" },
    ],
  },
  {
    id: "SHP-1003",
    customer: "Global Pharma Labs",
    origin: "Hyderabad, India",
    destination: "Singapore, SG",
    cargoType: "Temperature-Sensitive Vaccines",
    hsCode: "3002.20",
    documentsStatus: "4/4 Verified",
    riskLevel: "LOW",
    riskScore: 18,
    status: "APPROVED",
    assignedOfficer: "Officer Sharma",
    documents: [
      { name: "Commercial Invoice", status: "VERIFIED" },
      { name: "Air Waybill", status: "VERIFIED" },
      { name: "Cold Chain Log", status: "VERIFIED" },
      { name: "Import Permit SG", status: "VERIFIED" },
    ],
  },
  {
    id: "SHP-1004",
    customer: "Nordic Timber Corp",
    origin: "Kolkata, India",
    destination: "Antwerp, Belgium",
    cargoType: "Treated Timber & Lumber",
    hsCode: "4407.11",
    documentsStatus: "Pending Phytosanitary",
    riskLevel: "MEDIUM",
    riskScore: 45,
    status: "PENDING_REVIEW",
    assignedOfficer: "Officer Sharma",
    documents: [
      { name: "Commercial Invoice", status: "VERIFIED" },
      { name: "Bill of Lading", status: "VERIFIED" },
      { name: "Phytosanitary Certificate", status: "PENDING" },
    ],
  },
];

export default function CustomsOfficerPortal({ initialTab = "pending-reviews" }) {
  const [activeTab, setActiveTab] = useState(initialTab || "pending-reviews");
  const [shipments, setShipments] = useState(INITIAL_CUSTOMS_SHIPMENTS);
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

  const pendingCount = shipments.filter((s) => s.status === "PENDING_REVIEW").length;
  const missingDocCount = shipments.filter((s) => s.documentsStatus.toLowerCase().includes("missing") || s.documentsStatus.toLowerCase().includes("pending")).length;
  const highRiskCount = shipments.filter((s) => s.riskLevel === "HIGH" || s.riskLevel === "CRITICAL").length;
  const completedCount = shipments.filter((s) => s.status === "APPROVED" || s.status === "RESOLVED").length;

  function openSignoffModal(shipment) {
    setSelectedShipment(shipment);
    setOfficerNotes("");
    setReviewModalOpen(true);
  }

  async function handleDecision(decision) {
    if (!selectedShipment) return;

    try {
      // Call backend customs signoff API if available
      await signOffCustoms({
        check_id: selectedShipment.id,
        decision: decision === "APPROVE" ? "APPROVED" : "FLAGGED",
        officer_name: selectedShipment.assignedOfficer || "Customs Officer",
        comments: officerNotes || `Officer sign-off: ${decision}`,
      }).catch(() => {
        // Fallback gracefully for demo/offline
      });

      setShipments((prev) =>
        prev.map((s) =>
          s.id === selectedShipment.id
            ? {
                ...s,
                status: decision === "APPROVE" ? "APPROVED" : "FLAGGED",
                riskLevel: decision === "APPROVE" ? "LOW" : "HIGH",
              }
            : s
        )
      );

      setActionStatus(`Shipment ${selectedShipment.id} successfully marked as ${decision === "APPROVE" ? "APPROVED" : "FLAGGED"}.`);
      setReviewModalOpen(false);
      setTimeout(() => setActionStatus(null), 4000);
    } catch (err) {
      console.error(err);
    }
  }

  const filteredShipments = shipments.filter((s) => {
    if (activeTab === "pending-reviews") return s.status === "PENDING_REVIEW";
    if (activeTab === "customs-risk-flags") return s.status === "FLAGGED" || s.riskLevel === "HIGH";
    if (activeTab === "completed-reviews") return s.status === "APPROVED";
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
            <h3>Customs Inspection & Verification: {selectedShipment.id}</h3>
            <p style={{ margin: 0, fontSize: "13px", color: "#94a3b8" }}>
              Shipper: <strong>{selectedShipment.customer}</strong> | Route: {selectedShipment.origin} to {selectedShipment.destination}
            </p>

            <div style={{ fontSize: "12px", color: "#38bdf8" }}>
              Declared Cargo: <strong>{selectedShipment.cargoType}</strong> (HS: {selectedShipment.hsCode})
            </div>

            <div className="cop-checklist">
              <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "#94a3b8" }}>
                Mandatory Regulatory Documents
              </span>
              {selectedShipment.documents.map((doc, idx) => (
                <label key={idx} className="cop-check-item">
                  <input type="checkbox" defaultChecked={doc.status === "VERIFIED"} />
                  <span>{doc.name} — <strong style={{ color: doc.status === "VERIFIED" ? "#4ade80" : doc.status === "MISSING" ? "#f87171" : "#fbbf24" }}>{doc.status}</strong></span>
                </label>
              ))}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                Officer Notes / Compliance Remarks:
              </label>
              <textarea
                className="cop-textarea"
                placeholder="Enter customs regulatory comments, duty assessment, or required export amendments..."
                value={officerNotes}
                onChange={(e) => setOfficerNotes(e.target.value)}
              />
            </div>

            <div className="cop-modal-actions">
              <button
                type="button"
                style={{ padding: "8px 16px", borderRadius: "6px", background: "transparent", border: "1px solid rgba(255, 255, 255, 0.2)", color: "#fff", cursor: "pointer" }}
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
                style={{ background: "#16a34a" }}
                onClick={() => handleDecision("APPROVE")}
              >
                Approve & Digital Sign-off
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
