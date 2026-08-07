import React, { useState } from "react";
import "./Logo.css";
import "./Navbar.css";
import "./Footer.css";
import "./PageHeader.css";
import "./TrackingPage.css";
import Navbar from "./Navbar";
import Footer from "./Footer";
import PageHeader from "./PageHeader";
import {
  FaSearch,
  FaBoxOpen,
  FaPlaneDeparture,
  FaWarehouse,
  FaTruckLoading,
  FaCheckCircle,
} from "react-icons/fa";

const STAGES = [
  { icon: <FaBoxOpen />, label: "Order Confirmed" },
  { icon: <FaWarehouse />, label: "At Origin Hub" },
  { icon: <FaPlaneDeparture />, label: "In Transit" },
  { icon: <FaTruckLoading />, label: "Out for Delivery" },
  { icon: <FaCheckCircle />, label: "Delivered" },
];

function TrackingPage() {
  const [trackingId, setTrackingId] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (!trackingId.trim()) return;
    setSubmitted(true);
  }

  return (
    <div className="fa-inner-page">
      <Navbar forceSolid />

      <PageHeader
        eyebrow="Live Tracking"
        title="Track Your Shipment"
        subtitle="Enter your tracking ID to see the latest status of your freight, anywhere in the world."
      />

      <section className="fa-tracking-body">
        <form className="fa-tracking-form" onSubmit={handleSubmit}>
          <div className="fa-tracking-input-wrap">
            <FaSearch className="fa-tracking-icon" />
            <input
              type="text"
              placeholder="Enter tracking ID e.g. FRT-2026-8841"
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
            />
          </div>
          <button type="submit" className="fa-btn fa-btn-primary">
            Track Shipment
          </button>
        </form>

        {submitted && (
          <div className="fa-tracking-result">
            <div className="fa-tracking-result-head">
              <div>
                <span className="fa-tracking-label">Tracking ID</span>
                <h3>{trackingId.toUpperCase()}</h3>
              </div>
              <span className="fa-tracking-status-pill">In Transit</span>
            </div>

            <div className="fa-tracking-progress">
              {STAGES.map((stage, i) => (
                <div
                  className={`fa-tracking-stage ${i <= 2 ? "done" : ""}`}
                  key={stage.label}
                >
                  <span className="fa-tracking-stage-icon">{stage.icon}</span>
                  <p>{stage.label}</p>
                </div>
              ))}
            </div>

            <p className="fa-tracking-note">
              This is a preview experience. Sign in to your Customer Portal
              for live, real-time tracking on your actual shipments.
            </p>
          </div>
        )}

        {!submitted && (
          <div className="fa-tracking-placeholder">
            <FaBoxOpen />
            <p>Your shipment status will appear here once you track an order.</p>
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}

export default TrackingPage;
