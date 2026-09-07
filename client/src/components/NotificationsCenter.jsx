import React, { useCallback, useEffect, useState } from "react";
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
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api/workflow";
import { useAuth } from "../context/AuthContext";
import "./NotificationsCenter.css";

/**
 * Notifications come from the platform API. Each portal's nav carries a
 * Notifications item (PDF section 6), and the feed is emitted server-side when a
 * quote is generated, approved, sent, flagged by customs, or decided on.
 *
 * This file previously held a hardcoded array in component state, so every user
 * saw the same fictional five notifications and nothing ever produced a new one.
 */

// Server categories -> the icon and palette used by the list.
const CATEGORY_PRESENTATION = {
  QUOTE: { icon: DollarSign, color: "#0284c7", bg: "#e0f2fe", filter: "quotes" },
  SHIPMENT: { icon: Ship, color: "#0f766e", bg: "#ccfbf1", filter: "quotes" },
  CUSTOMS: { icon: FileText, color: "#b45309", bg: "#fef3c7", filter: "customs" },
  RISK: { icon: AlertTriangle, color: "#dc2626", bg: "#fee2e2", filter: "routes" },
  SYSTEM: { icon: Info, color: "#475569", bg: "#f1f5f9", filter: "all" },
};

const SEVERITY_OVERRIDE = {
  CRITICAL: { color: "#dc2626", bg: "#fee2e2" },
  WARNING: { color: "#b45309", bg: "#fef3c7" },
  SUCCESS: { color: "#059669", bg: "#ecfdf5" },
};

function relativeTime(iso) {
  if (!iso) return "just now";
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function presentNotification(n) {
  const preset = CATEGORY_PRESENTATION[n.category] || CATEGORY_PRESENTATION.SYSTEM;
  const severity = SEVERITY_OVERRIDE[n.severity] || {};
  return {
    id: n.id,
    title: n.title,
    message: n.message,
    category: preset.filter,
    priority: n.severity === "CRITICAL" ? "high" : "normal",
    time: relativeTime(n.created_at),
    read: n.read,
    link: n.link || "",
    linkLabel: "View",
    icon: preset.icon,
    color: severity.color || preset.color,
    bg: severity.bg || preset.bg,
  };
}

export default function NotificationsCenter() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    try {
      setError("");
      const data = await listNotifications(token, { limit: 50 });
      setNotifications((data.results || []).map(presentNotification));
      setUnreadCount(data.unread_count || 0);
    } catch (err) {
      setError(err.message || "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
    // Poll so an agent approval shows up on the customer's screen without a reload.
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const markAsRead = async (id) => {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.read) return;

    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await markNotificationRead(token, id);
    } catch {
      load();
    }
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead(token);
    } catch {
      load();
    }
  };

  // Notifications are an audit-relevant server record, so the UI marks them read
  // rather than deleting them outright.
  const clearAll = markAllAsRead;

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
              <Trash2 size={16} /> Mark all read
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

      {error && (
        <div className="notif-empty-state" style={{ color: "#b91c1c" }}>
          <div className="notif-empty-icon">
            <AlertTriangle size={48} />
          </div>
          <h3>Notifications unavailable</h3>
          <p>{error}</p>
        </div>
      )}

      {/* Notifications List */}
      <div className="notif-list">
        {filtered.length === 0 ? (
          <div className="notif-empty-state">
            <div className="notif-empty-icon">
              <CheckCircle2 size={48} />
            </div>
            <h3>{loading ? "Loading notifications…" : "All caught up!"}</h3>
            <p>
              {loading
                ? "Fetching your latest platform alerts."
                : "You have no notifications in this category right now."}
            </p>
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
