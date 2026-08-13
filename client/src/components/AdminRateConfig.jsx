import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaSlidersH, FaGasPump, FaCalendarAlt, FaCoins, FaCheck } from "react-icons/fa";
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

const DEFAULT_CONFIG = {
  currency: "INR",
  base_handling_fee: 1500,
  rate_per_km_per_tonne: 4.5,
  fuel_surcharge_pct: 12.5,
  quote_validity_days: 14,
  cargo_multipliers: {
    general: 1.0,
    express: 1.4,
    cold_chain: 1.75,
    hazardous: 2.2,
  },
  mode_multipliers: {
    road: 1.0,
    rail: 0.85,
    air: 2.8,
    ocean: 0.65,
  },
};

export default function AdminRateConfig() {
  const { token } = useAuth();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    getRateConfig(token)
      .then((res) => setConfig(res || DEFAULT_CONFIG))
      .catch(() => setConfig(DEFAULT_CONFIG))
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
      setConfig(updated || payload);
      setSuccessMsg("Rate config updated — new quotes will automatically use these rates.");
    } catch (err) {
      setError(err.message || "Failed to update rate configuration on backend API.");
    } finally {
      setSaving(false);
    }
  }

  const currentConfig = config || DEFAULT_CONFIG;

  return (
    <div className="agent-overview">
      {/* Header Banner */}
      <div className="agent-header-banner">
        <div className="agent-title-block">
          <h1>FreightAI Rate & Pricing Engine</h1>
          <p>Configure global base freight rates, fuel surcharges, and risk multipliers</p>
        </div>
        <div className="agent-badge-tag">
          <span className="agent-badge-dot" />
          System Rate Governance
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="agent-kpi-grid">
        <div className="agent-kpi-card">
          <div className="agent-kpi-top">
            <span className="agent-kpi-label">Base Handling Fee</span>
            <div className="agent-kpi-icon icon-amber"><FaSlidersH /></div>
          </div>
          <div className="agent-kpi-value">₹{Number(currentConfig.base_handling_fee || 1500).toLocaleString("en-IN")}</div>
          <div className="agent-kpi-sub">Standard per-quote admin fee</div>
        </div>

        <div className="agent-kpi-card">
          <div className="agent-kpi-top">
            <span className="agent-kpi-label">Fuel Surcharge Index</span>
            <div className="agent-kpi-icon icon-cyan"><FaGasPump /></div>
          </div>
          <div className="agent-kpi-value">{currentConfig.fuel_surcharge_pct || 12.5}%</div>
          <div className="agent-kpi-sub">BAF surcharge rate</div>
        </div>

        <div className="agent-kpi-card">
          <div className="agent-kpi-top">
            <span className="agent-kpi-label">Quote Validity</span>
            <div className="agent-kpi-icon icon-teal"><FaCalendarAlt /></div>
          </div>
          <div className="agent-kpi-value">{currentConfig.quote_validity_days || 14} Days</div>
          <div className="agent-kpi-sub">Binding quote lock window</div>
        </div>

        <div className="agent-kpi-card">
          <div className="agent-kpi-top">
            <span className="agent-kpi-label">Base Currency</span>
            <div className="agent-kpi-icon icon-purple"><FaCoins /></div>
          </div>
          <div className="agent-kpi-value">{currentConfig.currency || "INR"}</div>
          <div className="agent-kpi-sub">Platform billing currency</div>
        </div>
      </div>

      {/* Main Configuration Card */}
      <div className="agent-panel-card" style={{ maxWidth: "1000px" }}>
        <div className="agent-panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 className="agent-panel-title">System Base Rate Parameters</h2>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
              Editing these parameters updates the pricing engine for all newly generated quotes.
            </p>
          </div>
          <Link to="/dashboard/user-management" className="agent-btn-sm" style={{ textDecoration: "none" }}>
            User Management &rarr;
          </Link>
        </div>

        {error && <div style={{ color: "#ef4444", fontWeight: "600", marginBottom: "16px" }}>{error}</div>}
        {successMsg && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#059669", fontWeight: "700", marginBottom: "16px" }}>
            <FaCheck /> {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ marginTop: "20px" }}>
          <div className="admin-grid-3">
            <div className="modal-field">
              <label>Currency Code</label>
              <input
                type="text"
                className="desk-select"
                maxLength={3}
                value={currentConfig.currency}
                onChange={(e) => updateField("currency", e.target.value.toUpperCase())}
              />
            </div>

            <div className="modal-field">
              <label>Base Handling Fee (₹)</label>
              <input
                type="number"
                className="desk-select"
                min="0"
                step="1"
                value={currentConfig.base_handling_fee}
                onChange={(e) => updateField("base_handling_fee", e.target.value)}
              />
            </div>

            <div className="modal-field">
              <label>Rate per KM per Tonne (₹)</label>
              <input
                type="number"
                className="desk-select"
                min="0"
                step="0.1"
                value={currentConfig.rate_per_km_per_tonne}
                onChange={(e) => updateField("rate_per_km_per_tonne", e.target.value)}
              />
            </div>

            <div className="modal-field">
              <label>Fuel Surcharge (%)</label>
              <input
                type="number"
                className="desk-select"
                min="0"
                max="100"
                step="0.1"
                value={currentConfig.fuel_surcharge_pct}
                onChange={(e) => updateField("fuel_surcharge_pct", e.target.value)}
              />
            </div>

            <div className="modal-field">
              <label>Quote Validity (Days)</label>
              <input
                type="number"
                className="desk-select"
                min="1"
                max="90"
                value={currentConfig.quote_validity_days}
                onChange={(e) => updateField("quote_validity_days", e.target.value)}
              />
            </div>
          </div>

          <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a", marginTop: "28px", marginBottom: "12px", borderTop: "1px solid #e2e8f0", paddingTop: "20px" }}>
            Cargo Risk Multipliers
          </h3>
          <div className="admin-grid-4">
            {Object.entries(currentConfig.cargo_multipliers || {}).map(([key, value]) => (
              <div className="modal-field" key={key}>
                <label>{CARGO_LABELS[key] || key}</label>
                <input
                  type="number"
                  className="desk-select"
                  min="0"
                  step="0.05"
                  value={value}
                  onChange={(e) => updateMultiplier("cargo_multipliers", key, e.target.value)}
                />
              </div>
            ))}
          </div>

          <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a", marginTop: "28px", marginBottom: "12px", borderTop: "1px solid #e2e8f0", paddingTop: "20px" }}>
            Transport Mode Multipliers
          </h3>
          <div className="admin-grid-4">
            {Object.entries(currentConfig.mode_multipliers || {}).map(([key, value]) => (
              <div className="modal-field" key={key}>
                <label>{MODE_LABELS[key] || key}</label>
                <input
                  type="number"
                  className="desk-select"
                  min="0"
                  step="0.05"
                  value={value}
                  onChange={(e) => updateMultiplier("mode_multipliers", key, e.target.value)}
                />
              </div>
            ))}
          </div>

          <div style={{ marginTop: "28px", display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" className="agent-action-btn" disabled={saving}>
              {saving ? "Saving Changes..." : "Save Rate Configuration"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
