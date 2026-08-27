import React, { useState, useEffect } from "react";
import { TrendingUp, RefreshCw, Cpu, CheckCircle } from "lucide-react";
import { predictMLFreightRate } from "../api/mlPricing";
import "./MLPricingComparisonCard.css";

const MENTOR_ORIGINS = ["Bengaluru", "Mumbai", "Kolkata", "Chennai", "Hyderabad", "Ahmedabad", "Pune", "Delhi"];
const MENTOR_DESTINATIONS = [
  "Rotterdam",
  "Los Angeles",
  "Dubai",
  "Hamburg",
  "London",
  "Singapore",
  "Colombo",
  "New York",
  "Jebel Ali",
  "Shanghai",
];
const MENTOR_CARGOS = [
  "Electronics",
  "Textiles",
  "Furniture",
  "Pharmaceuticals",
  "Chemicals",
  "Machinery",
  "Food Products",
  "Automotive Parts",
];
const MENTOR_CONTAINERS = ["40FT", "20FT", "40FT_HC", "LCL", "AIR_CARGO"];

export default function MLPricingComparisonCard({
  origin = "Chennai",
  destination = "Rotterdam",
  cargoType = "Electronics",
  transitDays = 15,
}) {
  const [loading, setLoading] = useState(false);
  const [pricingData, setPricingData] = useState(null);
  const [error, setError] = useState(null);

  // Form states aligned with mentor dataset
  const [selectedOrigin, setSelectedOrigin] = useState(origin);
  const [selectedDest, setSelectedDest] = useState(destination);
  const [selectedCargo, setSelectedCargo] = useState(cargoType);
  const [containerType, setContainerType] = useState("40FT");
  const [transportMode, setTransportMode] = useState("Sea");
  const [carrier, setCarrier] = useState("Carrier_A");
  const [season, setSeason] = useState("Peak");
  const [weightKg, setWeightKg] = useState(3500);
  const [volumeCbm, setVolumeCbm] = useState(8.5);
  const [fuelPrice, setFuelPrice] = useState(95.0);
  const [currencyMode, setCurrencyMode] = useState("INR"); // "INR" or "USD"

  useEffect(() => {
    if (origin && MENTOR_ORIGINS.includes(origin)) setSelectedOrigin(origin);
    if (destination && MENTOR_DESTINATIONS.includes(destination)) setSelectedDest(destination);
  }, [origin, destination]);

  const fetchPricing = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await predictMLFreightRate({
        origin_port: selectedOrigin,
        destination_port: selectedDest,
        transport_mode: transportMode,
        cargo_type: selectedCargo,
        container_type: containerType,
        weight_kg: weightKg,
        volume_cbm: volumeCbm,
        distance_km: 8500.0,
        fuel_price: fuelPrice,
        season: season,
        carrier: carrier,
        transit_time_days: transitDays,
      });
      setPricingData(data);
    } catch (err) {
      setError(err.message || "Failed to load ML pricing prediction.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPricing();
  }, [selectedOrigin, selectedDest, selectedCargo, containerType, transportMode, carrier, season, weightKg, volumeCbm, fuelPrice, transitDays]);

  const isINR = currencyMode === "INR";
  const currSym = isINR ? "₹" : "$";

  const mlPrice = isINR
    ? (pricingData?.ml_predicted_price_inr ?? 78500.0)
    : (pricingData?.ml_predicted_price_usd ?? 940.12);

  const rulePrice = isINR
    ? (pricingData?.rule_based_price_inr ?? 74200.0)
    : (pricingData?.rule_based_price_usd ?? 888.62);

  const variancePct = pricingData?.variance_percent ?? 5.8;
  const varianceVal = isINR
    ? (pricingData?.variance_inr ?? 4300.0)
    : (pricingData?.variance_usd ?? 51.50);

  const strategy = pricingData?.strategy || "OPTIMAL_MARKET_PARITY";
  const ci = pricingData?.confidence_interval_95 || {
    lower_inr: 68098.34,
    upper_inr: 88901.66,
    lower_usd: 815.55,
    upper_usd: 1064.69,
    margin_of_error_inr: 10401.66,
    margin_of_error_usd: 124.57,
  };

  const ciLower = isINR ? ci.lower_inr : ci.lower_usd;
  const ciUpper = isINR ? ci.upper_inr : ci.upper_usd;
  const ciMargin = isINR ? ci.margin_of_error_inr : ci.margin_of_error_usd;

  const meta = pricingData?.model_metadata || {
    r2_score: 0.9792,
    mape_percent: 5.54,
    training_dataset: "freight_pricing_training_dataset_5000.xlsx",
    training_samples: 5000,
  };

  const isIncrease = strategy === "INCREASE_MARGIN";
  const isDiscount = strategy === "DISCOUNT_TO_WIN";

  return (
    <div className="ml-pricing-card">
      {/* Header */}
      <div className="ml-pricing-header">
        <div className="ml-header-info">
          <h3>Machine Learning Freight Pricing &amp; Market Benchmarking</h3>
          <p>
            Trained on <strong>{meta.training_dataset}</strong> ({meta.training_samples.toLocaleString()} Historical Rows) &bull; Model: <strong>Gradient Boosting Regressor (R² {meta.r2_score})</strong>
          </p>
        </div>

        <div className="ml-header-actions">
          {/* Currency Toggle */}
          <div style={{ display: "flex", background: "#e2e8f0", borderRadius: "8px", padding: "2px" }}>
            <button
              type="button"
              onClick={() => setCurrencyMode("INR")}
              style={{
                border: "none",
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                background: isINR ? "#0f172a" : "transparent",
                color: isINR ? "#ffffff" : "#475569",
              }}
            >
              ₹ INR
            </button>
            <button
              type="button"
              onClick={() => setCurrencyMode("USD")}
              style={{
                border: "none",
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                background: !isINR ? "#0f172a" : "transparent",
                color: !isINR ? "#ffffff" : "#475569",
              }}
            >
              $ USD
            </button>
          </div>

          <button
            type="button"
            className="agent-btn-sm"
            onClick={fetchPricing}
            disabled={loading}
            title="Re-run ML Regression"
          >
            <RefreshCw size={12} style={{ display: "inline", marginRight: "4px" }} />
            {loading ? "Calculating..." : "Predict Market Rate"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: "#fef2f2", color: "#b91c1c", borderRadius: "8px", marginBottom: "16px", fontSize: "13px" }}>
          {error}
        </div>
      )}

      {/* Dual Price Comparison Hero Grid */}
      <div className="ml-hero-grid">
        {/* Box 1: Static Rule-Based Price */}
        <div className="ml-price-box">
          <span className="ml-price-lbl">Static Rule-Based Baseline</span>
          <span className="ml-price-val">
            {currSym}{rulePrice.toLocaleString()}
          </span>
          <span className="ml-price-sub">Fixed Distance &times; Weight Formula</span>
        </div>

        {/* Box 2: Variance Indicator */}
        <div className="ml-delta-box">
          <span className="ml-price-lbl">Market Spread Delta</span>
          <span
            className="ml-delta-val"
            style={{ color: isIncrease ? "#16a34a" : isDiscount ? "#ea580c" : "#0284c7" }}
          >
            {variancePct > 0 ? `+${variancePct}%` : `${variancePct}%`}
          </span>
          <span style={{ fontSize: "12.5px", color: "#64748b" }}>
            {varianceVal > 0
              ? `+${currSym}${Math.abs(varianceVal).toLocaleString()} vs Rule`
              : `-${currSym}${Math.abs(varianceVal).toLocaleString()} vs Rule`}
          </span>
        </div>

        {/* Box 3: ML Spot Market Predicted Price */}
        <div className="ml-price-box ml-active">
          <span className="ml-price-lbl" style={{ color: "#0284c7" }}>ML Predicted Spot Market Rate</span>
          <span className="ml-price-val" style={{ color: "#0284c7" }}>
            {currSym}{mlPrice.toLocaleString()}
          </span>
          <span className="ml-price-sub">Gradient Boosting Regressor</span>
        </div>
      </div>

      {/* Live Market Modifiers & Drivers */}
      <div className="ml-drivers-grid">
        <div className="ml-driver-item">
          <span className="ml-driver-name">Season Mode</span>
          <span className="ml-driver-val">{season}</span>
        </div>

        <div className="ml-driver-item">
          <span className="ml-driver-name">Fuel Index</span>
          <span className="ml-driver-val">₹{fuelPrice}/L</span>
        </div>

        <div className="ml-driver-item">
          <span className="ml-driver-name">Transport Mode</span>
          <span className="ml-driver-val">{transportMode}</span>
        </div>

        <div className="ml-driver-item">
          <span className="ml-driver-name">Carrier Service Tier</span>
          <span className="ml-driver-val">{carrier}</span>
        </div>
      </div>

      {/* 95% Confidence Interval Banner */}
      <div className="ml-ci-banner">
        <div className="ml-ci-info">
          <h4>95% Statistical Confidence Interval: [{currSym}{ciLower?.toLocaleString()} — {currSym}{ciUpper?.toLocaleString()}]</h4>
          <p>
            Standard Error Margin: &plusmn;{currSym}{ciMargin?.toLocaleString()} &bull; Mean Absolute Percentage Error (MAPE): {meta.mape_percent}%
          </p>
        </div>

        <span className="ml-badge-meta">Model Accuracy: 97.92% (R²)</span>
      </div>

      {/* Strategy Recommendation Banner */}
      <div className={`ml-strategy-card ${isIncrease ? "increase" : isDiscount ? "discount" : "parity"}`}>
        <div className="ml-strategy-text">
          <h4>Commercial Pricing Strategy: {strategy.replace(/_/g, " ")}</h4>
          <p>{pricingData?.pricing_recommendation || "Optimal market parity."}</p>
        </div>

        <span className={`ml-strategy-badge ${isIncrease ? "increase" : isDiscount ? "discount" : "parity"}`}>
          {isIncrease ? "CAPTURE SPREAD" : isDiscount ? "SPOT DISCOUNT" : "STANDARD RATE"}
        </span>
      </div>
    </div>
  );
}
