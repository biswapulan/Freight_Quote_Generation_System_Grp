import React from "react";
import "./Logo.css";
import "./Footer.css";
import { Link } from "react-router-dom";
import { FaFacebook, FaTwitter, FaLinkedin, FaInstagram } from "react-icons/fa";
import Logo from "./Logo";

function Footer() {
  return (
    <footer className="fa-footer" id="footer">
      <div className="fa-footer-container">
        <div className="fa-footer-brand">
          <Logo variant="white" size={38} />

          <p>
            AI powered logistics platform providing smart freight solutions,
            real-time tracking and intelligent shipment management.
          </p>

          <div className="fa-social-icons">
            <a href="#" aria-label="Facebook"><FaFacebook /></a>
            <a href="#" aria-label="Twitter"><FaTwitter /></a>
            <a href="#" aria-label="LinkedIn"><FaLinkedin /></a>
            <a href="#" aria-label="Instagram"><FaInstagram /></a>
          </div>
        </div>

        <div className="fa-footer-links">
          <h3>Company</h3>
          <Link to="/">Home</Link>
          <Link to="/services">Services</Link>
          <Link to="/tracking">Tracking</Link>
          <Link to="/contact">Contact</Link>
        </div>

        <div className="fa-footer-links">
          <h3>Services</h3>
          <Link to="/transport/air">Air Freight</Link>
          <Link to="/transport/ocean">Ocean Freight</Link>
          <Link to="/transport/road">Road Transport</Link>
          <Link to="/transport/rail">Rail Freight</Link>
        </div>

        <div className="fa-footer-links">
          <h3>Support</h3>
          <p>support@freightai.com</p>
          <p>+1 800 123 4567</p>
          <p>Global Logistics Center</p>
        </div>
      </div>

      <div className="fa-footer-bottom">
        <p>© 2026 FreightAI. All Rights Reserved.</p>
        <div className="fa-footer-legal">
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
