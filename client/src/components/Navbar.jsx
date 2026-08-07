import "./Logo.css";
import "./Navbar.css";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaBars, FaTimes } from "react-icons/fa";
import Logo from "./Logo";

const NAV_LINKS = [
  { label: "Home", to: "/", type: "route" },
  { label: "Services", to: "/services", type: "route" },
  { label: "Tracking", to: "/tracking", type: "route" },
  { label: "Shipment", to: "/shipment", type: "route" },
  { label: "Contact", to: "/contact", type: "route" },
];

function Navbar({ forceSolid = false }) {
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(forceSolid);

  useEffect(() => {
    if (forceSolid) return;
    function onScroll() {
      setScrolled(window.scrollY > 64);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [forceSolid]);

  useEffect(() => {
    document.body.style.overflow = menu ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menu]);

  return (
    <nav className={`fa-navbar ${scrolled ? "is-solid" : "is-transparent"}`}>
      <div className="fa-navbar-inner">
        <Logo variant={scrolled ? "navy" : "white"} size={36} className="fa-navbar-logo" />

        <ul className={menu ? "fa-nav-links active" : "fa-nav-links"}>
          {NAV_LINKS.map((link) =>
            link.type === "route" ? (
              <li key={link.label}>
                <Link to={link.to} onClick={() => setMenu(false)}>
                  {link.label}
                </Link>
              </li>
            ) : (
              <li key={link.label}>
                <a href={link.to} onClick={() => setMenu(false)}>
                  {link.label}
                </a>
              </li>
            )
          )}

          <li className="fa-mobile-only">
            <Link to="/login" className="fa-mobile-login-link" onClick={() => setMenu(false)}>
              Login
            </Link>
          </li>
        </ul>

        <div className="fa-nav-right">
          <Link to="/login" className="fa-login-pill">
            Login
          </Link>
        </div>

        <button
          type="button"
          className="fa-menu-toggle"
          onClick={() => setMenu(!menu)}
          aria-label={menu ? "Close menu" : "Open menu"}
          aria-expanded={menu}
        >
          {menu ? <FaTimes /> : <FaBars />}
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
