import { useEffect, useState } from "react";
import { createSavedAddress, deleteSavedAddress, getSavedAddresses, updateSavedAddress } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import "./SavedAddresses.css";

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
  const { token } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    getSavedAddresses(token)
      .then((data) => {
        if (!cancelled) setAddresses(data);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message || "Unable to load saved addresses.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function openModal(address = null) {
    setEditingAddressId(address?.id || "");
    setForm(address ? { ...address, isDefault: address.isDefault } : EMPTY_FORM);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingAddressId("");
  }

  async function handleDelete(id) {
    setError("");
    try {
      await deleteSavedAddress(token, id);
      setAddresses((list) => list.filter((address) => address.id !== id));
    } catch (requestError) {
      setError(requestError.message || "Unable to delete this address.");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const addressPayload = {
        ...form,
        is_default: form.isDefault,
      };
      const newAddress = editingAddressId
        ? await updateSavedAddress(token, editingAddressId, addressPayload)
        : await createSavedAddress(token, addressPayload);
      setAddresses((list) =>
        editingAddressId
          ? list.map((address) => address.id === newAddress.id ? newAddress : { ...address, isDefault: newAddress.isDefault ? false : address.isDefault })
          : newAddress.isDefault ? [newAddress, ...list.map((address) => ({ ...address, isDefault: false }))] : [newAddress, ...list]
      );
      closeModal();
    } catch (requestError) {
      setError(requestError.message || "Unable to save this address.");
    } finally {
      setSaving(false);
    }
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

        {error && <p className="addr-error" role="alert">{error}</p>}

        {loading ? (
          <div className="addr-empty">Loading saved addresses...</div>
        ) : addresses.length === 0 ? (
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
                  <p className="addr-detail-text">{a.city}, {a.state} - {a.postal}</p>
                  <p className="addr-detail-text addr-country">{a.country}</p>

                  <div className="addr-meta-box">
                    <p className="addr-meta-hours">🕒 Hours: {a.hours || "—"}</p>
                    <p className="addr-meta-notes">🏗️ Notes: {a.notes || "—"}</p>
                  </div>
                </div>
                <div className="addr-card-footer">
                  <button type="button" className="addr-btn-ghost" onClick={() => openModal(a)}>
                    Edit
                  </button>
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
              <h3>{editingAddressId ? "Edit Saved Address" : "Add Saved Address"}</h3>
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
                      <option value="Both (Origin & Destination)">Both (Origin &amp; Destination)</option>
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
                  <button type="submit" className="addr-btn-primary" disabled={saving}>
                    {saving ? "Saving..." : editingAddressId ? "Save Changes" : "Save Address"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
