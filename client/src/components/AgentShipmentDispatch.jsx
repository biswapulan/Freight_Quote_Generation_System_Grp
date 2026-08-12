import { useState } from "react";
import { FaCheckCircle, FaDownload } from "react-icons/fa";
import "./AgentShipmentDispatch.css";

const INITIAL_SHIPMENTS = [
  {
    id: "SHP-9901",
    client: "Nexus Global Corp",
    trackingNo: "MAEU-98218491",
    carrier: "Maersk Line",
    origin: "Mumbai (INBOM)",
    destination: "Rotterdam (NLRTM)",
    currentMilestone: "In-Transit",
    eta: "2026-08-24",
    vessel: "Maersk Mc-Kinney Moller",
    containerNo: "MSKU-481920-4",
    bolIssued: true,
  },
  {
    id: "SHP-9902",
    client: "Apex Transports Ltd",
    trackingNo: "LH-7749120",
    carrier: "Lufthansa Cargo",
    origin: "Delhi (DEL)",
    destination: "Frankfurt (FRA)",
    currentMilestone: "Customs",
    eta: "2026-08-14",
    vessel: "Flight LH8220",
    containerNo: "AWB-020-8819201",
    bolIssued: true,
  },
  {
    id: "SHP-9903",
    client: "Zenith Industrial Spares",
    trackingNo: "MSC-6629104",
    carrier: "MSC Mediterranean Shipping",
    origin: "Nhava Sheva (INNSA)",
    destination: "Jebel Ali (AEJEA)",
    currentMilestone: "Dispatched",
    eta: "2026-08-18",
    vessel: "MSC Oscar",
    containerNo: "MEDU-992014-1",
    bolIssued: false,
  },
];

const CARRIERS_LIST = [
  "Maersk Line",
  "MSC Mediterranean Shipping",
  "CMA CGM Group",
  "Hapag-Lloyd",
  "Lufthansa Cargo",
  "DHL Global Forwarding",
  "CONCOR Rail Express",
];

const MILESTONES = ["Booked", "Dispatched", "In-Transit", "Customs Cleared", "Out for Delivery", "Delivered"];

