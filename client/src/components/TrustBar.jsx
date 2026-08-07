import React from "react";
import "./TrustBar.css";
import { FaBoxOpen, FaGlobeAmericas, FaClock, FaHeadset } from "react-icons/fa";

const STATS = [
  { icon: <FaBoxOpen />, value: "10K+", label: "Shipments Handled" },
  { icon: <FaGlobeAmericas />, value: "120+", label: "Countries Served" },
  { icon: <FaClock />, value: "99.8%", label: "On-Time Delivery" },
  { icon: <FaHeadset />, value: "24/7", label: "Live Support" },
];

function TrustBar() {
  return (
    <section className="fa-trustbar" id="tracking">
      <div className="fa-trustbar-inner">
        {STATS.map((stat) => (
          <div className="fa-trustbar-item" key={stat.label}>
            <span className="fa-trustbar-icon">{stat.icon}</span>
            <div>
              <h3>{stat.value}</h3>
              <p>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default TrustBar;
