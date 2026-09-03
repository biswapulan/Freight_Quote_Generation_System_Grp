import React, { useState } from "react";
import WeatherRiskPanel from "./WeatherRiskPanel";
import CustomsComplianceCard from "./CustomsComplianceCard";
import RiskExplainabilityCard from "./RiskExplainabilityCard";
import MLPricingComparisonCard from "./MLPricingComparisonCard";
import "./M3IntelligenceDashboard.css";

// 11 Global Major Trade Corridors across Asia, Europe, North America, Middle East, & Oceania
const GLOBAL_TRADE_CORRIDORS = [
  {
    id: "CORR-01",
    name: "Asia → Europe Primary Trunk",
    origin: "Chennai",
    destination: "Rotterdam",
    commodity: "Solar Power Inverters & Static Converters",
    hs_code: "850440",
    incoterm: "CIF",
    transit_days: 22,
    region: "Asia-Europe",
  },
  {
    id: "CORR-02",
    name: "India → USA Hazardous Chemical Lane",
    origin: "Nhava Sheva",
    destination: "New York",
    commodity: "Industrial Methanol Solvent (Chemicals)",
    hs_code: "290511",
    incoterm: "FOB",
    transit_days: 26,
    region: "Transatlantic / India-US",
  },
  {
    id: "CORR-03",
    name: "Trans-Pacific Eastbound Corridor",
    origin: "Shanghai",
    destination: "Los Angeles",
    commodity: "Computing Hardware & Electronic Servers",
    hs_code: "847130",
    incoterm: "CIF",
    transit_days: 14,
    region: "Trans-Pacific",
  },
  {
    id: "CORR-04",
    name: "India → Middle East Fast Feeder",
    origin: "Nhava Sheva",
    destination: "Dubai",
    commodity: "Automotive Precision Components",
    hs_code: "870829",
    incoterm: "CIF",
    transit_days: 5,
    region: "Gulf Feeder",
  },
  {
    id: "CORR-05",
    name: "SE Asia → Middle East Perishables",
    origin: "Singapore",
    destination: "Dubai",
    commodity: "Organic Green Coffee Beans",
    hs_code: "090111",
    incoterm: "DDP",
    transit_days: 10,
    region: "Intra-Asia / Middle East",
  },
  {
    id: "CORR-06",
    name: "Far East → North Europe Gateway",
    origin: "Shanghai",
    destination: "Rotterdam",
    commodity: "Cotton Knitted Apparel & Fast Fashion",
    hs_code: "610910",
    incoterm: "FOB",
    transit_days: 28,
    region: "Asia-Europe",
  },
  {
    id: "CORR-07",
    name: "Europe → SE Asia Precision Trade",
    origin: "Hamburg",
    destination: "Singapore",
    commodity: "Precision Engineered Machinery",
    hs_code: "870829",
    incoterm: "CIF",
    transit_days: 24,
    region: "Europe-Asia",
  },
  {
    id: "CORR-08",
    name: "Subcontinent Pharma Express",
    origin: "Chennai",
    destination: "Colombo",
    commodity: "Temperature-Controlled Medicaments",
    hs_code: "300490",
    incoterm: "CIF",
    transit_days: 3,
    region: "Indian Ocean Regional",
  },
  {
    id: "CORR-09",
    name: "Japan → US West Coast Express",
    origin: "Tokyo",
    destination: "Los Angeles",
    commodity: "Robotics & Micro-Inverters",
    hs_code: "850440",
    incoterm: "CIF",
    transit_days: 11,
    region: "Trans-Pacific",
  },
  {
    id: "CORR-10",
    name: "SE Asia → Oceania Mining Supply",
    origin: "Singapore",
    destination: "Fremantle",
    commodity: "Digital Telemetry & Heavy Processing Units",
    hs_code: "847130",
    incoterm: "CIF",
    transit_days: 8,
    region: "Oceania",
  },
  {
    id: "CORR-11",
    name: "Embargo / Sanctions Security Test",
    origin: "Chennai",
    destination: "Singapore",
    commodity: "Revolvers & Munitions (Restricted Arms)",
    hs_code: "930200",
    incoterm: "CIF",
    transit_days: 6,
    region: "Compliance Security",
  },
];

// Global Ports Registry
const MASTER_PORTS = [
  "Chennai",
  "Nhava Sheva",
  "Mundra",
  "Kolkata",
  "Cochin",
  "Singapore",
  "Port Klang",
  "Shanghai",
  "Ningbo",
  "Shenzhen",
  "Hong Kong",
  "Busan",
  "Tokyo",
  "Colombo",
  "Dubai",
  "Rotterdam",
  "Antwerp",
  "Hamburg",
  "Felixstowe",
  "Los Angeles",
  "Long Beach",
  "New York",
  "Savannah",
  "Santos",
  "Sydney",
  "Fremantle",
];

