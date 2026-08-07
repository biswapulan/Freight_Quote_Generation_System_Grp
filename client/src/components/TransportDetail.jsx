import React from "react";
import "./Logo.css";
import "./Navbar.css";
import "./Footer.css";
import "./PageHeader.css";
import "./TransportDetail.css";
import { useParams, Link, Navigate } from "react-router-dom";
import { FaArrowRight } from "react-icons/fa";
import Navbar from "./Navbar";
import Footer from "./Footer";
import PageHeader from "./PageHeader";
import { transportData, CheckIcon } from "../data/transportData";

function TransportDetail() {
  const { mode } = useParams();
  const data = transportData[mode];

  if (!data) {
    return <Navigate to="/services" replace />;
  }

  return (
    <div className="fa-inner-page">
      <Navbar forceSolid />

      <PageHeader
        eyebrow={data.tag}
        title={data.label}
        subtitle={data.tagline}
        crumb={data.label}
      />

      <section className="fa-transport-body">
        <div className="fa-transport-grid">
          <div className="fa-transport-main">
            <div className="fa-transport-icon-badge">{data.icon}</div>
            <h2>About {data.label}</h2>
            <p className="fa-transport-desc">{data.description}</p>

            <h3>What's included</h3>
            <ul className="fa-transport-features">
              {data.features.map((feature) => (
                <li key={feature}>
                  <CheckIcon />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <aside className="fa-transport-sidebar">
            <div className="fa-transport-stats-card">
              <h3>At a glance</h3>
              {data.stats.map((stat) => (
                <div className="fa-transport-stat-row" key={stat.label}>
                  <span className="fa-transport-stat-value">{stat.value}</span>
                  <span className="fa-transport-stat-label">{stat.label}</span>
                </div>
              ))}
            </div>

            <div className="fa-transport-usecase-card">
              <h3>Common use cases</h3>
              <ul>
                {data.useCases.map((uc) => (
                  <li key={uc}>{uc}</li>
                ))}
              </ul>
            </div>

            <Link to="/services" className="fa-btn fa-btn-primary fa-transport-cta">
              Get a {data.label} Quote
              <FaArrowRight />
            </Link>
          </aside>
        </div>

        <div className="fa-transport-other">
          <h3>Explore other transport modes</h3>
          <div className="fa-transport-other-links">
            {Object.entries(transportData)
              .filter(([key]) => key !== mode)
              .map(([key, val]) => (
                <Link to={`/transport/${key}`} className="fa-transport-chip" key={key}>
                  <span>{val.icon}</span>
                  {val.label}
                </Link>
              ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default TransportDetail;
