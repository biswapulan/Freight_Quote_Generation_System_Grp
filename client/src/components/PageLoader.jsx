import React from "react";
import "./Logo.css";
import "./PageLoader.css";
import Logo from "./Logo";

function PageLoader({ visible }) {
  return (
    <div className={`fa-loader ${visible ? "" : "fa-loader-hide"}`} aria-hidden={!visible}>
      <div className="fa-loader-glow" />

      <div className="fa-loader-content">
        <div className="fa-loader-logo">
          <Logo variant="white" size={54} />
        </div>

        <div className="fa-loader-bar">
          <span className="fa-loader-bar-fill" />
        </div>

        <p className="fa-loader-text">Loading your logistics dashboard…</p>
      </div>
    </div>
  );
}

export default PageLoader;
