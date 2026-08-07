import { useEffect, useState } from "react";
import { FaEnvelope, FaPhoneAlt, FaRegClock } from "react-icons/fa";
import { createSupportTicket, getSupportTickets } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import "./Support.css";

const FAQS = [
  {
    q: "How long is my freight quote valid for?",
    a: "Indicative quotes are valid for 7 days from generation. Rates can shift with fuel surcharges and carrier space, so we recommend booking within that window to lock in the price shown.",
  },
  {
    q: 'What does an "Indicative" quote mean?',
    a: "An indicative quote is calculated from a flat lane-rate table and gives you a realistic estimate before booking. The final price is confirmed once a carrier and route are selected and your shipment details are verified.",
  },
  {
    q: "What documents do I need to submit a shipment?",
    a: "Commercial invoice, packing list, and a certificate of origin if applicable. Hazardous cargo also needs an MSDS. You can upload these directly from the Generate Quote flow once a route is selected.",
  },
  {
    q: "Can I change the pickup date after booking?",
    a: "Yes, up to 24 hours before the scheduled pickup, from Shipments History. Changes within 24 hours need to go through Support, since the carrier slot may already be locked.",
  },
  {
    q: "What payment methods are accepted?",
    a: "Credit/debit card and net banking for retail accounts. Business accounts can additionally request invoiced billing with NET-15 or NET-30 terms.",
  },
];

const EMPTY_TICKET = { name: "", email: "", category: "Quote issue", ref: "", subject: "", message: "" };

