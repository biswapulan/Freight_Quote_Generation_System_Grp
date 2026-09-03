import React from "react";
import "./Hero.css";
import { Link } from "react-router-dom";
import freight from "../assets/freight.png";
import { FaArrowRight, FaMapMarkerAlt, FaLocationArrow } from "react-icons/fa";
import { useUserLocation } from "../context/LocationContext";

function Hero() {
  const { status, location } = useUserLocation();
  const isLive = status === "granted";
  const mapSrc = `https://www.google.com/maps?q=${location.lat},${location.lng}&z=12&output=embed`;

  return (
    <section
      className="fa-hero"
      style={{ backgroundImage: `url(${freight})` }}
    >
      <div className="fa-hero-overlay" />

      <div className="fa-hero-container">
        <div className="fa-hero-left">
          <p className="fa-hero-tag">Autonomous Multi-Agent Logistics Intelligence</p>

          <h1>
            Agentic AI for Maritime Freight Pricing and Route Optimization
          </h1>

          <p className="fa-hero-description">
            Autonomous multi-agent intelligence for global maritime supply chains—combining M1 geodesic route intelligence, M2 machine-learning spot pricing, and M3 multi-factor weather and customs risk governance.
          </p>

          <div className="fa-hero-buttons">
            <Link to="/services" className="fa-btn fa-btn-primary">
              Get Instant Quote
              <FaArrowRight />
            </Link>
            <Link to="/login" className="fa-btn fa-btn-ghost">
              Open Portal
            </Link>
          </div>
        </div>

        <div className="fa-hero-right">
          <div className="fa-map-panel">
            <div className="fa-map-badge">
              {isLive ? <FaLocationArrow /> : <FaMapMarkerAlt />}
              <span>{isLive ? "Live Location" : "Default Origin"}</span>
            </div>

            <div className="fa-map-frame-wrap">
              <iframe
                className="fa-map-frame"
                src={mapSrc}
                title="Delivery origin map"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <div className="fa-map-pin-pulse" />
            </div>

            <div className="fa-map-caption">
              <FaMapMarkerAlt className="fa-map-caption-icon" />
              <p>
                Deliver from <strong>{location.city}</strong> to anywhere
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
