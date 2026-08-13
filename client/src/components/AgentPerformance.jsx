import { useState } from "react";
import { FaCheckCircle } from "react-icons/fa";
import "./AgentPerformance.css";

const MOCK_CLIENTS = [
  { id: "CL-101", name: "Nexus Global Corp", type: "Enterprise", totalSpent: "₹18,40,000", quotesCount: 14, status: "Active Premium" },
  { id: "CL-102", name: "Apex Transports Ltd", type: "Business", totalSpent: "₹12,20,000", quotesCount: 9, status: "Active" },
  { id: "CL-103", name: "Horizon Marine Exports", type: "Business", totalSpent: "₹6,80,000", quotesCount: 5, status: "Active" },
  { id: "CL-104", name: "Rajesh Kumar", type: "Retail", totalSpent: "₹1,45,000", quotesCount: 2, status: "Standard" },
];

const MOCK_TICKETS = [
  { id: "TCK-801", client: "Nexus Global Corp", subject: "Customs Duty Query for Rotterdam Port", priority: "High", status: "Open" },
  { id: "TCK-802", client: "Apex Transports Ltd", subject: "Air Cargo Temperature Log Request", priority: "Medium", status: "In Progress" },
];

export default function AgentPerformance() {
  const [clients] = useState(MOCK_CLIENTS);
  const [tickets, setTickets] = useState(MOCK_TICKETS);

  function handleResolveTicket(id) {
    setTickets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "Resolved" } : t))
    );
  }

  return (
    <div className="agent-performance">
      <div className="desk-header">
        <div className="desk-title">
          <h1>Client CRM & Agent Commission Performance</h1>
          <p>Managed client portfolio, support tickets queue, and monthly revenue analytics</p>
        </div>
      </div>

      <div className="perf-grid">
        {/* Managed Clients List */}
        <div className="agent-panel-card">
          <div className="agent-panel-header">
            <h2 className="agent-panel-title">Assigned Client Accounts</h2>
          </div>

          <div className="agent-table-wrap">
            <table className="agent-table">
              <thead>
                <tr>
                  <th>Client ID</th>
                  <th>Client Name</th>
                  <th>Type</th>
                  <th>Total Spent</th>
                  <th>Quotes</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.id}</strong></td>
                    <td>{c.name}</td>
                    <td><span className="badge-status status-transit">{c.type}</span></td>
                    <td><strong style={{ color: "#00e6b8" }}>{c.totalSpent}</strong></td>
                    <td>{c.quotesCount} quotes</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Support Tickets Queue */}
        <div className="agent-panel-card">
          <div className="agent-panel-header">
            <h2 className="agent-panel-title">Assigned Client Support Tickets</h2>
          </div>

          <div className="agent-table-wrap">
            <table className="agent-table">
              <thead>
                <tr>
                  <th>Ticket ID</th>
                  <th>Client</th>
                  <th>Subject</th>
                  <th>Priority</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id}>
                    <td><strong>{t.id}</strong></td>
                    <td>{t.client}</td>
                    <td>
                      <div>{t.subject}</div>
                    </td>
                    <td>
                      <span
                        className={`badge-status ${
                          t.priority === "High" ? "status-pending" : "status-transit"
                        }`}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td>
                      {t.status === "Resolved" ? (
                        <span style={{ color: "#059669", fontSize: "12px", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <FaCheckCircle /> Resolved
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="agent-btn-sm"
                          onClick={() => handleResolveTicket(t.id)}
                        >
                          Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
