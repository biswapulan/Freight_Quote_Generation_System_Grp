import React, { useState } from "react";
import "./M1RouteDashboard.css";
import { FaRoute, FaShip, FaClock, FaCheckCircle, FaExclamationCircle, FaExchangeAlt, FaTimes, FaStar } from "react-icons/fa";

const INITIAL_M1_SHIPMENTS = [
  {
    id: "SHP001",
    customer_id: "C001",
    customer: "ABC Logistics",
    origin: "Chennai (INMAA)",
    destination: "Singapore (SGSIN)",
    cargo_type: "Electronics",
    container_type: "40FT",
    transit_days: 6,
    carrier: "ABC Shipping",
    status: "Route Ready",
    route_options: [
      { code: "Route A", path: "Chennai → Singapore", transit: "6 Days", carrier: "ABC Shipping", is_recommended: true },
      { code: "Route B", path: "Chennai → Colombo → Singapore", transit: "8 Days", carrier: "XYZ Shipping", is_recommended: false },
      { code: "Route C", path: "Chennai → Dubai → Singapore", transit: "12 Days", carrier: "Global Marine", is_recommended: false },
    ],
  },
  {
    id: "SHP002",
    customer_id: "C002",
    customer: "XYZ Logistics",
    origin: "Chennai (INMAA)",
    destination: "Port of Jebel Ali (AEJEA)",
    cargo_type: "Machinery",
    container_type: "40HC",
    transit_days: 9,
    carrier: "XYZ Shipping",
    status: "Processing",
    route_options: [
      { code: "Route A", path: "Chennai → Dubai", transit: "9 Days", carrier: "XYZ Shipping", is_recommended: true },
      { code: "Route B", path: "Chennai → Muscat → Dubai", transit: "12 Days", carrier: "Gulf Feeder", is_recommended: false },
    ],
  },
  {
    id: "SHP003",
    customer_id: "C001",
    customer: "ABC Logistics",
    origin: "Nhava Sheva (INNSA)",
    destination: "Rotterdam (NLRTM)",
    cargo_type: "Automotive Parts",
    container_type: "20FT",
    transit_days: 22,
    carrier: "Emirates Line",
    status: "Route Ready",
    route_options: [
      { code: "Route A", path: "Nhava Sheva → Suez → Rotterdam", transit: "22 Days", carrier: "Emirates Line", is_recommended: true },
    ],
  },
];

export default function M1RouteDashboard() {
  const [shipments] = useState(INITIAL_M1_SHIPMENTS);
  const [selectedShipment, setSelectedShipment] = useState(null);

  return (
    <div className="m1-dashboard">
      <div className="agent-header-banner">
        <div className="agent-title-block">
          <h1>Milestone 1 — Route Intelligence Dashboard</h1>
          <p>Operational visibility into shipment route processing, carrier comparison, and transit recommendations</p>
        </div>
        <div className="agent-badge-tag">
          <span className="agent-badge-dot" />
          M1 Operational Mode
        </div>
      </div>

      {/* M1 KPI Cards specified in Spec Section 9 */}
      <div className="m1-kpi-grid">
        <div className="m1-kpi-card">
          <span className="m1-kpi-label">Total Shipments</span>
          <strong className="m1-kpi-val">120</strong>
        </div>
        <div className="m1-kpi-card">
          <span className="m1-kpi-label">Route Processing</span>
          <strong className="m1-kpi-val" style={{ color: "#0284c7" }}>25</strong>
        </div>
        <div className="m1-kpi-card">
          <span className="m1-kpi-label">Routes Recommended</span>
          <strong className="m1-kpi-val" style={{ color: "#16a34a" }}>82</strong>
        </div>
        <div className="m1-kpi-card">
          <span className="m1-kpi-label">Pending</span>
          <strong className="m1-kpi-val" style={{ color: "#ea580c" }}>13</strong>
        </div>
      </div>

      {/* Shipment Route Processing Table */}
      <div className="agent-panel-card">
        <div className="agent-panel-header md-workspace-header">
          <div className="md-header-left">
            <h2 className="agent-panel-title">Active Shipment Route Processing</h2>
            <span className="md-total-text">{shipments.length} Active Requests</span>
          </div>
        </div>

        <div className="agent-table-wrap">
          <table className="agent-table">
            <thead>
              <tr>
                <th>Shipment ID</th>
                <th>Customer</th>
                <th>Origin → Destination</th>
                <th>Cargo &amp; Container</th>
                <th>Est. Transit</th>
                <th>Carrier</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((shp) => (
                <tr key={shp.id}>
                  <td><strong>{shp.id}</strong></td>
                  <td>{shp.customer} <small style={{ color: "#64748b" }}>({shp.customer_id})</small></td>
                  <td>{shp.origin} &rarr; {shp.destination}</td>
                  <td>{shp.cargo_type} ({shp.container_type})</td>
                  <td>{shp.transit_days} Days</td>
                  <td>{shp.carrier}</td>
                  <td>
                    <span className={`badge-status ${shp.status === "Route Ready" ? "status-approved" : "status-pending"}`}>
                      {shp.status}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="agent-btn-sm"
                      onClick={() => setSelectedShipment(shp)}
                    >
                      <FaRoute /> Inspect Route Options
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* M1 Route Recommendation Inspector Modal */}
      {selectedShipment && (
        <div className="md-modal-backdrop" onClick={() => setSelectedShipment(null)}>
          <div className="md-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "700px" }}>
            <div className="md-modal-header">
              <h3>Shipment Details &amp; Route Intelligence — {selectedShipment.id}</h3>
              <button type="button" className="md-modal-close" onClick={() => setSelectedShipment(null)}>
                <FaTimes />
              </button>
            </div>

            <div className="m1-modal-body" style={{ padding: "20px" }}>
              <div className="m1-meta-box">
                <div><strong>Customer:</strong> {selectedShipment.customer} ({selectedShipment.customer_id})</div>
                <div><strong>Origin:</strong> {selectedShipment.origin}</div>
                <div><strong>Destination:</strong> {selectedShipment.destination}</div>
                <div><strong>Cargo:</strong> {selectedShipment.cargo_type} ({selectedShipment.container_type})</div>
              </div>

              <h4 style={{ margin: "20px 0 10px 0", color: "#0f172a" }}>Route Agent Generated Candidates:</h4>
              <div className="m1-routes-list">
                {selectedShipment.route_options.map((r, idx) => (
                  <div key={idx} className={`m1-route-card ${r.is_recommended ? "recommended" : ""}`}>
                    <div className="m1-route-header">
                      <span className="m1-route-code">{r.code}</span>
                      {r.is_recommended && (
                        <span className="m1-badge-rec" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <FaStar size={11} /> RECOMMENDED ROUTE
                        </span>
                      )}
                    </div>
                    <div className="m1-route-path">{r.path}</div>
                    <div className="m1-route-footer">
                      <span><FaClock /> Transit: <strong>{r.transit}</strong></span>
                      <span><FaShip /> Carrier: <strong>{r.carrier}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
