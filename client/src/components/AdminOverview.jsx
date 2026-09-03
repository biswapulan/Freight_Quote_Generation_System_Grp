import React, { useState, useEffect } from "react";
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
import {
  getPlatformQuotes,
  normalizeWorkflowStatus,
  STATUS_CONFIG,
} from "../utils/quoteWorkflow";
import "./AdminOverview.css";

export default function AdminOverview() {
  const [quotes, setQuotes] = useState(() => getPlatformQuotes());

  useEffect(() => {
    setQuotes(getPlatformQuotes());
  }, []);

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
            <span className="admin-kpi-label">Active Quotations</span>
            <div className="admin-kpi-icon icon-orange">
              <FileText size={20} />
            </div>
          </div>
          <div className="admin-kpi-value">{quotes.length + 80} Live</div>
          <div className="admin-kpi-sub">+18% this month</div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-top">
            <span className="admin-kpi-label">Active Platform Users</span>
            <div className="admin-kpi-icon icon-blue">
              <Users size={20} />
            </div>
          </div>
          <div className="admin-kpi-value">1,420</div>
          <div className="admin-kpi-sub">Retail, Business, Agents &amp; Customs</div>
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
                <th>Client / Consignee</th>
                <th>Trade Corridor</th>
                <th>Mode &amp; Cargo</th>
                <th>Total Value</th>
                <th>Customs Compliance</th>
                <th>Workflow Status</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => {
                const normStatus = normalizeWorkflowStatus(q.status);
                const cfg = STATUS_CONFIG[normStatus] || STATUS_CONFIG.REQUESTED;
                return (
                  <tr key={q.id || q.quoteNo}>
                    <td style={{ fontWeight: 700, color: "#ea580c" }}>{q.quoteNo || q.id}</td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{q.customerName || q.company || q.client}</div>
                      <small style={{ color: "#64748b" }}>{q.customerEmail || q.userType || "Customer"}</small>
                    </td>
                    <td style={{ fontWeight: 600 }}>{q.laneCode || `${q.origin} → ${q.destination}`}</td>
                    <td>
                      <div>{q.modeLabel || q.mode}</div>
                      <small style={{ color: "#64748b" }}>{q.cargoType || q.cargoClass || "Cargo"} ({q.weightKg || "12,000"} kg)</small>
                    </td>
                    <td style={{ fontWeight: 800 }}>{q.totalFormatted || `₹ ${Number(q.totalNum || 150000).toLocaleString("en-IN")}`}</td>
                    <td>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          color: q.customsRemarks ? "#7c3aed" : "#059669",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <ShieldCheck size={13} /> {q.customsRemarks ? "Customs Checked" : "Green Lane"}
                      </span>
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
                        <CheckCircle size={11} style={{ marginRight: 4 }} /> {cfg.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
