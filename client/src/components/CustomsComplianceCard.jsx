import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  Upload,
  RefreshCw,
} from "lucide-react";
import { validateCustomsCompliance, uploadCustomsDocument, signOffCustoms } from "../api/customs";
import "./CustomsComplianceCard.css";

export default function CustomsComplianceCard({
  shipmentId = "SHP-PREVIEW",
  originCountry = "India",
  destinationCountry = "Netherlands",
  hsCode = "850440",
  commodity = "Power Inverters & Electronics",
  incoterm = "CIF",
  onComplianceUpdated,
}) {
  const [loading, setLoading] = useState(false);
  const [compliance, setCompliance] = useState(null);
  const [uploadingItemId, setUploadingItemId] = useState(null);
  const [officerName, setOfficerName] = useState("Customs Officer Smith");

  const runValidation = async () => {
    setLoading(true);
    try {
      const data = await validateCustomsCompliance({
        shipment_id: shipmentId,
        origin_country: originCountry,
        destination_country: destinationCountry,
        hs_code: hsCode,
        commodity,
        incoterm,
      });
      setCompliance(data);
      if (onComplianceUpdated) onComplianceUpdated(data);
    } catch (err) {
      console.error("Customs validation failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runValidation();
  }, [shipmentId, originCountry, destinationCountry, hsCode, commodity, incoterm]);

  const handleUploadDoc = async (item, file) => {
    if (!file) return;
    setUploadingItemId(item.id);
    try {
      const res = await uploadCustomsDocument({
        shipment_id: shipmentId,
        checklist_item_id: item.id,
        document_type: item.item_name,
        file_name: file.name,
      });
      if (res.compliance_check) {
        setCompliance((prev) => ({
          ...prev,
          ...res.compliance_check,
        }));
      }
      runValidation();
    } catch (err) {
      alert(err.message || "Upload failed");
    } finally {
      setUploadingItemId(null);
    }
  };

  const handleSignOff = async (decision) => {
    if (!compliance?.id) return;
    try {
      const res = await signOffCustoms({
        check_id: compliance.id,
        decision,
        officer_name: officerName,
        comments: `Manual review decision: ${decision}`,
      });
      setCompliance((prev) => ({
        ...prev,
        ...res.compliance_check,
      }));
      if (onComplianceUpdated) onComplianceUpdated(res.compliance_check);
    } catch (err) {
      alert(err.message || "Sign-off failed");
    }
  };

  const status = compliance?.status || "PENDING";
  const readiness = compliance?.readiness_score ? Math.round(compliance.readiness_score) : 85;
  const items = compliance?.checklist_items || [];
  const evidence = compliance?.regulatory_evidence || [];

  return (
    <div className="customs-panel-card">
      {/* Header */}
      <div className="customs-panel-header">
        <div className="customs-header-info">
          <h3>Customs Compliance &amp; Regulatory Verification</h3>
          <p>
            Trade Lane: <strong>{originCountry}</strong> &rarr; <strong>{destinationCountry}</strong> | HS Code:{" "}
            <strong>{hsCode}</strong> ({incoterm})
          </p>
        </div>

        <div className="customs-header-actions">
          <span
            className={`badge-status ${
              status === "APPROVED" ? "status-approved" : status === "REJECTED" ? "badge-status" : "status-pending"
            }`}
            style={status === "REJECTED" ? { background: "#fee2e2", color: "#b91c1c" } : undefined}
          >
            {status.replace("_", " ")}
          </span>

          <button
            type="button"
            className="agent-btn-sm"
            onClick={runValidation}
            disabled={loading}
            title="Re-verify Customs Compliance"
          >
            <RefreshCw size={12} style={{ display: "inline", marginRight: "4px" }} />
            {loading ? "Verifying..." : "Re-verify"}
          </button>
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div className="customs-kpi-grid">
        <div className="customs-kpi-box">
          <span className="customs-kpi-lbl">Compliance Readiness</span>
          <span className="customs-kpi-val">{readiness}%</span>
          <div className="customs-progress-track">
            <div
              className="customs-progress-bar"
              style={{
                width: `${readiness}%`,
                background: readiness >= 80 ? "#16a34a" : readiness >= 50 ? "#ea580c" : "#e11d48",
              }}
            />
          </div>
        </div>

        <div className="customs-kpi-box">
          <span className="customs-kpi-lbl">Commodity Classification</span>
          <span className="customs-kpi-val" style={{ fontSize: "16px", paddingTop: "6px" }}>
            {compliance?.commodity || commodity}
          </span>
          <span style={{ fontSize: "12px", color: compliance?.is_prohibited ? "#dc2626" : compliance?.is_restricted ? "#d97706" : "#16a34a", fontWeight: 600 }}>
            {compliance?.is_prohibited ? "PROHIBITED / SANCTIONED" : compliance?.is_restricted ? "RESTRICTED / CONTROLLED" : "STANDARD CLEARANCE"}
          </span>
        </div>

        <div className="customs-kpi-box">
          <span className="customs-kpi-lbl">Verified Documentation</span>
          <span className="customs-kpi-val">
            {items.filter((i) => i.status === "VERIFIED").length} / {items.length}
          </span>
          <span style={{ fontSize: "12px", color: "#64748b" }}>Required for Port Ingress</span>
        </div>
      </div>

      {/* Checklist Table */}
      <div style={{ marginBottom: "20px" }}>
        <div className="customs-table-title">Mandatory Customs Documentation &amp; Checklist</div>
        <div className="customs-table-wrap">
          <table className="customs-table">
            <thead>
              <tr>
                <th>Document Type</th>
                <th>Description &amp; Purpose</th>
                <th>Regulatory Reference</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.item_name}</strong></td>
                  <td>{item.description}</td>
                  <td><code style={{ fontSize: "12px", color: "#0284c7" }}>{item.citation || "General Tariff Code"}</code></td>
                  <td>
                    <span className={`badge-status ${item.status === "VERIFIED" ? "status-approved" : "status-pending"}`}>
                      {item.status}
                    </span>
                  </td>
                  <td>
                    {item.status !== "VERIFIED" ? (
                      <>
                        <input
                          type="file"
                          id={`customs-doc-upload-${item.id}`}
                          style={{ display: "none" }}
                          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.csv"
                          disabled={uploadingItemId === item.id}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadDoc(item, file);
                          }}
                        />
                        <label
                          htmlFor={`customs-doc-upload-${item.id}`}
                          className="agent-btn-sm"
                          style={{ cursor: "pointer", display: "inline-flex", alignItems: "center" }}
                        >
                          <Upload size={12} style={{ marginRight: "4px" }} />
                          {uploadingItemId === item.id ? "Attaching..." : "Upload Doc"}
                        </label>
                      </>
                    ) : (
                      <span style={{ fontSize: "12.5px", color: "#16a34a", fontWeight: 600 }}>Verified</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Regulatory Evidence */}
      {evidence && evidence.length > 0 && (
        <div className="customs-citations-card">
          <div className="customs-citations-title">Applicable Trade Legislation &amp; Legal Evidence</div>
          {evidence.map((chunk, idx) => (
            <div className="citation-item" key={idx}>
              <div className="citation-header">
                <span>{chunk.section_name}</span>
                <span style={{ color: "#0284c7" }}>{chunk.authority}</span>
              </div>
              <div className="citation-body">{chunk.content}</div>
            </div>
          ))}
        </div>
      )}

      {/* Officer Sign-off Bar */}
      <div className="officer-signoff-bar">
        <div className="officer-desc">
          <h4>Customs Compliance Review &amp; Sign-off</h4>
          <p>
            Officer: <strong>{compliance?.reviewed_by || officerName}</strong> &bull; Quote Gating:{" "}
            <strong>{status === "APPROVED" ? "Eligible for Issuance" : "Blocked until Clearance Approval"}</strong>
          </p>
        </div>

        <div className="officer-btn-group">
          <button
            type="button"
            className="agent-action-btn"
            style={{ background: "#16a34a" }}
            onClick={() => handleSignOff("APPROVED")}
          >
            Approve Clearance
          </button>
          <button
            type="button"
            className="agent-btn-sm"
            style={{ background: "#fee2e2", color: "#b91c1c", borderColor: "#fca5a5" }}
            onClick={() => handleSignOff("REJECTED")}
          >
            Reject Shipment
          </button>
        </div>
      </div>
    </div>
  );
}
