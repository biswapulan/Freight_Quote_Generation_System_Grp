import React, { useState } from "react";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Ship,
  DollarSign,
  ShieldCheck,
  Clock,
  Filter,
  Trash2,
  ExternalLink,
  ChevronRight,
  Info,
} from "lucide-react";
import { Link } from "react-router-dom";
import "./NotificationsCenter.css";

const INITIAL_NOTIFICATIONS = [
  {
    id: "notif-1",
    title: "Final Quote Ready for Review",
    message: "Freight Agent has validated commercial terms for Quote SHP-1001 (Chennai ➔ Rotterdam). Total: ₹ 86,000.",
    category: "quotes",
    priority: "high",
    time: "10 mins ago",
    read: false,
    link: "/dashboard/my-quotes",
    linkLabel: "View & Decide",
    icon: DollarSign,
    color: "#059669",
    bg: "#ecfdf5",
  },
  {
    id: "notif-2",
    title: "Customs Clearance Sign-Off Completed",
    message: "Officer Sharma digitally verified HS Code 8517.12 and CE Conformity for shipment SHP-1001.",
    category: "customs",
    priority: "medium",
    time: "45 mins ago",
    read: false,
    link: "/dashboard/documents",
    linkLabel: "View Certificate",
    icon: ShieldCheck,
    color: "#7c3aed",
    bg: "#f5f3ff",
  },
  {
    id: "notif-3",
    title: "Marine Swell Advisory — Arabian Sea",
    message: "Monsoon swell (3.8m waves) detected on INNSA ➔ NLRTM lane. AI transit estimate adjusted by +1.2 days.",
    category: "weather",
    priority: "high",
    time: "2 hours ago",
    read: false,
    link: "/dashboard/risk-analysis",
    linkLabel: "Inspect Weather Risk",
    icon: AlertTriangle,
    color: "#d97706",
    bg: "#fffbeb",
  },
  {
    id: "notif-4",
    title: "Bunker Fuel Adjustment (BAF) Update",
    message: "Global maritime BAF index updated to 12.5% effective this week across all Asia-Europe routes.",
    category: "pricing",
    priority: "low",
    time: "Yesterday",
    read: true,
    link: "/dashboard/pricing-rules",
    linkLabel: "Rate Index",
    icon: Info,
    color: "#2563eb",
    bg: "#eff6ff",
  },
  {
    id: "notif-5",
    title: "Port Congestion Notice — Jebel Ali",
    message: "Vessel dwell time reduced from 3.4 days to 2.1 days. Transshipment turnaround back to normal SLA.",
    category: "routes",
    priority: "low",
    time: "2 days ago",
    read: true,
    link: "/dashboard/routes",
    linkLabel: "View Route Map",
    icon: Ship,
    color: "#0284c7",
    bg: "#f0f9ff",
  },
  {
    id: "notif-6",
    title: "Commercial Invoice Verified",
    message: "Automated OCR extraction successfully parsed shipment document for INMAA-DEHAM booking.",
    category: "documents",
    priority: "low",
    time: "3 days ago",
    read: true,
    link: "/dashboard/documents",
    linkLabel: "Doc Vault",
    icon: FileText,
    color: "#475569",
    bg: "#f1f5f9",
  },
];

export default function NotificationsCenter() {
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [filter, setFilter] = useState("all");

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const filtered = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    if (filter === "quotes") return n.category === "quotes" || n.category === "pricing";
    if (filter === "customs") return n.category === "customs" || n.category === "documents";
    if (filter === "routes") return n.category === "weather" || n.category === "routes";
    return true;
  });

  return (
    <div className="notif-center">
      {/* Header */}
      <div className="notif-header">
        <div className="notif-title-wrap">
          <div className="notif-icon-badge">
            <Bell size={24} />
            {unreadCount > 0 && <span className="notif-badge-pill">{unreadCount}</span>}
          </div>
          <div>
            <h1>Notifications &amp; Operational Alerts</h1>
            <p>Real-time updates on quotes, customs sign-offs, marine weather alerts, and lane advisories.</p>
          </div>
        </div>

        <div className="notif-actions">
          {unreadCount > 0 && (
            <button className="notif-btn-secondary" onClick={markAllAsRead}>
              <CheckCircle2 size={16} /> Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button className="notif-btn-ghost" onClick={clearAll}>
              <Trash2 size={16} /> Clear all
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="notif-tabs">
        <button
          className={`notif-tab ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All ({notifications.length})
        </button>
        <button
          className={`notif-tab ${filter === "unread" ? "active" : ""}`}
          onClick={() => setFilter("unread")}
        >
          Unread ({unreadCount})
        </button>
        <button
          className={`notif-tab ${filter === "quotes" ? "active" : ""}`}
          onClick={() => setFilter("quotes")}
        >
          Quotes &amp; Rates
        </button>
        <button
          className={`notif-tab ${filter === "customs" ? "active" : ""}`}
          onClick={() => setFilter("customs")}
        >
          Customs &amp; Docs
        </button>
        <button
          className={`notif-tab ${filter === "routes" ? "active" : ""}`}
          onClick={() => setFilter("routes")}
        >
          Weather &amp; Routes
        </button>
      </div>

      {/* Notifications List */}
      <div className="notif-list">
        {filtered.length === 0 ? (
          <div className="notif-empty-state">
            <div className="notif-empty-icon">
              <CheckCircle2 size={48} />
            </div>
            <h3>All caught up!</h3>
            <p>You have no notifications in this category right now.</p>
          </div>
        ) : (
          filtered.map((item) => {
            const IconComponent = item.icon;
            return (
              <div
                key={item.id}
                className={`notif-item ${!item.read ? "unread" : ""}`}
                onClick={() => markAsRead(item.id)}
              >
                <div
                  className="notif-item-icon"
                  style={{ background: item.bg, color: item.color }}
                >
                  <IconComponent size={20} />
                </div>

                <div className="notif-item-content">
                  <div className="notif-item-top">
                    <span className="notif-item-title">{item.title}</span>
                    <span className="notif-item-time">
                      <Clock size={12} /> {item.time}
                    </span>
                  </div>
                  <p className="notif-item-msg">{item.message}</p>
                </div>

                <div className="notif-item-right">
                  {item.link && (
                    <Link to={item.link} className="notif-link-btn" onClick={(e) => e.stopPropagation()}>
                      {item.linkLabel || "View"} <ChevronRight size={14} />
                    </Link>
                  )}
                  {!item.read && <span className="notif-unread-dot" title="Unread" />}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
