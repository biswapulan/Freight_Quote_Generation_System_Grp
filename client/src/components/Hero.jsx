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
          <p className="fa-hero-tag">AI-Powered Enterprise Logistics Platform</p>

          <h1>
            Intelligent Freight
            <br />
            Quotes, Instantly
          </h1>

          <p className="fa-hero-description">
            Transform your logistics operations with AI-powered freight
            quotation, real-time shipment tracking, and smart supply chain
            management built for global businesses.
          </p>

          <div className="fa-hero-buttons">
            <Link to="/services" className="fa-btn fa-btn-primary">
              Get Quote
              <FaArrowRight />
            </Link>
            <Link to="/login" className="fa-btn fa-btn-ghost">
              Get Started
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
