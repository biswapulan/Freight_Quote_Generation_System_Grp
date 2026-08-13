import { useState } from "react";
import "./AgentQuoteDesk.css";

const INITIAL_QUOTES = [
  {
    id: "FQ-8921",
    client: "Nexus Global Corp",
    clientEmail: "ops@nexusglobal.com",
    origin: "Mumbai Port (INBOM)",
    destination: "Rotterdam (NLRTM)",
    mode: "Ocean FCL (40ft High Cube)",
    cargoClass: "General Electronics",
    weightKg: 14500,
    baseRate: 210000,
    marginPct: 10,
    fuelSurchargePct: 8,
    portFee: 15000,
    status: "Pending Review",
    requestedDate: "2026-08-12",
  },
  {
    id: "FQ-8922",
    client: "Apex Transports Ltd",
    clientEmail: "logistics@apextrans.com",
    origin: "Delhi Airport (DEL)",
    destination: "Frankfurt Airport (FRA)",
    mode: "Air Cargo Express",
    cargoClass: "Pharma / Cold Chain",
    weightKg: 850,
    baseRate: 155000,
    marginPct: 12,
    fuelSurchargePct: 10,
    portFee: 8000,
    status: "Pending Review",
    requestedDate: "2026-08-12",
  },
  {
    id: "FQ-8919",
    client: "Horizon Marine Exports",
    clientEmail: "export@horizonmarine.in",
    origin: "Chennai Port (INMAA)",
    destination: "Hamburg (DEHAM)",
    mode: "Ocean LCL",
    cargoClass: "Textiles & Apparel",
    weightKg: 4200,
    baseRate: 110000,
    marginPct: 15,
    fuelSurchargePct: 6,
    portFee: 12000,
    status: "Approved",
    requestedDate: "2026-08-11",
  },
];

