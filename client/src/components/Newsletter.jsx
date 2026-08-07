import React, { useState } from "react";
import "./Newsletter.css";
import { Link } from "react-router-dom";
import { FaEnvelope, FaPaperPlane, FaCheck } from "react-icons/fa";

function Newsletter() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setSubscribed(true);
  }

  return (
    <section className="fa-newsletter">
      <div className="fa-newsletter-inner">
        <div className="fa-newsletter-copy">
          <p className="fa-eyebrow">Get In Touch</p>
          <h2>Stay ahead of every shipment.</h2>
          <p className="fa-newsletter-sub">
            Subscribe to our newsletter for freight market updates, new
            offers, and product news. Or{" "}
            <Link to="/contact">reach out to our team directly</Link>.
          </p>
        </div>

        <div className="fa-newsletter-form-wrap">
          {!subscribed ? (
            <form className="fa-newsletter-form" onSubmit={handleSubmit}>
              <div className="fa-newsletter-input-wrap">
                <FaEnvelope className="fa-newsletter-icon" />
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError("");
                  }}
                />
              </div>
              <button type="submit" className="fa-btn fa-btn-primary">
                Subscribe
                <FaPaperPlane />
              </button>
            </form>
          ) : (
            <div className="fa-newsletter-success">
              <span>
                <FaCheck />
              </span>
              You're subscribed! Watch your inbox for updates.
            </div>
          )}

          {error && <p className="fa-newsletter-error">{error}</p>}
        </div>
      </div>
    </section>
  );
}

export default Newsletter;