export default function Support() {
  const { token, user } = useAuth();
  const [openFaq, setOpenFaq] = useState(0);
  const [ticket, setTicket] = useState(EMPTY_TICKET);
  const [submitted, setSubmitted] = useState(false);
  const [trackInput, setTrackInput] = useState("");
  const [trackedId, setTrackedId] = useState("");
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSupportTickets(token)
      .then((data) => setTickets(data?.results || []))
      .catch((requestError) => setError(requestError.message || "Unable to load support tickets."));
  }, [token]);

  function updateTicket(field, value) {
    setTicket((t) => ({ ...t, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const createdTicket = await createSupportTicket(token, {
        category: ticket.category,
        reference: ticket.ref,
        subject: ticket.subject,
        message: ticket.message,
      });
      setTickets((current) => [createdTicket, ...current]);
      setTrackedId(createdTicket.ticket_number);
      setSubmitted(true);
      setTicket(EMPTY_TICKET);
    } catch (requestError) {
      setError(requestError.message || "Unable to submit this ticket.");
    } finally {
      setSaving(false);
    }
  }

  function handleTrack() {
    const val = trackInput.trim();
    if (!val) return;
    setTrackedId(tickets.find((ticket) => ticket.ticket_number.toLowerCase() === val.toLowerCase())?.ticket_number || "");
  }

  const trackedTicket = tickets.find((ticket) => ticket.ticket_number === trackedId);

  return (
    <section className="sup-page" aria-labelledby="sup-title">
      <div className="sup-shell">
        <div className="sup-eyebrow">
          <span className="sup-pulse-dot" />
          <span>Support</span>
        </div>
        <h1 id="sup-title" className="sup-h1">Support</h1>
        <p className="sup-sub">Find an answer below or submit a ticket and our team will follow up by email.</p>

        <div className="sup-contact-strip">
          <div className="sup-contact-card">
            <div className="sup-contact-icon"><FaEnvelope /></div>
            <div>
              <p className="sup-contact-label">Email</p>
              <p className="sup-contact-value">support@freightai.com</p>
              <p className="sup-contact-sub">Replies within 12 min on average</p>
            </div>
          </div>
          <div className="sup-contact-card">
            <div className="sup-contact-icon"><FaPhoneAlt /></div>
            <div>
              <p className="sup-contact-label">Phone</p>
              <p className="sup-contact-value">+91 22 4567 8900</p>
              <p className="sup-contact-sub">Mon–Sat, 9:00 AM–7:00 PM IST</p>
            </div>
          </div>
          <div className="sup-contact-card">
            <div className="sup-contact-icon"><FaRegClock /></div>
            <div>
              <p className="sup-contact-label">Office hours</p>
              <p className="sup-contact-value">9:00 AM – 7:00 PM</p>
              <p className="sup-contact-sub">India Standard Time, Mon–Sat</p>
            </div>
          </div>
        </div>

        <div className="sup-grid">
          <div>
            <div className="sup-card">
              <h2 className="sup-card-title">Frequently asked</h2>
              <p className="sup-card-desc">The most common questions, answered.</p>

              <div className="sup-faq-list">
                {FAQS.map((item, i) => (
                  <div className={`sup-faq-item${openFaq === i ? " open" : ""}`} key={item.q}>
                    <button
                      type="button"
                      className="sup-faq-question"
                      onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                    >
                      {item.q}
                      <span className="sup-faq-icon">+</span>
                    </button>
                    <div className="sup-faq-answer">
                      <p>{item.a}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="sup-card">
              <h2 className="sup-card-title">Track a ticket</h2>
              <p className="sup-card-desc">Enter your ticket ID to see its current status.</p>

              <div className="sup-tracker-input-row">
                <input
                  type="text"
                  className="sup-input"
                  placeholder="e.g. TCK-48213"
                  value={trackInput}
                  onChange={(e) => setTrackInput(e.target.value)}
                />
                <button type="button" className="sup-btn-primary" onClick={handleTrack}>Check status</button>
              </div>

              {trackedTicket && (
                <div className="sup-tracker-result visible">
                  <div className="sup-tracker-meta">
                    <div>
                      <p className="sup-tracker-meta-label">Ticket</p>
                      <p className="sup-tracker-meta-value">{trackedTicket.ticket_number}</p>
                    </div>
                    <div>
                      <p className="sup-tracker-meta-label">Category</p>
                      <p className="sup-tracker-meta-value">{trackedTicket.category}</p>
                    </div>
                  </div>

                  <div className="sup-route">
                    <div className="sup-route-stop">
                      <div className="sup-route-dot" />
                      <span className="sup-route-stop-label">Submitted</span>
                      <span className="sup-route-stop-time">Aug 5, 10:14 AM</span>
                    </div>
                    <div className="sup-route-line" />
                    <div className="sup-route-stop">
                      <div className="sup-route-dot" />
                      <span className="sup-route-stop-label">{trackedTicket.status === "pending" ? "Pending" : "In review"}</span>
                      <span className="sup-route-stop-time">Awaiting support</span>
                    </div>
                    <div className="sup-route-line pending" />
                    <div className="sup-route-stop pending">
                      <div className="sup-route-dot" />
                      <span className="sup-route-stop-label">Resolved</span>
                      <span className="sup-route-stop-time">—</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="sup-card">
              <h2 className="sup-card-title">Submit a ticket</h2>
              <p className="sup-card-desc">Can&apos;t find your answer above? Send us the details and we&apos;ll follow up by email.</p>

              <form onSubmit={handleSubmit}>
                <div className="sup-form-row">
                  <div className="sup-form-group">
                    <label className="sup-label" htmlFor="sup-name">Full name</label>
                    <input className="sup-input" type="text" id="sup-name" required value={user?.full_name || ""} disabled />
                  </div>
                  <div className="sup-form-group">
                    <label className="sup-label" htmlFor="sup-email">Email</label>
                    <input className="sup-input" type="email" id="sup-email" required value={user?.email || ""} disabled />
                  </div>
                </div>

                <div className="sup-form-row">
                  <div className="sup-form-group">
                    <label className="sup-label" htmlFor="sup-category">Category</label>
                    <select className="sup-select" id="sup-category" value={ticket.category} onChange={(e) => updateTicket("category", e.target.value)}>
                      <option>Quote issue</option>
                      <option>Shipment tracking</option>
                      <option>Billing</option>
                      <option>Account</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div className="sup-form-group">
                    <label className="sup-label" htmlFor="sup-ref">Shipment / quote ID (optional)</label>
                    <input className="sup-input" type="text" id="sup-ref" placeholder="e.g. SHP-10432" value={ticket.ref} onChange={(e) => updateTicket("ref", e.target.value)} />
                  </div>
                </div>

                <div className="sup-form-group sup-mb">
                  <label className="sup-label" htmlFor="sup-subject">Subject</label>
                  <input className="sup-input" type="text" id="sup-subject" required value={ticket.subject} onChange={(e) => updateTicket("subject", e.target.value)} />
                </div>

                <div className="sup-form-group sup-mb-lg">
                  <label className="sup-label" htmlFor="sup-message">Message</label>
                  <textarea className="sup-textarea" id="sup-message" required value={ticket.message} onChange={(e) => updateTicket("message", e.target.value)} />
                </div>

                <button type="submit" className="sup-btn-primary sup-btn-full" disabled={saving}>{saving ? "Submitting..." : "Submit ticket"}</button>

                {error && <p className="sup-error" role="alert">{error}</p>}

                {submitted && (
                  <div className="sup-form-success visible">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                    Ticket submitted — we&apos;ll email you shortly.
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}