export default function AgentQuoteDesk() {
  const [quotes, setQuotes] = useState(INITIAL_QUOTES);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [activeModalQuote, setActiveModalQuote] = useState(null);
  const [marginPct, setMarginPct] = useState(10);
  const [fuelPct, setFuelPct] = useState(8);
  const [portFee, setPortFee] = useState(15000);

  function openPricingModal(q) {
    setActiveModalQuote(q);
    setMarginPct(q.marginPct || 10);
    setFuelPct(q.fuelSurchargePct || 8);
    setPortFee(q.portFee || 12000);
  }

  function handleSaveQuote() {
    if (!activeModalQuote) return;
    setQuotes((prev) =>
      prev.map((q) =>
        q.id === activeModalQuote.id
          ? {
              ...q,
              marginPct: Number(marginPct),
              fuelSurchargePct: Number(fuelPct),
              portFee: Number(portFee),
              status: "Approved",
            }
          : q
      )
    );
    setActiveModalQuote(null);
  }

  const filteredQuotes = quotes.filter((q) => {
    const matchesSearch =
      q.id.toLowerCase().includes(search.toLowerCase()) ||
      q.client.toLowerCase().includes(search.toLowerCase()) ||
      q.origin.toLowerCase().includes(search.toLowerCase()) ||
      q.destination.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "All" || q.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  function calculateFinalCost(q, mPct = q.marginPct, fPct = q.fuelSurchargePct, pFee = q.portFee) {
    const marginAmount = q.baseRate * (mPct / 100);
    const fuelAmount = q.baseRate * (fPct / 100);
    return Math.round(q.baseRate + marginAmount + fuelAmount + pFee);
  }

  return (
    <div className="agent-quote-desk">
      <div className="desk-header">
        <div className="desk-title">
          <h1>Agent Quote Desk & Pricing Engine</h1>
          <p>Review customer freight quote requests, adjust agent margins, and issue binding quotes</p>
        </div>

        <div className="desk-controls">
          <input
            type="text"
            className="desk-search-input"
            placeholder="Search quotes, clients, ports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="desk-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="Pending Review">Pending Review</option>
            <option value="Approved">Approved</option>
          </select>
        </div>
      </div>

      <div className="agent-panel-card">
        <div className="agent-table-wrap">
          <table className="agent-table">
            <thead>
              <tr>
                <th>Quote ID</th>
                <th>Client & Contact</th>
                <th>Origin & Destination</th>
                <th>Mode / Cargo</th>
                <th>Base Cost</th>
                <th>Margin / Fees</th>
                <th>Final Quote</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotes.map((q) => {
                const finalCost = calculateFinalCost(q);
                return (
                  <tr key={q.id}>
                    <td><strong>{q.id}</strong></td>
                    <td>
                      <div>{q.client}</div>
                      <small style={{ color: "#64748b" }}>{q.clientEmail}</small>
                    </td>
                    <td>
                      <div style={{ fontWeight: "600" }}>{q.origin}</div>
                      <small style={{ color: "#0284c7", fontWeight: "700" }}>&rarr; {q.destination}</small>
                    </td>
                    <td>
                      <div>{q.mode}</div>
                      <small style={{ color: "#64748b", fontWeight: "500" }}>{q.cargoClass} ({q.weightKg} kg)</small>
                    </td>
                    <td>₹{q.baseRate.toLocaleString("en-IN")}</td>
                    <td>
                      <div>Margin: {q.marginPct}%</div>
                      <small style={{ color: "#64748b" }}>Fuel: {q.fuelSurchargePct}%</small>
                    </td>
                    <td>
                      <strong style={{ color: "#059669", fontSize: "15px" }}>
                        ₹{finalCost.toLocaleString("en-IN")}
                      </strong>
                    </td>
                    <td>
                      <span
                        className={`badge-status ${
                          q.status === "Pending Review" ? "status-pending" : "status-approved"
                        }`}
                      >
                        {q.status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="agent-btn-sm"
                        onClick={() => openPricingModal(q)}
                      >
                        {q.status === "Approved" ? "Edit Pricing" : "Review & Price"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pricing Adjustment Modal */}
      {activeModalQuote && (
        <div className="modal-backdrop" onClick={() => setActiveModalQuote(null)}>
          <div className="pricing-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Adjust Quote Pricing ({activeModalQuote.id})</h3>
            <p style={{ color: "#94a3b8", fontSize: "13px", marginTop: "-10px", marginBottom: "20px" }}>
              Client: {activeModalQuote.client} ({activeModalQuote.origin} to {activeModalQuote.destination})
            </p>

            <div className="modal-form-grid">
              <div className="modal-field">
                <label>Base Freight Cost (₹)</label>
                <input type="number" value={activeModalQuote.baseRate} disabled readOnly />
              </div>

              <div className="modal-field">
                <label>Agent Margin (%)</label>
                <input
                  type="number"
                  value={marginPct}
                  onChange={(e) => setMarginPct(e.target.value)}
                />
              </div>

              <div className="modal-field">
                <label>Fuel Surcharge (%)</label>
                <input
                  type="number"
                  value={fuelPct}
                  onChange={(e) => setFuelPct(e.target.value)}
                />
              </div>

              <div className="modal-field">
                <label>Port & Handling Fee (₹)</label>
                <input
                  type="number"
                  value={portFee}
                  onChange={(e) => setPortFee(e.target.value)}
                />
              </div>
            </div>

            <div className="price-summary-box">
              <div className="price-row">
                <span>Base Carrier Rate:</span>
                <span>₹{activeModalQuote.baseRate.toLocaleString("en-IN")}</span>
              </div>
              <div className="price-row">
                <span>Agent Margin ({marginPct}%):</span>
                <span>₹{Math.round(activeModalQuote.baseRate * (marginPct / 100)).toLocaleString("en-IN")}</span>
              </div>
              <div className="price-row">
                <span>Fuel Surcharge ({fuelPct}%):</span>
                <span>₹{Math.round(activeModalQuote.baseRate * (fuelPct / 100)).toLocaleString("en-IN")}</span>
              </div>
              <div className="price-row">
                <span>Port Terminal Handling Fee:</span>
                <span>₹{Number(portFee).toLocaleString("en-IN")}</span>
              </div>
              <div className="price-row total">
                <span>Binding Quote Price:</span>
                <span>
                  ₹{calculateFinalCost(activeModalQuote, marginPct, fuelPct, portFee).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setActiveModalQuote(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-approve"
                onClick={handleSaveQuote}
              >
                Approve & Issue Quote
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
