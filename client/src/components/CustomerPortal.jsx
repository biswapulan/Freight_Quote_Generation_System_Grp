import React from "react";
import "./CustomerPortal.css";
import { Link } from "react-router-dom";
import {
  FaUserShield,
  FaChartLine,
  FaMapMarkedAlt,
  FaFileInvoiceDollar,
} from "react-icons/fa";

const DASHBOARD_ITEMS = [
  { icon: <FaMapMarkedAlt />, title: "Live Tracking", desc: "Real-time shipment updates" },
  { icon: <FaChartLine />, title: "Analytics", desc: "Performance insights" },
  { icon: <FaFileInvoiceDollar />, title: "Invoices", desc: "Digital billing management" },
  { icon: <FaUserShield />, title: "Secure Access", desc: "Protected customer account" },
];

function CustomerPortal() {
  return (
    <section className="fa-portal">
      <div className="fa-portal-container">
        <div className="fa-portal-content">
          <p className="fa-eyebrow">Customer Portal</p>
          <h2>Manage Your Shipments Easily</h2>
          <span>
            Access shipment tracking, invoices, analytics and complete
            logistics information from one smart platform &mdash; built for
            enterprise freight teams.
          </span>

          <div className="fa-portal-buttons">
            <Link to="/login" className="fa-btn fa-btn-primary">
              Login Portal
            </Link>
            <Link to="/login" className="fa-btn fa-btn-outline-light">
              Create Account
            </Link>
          </div>
        </div>

        <div className="fa-portal-dashboard">
          {DASHBOARD_ITEMS.map((item) => (
            <div className="fa-dashboard-card" key={item.title}>
              <span className="fa-dashboard-icon">{item.icon}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default CustomerPortal;
