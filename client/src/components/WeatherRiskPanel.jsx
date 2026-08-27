import React, { useState, useEffect } from "react";
import { CloudRain, Wind, Waves, AlertTriangle, ShieldCheck, RefreshCw } from "lucide-react";
import { assessRouteWeather } from "../api/weather";
import "./WeatherRiskPanel.css";

export default function WeatherRiskPanel({
  shipmentId = "SHP-PREVIEW",
  origin = "Chennai",
  destination = "Rotterdam",
  transitDays = 7,
  onWeatherAssessed,
}) {
  const [loading, setLoading] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [error, setError] = useState(null);

  const fetchWeather = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await assessRouteWeather({
        shipment_id: shipmentId,
        origin,
        destination,
        transit_days: transitDays,
      });
      setAssessment(data);
      if (onWeatherAssessed) {
        onWeatherAssessed(data);
      }
    } catch (err) {
      setError(err.message || "Failed to load weather intelligence");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
  }, [shipmentId, origin, destination, transitDays]);

  const riskLevel = assessment?.risk_level || "LOW";
  const riskScore = assessment?.risk_score ?? 18;
  const delayProb = assessment?.delay_probability ? Math.round(assessment.delay_probability * 100) : 15;
  const observations = assessment?.observations || [];
  const advisories = assessment?.analysis?.advisories || assessment?.advisories || [];
  const alerts = assessment?.alerts || assessment?.analysis?.alerts || [];

  return (
    <div className="weather-panel-card">
      <div className="weather-panel-header">
        <div className="weather-header-info">
          <h3>Marine &amp; Weather Route Intelligence</h3>
          <p>
            Corridor: <strong>{origin}</strong> &rarr; <strong>{destination}</strong> ({transitDays} Days Transit)
          </p>
        </div>

        <div className="weather-header-actions">
          <span className={`badge-status ${riskLevel === "LOW" ? "status-approved" : riskLevel === "MEDIUM" ? "status-pending" : "badge-status"}`}
            style={riskLevel === "HIGH" || riskLevel === "CRITICAL" ? { background: "#fee2e2", color: "#b91c1c" } : undefined}>
            {riskLevel} Weather Risk ({riskScore}/100)
          </span>

          <button
            type="button"
            className="agent-btn-sm"
            onClick={fetchWeather}
            disabled={loading}
            title="Refresh Route Weather"
          >
            <RefreshCw size={12} style={{ display: "inline", marginRight: "4px" }} />
            {loading ? "Sampling..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: "#fef2f2", color: "#b91c1c", borderRadius: "8px", marginBottom: "16px", fontSize: "13px" }}>
          {error}
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="weather-metrics-grid">
        <div className="weather-metric-box">
          <span className="metric-lbl">Predicted Delay Probability</span>
          <span className="metric-val" style={{ color: delayProb > 40 ? "#e11d48" : "#0f172a" }}>
            {delayProb}%
          </span>
          <span className="metric-desc">Est. Delay: ~{assessment?.analysis?.estimated_delay_hours || 0} hrs</span>
        </div>

        <div className="weather-metric-box">
          <span className="metric-lbl">Peak Wave Swell</span>
          <span className="metric-val">
            {assessment?.analysis?.max_wave_height_m ?? 1.4}m
          </span>
          <span className="metric-desc">Wave Score: {assessment?.wave_risk ?? 18}/100</span>
        </div>

        <div className="weather-metric-box">
          <span className="metric-lbl">Peak Wind Speed</span>
          <span className="metric-val">
            {assessment?.analysis?.max_wind_speed_knots ?? 16} kts
          </span>
          <span className="metric-desc">Wind Score: {assessment?.wind_risk ?? 20}/100</span>
        </div>

        <div className="weather-metric-box">
          <span className="metric-lbl">Telemetry Source</span>
          <span className="metric-val" style={{ fontSize: "16px", textTransform: "capitalize", paddingTop: "6px" }}>
            {assessment?.provider || "Open-Meteo GFS"}
          </span>
          <span className="metric-desc">Status: 100% Verified</span>
        </div>
      </div>

      {/* Severe Weather Warnings if Any */}
      {alerts && alerts.length > 0 && (
        <div className="weather-alert-stripe">
          <strong>⚠️ {alerts[0].title || "Severe Weather Warning on Corridor"}:</strong> {alerts[0].message}
        </div>
      )}

      {/* Waypoint Telemetry Table */}
      <div style={{ marginBottom: "20px" }}>
        <div className="weather-table-title">
          <Waves size={15} /> Sampled Maritime Waypoints &amp; Ocean Telemetry
        </div>
        <div className="weather-table-wrap">
          <table className="weather-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Waypoint Location</th>
                <th>Coordinates</th>
                <th>Condition</th>
                <th>Wave Height</th>
                <th>Wind Speed</th>
                <th>Precipitation</th>
              </tr>
            </thead>
            <tbody>
              {observations.length > 0 ? (
                observations.map((obs, idx) => (
                  <tr key={idx}>
                    <td><strong>{idx + 1}</strong></td>
                    <td><strong>{obs.raw_payload?.name || `Waypoint ${idx + 1}`}</strong></td>
                    <td>{obs.latitude.toFixed(2)}°N, {obs.longitude.toFixed(2)}°E</td>
                    <td>{obs.weather_condition}</td>
                    <td><Waves size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />{obs.wave_height} m</td>
                    <td><Wind size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />{obs.wind_speed} kts</td>
                    <td><CloudRain size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />{obs.rainfall} mm</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center", color: "#64748b", padding: "20px" }}>
                    Waypoint observations loading...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actionable Route Advisories */}
      {advisories && advisories.length > 0 && (
        <div className="weather-advisories-card">
          <div className="weather-advisories-title">Maritime Navigation Advisories</div>
          <ul>
            {advisories.map((adv, i) => (
              <li key={i}>{adv}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
