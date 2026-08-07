import React from "react";
import "./Logo.css";
import "./Navbar.css";
import "./Footer.css";
import "./PageHeader.css";
import "./ShipmentPage.css";
import { Link } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import PageHeader from "./PageHeader";
import {
  FaBox,
  FaRobot,
  FaTruckMoving,
  FaCheckCircle,
  FaArrowRight,
  FaFileInvoiceDollar,
  FaHeadset,
} from "react-icons/fa";

const STEPS = [
  {
    icon: <FaBox />,
    title: "Shipment Request",
    desc: "Tell us your origin, destination, cargo type and preferred transport mode.",
  },
  {
    icon: <FaRobot />,
    title: "AI Quote Generation",
    desc: "Our engine compares live rates across carriers and generates your best price instantly.",
  },
  {
    icon: <FaTruckMoving />,
    title: "Pickup & Transit",
    desc: "Your cargo is picked up and moved through our tracked logistics network.",
  },
  {
    icon: <FaCheckCircle />,
    title: "Safe Delivery",
    desc: "Shipment arrives at its destination, with proof of delivery in your portal.",
  },
];

const EXTRAS = [
  {
    icon: <FaFileInvoiceDollar />,
    title: "Transparent Invoicing",
    desc: "Every shipment comes with a clear, itemized invoice — no hidden fees.",
  },
  {
    icon: <FaHeadset />,
    title: "24/7 Shipment Support",
    desc: "Our logistics team is available around the clock for any shipment questions.",
  },
];

function ShipmentPage() {
  return (
    <div className="fa-inner-page">
      <Navbar forceSolid />

      <PageHeader
        eyebrow="How Shipping Works"
        title="Start a Shipment"
        subtitle="From request to delivery, here's exactly how FreightAI moves your cargo — with AI-generated pricing and full visibility at every step."
      />

      <section className="fa-shipment-steps">
        {STEPS.map((step, i) => (
          <div className="fa-shipment-step" key={step.title}>
            <div className="fa-shipment-step-num">{`0${i + 1}`}</div>
            <div className="fa-shipment-step-icon">{step.icon}</div>
            <h3>{step.title}</h3>
            <p>{step.desc}</p>
          </div>
        ))}
      </section>

      <section className="fa-shipment-extras">
        <div className="fa-shipment-extras-grid">
          {EXTRAS.map((extra) => (
            <div className="fa-shipment-extra-card" key={extra.title}>
              <span className="fa-shipment-extra-icon">{extra.icon}</span>
              <div>
                <h3>{extra.title}</h3>
                <p>{extra.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="fa-shipment-cta">
        <div>
          <h2>Ready to send your first shipment?</h2>
          <p>Generate an AI-powered quote in under a minute.</p>
        </div>
        <Link to="/services" className="fa-btn fa-btn-primary">
          Get a Quote
          <FaArrowRight />
        </Link>
      </section>

      <Footer />
    </div>
  );
}

export default ShipmentPage;
