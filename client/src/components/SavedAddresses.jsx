import { useState } from "react";
import "./SavedAddresses.css";

const INITIAL_ADDRESSES = [
  {
    id: "addr-1",
    label: "Central Warehouse",
    type: "Pickup (Origin)",
    isDefault: true,
    contact: "Rajesh Sharma",
    phone: "+91 98765 43210",
    email: "dispatch@centralwh.com",
    street: "Plot 42, Industrial Area Phase 1",
    cityState: "Mumbai, Maharashtra - 400001",
    country: "India",
    hours: "Mon-Sat: 9 AM - 6 PM",
    notes: "Dock high available, Forklift on site.",
  },
  {
    id: "addr-2",
    label: "Retail Flagship Store",
    type: "Delivery (Destination)",
    isDefault: false,
    contact: "Ananya Verma",
    phone: "+91 91234 56789",
    email: "store.mumbai@retail.com",
    street: "Store #12, Grand Avenue Mall",
    cityState: "Pune, Maharashtra - 411001",
    country: "India",
    hours: "Mon-Sun: 10 AM - 9 PM",
    notes: "Ground-level loading only, strict morning delivery window.",
  },
  {
    id: "addr-3",
    label: "North Regional Hub",
    type: "Both (Origin & Destination)",
    isDefault: false,
    contact: "Vikram Singh",
    phone: "+91 99887 76655",
    email: "northhub@logistics.com",
    street: "Sector 18, Transport Nagar",
    cityState: "Delhi, NCR - 110033",
    country: "India",
    hours: "24/7 Operations",
    notes: "Multi-dock bay, heavy container truck entry permitted.",
  },
];

const EMPTY_FORM = {
  label: "",
  type: "Pickup (Origin)",
  contact: "",
  phone: "",
  email: "",
  street: "",
  city: "",
  state: "",
  postal: "",
  country: "India",
  hours: "",
  notes: "",
  isDefault: false,
};

