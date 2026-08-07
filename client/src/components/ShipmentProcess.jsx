import React from "react";
import "./ShipmentProcess.css";
import { FaBox, FaRobot, FaTruckMoving, FaCheckCircle } from "react-icons/fa";

const STEPS = [
  {
    num: "01",
    icon: <FaBox />,
    title: "Shipment Request",
    desc: "Enter shipment details including source, destination and cargo information.",
  },
  {
    num: "02",
    icon: <FaRobot />,
    title: "AI Quote Generation",
    desc: "Our intelligent AI system analyzes data and generates accurate freight quotes.",
  },
  {
    num: "03",
    icon: <FaTruckMoving />,
    title: "Shipment Tracking",
    desc: "Track shipment movement with real-time logistics updates.",
  },
  {
    num: "04",
    icon: <FaCheckCircle />,
    title: "Safe Delivery",
    desc: "Complete your shipment successfully with reliable delivery management.",
  },
];

function ShipmentProcess() {
  return (
    <section className="fa-process" id="process">
      <div className="fa-section-header">
        <p className="fa-eyebrow">Our Workflow</p>
        <h2>Complete Shipment Process</h2>
        <span>
          From quotation generation to final delivery, manage your complete
          logistics journey easily.
        </span>
      </div>

      <div className="fa-process-wrapper">
        {STEPS.map((step) => (
          <div className="fa-process-card" key={step.num}>
            <div className="fa-step-badge">{step.num}</div>
            <div className="fa-process-icon">{step.icon}</div>
            <h3>{step.title}</h3>
            <p>{step.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ShipmentProcess;
