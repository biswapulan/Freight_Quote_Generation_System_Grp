import React from "react";
import "./Services.css";
import { Link } from "react-router-dom";
import { FaPlane, FaShip, FaTruck, FaTrain } from "react-icons/fa";

const SERVICES = [
  {
    slug: "air",
    icon: <FaPlane />,
    title: "Air Freight",
    desc: "Fast and secure air cargo transportation with accurate AI based freight estimation.",
  },
  {
    slug: "ocean",
    icon: <FaShip />,
    title: "Ocean Freight",
    desc: "Cost effective global shipping solutions for large scale cargo movement.",
  },
  {
    slug: "road",
    icon: <FaTruck />,
    title: "Road Transport",
    desc: "Flexible road logistics with real-time tracking and delivery updates.",
  },
  {
    slug: "rail",
    icon: <FaTrain />,
    title: "Rail Freight",
    desc: "Reliable railway cargo solutions for efficient supply chain operations.",
  },
];

function Services() {
  return (
    <section className="fa-services">
      <div className="fa-section-header">
        <p className="fa-eyebrow">Our Services</p>
        <h2>Smart Logistics Solutions</h2>
        <span>
          Reliable transportation solutions powered by AI technology and
          intelligent management.
        </span>
      </div>

      <div className="fa-services-grid">
        {SERVICES.map((service) => (
          <div className="fa-service-card" key={service.title}>
            <div className="fa-service-icon">{service.icon}</div>
            <h3>{service.title}</h3>
            <p>{service.desc}</p>
            <Link to={`/transport/${service.slug}`} className="fa-service-link">
              Explore More →
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

export default Services;