export default function SavedAddresses() {
  const [addresses, setAddresses] = useState(INITIAL_ADDRESSES);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function openModal() {
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  function handleDelete(id) {
    setAddresses((list) => list.filter((a) => a.id !== id));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const newAddress = {
      id: `addr-${Date.now()}`,
      label: form.label,
      type: form.type,
      isDefault: form.isDefault,
      contact: form.contact,
      phone: form.phone,
      email: form.email,
      street: form.street,
      cityState: `${form.city}, ${form.state} - ${form.postal}`,
      country: form.country,
      hours: form.hours,
      notes: form.notes,
    };
    setAddresses((list) =>
      newAddress.isDefault ? [newAddress, ...list.map((a) => ({ ...a, isDefault: false }))] : [...list, newAddress]
    );
    closeModal();
  }

  return (
    <section className="addr-page" aria-labelledby="addr-title">
      <div className="addr-shell">
        <div className="addr-eyebrow">
          <span>Retailer Account Management</span>
        </div>
        <h1 id="addr-title" className="addr-h1">Saved Addresses</h1>
        <p className="addr-sub">Manage pickup and delivery warehouse locations, contact personnel, dock notes, and access instructions.</p>

        <div className="addr-top-action">
          <div>
            <h2>Your Locations</h2>
            <p>Fully optimized for retailer dispatch workflows.</p>
          </div>
          <button type="button" className="addr-btn-primary" onClick={openModal}>
            + Add new address
          </button>
        </div>

        {addresses.length === 0 ? (
          <div className="addr-empty">No saved addresses yet — add your first warehouse or store location.</div>
        ) : (
          <div className="addr-grid">
            {addresses.map((a) => (
              <article className="addr-card" key={a.id}>
                <div>
                  <div className="addr-badge-row">
                    <div className="addr-badge-group">
                      <span className="addr-label-tag">{a.label}</span>
                      <span className="addr-type-tag">{a.type}</span>
                    </div>
                    {a.isDefault && <span className="addr-default-tag">Default</span>}
                  </div>
                  <p className="addr-contact">{a.contact}</p>
                  <p className="addr-detail-text">📞 {a.phone} | ✉️ {a.email}</p>
                  <p className="addr-detail-text addr-mt">{a.street}</p>
                  <p className="addr-detail-text">{a.cityState}</p>
                  <p className="addr-detail-text addr-country">{a.country}</p>

                  <div className="addr-meta-box">
                    <p className="addr-meta-hours">🕒 Hours: {a.hours || "—"}</p>
                    <p className="addr-meta-notes">🏗️ Notes: {a.notes || "—"}</p>
                  </div>
                </div>
                <div className="addr-card-footer">
                  <button type="button" className="addr-btn-ghost" onClick={() => handleDelete(a.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="addr-modal-backdrop open" onClick={closeModal}>
          <div className="addr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="addr-modal-header">
              <h3>Add Saved Address</h3>
              <button type="button" className="addr-modal-close" onClick={closeModal} aria-label="Close">&times;</button>
            </div>
            <div className="addr-modal-body">
              <form onSubmit={handleSubmit}>
                <div className="addr-form-row">
                  <div className="addr-form-group">
                    <label className="addr-label" htmlFor="addr-label-input">Location Label / Alias</label>
                    <input id="addr-label-input" className="addr-input" placeholder="e.g. Central Warehouse" required value={form.label} onChange={(e) => update("label", e.target.value)} />
                  </div>
                  <div className="addr-form-group">
                    <label className="addr-label" htmlFor="addr-type-input">Facility Role</label>
                    <select id="addr-type-input" className="addr-select" value={form.type} onChange={(e) => update("type", e.target.value)}>
                      <option value="Pickup (Origin)">Pickup (Origin)</option>
                      <option value="Delivery (Destination)">Delivery (Destination)</option>
                      <option value="Both">Both (Origin &amp; Destination)</option>
                    </select>
                  </div>
                </div>

                <div className="addr-form-row">
                  <div className="addr-form-group">
                    <label className="addr-label" htmlFor="addr-contact-input">Contact Person Name</label>
                    <input id="addr-contact-input" className="addr-input" placeholder="Full name" required value={form.contact} onChange={(e) => update("contact", e.target.value)} />
                  </div>
                  <div className="addr-form-group">
                    <label className="addr-label" htmlFor="addr-phone-input">Phone Number</label>
                    <input id="addr-phone-input" type="tel" className="addr-input" placeholder="+91 XXXXX XXXXX" required value={form.phone} onChange={(e) => update("phone", e.target.value)} />
                  </div>
                </div>

                <div className="addr-form-group addr-mb">
                  <label className="addr-label" htmlFor="addr-email-input">Email Address</label>
                  <input id="addr-email-input" type="email" className="addr-input" placeholder="dispatch@warehouse.com" required value={form.email} onChange={(e) => update("email", e.target.value)} />
                </div>

                <div className="addr-form-group addr-mb">
                  <label className="addr-label" htmlFor="addr-street-input">Full Street Address</label>
                  <input id="addr-street-input" className="addr-input" placeholder="Street line, suite, unit" required value={form.street} onChange={(e) => update("street", e.target.value)} />
                </div>

                <div className="addr-form-row">
                  <div className="addr-form-group">
                    <label className="addr-label" htmlFor="addr-city-input">City</label>
                    <input id="addr-city-input" className="addr-input" required value={form.city} onChange={(e) => update("city", e.target.value)} />
                  </div>
                  <div className="addr-form-group">
                    <label className="addr-label" htmlFor="addr-state-input">State / Province</label>
                    <input id="addr-state-input" className="addr-input" required value={form.state} onChange={(e) => update("state", e.target.value)} />
                  </div>
                </div>

                <div className="addr-form-row">
                  <div className="addr-form-group">
                    <label className="addr-label" htmlFor="addr-postal-input">Postal / ZIP Code</label>
                    <input id="addr-postal-input" className="addr-input" required value={form.postal} onChange={(e) => update("postal", e.target.value)} />
                  </div>
                  <div className="addr-form-group">
                    <label className="addr-label" htmlFor="addr-country-input">Country</label>
                    <input id="addr-country-input" className="addr-input" required value={form.country} onChange={(e) => update("country", e.target.value)} />
                  </div>
                </div>

                <div className="addr-form-row">
                  <div className="addr-form-group">
                    <label className="addr-label" htmlFor="addr-hours-input">Operating Hours / Window</label>
                    <input id="addr-hours-input" className="addr-input" placeholder="e.g. Mon-Sat: 9 AM - 6 PM" value={form.hours} onChange={(e) => update("hours", e.target.value)} />
                  </div>
                  <div className="addr-form-group">
                    <label className="addr-label" htmlFor="addr-notes-input">Dock &amp; Access Notes</label>
                    <input id="addr-notes-input" className="addr-input" placeholder="e.g. Dock high available, Forklift on site" value={form.notes} onChange={(e) => update("notes", e.target.value)} />
                  </div>
                </div>

                <div className="addr-checkbox-row">
                  <input id="addr-default-input" type="checkbox" checked={form.isDefault} onChange={(e) => update("isDefault", e.target.checked)} />
                  <label htmlFor="addr-default-input">Set as default location for quotes</label>
                </div>

                <div className="addr-form-actions">
                  <button type="button" className="addr-btn-ghost" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="addr-btn-primary">Save Address</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
