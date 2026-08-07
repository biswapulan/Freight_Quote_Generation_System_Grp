import React, { useState } from "react";
import "./Logo.css";
import "./Navbar.css";
import "./Footer.css";
import "./PageHeader.css";
import "./ContactPage.css";
import Navbar from "./Navbar";
import Footer from "./Footer";
import PageHeader from "./PageHeader";
import {
  FaEnvelope,
  FaPhoneAlt,
  FaMapMarkerAlt,
  FaPaperPlane,
  FaCheck,
} from "react-icons/fa";

const CONTACT_INFO = [
  {
    icon: <FaEnvelope />,
    title: "Email Us",
    lines: ["support@freightai.com", "sales@freightai.com"],
  },
  {
    icon: <FaPhoneAlt />,
    title: "Call Us",
    lines: ["+1 800 123 4567", "Mon–Fri, 9am–7pm"],
  },
  {
    icon: <FaMapMarkerAlt />,
    title: "Visit Us",
    lines: ["Global Logistics Center", "Bhubaneswar, Odisha, India"],
  },
];

function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;
    setSent(true);
  }

  return (
    <div className="fa-inner-page">
      <Navbar forceSolid />

      <PageHeader
        eyebrow="Get In Touch"
        title="Contact FreightAI"
        subtitle="Have a question about a shipment, pricing, or partnering with us? Our team usually replies within one business day."
      />

      <section className="fa-contact-body">
        <div className="fa-contact-info">
          {CONTACT_INFO.map((item) => (
            <div className="fa-contact-info-card" key={item.title}>
              <span className="fa-contact-info-icon">{item.icon}</span>
              <h3>{item.title}</h3>
              {item.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ))}
        </div>

        <div className="fa-contact-form-card">
          {!sent ? (
            <form className="fa-contact-form" onSubmit={handleSubmit}>
              <div className="fa-contact-row">
                <label className="field">
                  <span className="field-label">Full name</span>
                  <div className="input-wrap">
                    <input
                      type="text"
                      placeholder="Jane Doe"
                      required
                      value={form.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                    />
                  </div>
                </label>

                <label className="field">
                  <span className="field-label">Email address</span>
                  <div className="input-wrap">
                    <input
                      type="email"
                      placeholder="you@company.com"
                      required
                      value={form.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                    />
                  </div>
                </label>
              </div>

              <label className="field">
                <span className="field-label">Subject</span>
                <div className="input-wrap">
                  <input
                    type="text"
                    placeholder="How can we help?"
                    value={form.subject}
                    onChange={(e) => handleChange("subject", e.target.value)}
                  />
                </div>
              </label>

              <label className="field">
                <span className="field-label">Message</span>
                <textarea
                  rows={5}
                  placeholder="Tell us a bit about your shipment or question..."
                  required
                  value={form.message}
                  onChange={(e) => handleChange("message", e.target.value)}
                />
              </label>

              <button type="submit" className="fa-btn fa-btn-primary">
                Send Message
                <FaPaperPlane />
              </button>
            </form>
          ) : (
            <div className="fa-contact-success">
              <span className="fa-contact-success-icon">
                <FaCheck />
              </span>
              <h3>Message received</h3>
              <p>
                Thanks, {form.name.split(" ")[0]}! Our team will get back to
                you at <strong>{form.email}</strong> shortly.
              </p>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default ContactPage;