// HS Code Reference Catalog
const MASTER_COMMODITIES = [
  { code: "850440", desc: "Solar Power Inverters & Static Converters", category: "Electronics" },
  { code: "847130", desc: "Computing Hardware & Digital Processing Units", category: "High-Tech" },
  { code: "290511", desc: "Industrial Methanol Solvent (Chemicals)", category: "Hazardous Class 3" },
  { code: "300490", desc: "Pharmaceuticals, Medicaments & Packaged Vaccines", category: "Pharma / Reefer" },
  { code: "090111", desc: "Organic Green Coffee Beans", category: "Agricultural Perishables" },
  { code: "870829", desc: "Automotive Precision Body Components", category: "Automotive" },
  { code: "610910", desc: "Cotton Knitted Apparel & Garments", category: "Textiles" },
  { code: "930200", desc: "Revolvers, Munitions & Military Firearms (Restricted)", category: "Prohibited / Arms" },
];

export default function M3IntelligenceDashboard({ mode = "all" }) {
  const [selectedLane, setSelectedLane] = useState(GLOBAL_TRADE_CORRIDORS[0]);
  const [customOrigin, setCustomOrigin] = useState(GLOBAL_TRADE_CORRIDORS[0].origin);
  const [customDest, setCustomDest] = useState(GLOBAL_TRADE_CORRIDORS[0].destination);
  const [customHS, setCustomHS] = useState(GLOBAL_TRADE_CORRIDORS[0].hs_code);
  const [customCommodity, setCustomCommodity] = useState(GLOBAL_TRADE_CORRIDORS[0].commodity);
  const [customIncoterm, setCustomIncoterm] = useState(GLOBAL_TRADE_CORRIDORS[0].incoterm);
  const [customTransit, setCustomTransit] = useState(GLOBAL_TRADE_CORRIDORS[0].transit_days);
  const [selectedRegion, setSelectedRegion] = useState("ALL");

  // Reactive sub-scores from modules
  const [weatherScore, setWeatherScore] = useState(20);
  const [customsScore, setCustomsScore] = useState(15);
  const [customsStatus, setCustomsStatus] = useState("APPROVED");

  const handleSelectLane = (lane) => {
    setSelectedLane(lane);
    setCustomOrigin(lane.origin);
    setCustomDest(lane.destination);
    setCustomHS(lane.hs_code);
    setCustomCommodity(lane.commodity);
    setCustomIncoterm(lane.incoterm);
    setCustomTransit(lane.transit_days);
  };

  const handleSelectCommodity = (hsCode) => {
    const found = MASTER_COMMODITIES.find((c) => c.code === hsCode);
    if (found) {
      setCustomHS(found.code);
      setCustomCommodity(found.desc);
    }
  };

  const handleWeatherAssessed = (data) => {
    if (data?.risk_score !== undefined) {
      setWeatherScore(data.risk_score);
    }
  };

  const handleComplianceUpdated = (data) => {
    if (data?.readiness_score !== undefined) {
      setCustomsScore(Math.max(0, 100 - data.readiness_score));
    }
    if (data?.status) {
      setCustomsStatus(data.status);
    }
  };

  const filteredCorridors =
    selectedRegion === "ALL"
      ? GLOBAL_TRADE_CORRIDORS
      : GLOBAL_TRADE_CORRIDORS.filter((c) => c.region === selectedRegion);

  const bannerTitle =
    mode === "pricing"
      ? "AI Pricing Monitor — Dynamic ML Rate Engine"
      : mode === "risk"
      ? "Risk Intelligence & Route Safety Suite"
      : "Milestone 3 — Intelligence & Compliance Suite";

  const bannerSubtitle =
    mode === "pricing"
      ? "Real-time machine learning freight predictions, multi-model regression benchmarks (Linear vs Random Forest vs Ridge), and container fuel elasticity modeling."
      : mode === "risk"
      ? "Global marine weather modeling, Open-Meteo telemetry, international HS tariff verification & multi-factor risk policy gating."
      : "Global Marine Weather Modeling, Open-Meteo Telemetry, International HS Tariff Verification & Multi-Factor Risk Policy Gating";

  const badgeText =
    mode === "pricing"
      ? "AI ML Pricing Engine (Active)"
      : mode === "risk"
      ? "Risk & Safety Engine (Active)"
      : "M3 Live Production Mode (Phases 1-4 Active)";

  return (
    <div className="m3-dashboard">
      {/* Top Banner */}
      <div className="m3-header-banner">
        <div className="m3-title-block">
          <h1>{bannerTitle}</h1>
          <p>{bannerSubtitle}</p>
        </div>
        <div className="m3-badge-tag">
          <span className="m3-badge-dot" />
          {badgeText}
        </div>
      </div>

      {/* Corridor & Shipment Specification Panel */}
      <div className="m3-filter-panel">
        <div className="m3-panel-header">
          <div>
            <h2 className="m3-panel-title">Trade Corridor &amp; Cargo Parameters</h2>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
              Select any pre-configured international corridor or customize any global port-pair and HS tariff classification.
            </p>
          </div>

          {/* Region Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12.5px", color: "#64748b", fontWeight: 600 }}>Filter Corridor:</span>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="desk-select"
              style={{ padding: "6px 12px", fontSize: "13px" }}
            >
              <option value="ALL">All Global Regions ({GLOBAL_TRADE_CORRIDORS.length})</option>
              <option value="Asia-Europe">Asia - Europe</option>
              <option value="Trans-Pacific">Trans-Pacific</option>
              <option value="Transatlantic / India-US">India - US Transatlantic</option>
              <option value="Gulf Feeder">Gulf Feeder</option>
              <option value="Intra-Asia / Middle East">SE Asia - Middle East</option>
              <option value="Oceania">Oceania</option>
              <option value="Compliance Security">Compliance Security (Embargo)</option>
            </select>
          </div>
        </div>

        {/* Global Trade Corridor Pills Grid */}
        <div className="lane-pills-row">
          {filteredCorridors.map((lane) => (
            <button
              key={lane.id}
              type="button"
              className={`lane-pill-btn ${selectedLane.id === lane.id ? "active" : ""}`}
              onClick={() => handleSelectLane(lane)}
            >
              <span>{lane.name}</span>
              <small style={{ opacity: 0.75, fontWeight: 700 }}>
                {lane.origin} &rarr; {lane.destination} ({lane.transit_days}d)
              </small>
            </button>
          ))}
        </div>

        {/* Detailed Form Parameter Selectors */}
        <div className="m3-inputs-grid">
          {/* Origin Port Select / Input */}
          <div className="m3-input-field">
            <label>Origin Port / Hub</label>
            <input
              type="text"
              list="origin-ports-list"
              value={customOrigin}
              onChange={(e) => setCustomOrigin(e.target.value)}
              placeholder="Select or type port..."
            />
            <datalist id="origin-ports-list">
              {MASTER_PORTS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>

          {/* Destination Port Select / Input */}
          <div className="m3-input-field">
            <label>Destination Port / Hub</label>
            <input
              type="text"
              list="dest-ports-list"
              value={customDest}
              onChange={(e) => setCustomDest(e.target.value)}
              placeholder="Select or type port..."
            />
            <datalist id="dest-ports-list">
              {MASTER_PORTS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>

          {/* Commodity & HS Code Dropdown */}
          <div className="m3-input-field" style={{ gridColumn: "span 2" }}>
            <label>HS Code Classification &amp; Commodity</label>
            <select
              value={customHS}
              onChange={(e) => handleSelectCommodity(e.target.value)}
            >
              {MASTER_COMMODITIES.map((c) => (
                <option key={c.code} value={c.code}>
                  HS {c.code} — {c.desc} [{c.category}]
                </option>
              ))}
            </select>
          </div>

          {/* Incoterm Select */}
          <div className="m3-input-field">
            <label>Incoterm</label>
            <select
              value={customIncoterm}
              onChange={(e) => setCustomIncoterm(e.target.value)}
            >
              <option value="CIF">CIF — Cost, Insurance &amp; Freight</option>
              <option value="FOB">FOB — Free on Board</option>
              <option value="DDP">DDP — Delivered Duty Paid (Import Clearance)</option>
              <option value="EXW">EXW — Ex Works</option>
              <option value="DAP">DAP — Delivered at Place</option>
            </select>
          </div>

          {/* Est Transit Days */}
          <div className="m3-input-field">
            <label>Estimated Transit Days</label>
            <input
              type="number"
              min="1"
              max="90"
              value={customTransit}
              onChange={(e) => setCustomTransit(parseInt(e.target.value) || 1)}
            />
          </div>
        </div>
      </div>

      {/* Intelligence Modules Stack */}
      <div className="m3-modules-stack">
        {/* Module 1: Weather Intelligence */}
        {(mode === "all" || mode === "risk") && (
          <WeatherRiskPanel
            shipmentId={selectedLane.id}
            origin={customOrigin}
            destination={customDest}
            transitDays={customTransit}
            onWeatherAssessed={handleWeatherAssessed}
          />
        )}

        {/* Module 2: Customs Compliance & RAG Engine */}
        {(mode === "all" || mode === "risk") && (
          <CustomsComplianceCard
            shipmentId={selectedLane.id}
            originCountry={customOrigin}
            destinationCountry={customDest}
            hsCode={customHS}
            commodity={customCommodity}
            incoterm={customIncoterm}
            onComplianceUpdated={handleComplianceUpdated}
          />
        )}

        {/* Module 3: Multi-Factor Risk Assessment & Policy Gating */}
        {(mode === "all" || mode === "risk") && (
          <RiskExplainabilityCard
            shipmentId={selectedLane.id}
            weatherScore={weatherScore}
            customsScore={customsScore}
            customsStatus={customsStatus}
            origin={customOrigin}
            destination={customDest}
            cargoType={customCommodity}
            hsCode={customHS}
          />
        )}

        {/* Module 4: Machine Learning Freight Pricing & Market Benchmarks */}
        {(mode === "all" || mode === "pricing") && (
          <MLPricingComparisonCard
            origin={customOrigin}
            destination={customDest}
            cargoType={customCommodity}
            transitDays={customTransit}
          />
        )}
      </div>
    </div>
  );
}

