import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getRateConfig, updateRateConfig } from "../api/admin";
import "./AdminRateConfig.css";

const CARGO_LABELS = {
  general: "General Cargo",
  express: "Express Cargo",
  cold_chain: "Cold Chain",
  hazardous: "Hazardous Cargo",
};

const MODE_LABELS = { road: "Road", rail: "Rail", air: "Air", ocean: "Ocean" };

export default function AdminRateConfig() {
  const { token } = useAuth();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    getRateConfig(token)
      .then(setConfig)
      .catch((err) => setError(err.message || "Could not load rate config."))
      .finally(() => setLoading(false));
  }, [token]);

  function updateField(field, value) {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }

  function updateMultiplier(group, key, value) {
    setConfig((prev) => ({
      ...prev,
      [group]: { ...prev[group], [key]: value },
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setSaving(true);

    try {
      const payload = {
        currency: config.currency,
        base_handling_fee: Number(config.base_handling_fee),
        rate_per_km_per_tonne: Number(config.rate_per_km_per_tonne),
        fuel_surcharge_pct: Number(config.fuel_surcharge_pct),
        quote_validity_days: Number(config.quote_validity_days),
        cargo_multipliers: Object.fromEntries(
          Object.entries(config.cargo_multipliers).map(([k, v]) => [k, Number(v)]),
        ),
        mode_multipliers: Object.fromEntries(
          Object.entries(config.mode_multipliers).map(([k, v]) => [k, Number(v)]),
        ),
      };
      const updated = await updateRateConfig(token, payload);
      setConfig(updated);
      setSuccessMsg("Rate config updated — the next quote will use these values.");
    } catch (err) {
      setError(err.message || "Could not save rate config.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="admin-page">
      <div className="admin-panel">
        <div className="admin-top-row">
          <Link to="/dashboard" className="admin-back-link">
            &larr; Back to dashboard
          </Link>
          <Link to="/admin/users" className="admin-nav-link">
            User Management &rarr;
          </Link>
        </div>
        <h1>Pricing Rate Configuration</h1>
        <p className="admin-subtitle">
          Editing these values changes the price of every quote generated from now on.
        </p>

        {loading && <p className="admin-muted">Loading...</p>}
        {error && <p className="admin-error">{error}</p>}
        {successMsg && <p className="admin-success">{successMsg}</p>}

        {!loading && config && (
          <form onSubmit={handleSubmit} className="admin-form">
            <div className="admin-grid">
              <label className="admin-field">
                <span>Currency</span>
                <input
                  type="text"
                  maxLength={3}
                  value={config.currency}
                  onChange={(e) => updateField("currency", e.target.value.toUpperCase())}
                />
              </label>

              <label className="admin-field">
                <span>Base handling fee</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={config.base_handling_fee}
                  onChange={(e) => updateField("base_handling_fee", e.target.value)}
                />
              </label>

              <label className="admin-field">
                <span>Rate per km per tonne</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={config.rate_per_km_per_tonne}
                  onChange={(e) => updateField("rate_per_km_per_tonne", e.target.value)}
                />
              </label>

              <label className="admin-field">
                <span>Fuel surcharge (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={config.fuel_surcharge_pct}
                  onChange={(e) => updateField("fuel_surcharge_pct", e.target.value)}
                />
              </label>

              <label className="admin-field">
                <span>Quote validity (days)</span>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={config.quote_validity_days}
                  onChange={(e) => updateField("quote_validity_days", e.target.value)}
                />
              </label>
            </div>

            <h2>Cargo type multipliers</h2>
            <div className="admin-grid">
              {Object.entries(config.cargo_multipliers).map(([key, value]) => (
                <label className="admin-field" key={key}>
                  <span>{CARGO_LABELS[key] || key}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={value}
                    onChange={(e) => updateMultiplier("cargo_multipliers", key, e.target.value)}
                  />
                </label>
              ))}
            </div>

            <h2>Transport mode multipliers</h2>
            <div className="admin-grid">
              {Object.entries(config.mode_multipliers).map(([key, value]) => (
                <label className="admin-field" key={key}>
                  <span>{MODE_LABELS[key] || key}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={value}
                    onChange={(e) => updateMultiplier("mode_multipliers", key, e.target.value)}
                  />
                </label>
              ))}
            </div>

            {config.updated_at && (
              <p className="admin-muted admin-updated-note">
                Last updated {new Date(config.updated_at).toLocaleString()}
                {config.updated_by ? ` by ${config.updated_by}` : ""}
              </p>
            )}

            <button type="submit" className="admin-save-btn" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
