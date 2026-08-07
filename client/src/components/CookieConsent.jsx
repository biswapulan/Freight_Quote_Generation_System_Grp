import React, { useEffect, useState } from "react";
import "./CookieConsent.css";
import { FaCookieBite, FaShieldAlt } from "react-icons/fa";

const CONSENT_KEY = "fa_cookie_consent";

function CookieConsent({ onResolved }) {
  const [decision, setDecision] = useState(null); // null | "all" | "necessary" | "rejected"

  useEffect(() => {
    const saved = localStorage.getItem(CONSENT_KEY);
    if (saved === "all" || saved === "necessary") {
      setDecision(saved);
      onResolved?.(true);
    } else if (saved === "rejected") {
      setDecision("rejected");
      onResolved?.(false);
    }
    // if nothing saved, stay null -> bar shows, site stays locked
  }, [onResolved]);

  function choose(value) {
    setDecision(value);
    if (value === "rejected") {
      onResolved?.(false);
      // Don't persist a reject choice — let them reconsider on next visit.
      localStorage.removeItem(CONSENT_KEY);
    } else {
      localStorage.setItem(CONSENT_KEY, value);
      onResolved?.(true);
    }
  }

  if (decision === "rejected") {
    return (
      <div className="fa-cookie-block">
        <div className="fa-cookie-block-card">
          <FaShieldAlt className="fa-cookie-block-icon" />
          <h2>Access Restricted</h2>
          <p>
            FreightAI requires essential cookies to operate securely and
            deliver core functionality. Since cookie access was declined, we
            can't show you the site right now.
          </p>
          <button
            type="button"
            className="fa-cookie-btn fa-cookie-btn-primary"
            onClick={() => setDecision(null)}
          >
            Review Cookie Choices Again
          </button>
        </div>
      </div>
    );
  }

  if (decision === "all" || decision === "necessary") {
    return null;
  }

  return (
    <>
      <div className="fa-cookie-overlay" />

      <div className="fa-cookie-bar" role="dialog" aria-label="Cookie consent">
        <div className="fa-cookie-bar-inner">
          <div className="fa-cookie-copy">
            <div className="fa-cookie-icon">
              <FaCookieBite />
            </div>
            <div>
              <h3>We value your privacy</h3>
              <p>
                We use cookies and similar technologies to run our site
                securely and improve your experience. This includes your{" "}
                <strong>device IP address</strong>, <strong>user interaction data</strong>{" "}
                (clicks, pages visited, session activity), approximate{" "}
                <strong>location</strong> for delivery estimates, and{" "}
                <strong>device/browser information</strong> for fraud
                prevention and analytics. Necessary cookies keep the site
                functional; optional cookies help us personalize content and
                measure performance. Read our{" "}
                <a href="#" onClick={(e) => e.preventDefault()}>
                  Cookie Policy
                </a>{" "}
                for details.
              </p>
            </div>
          </div>

          <div className="fa-cookie-actions">
            <button
              type="button"
              className="fa-cookie-btn fa-cookie-btn-reject"
              onClick={() => choose("rejected")}
            >
              Reject
            </button>
            <button
              type="button"
              className="fa-cookie-btn fa-cookie-btn-secondary"
              onClick={() => choose("necessary")}
            >
              Necessary Only
            </button>
            <button
              type="button"
              className="fa-cookie-btn fa-cookie-btn-primary"
              onClick={() => choose("all")}
            >
              Accept All
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default CookieConsent;
