import { useState } from "react";
import { FaStar, FaCheckCircle, FaLock } from "react-icons/fa";
import "./AgentSpotRates.css";

const SPOT_RATES_DATA = [
  {
    id: "SR-101",
    carrier: "Maersk Ocean Line",
    mode: "Ocean FCL (40ft HC)",
    route: "Mumbai (INBOM) → Rotterdam (NLRTM)",
    transitDays: "18-22 Days",
    spotCost: 195000,
    validUntil: "15 Aug 2026",
    availableTEU: 42,
    rating: "4.9",
    isLocked: false,
  },
  {
    id: "SR-102",
    carrier: "MSC Mediterranean Shipping",
    mode: "Ocean FCL (40ft HC)",
    route: "Mumbai (INBOM) → Rotterdam (NLRTM)",
    transitDays: "20-24 Days",
    spotCost: 182000,
    validUntil: "14 Aug 2026",
    availableTEU: 18,
    rating: "4.7",
    isLocked: false,
  },
  {
    id: "SR-103",
    carrier: "Lufthansa Cargo Express",
    mode: "Air Cargo",
    route: "Delhi (DEL) → Frankfurt (FRA)",
    transitDays: "1-2 Days",
    spotCost: 142000,
    validUntil: "13 Aug 2026",
    availableTEU: 8,
    rating: "4.9",
    isLocked: false,
  },
  {
    id: "SR-104",
    carrier: "CMA CGM Group",
    mode: "Ocean LCL",
    route: "Chennai (INMAA) → Singapore (SGSIN)",
    transitDays: "5-7 Days",
    spotCost: 54000,
    validUntil: "16 Aug 2026",
    availableTEU: 95,
    rating: "4.8",
    isLocked: false,
  },
];

export default function AgentSpotRates() {
  const [rates, setRates] = useState(SPOT_RATES_DATA);
  const [modeFilter, setModeFilter] = useState("All");

  function handleLockBooking(id) {
    setRates((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isLocked: true } : r))
    );
  }

  const filteredRates = rates.filter(
    (r) => modeFilter === "All" || r.mode.toLowerCase().includes(modeFilter.toLowerCase())
  );

  return (
    <div className="agent-spot-rates">
      <div className="desk-header">
        <div className="desk-title">
          <h1>Carrier Spot Rate Matrix & Bidding</h1>
          <p>Real-time ocean, air & surface freight spot rate comparison for margin optimization</p>
        </div>

        <div className="desk-controls">
          <select
            className="desk-select"
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
          >
            <option value="All">All Transport Modes</option>
            <option value="Ocean">Ocean Freight</option>
            <option value="Air">Air Freight</option>
          </select>
        </div>
      </div>

      <div className="spot-matrix-grid">
        {filteredRates.map((r) => (
          <div key={r.id} className="spot-card">
            <div className="spot-card-header">
              <span className="carrier-name">{r.carrier}</span>
              <span className="validity-tag">Expires {r.validUntil}</span>
            </div>

            <div style={{ fontSize: "13px", color: "#0284c7", fontWeight: "700" }}>
              {r.route}
            </div>
            <div style={{ fontSize: "12.5px", color: "#64748b", marginTop: "4px", fontWeight: "500" }}>
              Mode: {r.mode} | Transit: {r.transitDays}
            </div>

            <div className="spot-rate-value">
              ₹{r.spotCost.toLocaleString("en-IN")}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#475569", fontWeight: "600", marginBottom: "16px" }}>
              <span>Capacity Available: {r.availableTEU} units</span>
              <span style={{ color: "#d97706", fontWeight: "800", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                {r.rating} <FaStar style={{ fontSize: "11px" }} />
              </span>
            </div>

            {r.isLocked ? (
              <button
                type="button"
                className="agent-action-btn"
                style={{ width: "100%", background: "#059669", cursor: "default", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              >
                <FaCheckCircle /> Spot Rate Locked & Booked
              </button>
            ) : (
              <button
                type="button"
                className="agent-action-btn"
                style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                onClick={() => handleLockBooking(r.id)}
              >
                <FaLock /> Lock Spot Rate & Book Carrier
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
