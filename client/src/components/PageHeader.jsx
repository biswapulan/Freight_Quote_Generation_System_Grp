import React from "react";
import "./PageHeader.css";
import { Link } from "react-router-dom";

function PageHeader({ eyebrow, title, subtitle, crumb }) {
  return (
    <header className="fa-page-header">
      <div className="fa-page-header-glow" />
      <div className="fa-page-header-inner">
        <p className="fa-breadcrumb">
          <Link to="/">Home</Link>
          <span>/</span>
          <span>{crumb || title}</span>
        </p>

        {eyebrow && <p className="fa-eyebrow fa-page-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {subtitle && <p className="fa-page-subtitle">{subtitle}</p>}
      </div>
    </header>
  );
}

export default PageHeader;