export default function AgentShipmentDispatch() {
  const [shipments, setShipments] = useState(INITIAL_SHIPMENTS);
  const [selectedShipment, setSelectedShipment] = useState(INITIAL_SHIPMENTS[0]);

  function handleMilestoneChange(shipmentId, newMilestone) {
    setShipments((prev) =>
      prev.map((s) => (s.id === shipmentId ? { ...s, currentMilestone: newMilestone } : s))
    );
    if (selectedShipment && selectedShipment.id === shipmentId) {
      setSelectedShipment((prev) => ({ ...prev, currentMilestone: newMilestone }));
    }
  }

  function handleCarrierChange(shipmentId, newCarrier) {
    setShipments((prev) =>
      prev.map((s) => (s.id === shipmentId ? { ...s, carrier: newCarrier } : s))
    );
    if (selectedShipment && selectedShipment.id === shipmentId) {
      setSelectedShipment((prev) => ({ ...prev, carrier: newCarrier }));
    }
  }

  function handleIssueBOL(shipmentId) {
    setShipments((prev) =>
      prev.map((s) => (s.id === shipmentId ? { ...s, bolIssued: true } : s))
    );
    if (selectedShipment && selectedShipment.id === shipmentId) {
      setSelectedShipment((prev) => ({ ...prev, bolIssued: true }));
    }
  }

  return (
    <div className="agent-dispatch">
      <div className="desk-header">
        <div className="desk-title">
          <h1>Shipment Dispatch & Operations Desk</h1>
          <p>Carrier assignment, milestone status updates, and Bill of Lading (BOL) issuance</p>
        </div>
      </div>

      <div className="dispatch-grid">
        {/* Left: Shipments List */}
        <div className="agent-panel-card">
          <div className="agent-panel-header">
            <h2 className="agent-panel-title">Active Managed Dispatches</h2>
          </div>

          <div className="agent-table-wrap">
            <table className="agent-table">
              <thead>
                <tr>
                  <th>Shipment Ref</th>
                  <th>Client</th>
                  <th>Carrier</th>
                  <th>Route</th>
                  <th>Milestone</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((s) => (
                  <tr
                    key={s.id}
                    style={{
                      background:
                        selectedShipment?.id === s.id
                          ? "rgba(0, 180, 216, 0.08)"
                          : "transparent",
                    }}
                  >
                    <td><strong>{s.id}</strong></td>
                    <td>{s.client}</td>
                    <td>{s.carrier}</td>
                    <td>
                      <div style={{ fontWeight: "600" }}>{s.origin}</div>
                      <small style={{ color: "#0284c7", fontWeight: "700" }}>&rarr; {s.destination}</small>
                    </td>
                    <td>
                      <span className="badge-status status-transit">
                        {s.currentMilestone}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="agent-btn-sm"
                        onClick={() => setSelectedShipment(s)}
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Selected Shipment Control Panel */}
        {selectedShipment && (
          <div className="agent-panel-card">
            <div className="agent-panel-header">
              <h2 className="agent-panel-title">Dispatch Control ({selectedShipment.id})</h2>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "13.5px", color: "#1e293b", marginBottom: "4px" }}>
                <strong>Client:</strong> {selectedShipment.client}
              </div>
              <div style={{ fontSize: "12.5px", color: "#64748b" }}>
                <strong>Tracking No:</strong> {selectedShipment.trackingNo} | <strong>ETA:</strong> {selectedShipment.eta}
              </div>
            </div>

            {/* Split Control Body: Form Left, Vertical Milestone Stepper Right */}
            <div className="dispatch-control-body">
              {/* Form Controls Left */}
              <div className="dispatch-form-left">
                <div className="modal-field">
                  <label style={{ fontSize: "12.5px" }}>Update Milestone Status:</label>
                  <select
                    className="desk-select"
                    value={selectedShipment.currentMilestone}
                    onChange={(e) => handleMilestoneChange(selectedShipment.id, e.target.value)}
                  >
                    {MILESTONES.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div className="modal-field">
                  <label style={{ fontSize: "12.5px" }}>Assigned Freight Carrier:</label>
                  <select
                    className="desk-select"
                    value={selectedShipment.carrier}
                    onChange={(e) => handleCarrierChange(selectedShipment.id, e.target.value)}
                  >
                    {CARRIERS_LIST.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Vertical Milestone Progress Right */}
              <div className="dispatch-timeline-vertical">
                {MILESTONES.map((m, idx) => {
                  const currentIdx = MILESTONES.indexOf(selectedShipment.currentMilestone);
                  const isCompleted = idx < currentIdx;
                  const isActive = idx === currentIdx;

                  return (
                    <div
                      key={m}
                      className={`vstep-node ${isCompleted ? "completed" : ""} ${isActive ? "active" : ""}`}
                    >
                      <div className="vstep-indicator">
                        <div className="vstep-circle">{idx + 1}</div>
                        {idx < MILESTONES.length - 1 && (
                          <div className={`vstep-line ${isCompleted ? "completed" : ""}`} />
                        )}
                      </div>
                      <span className="vstep-label">{m}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Action: Bill of Lading (Unchanged) */}
            <div style={{ paddingTop: "14px", marginTop: "16px", borderTop: "1px solid #e2e8f0" }}>
              {selectedShipment.bolIssued ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap", color: "#059669", fontWeight: "700" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <FaCheckCircle style={{ fontSize: "15px" }} />
                    <span style={{ fontSize: "13px" }}>Bill of Lading (BOL) Issued</span>
                  </div>
                  <button
                    type="button"
                    className="agent-btn-sm"
                    style={{ padding: "6px 12px", fontSize: "12px", whiteSpace: "nowrap" }}
                    onClick={() => alert(`Downloading BOL for ${selectedShipment.id}...`)}
                  >
                    <FaDownload style={{ marginRight: "4px" }} /> Download Document
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="agent-action-btn"
                  style={{ width: "100%" }}
                  onClick={() => handleIssueBOL(selectedShipment.id)}
                >
                  Generate & Issue Bill of Lading (BOL)
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
