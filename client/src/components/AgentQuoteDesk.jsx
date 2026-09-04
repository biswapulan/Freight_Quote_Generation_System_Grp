import { useState, useEffect } from "react";
import { AlertTriangle, ShieldCheck, CheckCircle2, Send, FileCheck } from "lucide-react";
import {
  getPlatformQuotes,
  updateQuoteStatusInStore,
  STATUS_CONFIG,
  normalizeWorkflowStatus,
} from "../utils/quoteWorkflow";
import QuoteWorkflowStepper from "./QuoteWorkflowStepper";
import "./AgentQuoteDesk.css";

export default function AgentQuoteDesk() {
  const [quotes, setQuotes] = useState(() => getPlatformQuotes());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [activeModalQuote, setActiveModalQuote] = useState(null);
  const [marginPct, setMarginPct] = useState(10);
  const [fuelPct, setFuelPct] = useState(8);
  const [portFee, setPortFee] = useState(15000);
  const [actionNotice, setActionNotice] = useState(null);

  useEffect(() => {
    function refresh() {
      setQuotes(getPlatformQuotes());
    }
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  function openPricingModal(q) {
    setActiveModalQuote(q);
    setMarginPct(q.marginPct || 10);
    setFuelPct(q.fuelSurchargePct || 8);
    setPortFee(q.portFee || 15000);
  }

  function handleApproveOnly() {
    if (!activeModalQuote) return;
    const finalAmount = calculateFinalCost(activeModalQuote, marginPct, fuelPct, portFee);
    const updated = updateQuoteStatusInStore(
      activeModalQuote.id || activeModalQuote.quoteNo,
      "APPROVED",
      {
        marginPct: Number(marginPct),
        fuelSurchargePct: Number(fuelPct),
        portFee: Number(portFee),
        totalNum: finalAmount,
        totalFormatted: `₹ ${finalAmount.toLocaleString("en-IN")}`,
        agentRemarks: `Commercial margin (${marginPct}%) approved by Operations Desk. Ready to dispatch.`,
        shipmentStatus: "ANALYZED",
      }
    );
    setQuotes(updated);
    setActionNotice(`Quote ${activeModalQuote.id || activeModalQuote.quoteNo} commercials APPROVED.`);
    setActiveModalQuote(null);
    setTimeout(() => setActionNotice(null), 4000);
  }

  function handleSaveQuote() {
    if (!activeModalQuote) return;
    const finalAmount = calculateFinalCost(activeModalQuote, marginPct, fuelPct, portFee);
    const newStatus = "SENT";

    const updated = updateQuoteStatusInStore(
      activeModalQuote.id || activeModalQuote.quoteNo,
      newStatus,
      {
        marginPct: Number(marginPct),
        fuelSurchargePct: Number(fuelPct),
        portFee: Number(portFee),
        totalNum: finalAmount,
        totalFormatted: `₹ ${finalAmount.toLocaleString("en-IN")}`,
        agentRemarks: `Commercial margin (${marginPct}%) validated by Operations Desk. Final official quotation dispatched to customer.`,
        finalQuoteSentAt: new Date().toISOString(),
        shipmentStatus: "QUOTED",
      }
    );

    setQuotes(updated);
    setActionNotice(`Final Quotation for ${activeModalQuote.id || activeModalQuote.quoteNo} dispatched to Customer with status: SENT`);
    setActiveModalQuote(null);
    setTimeout(() => setActionNotice(null), 4000);
  }

  const filteredQuotes = quotes.filter((q) => {
    const qId = q.id || q.quoteNo || "";
    const client = q.customerName || q.client || "";
    const origin = q.origin || "";
    const dest = q.destination || "";

    const matchesSearch =
      qId.toLowerCase().includes(search.toLowerCase()) ||
      client.toLowerCase().includes(search.toLowerCase()) ||
      origin.toLowerCase().includes(search.toLowerCase()) ||
      dest.toLowerCase().includes(search.toLowerCase());

    const normStatus = normalizeWorkflowStatus(q.status);
    const matchesStatus =
      statusFilter === "All" ||
      normStatus === statusFilter ||
      q.status === statusFilter;

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
          <h1>Milestone 2 — Broker Pricing &amp; Quotation Dashboard</h1>
          <p>Review customer freight requests, calculate operational costs, enforce margin policies, and issue dynamic binding quotes</p>
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

      {/* M2 Broker Dashboard KPIs specified in Section 11 */}
      <div className="m1-kpi-grid" style={{ marginBottom: "20px" }}>
        <div className="m1-kpi-card">
          <span className="m1-kpi-label">Total Shipments</span>
          <strong className="m1-kpi-val">120</strong>
        </div>
        <div className="m1-kpi-card">
          <span className="m1-kpi-label">Quotes Generated</span>
          <strong className="m1-kpi-val" style={{ color: "#0284c7" }}>85</strong>
        </div>
        <div className="m1-kpi-card">
          <span className="m1-kpi-label">Pending Quotes</span>
          <strong className="m1-kpi-val" style={{ color: "#ea580c" }}>20</strong>
        </div>
        <div className="m1-kpi-card">
          <span className="m1-kpi-label">Approved Quotes</span>
          <strong className="m1-kpi-val" style={{ color: "#16a34a" }}>60</strong>
        </div>
        <div className="m1-kpi-card">
          <span className="m1-kpi-label">Avg Freight Cost</span>
          <strong className="m1-kpi-val">₹1,58,000</strong>
        </div>
        <div className="m1-kpi-card">
          <span className="m1-kpi-label">Avg Quote</span>
          <strong className="m1-kpi-val" style={{ color: "#059669" }}>₹1,95,000</strong>
        </div>
        <div className="m1-kpi-card">
          <span className="m1-kpi-label">Avg Margin</span>
          <strong className="m1-kpi-val" style={{ color: "#7c3aed" }}>15%</strong>
        </div>
      </div>

      {actionNotice && (
        <div style={{ padding: "12px 16px", background: "rgba(34, 197, 94, 0.15)", border: "1px solid rgba(34, 197, 94, 0.3)", borderRadius: "10px", color: "#16a34a", fontSize: "13.5px", display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", fontWeight: "600" }}>
          <CheckCircle2 size={18} /> {actionNotice}
        </div>
      )}

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
                <th>Workflow Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotes.map((q) => {
                const finalCost = q.totalNum || calculateFinalCost(q);
                const normStatus = normalizeWorkflowStatus(q.status);
                const cfg = STATUS_CONFIG[normStatus] || STATUS_CONFIG.REQUESTED;

                return (
                  <tr key={q.id || q.quoteNo}>
                    <td><strong>{q.id || q.quoteNo}</strong></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{q.customerName || q.client}</div>
                      <small style={{ color: "#64748b" }}>{q.customerEmail || q.clientEmail}</small>
                    </td>
                    <td>
                      <div style={{ fontWeight: "600" }}>{q.origin}</div>
                      <small style={{ color: "#0284c7", fontWeight: "700" }}>&rarr; {q.destination}</small>
                    </td>
                    <td>
                      <div>{q.modeLabel || q.mode}</div>
                      <small style={{ color: "#64748b", fontWeight: "500" }}>{q.cargoType || q.cargoClass} ({q.weightKg || 12000} kg)</small>
                    </td>
                    <td>₹{Number(q.baseRate || 150000).toLocaleString("en-IN")}</td>
                    <td>
                      <div>Margin: {q.marginPct || 10}%</div>
                      <small style={{ color: "#64748b" }}>Fuel: {q.fuelSurchargePct || 8}%</small>
                    </td>
                    <td>
                      <strong style={{ color: "#059669", fontSize: "15px" }}>
                        ₹{Number(finalCost).toLocaleString("en-IN")}
                      </strong>
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "4px 10px",
                          borderRadius: "999px",
                          fontSize: "11.5px",
                          fontWeight: "700",
                          color: cfg.color,
                          backgroundColor: cfg.bg,
                          border: `1px solid ${cfg.color}30`,
                        }}
                      >
                        {cfg.label}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="agent-btn-sm"
                        onClick={() => openPricingModal(q)}
                      >
                        {normStatus === "FINAL_QUOTE_SENT" || normStatus === "ACCEPTED" ? "View / Edit" : "Review & Send"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pricing Adjustment & Final Quote Modal */}
      {activeModalQuote && (
        <div className="modal-backdrop" onClick={() => setActiveModalQuote(null)}>
          <div className="pricing-modal" style={{ maxWidth: "680px" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "18px", fontWeight: "800" }}>
              Freight Operations Review: {activeModalQuote.id || activeModalQuote.quoteNo}
            </h3>
            <p style={{ color: "#64748b", fontSize: "13px", marginTop: "0", marginBottom: "12px" }}>
              Client: <strong>{activeModalQuote.customerName || activeModalQuote.client}</strong> &bull; Route: {activeModalQuote.origin} &rarr; {activeModalQuote.destination}
            </p>

            {/* Visual Workflow Stepper */}
            <QuoteWorkflowStepper status={activeModalQuote.status} compact />

            {/* Customs Review Clearance Callout if available */}
            {activeModalQuote.customsRemarks && (
              <div style={{ background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: "10px", padding: "12px 14px", margin: "12px 0", fontSize: "13px", color: "#5b21b6", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: "2px", color: "#7c3aed" }} />
                <div>
                  <strong>Customs Compliance Sign-off:</strong>
                  <p style={{ margin: "2px 0 0 0", color: "#4c1d95" }}>{activeModalQuote.customsRemarks}</p>
                </div>
              </div>
            )}

            <div className="modal-form-grid" style={{ marginTop: "14px" }}>
              <div className="modal-field">
                <label>Base Carrier Freight (₹)</label>
                <input type="number" value={activeModalQuote.baseRate || 185000} disabled readOnly />
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
                <label>Fuel Surcharge / BAF (%)</label>
                <input
                  type="number"
                  value={fuelPct}
                  onChange={(e) => setFuelPct(e.target.value)}
                />
              </div>

              <div className="modal-field">
                <label>Port &amp; Terminal Fee (₹)</label>
                <input
                  type="number"
                  value={portFee}
                  onChange={(e) => setPortFee(e.target.value)}
                />
              </div>
            </div>

            {Number(marginPct) < 12.0 && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  padding: "12px",
                  margin: "14px 0",
                  color: "#991b1b",
                  fontSize: "13px",
                }}
              >
                <strong style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <AlertTriangle size={15} /> Commercial Margin Warning
                </strong>
                <p style={{ margin: "4px 0 0 0" }}>
                  Requested margin ({marginPct}%) is below standard floor policy (12.0%).
                </p>
              </div>
            )}

            <div className="price-summary-box" style={{ margin: "16px 0" }}>
              <div className="price-row">
                <span>Base Carrier Rate:</span>
                <span>₹{Number(activeModalQuote.baseRate || 185000).toLocaleString("en-IN")}</span>
              </div>
              <div className="price-row">
                <span>Agent Margin ({marginPct}%):</span>
                <span>₹{Math.round(Number(activeModalQuote.baseRate || 185000) * (marginPct / 100)).toLocaleString("en-IN")}</span>
              </div>
              <div className="price-row">
                <span>Fuel Surcharge ({fuelPct}%):</span>
                <span>₹{Math.round(Number(activeModalQuote.baseRate || 185000) * (fuelPct / 100)).toLocaleString("en-IN")}</span>
              </div>
              <div className="price-row">
                <span>Port &amp; Handling Fees:</span>
                <span>₹{Number(portFee).toLocaleString("en-IN")}</span>
              </div>
              <div className="price-row total-row">
                <span>Final Quotation to Customer:</span>
                <span>
                  ₹{calculateFinalCost(activeModalQuote, marginPct, fuelPct, portFee).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="agent-btn-secondary"
                onClick={() => setActiveModalQuote(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="agent-btn-secondary"
                style={{ background: "#ede9fe", color: "#6d28d9", border: "1px solid #ddd6fe", display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: "700" }}
                onClick={handleApproveOnly}
              >
                <FileCheck size={15} /> Approve Commercials
              </button>
              <button
                type="button"
                className="agent-btn-primary"
                style={{ background: "#0284c7", display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: "700" }}
                onClick={handleSaveQuote}
              >
                <Send size={15} /> Send Final Quote to Customer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
