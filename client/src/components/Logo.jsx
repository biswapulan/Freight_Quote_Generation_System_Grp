import React from "react";
import { Link } from "react-router-dom";

/**
 * FreightAI brand mark — a cargo-ship silhouette with stacked containers
 * and an orange "signal" pulse standing in for the AI layer.
 * variant: "navy" (default, for light backgrounds) | "white" (for navy backgrounds)
 */
function LogoMark({ size = 38 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="fa-logo-svg"
    >
      <rect width="44" height="44" rx="12" fill="#0F172A" />
      <rect x="8.5" y="16.5" width="6" height="6" rx="1.4" fill="#FF9800" />
      <rect x="16" y="13.5" width="6.5" height="9" rx="1.4" fill="#FFB74D" />
      <rect x="24" y="16.5" width="6" height="6" rx="1.4" fill="#FF9800" />
      <path
        d="M7 25.5H33.5L30.6 33.2C30.3 34 29.5 34.5 28.7 34.5H12.3C11.4 34.5 10.6 34 10.3 33.2L7 25.5Z"
        fill="#F8FAFC"
      />
      <path
        d="M5 37C10 34.5 16 34.5 20.5 36.2C26 38.2 32 37.6 36.5 34.5"
        stroke="#FF9800"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="33.5" cy="9.5" r="3.6" fill="#0F172A" stroke="#FF9800" strokeWidth="1.6" />
      <circle cx="33.5" cy="9.5" r="1.3" fill="#FF9800" />
    </svg>
  );
}

function Logo({ to = "/", size = 38, variant = "navy", className = "", showTag = false }) {
  const wordColor = variant === "white" ? "#FFFFFF" : "#0F172A";

  return (
    <Link to={to} className={`fa-logo ${className}`} aria-label="FreightAI home">
      <LogoMark size={size} />
      <span className="fa-logo-word" style={{ color: wordColor }}>
        Freight<span className="fa-logo-accent">AI</span>
      </span>
      {showTag && <span className="fa-logo-tag">Smart Logistics</span>}
    </Link>
  );
}

export default Logo;
