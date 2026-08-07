import React from "react";
import "./SpecialOffers.css";
import { Link } from "react-router-dom";
import {
  FaBolt,
  FaGlobe,
  FaDollarSign,
  FaFlag,
  FaGlobeAsia,
  FaBoxOpen,
  FaArrowRight,
} from "react-icons/fa";

const OFFERS = [
  {
    icon: <FaFlag />,
    badge: "Independence Day Offer",
    title: "25% Off All Shipments",
    desc: "Celebrate with savings — book any shipment this week and save big on freight costs.",
    stat: "25% OFF · Limited Week",
  },
  {
    icon: <FaGlobeAsia />,
    badge: "World Trade Day Offer",
    title: "Free Customs Assistance",
    desc: "Complimentary customs documentation support on all international shipments.",
    stat: "Free Add-on · This Month",
  },
  {
    icon: <FaBoxOpen />,
    badge: "First Shipment Offer",
    title: "Flat 30% Off Your First Order",
    desc: "New to FreightAI? Get 30% off your very first shipment, any transport mode.",
    stat: "30% OFF · New Customers",
  },
  {
    icon: <FaBolt />,
    badge: "Fast Delivery",
    title: "Priority Handling",
    desc: "Priority shipment handling with optimized delivery routes.",
    stat: "Up to 40% Faster",
  },
  {
    icon: <FaGlobe />,
    badge: "Global Network",
    title: "Worldwide Coverage",
    desc: "Connect your business with international logistics networks.",
    stat: "120+ Countries",
  },
  {
    icon: <FaDollarSign />,
    badge: "Cost Savings",
    title: "Smart AI Pricing",
    desc: "AI based pricing helps reduce unnecessary transportation costs.",
    stat: "Smart Pricing",
  },
];

// Duplicate the list so the CSS marquee loop is seamless.
const MARQUEE_OFFERS = [...OFFERS, ...OFFERS];

function SpecialOffers() {
  return (
    <section className="fa-offers" id="offers">
      <div className="fa-section-header">
        <p className="fa-eyebrow">Special Offers</p>
        <h2>Exclusive Logistics Benefits</h2>
        <span>Save time and cost with our intelligent freight solutions.</span>
      </div>

      <div className="fa-offers-marquee-mask">
        <div className="fa-offers-track">
          {MARQUEE_OFFERS.map((offer, i) => (
            <div className="fa-offer-card" key={`${offer.title}-${i}`}>
              <span className="fa-offer-badge">{offer.badge}</span>
              <div className="fa-offer-icon">{offer.icon}</div>
              <h3>{offer.title}</h3>
              <p>{offer.desc}</p>
              <div className="fa-offer-divider" />
              <h4>{offer.stat}</h4>
            </div>
          ))}
        </div>
      </div>

      <div className="fa-offer-banner">
        <div>
          <h2>Ready to Optimize Your Shipment?</h2>
          <p>Generate your AI-powered freight quote today.</p>
        </div>

        <Link to="/services" className="fa-btn fa-btn-primary">
          Get Started
          <FaArrowRight />
        </Link>
      </div>
    </section>
  );
}

export default SpecialOffers;
