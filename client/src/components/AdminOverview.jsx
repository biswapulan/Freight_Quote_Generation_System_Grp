import React from "react";
import { Link } from "react-router-dom";
import {
  Sliders,
  Users,
  Database,
  Cpu,
  TrendingUp,
  FileText,
  ShieldCheck,
  Globe,
  ArrowRight,
  Activity,
  CheckCircle,
} from "lucide-react";
import "./AdminOverview.css";

const RECENT_PLATFORM_QUOTES = [
  {
    id: "FQ-9042",
    company: "Apex Exports Pvt Ltd",
    userType: "Business",
    route: "Chennai (INMAA) → Rotterdam (NLRTM)",
    mode: "Ocean FCL",
    weight: "12,500 kg",
    amount: "₹ 1,48,500",
    risk: "Low (18/100)",
    status: "Approved",
  },
  {
    id: "FQ-9041",
    company: "Zenith Global Logistics",
    userType: "Business",
    route: "Nhava Sheva (INNSA) → New York (USNYC)",
    mode: "Ocean FCL",
    weight: "18,200 kg",
    amount: "₹ 2,15,000",
    risk: "Medium (42/100)",
    status: "Pending",
  },
  {
    id: "FQ-9040",
    company: "Reliance Retail Direct",
    userType: "Retail",
    route: "Delhi Airport (DEL) → Frankfurt (FRA)",
    mode: "Air Cargo",
    weight: "850 kg",
    amount: "₹ 96,400",
    risk: "Low (12/100)",
    status: "In-Transit",
  },
  {
    id: "FQ-9039",
    company: "Tata Precision Spares",
    userType: "Business",
    route: "Shanghai (CNSHA) → Los Angeles (USLAX)",
    mode: "Ocean FCL",
    weight: "22,000 kg",
    amount: "₹ 3,42,000",
    risk: "Low (15/100)",
    status: "Approved",
  },
];

export default function AdminOverview() {
  return (
    <div className="admin-overview">
      {/* Header Banner */}
      <div className="admin-header-banner">
        <div className="admin-title-block">
          <h1>Administrator Executive Command Center</h1>
          <p>
            Platform-wide system health, dynamic rate governance, user access management, and live freight quotation telemetry.
          </p>
        </div>
        <div className="admin-badge-tag">
          <span className="admin-badge-dot" />
          <ShieldCheck size={14} /> Platform Admin Active
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <div className="admin-kpi-top">
            <span className="admin-kpi-label">Total Platform Quotes</span>
            <div className="admin-kpi-icon icon-blue">
              <FileText size={20} />
            </div>
          </div>
          <div className="admin-kpi-value">1,284</div>
          <div className="admin-kpi-sub">
            <span className="trend-up">↑ 18.4%</span> this week
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-top">
            <span className="admin-kpi-label">Registered Accounts</span>
            <div className="admin-kpi-icon icon-purple">
              <Users size={20} />
            </div>
          </div>
          <div className="admin-kpi-value">48 Users</div>
          <div className="admin-kpi-sub">Retail, Business &amp; Agents</div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-top">
            <span className="admin-kpi-label">Active AI Sub-Agents</span>
            <div className="admin-kpi-icon icon-emerald">
              <Cpu size={20} />
            </div>
          </div>
          <div className="admin-kpi-value">6 Online</div>
          <div className="admin-kpi-sub">100% Health &amp; Telemetry</div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-top">
            <span className="admin-kpi-label">Base Rate Currency</span>
            <div className="admin-kpi-icon icon-orange">
              <Sliders size={20} />
            </div>
          </div>
          <div className="admin-kpi-value">INR (₹)</div>
          <div className="admin-kpi-sub">Fuel BAF: 12.5%</div>
        </div>
      </div>

      {/* Quick Governance & Control Center */}
      <div className="admin-actions-card">
        <h3 className="admin-section-title">
          <Activity size={17} /> Platform Controls &amp; Governance Shortcuts
        </h3>
        <div className="admin-shortcuts-grid">
          <Link to="/dashboard/rate-config" className="admin-shortcut-btn">
            <div className="admin-shortcut-left">
              <Sliders size={18} className="text-orange-500" />
              <span>Base Rate &amp; Surcharge Config</span>
            </div>
            <ArrowRight size={16} />
          </Link>

          <Link to="/dashboard/ai-agent-monitor" className="admin-shortcut-btn">
            <div className="admin-shortcut-left">
              <Cpu size={18} className="text-purple-500" />
              <span>AI Agent Performance Monitor</span>
            </div>
            <ArrowRight size={16} />
          </Link>

          <Link to="/dashboard/users" className="admin-shortcut-btn">
            <div className="admin-shortcut-left">
              <Users size={18} className="text-blue-500" />
              <span>User &amp; Role Management</span>
            </div>
            <ArrowRight size={16} />
          </Link>

          <Link to="/dashboard/customs-portal" className="admin-shortcut-btn">
            <div className="admin-shortcut-left">
              <ShieldCheck size={18} className="text-cyan-500" />
              <span>Customs &amp; Regulatory Portal</span>
            </div>
            <ArrowRight size={16} />
          </Link>

          <Link to="/dashboard/master-data" className="admin-shortcut-btn">
            <div className="admin-shortcut-left">
              <Database size={18} className="text-emerald-500" />
              <span>Master Ports &amp; Carriers</span>
            </div>
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* Recent Activity Audit Table */}
      <div className="admin-table-card">
        <div className="admin-table-header">
          <h3 className="admin-section-title">
            <TrendingUp size={17} /> Live Platform Quotations Audit Stream
          </h3>
          <Link
            to="/dashboard/all-quotes"
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: "#ea580c",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            View All Quotes <ArrowRight size={14} />
          </Link>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Quote ID</th>
                <th>Client / Company</th>
                <th>Trade Corridor</th>
                <th>Mode</th>
                <th>Cargo Weight</th>
                <th>Total Value</th>
                <th>MCDA Risk</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_PLATFORM_QUOTES.map((q) => (
                <tr key={q.id}>
                  <td style={{ fontWeight: 700, color: "#ea580c" }}>{q.id}</td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{q.company}</div>
                    <small style={{ color: "#64748b" }}>{q.userType}</small>
                  </td>
                  <td style={{ fontWeight: 600 }}>{q.route}</td>
                  <td>{q.mode}</td>
                  <td>{q.weight}</td>
                  <td style={{ fontWeight: 800 }}>{q.amount}</td>
                  <td>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: q.risk.includes("Low") ? "#059669" : "#d97706",
                      }}
                    >
                      {q.risk}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`status-badge ${
                        q.status === "Approved"
                          ? "approved"
                          : q.status === "Pending"
                          ? "pending"
                          : "transit"
                      }`}
                    >
                      <CheckCircle size={11} /> {q.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
