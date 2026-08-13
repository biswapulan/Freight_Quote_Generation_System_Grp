import { useState } from "react";
import { Link } from "react-router-dom";
import { FaClipboardList, FaShip, FaDollarSign, FaWallet, FaArrowRight } from "react-icons/fa";
import "./AgentOverview.css";

const MOCK_QUOTES = [
  {
    id: "FQ-8921",
    client: "Nexus Global Corp",
    type: "Business",
    origin: "Mumbai Port (INBOM)",
    destination: "Rotterdam (NLRTM)",
    mode: "Ocean FCL",
    weight: "14,500 kg",
    estCost: "₹2,45,000",
    status: "Pending Review",
    date: "12 Aug, 09:30 AM",
  },
  {
    id: "FQ-8922",
    client: "Apex Transports Ltd",
    type: "Business",
    origin: "Delhi Airport (DEL)",
    destination: "Frankfurt (FRA)",
    mode: "Air Cargo Express",
    weight: "850 kg",
    estCost: "₹1,82,000",
    status: "Pending Review",
    date: "12 Aug, 08:15 AM",
  },
  {
    id: "FQ-8920",
    client: "Rajesh Kumar",
    type: "Retail",
    origin: "Chennai Port (INMAA)",
    destination: "Singapore (SGSIN)",
    mode: "Ocean LCL",
    weight: "2,100 kg",
    estCost: "₹68,500",
    status: "Approved",
    date: "11 Aug, 04:45 PM",
  },
  {
    id: "FQ-8918",
    client: "Zenith Industrial Spares",
    type: "Business",
    origin: "Nhava Sheva (INNSA)",
    destination: "Jebel Ali (AEJEA)",
    mode: "Ocean FCL",
    weight: "22,000 kg",
    estCost: "₹1,95,000",
    status: "In-Transit",
    date: "11 Aug, 02:20 PM",
  },
];

export default function AgentOverview() {
  const [quotes, setQuotes] = useState(MOCK_QUOTES);

  function handleQuickApprove(id) {
    setQuotes((prev) =>
      prev.map((q) => (q.id === id ? { ...q, status: "Approved" } : q))
    );
  }

  return (
    <div className="agent-overview">
      {/* Header Banner */}
      <div className="agent-header-banner">
        <div className="agent-title-block">
          <h1>Freight Agent Command Center</h1>
          <p>Real-time logistics quote desk, dispatch queue & carrier performance monitoring</p>
        </div>
        <div className="agent-badge-tag">
          <span className="agent-badge-dot" />
          Freight Forwarder Operations
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="agent-kpi-grid">
        <div className="agent-kpi-card">
          <div className="agent-kpi-top">
            <span className="agent-kpi-label">Pending Quote Reviews</span>
            <div className="agent-kpi-icon icon-amber"><FaClipboardList /></div>
          </div>
          <div className="agent-kpi-value">14</div>
          <div className="agent-kpi-sub">
            <span className="trend-up">↑ 3 new</span> since last hour
          </div>
        </div>

        <div className="agent-kpi-card">
          <div className="agent-kpi-top">
            <span className="agent-kpi-label">Active Dispatches</span>
            <div className="agent-kpi-icon icon-cyan"><FaShip /></div>
          </div>
          <div className="agent-kpi-value">38</div>
          <div className="agent-kpi-sub">In-transit across 12 ports</div>
        </div>

        <div className="agent-kpi-card">
          <div className="agent-kpi-top">
            <span className="agent-kpi-label">Monthly Gross Margin</span>
            <div className="agent-kpi-icon icon-teal"><FaDollarSign /></div>
          </div>
          <div className="agent-kpi-value">₹8,45,000</div>
          <div className="agent-kpi-sub">
            <span className="trend-up">↑ 18%</span> vs target
          </div>
        </div>

        <div className="agent-kpi-card">
          <div className="agent-kpi-top">
            <span className="agent-kpi-label">Agent Commission (Est)</span>
            <div className="agent-kpi-icon icon-purple"><FaWallet /></div>
          </div>
          <div className="agent-kpi-value">₹1,26,750</div>
          <div className="agent-kpi-sub">15% commission rate</div>
        </div>
      </div>

      {/* Overview Grid */}
      <div className="agent-overview-grid">
        {/* Main Table Panel */}
        <div className="agent-panel-card">
          <div className="agent-panel-header">
            <h2 className="agent-panel-title">Urgent Quote Action Queue</h2>
            <Link to="/dashboard/quote-desk" className="agent-action-btn">
              Open Full Quote Desk &rarr;
            </Link>
          </div>

          <div className="agent-table-wrap">
            <table className="agent-table">
              <thead>
                <tr>
                  <th>Quote Ref</th>
                  <th>Client</th>
                  <th>Route</th>
                  <th>Mode / Weight</th>
                  <th>Est Value</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id}>
                    <td><strong>{q.id}</strong></td>
                    <td>
                      <div>{q.client}</div>
                      <small style={{ color: "#64748b" }}>{q.type}</small>
                    </td>
                    <td>
                      <div style={{ fontSize: "12.5px", fontWeight: "600" }}>{q.origin}</div>
                      <div style={{ color: "#0284c7", fontSize: "11.5px", fontWeight: "700" }}>&rarr; {q.destination}</div>
                    </td>
                    <td>
                      <div>{q.mode}</div>
                      <small style={{ color: "#64748b", fontWeight: "500" }}>{q.weight}</small>
                    </td>
                    <td><strong>{q.estCost}</strong></td>
                    <td>
                      <span
                        className={`badge-status ${
                          q.status === "Pending Review"
                            ? "status-pending"
                            : q.status === "Approved"
                            ? "status-approved"
                            : "status-transit"
                        }`}
                      >
                        {q.status}
                      </span>
                    </td>
                    <td>
                      {q.status === "Pending Review" ? (
                        <button
                          type="button"
                          className="agent-btn-sm"
                          onClick={() => handleQuickApprove(q.id)}
                        >
                          Approve
                        </button>
                      ) : (
                        <span style={{ color: "#64748b", fontSize: "12px" }}>Processed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Capacity & Carrier Status Sidebar Panel */}
        <div className="agent-panel-card">
          <div className="agent-panel-header">
            <h2 className="agent-panel-title">Live Carrier Allocation</h2>
          </div>

          <div className="capacity-list">
            <div className="capacity-item">
              <div className="capacity-label">
                <span>Maersk Ocean Lines</span>
                <span>88% Full</span>
              </div>
              <div className="capacity-bar-bg">
                <div className="capacity-bar-fill" style={{ width: "88%", background: "#0284c7" }} />
              </div>
            </div>

            <div className="capacity-item">
              <div className="capacity-label">
                <span>Lufthansa Air Cargo</span>
                <span>64% Full</span>
              </div>
              <div className="capacity-bar-bg">
                <div className="capacity-bar-fill" style={{ width: "64%", background: "#059669" }} />
              </div>
            </div>

            <div className="capacity-item">
              <div className="capacity-label">
                <span>DHL Express Fleet</span>
                <span>92% Full</span>
              </div>
              <div className="capacity-bar-bg">
                <div className="capacity-bar-fill" style={{ width: "92%", background: "#d97706" }} />
              </div>
            </div>

            <div className="capacity-item">
              <div className="capacity-label">
                <span>Indian Railways Container (CONCOR)</span>
                <span>54% Full</span>
              </div>
              <div className="capacity-bar-bg">
                <div className="capacity-bar-fill" style={{ width: "54%", background: "#9333ea" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
