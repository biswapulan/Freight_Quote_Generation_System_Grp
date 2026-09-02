import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Ship,
  Box,
  Plane,
  Truck,
  MapPin,
  ArrowLeftRight,
  Receipt,
  Clock,
  Navigation,
  Cloud,
  FileText,
  IndianRupee,
  PackageCheck,
  X,
  UserPlus,
  Globe,
  CheckCircle2,
} from "lucide-react";
import Chart from "chart.js/auto";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import html2pdf from "html2pdf.js";
import "./QuoteCalculator.css";

// Fix default Leaflet marker icons (Vite/webpack asset URL issue)
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// ---- Static reference data (ported from original quote calculator) ----

const PORTS = [
  { id: "INBOM", name: "Nhava Sheva (Mumbai Port)", country: "India", type: "ocean", lat: 18.95, lng: 72.95 },
  { id: "INMAA", name: "Chennai Port", country: "India", type: "ocean", lat: 13.0827, lng: 80.2707 },
  { id: "INMUN", name: "Mundra Port (Gujarat)", country: "India", type: "ocean", lat: 22.8397, lng: 69.7042 },
  { id: "CNSHA", name: "Port of Shanghai", country: "China", type: "ocean", lat: 31.2304, lng: 121.4737 },
  { id: "NLRTM", name: "Port of Rotterdam", country: "Netherlands", type: "ocean", lat: 51.9244, lng: 4.4777 },
  { id: "SGSIN", name: "Port of Singapore", country: "Singapore", type: "ocean", lat: 1.3521, lng: 103.8198 },
  { id: "USLAX", name: "Port of Los Angeles", country: "United States", type: "ocean", lat: 33.7423, lng: -118.2673 },
  { id: "AEDXB", name: "Port of Jebel Ali (Dubai)", country: "UAE", type: "ocean", lat: 24.9857, lng: 55.0273 },
  { id: "DEHAM", name: "Port of Hamburg", country: "Germany", type: "ocean", lat: 53.5511, lng: 9.9937 },
  { id: "DEL", name: "Delhi Indira Gandhi Airport (DEL)", country: "India", type: "air", lat: 28.5562, lng: 77.1 },
  { id: "BOM", name: "Mumbai Airport (BOM)", country: "India", type: "air", lat: 19.0896, lng: 72.8656 },
  { id: "PVG", name: "Shanghai Pudong Airport", country: "China", type: "air", lat: 31.1443, lng: 121.8083 },
  { id: "FRA", name: "Frankfurt Airport", country: "Germany", type: "air", lat: 50.0379, lng: 8.5622 },
  { id: "DXB", name: "Dubai International Airport", country: "UAE", type: "air", lat: 25.2532, lng: 55.3657 },
];

const CURRENCIES = [
  { code: "INR", symbol: "₹", rate: 1, label: "INR (₹ Rupees)" },
  { code: "USD", symbol: "$", rate: 0.012, label: "USD ($)" },
  { code: "EUR", symbol: "€", rate: 0.011, label: "EUR (€)" },
  { code: "GBP", symbol: "£", rate: 0.0094, label: "GBP (£)" },
  { code: "AED", symbol: "AED ", rate: 0.044, label: "AED (Dirhams)" },
];

const COMMODITIES = [
  { value: "general", label: "General Cargo (Dry Goods, Machinery)", mult: 1.0 },
  { value: "hazmat", label: "HAZMAT / Dangerous Goods", mult: 1.35 },
  { value: "reefer", label: "Refrigerated / Temperature Controlled", mult: 1.25 },
  { value: "high_value", label: "High Value Electronics", mult: 1.2 },
  { value: "oversized", label: "Oversized / Heavy Lift", mult: 1.4 },
];

const CONTAINER_TYPES = [
  { value: "20ft", label: "20' Standard", meta: "33 CBM / 21,700 kg", rateINR: 150000 },
  { value: "40ft", label: "40' Standard", meta: "67 CBM / 26,500 kg", rateINR: 240000 },
  { value: "40hc", label: "40' High Cube", meta: "76 CBM / 26,500 kg", rateINR: 265000 },
  { value: "45hc", label: "45' Reefer / HC", meta: "86 CBM / 29,000 kg", rateINR: 310000 },
];

const MODE_TABS = [
  { value: "ocean_fcl", label: "Ocean FCL", Icon: Ship },
  { value: "ocean_lcl", label: "Ocean LCL", Icon: Box },
  { value: "air_standard", label: "Air Freight", Icon: Plane },
  { value: "road", label: "Road Freight", Icon: Truck },
];

const PROMOS = {
  FREIGHT10: 0.1,
  AIRSPEED15: 0.15,
  GLOBAL2026: 15000,
};

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function formatCurrency(val, sym = "₹") {
  return `${sym}${Math.round(val).toLocaleString("en-IN")}`;
}

export default function QuoteCalculator() {
  const [currencyCode, setCurrencyCode] = useState("INR");
  const [originId, setOriginId] = useState("");
  const [destId, setDestId] = useState("");
  const [mode, setMode] = useState("");
  const [containerType, setContainerType] = useState("");
  const [containerQty, setContainerQty] = useState("");
  const [cargoWeight, setCargoWeight] = useState("");
  const [cargoVolume, setCargoVolume] = useState("");
  const [commodity, setCommodity] = useState("");
  const [declaredValue, setDeclaredValue] = useState("");
  const [incoterm, setIncoterm] = useState("FOB");

  const [services, setServices] = useState({
    customs: false,
    insurance: false,
    thc: false,
    baf: false,
    doorPickup: false,
    greenOffset: false,
  });

  const [promoInput, setPromoInput] = useState("");
  const [activePromo, setActivePromo] = useState(null);
  const [promoMsg, setPromoMsg] = useState({ text: "", ok: false });

  const [showShipModal, setShowShipModal] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");

  const submitToBrokerDesk = () => {
    if (!quote) return;
    const newReq = {
      id: quote.id,
      client: "Direct Online Shipper",
      clientEmail: "shipper@example.com",
      origin: `${quote.oPort.name} (${quote.oPort.id})`,
      destination: `${quote.dPort.name} (${quote.dPort.id})`,
      mode: quote.mode === "ocean_fcl" ? "Ocean FCL" : quote.mode === "ocean_lcl" ? "Ocean LCL" : quote.mode === "air_standard" ? "Air Standard" : "Road Drayage",
      cargoClass: `${commodity || "General"} cargo`,
      weightKg: cargoWeight || 1200,
      baseRate: quote.baseINR,
      marginPct: 10,
      fuelSurchargePct: 12.5,
      portFee: 15000,
      status: "Pending Review",
      requestedDate: new Date().toISOString().split("T")[0],
    };
    try {
      const saved = localStorage.getItem("freightai_agent_quotes");
      const list = saved ? JSON.parse(saved) : [];
      localStorage.setItem("freightai_agent_quotes", JSON.stringify([newReq, ...list]));
      setSubmitMsg(`Quote ${quote.id} submitted to Broker Desk for review & margin approval!`);
      setTimeout(() => setSubmitMsg(""), 5000);
    } catch {}
  };

  const mapElRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const originMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const polylineRef = useRef(null);

  const chartCanvasRef = useRef(null);
  const chartInstanceRef = useRef(null);

  const pdfContainerRef = useRef(null);

  // Read dynamic Admin Rate Config & Master Data from localStorage
  const rateConfig = useMemo(() => {
    try {
      const saved = localStorage.getItem("freightai_rate_config");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, []);

  const masterData = useMemo(() => {
    try {
      const saved = localStorage.getItem("freightai_master_data");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, []);

  // Merged dynamic ports (Master Data + Seed)
  const portsList = useMemo(() => {
    if (!masterData?.ports || !Array.isArray(masterData.ports)) return PORTS;
    const dynamicPorts = masterData.ports
      .filter((p) => p.isActive)
      .map((p) => ({
        id: p.unlocode,
        name: p.portName,
        country: p.countryCode,
        type: p.portType === "AIRPORT" ? "air" : "ocean",
        lat: p.location?.coordinates?.[1] || 18.95,
        lng: p.location?.coordinates?.[0] || 72.95,
      }));
    const ids = new Set(dynamicPorts.map((p) => p.id));
    const extra = PORTS.filter((p) => !ids.has(p.id));
    return [...dynamicPorts, ...extra];
  }, [masterData]);

  const currency = CURRENCIES.find((c) => c.code === currencyCode) || CURRENCIES[0];
  const oPort = portsList.find((p) => p.id === originId);
  const dPort = portsList.find((p) => p.id === destId);

  const toggleService = (key) => setServices((s) => ({ ...s, [key]: !s[key] }));

  const swapPorts = () => {
    setOriginId(destId);
    setDestId(originId);
  };

  const applyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (PROMOS[code]) {
      setActivePromo(code);
      setPromoMsg({ text: `Promo Code Applied: ${code}`, ok: true });
    } else {
      setActivePromo(null);
      setPromoMsg({ text: code ? "Invalid Code" : "", ok: false });
    }
  };

  // ---- Core quote calculation (recomputed on any relevant state change) ----
  const quote = useMemo(() => {
    if (!originId || !destId || !oPort || !dPort || !mode) {
      return null;
    }

    // Dynamic Admin Rate Engine Multipliers
    const cargoMults = rateConfig?.cargo_multipliers || {};
    let commMult = COMMODITIES.find((c) => c.value === commodity)?.mult || 1.0;
    if (commodity === "general" && cargoMults.general) commMult = cargoMults.general;
    if (commodity === "hazmat" && cargoMults.hazardous) commMult = cargoMults.hazardous;
    if (commodity === "reefer" && cargoMults.cold_chain) commMult = cargoMults.cold_chain;

    const modeMults = rateConfig?.mode_multipliers || {};
    let modeMult = 1.0;
    if (mode.startsWith("ocean") && modeMults.ocean) modeMult = modeMults.ocean;
    if (mode.startsWith("air") && modeMults.air) modeMult = modeMults.air;
    if (mode.startsWith("road") && modeMults.road) modeMult = modeMults.road;

    const distKm = calculateDistanceKm(oPort.lat, oPort.lng, dPort.lat, dPort.lng);
    const distNM = Math.round(distKm * 0.539957);

    // Incoterms Scope Matrix Gate
    if (incoterm === "EXW") {
      return {
        id: "QT-2026-" + Math.floor(1000 + Math.random() * 9000),
        oPort,
        dPort,
        mode,
        distKm,
        distNM,
        baseINR: 0,
        subtotalINR: 0,
        discountINR: 0,
        totalINR: 0,
        formattedTotal: formatCurrency(0, currency.symbol),
        formattedSubtotal: formatCurrency(0, currency.symbol),
        formattedDiscount: formatCurrency(0, currency.symbol),
        items: [],
        incoterm: "EXW",
        exwNotice: "Under EXW (Ex Works), the seller does nothing — buyer arranges and pays for all freight legs.",
        transitDays: "Buyer Managed",
        co2Tonnes: "0.00",
      };
    }

    let baseINR = 0;
    let airLowerBreakNotice = null;
    if (mode === "ocean_fcl") {
      const rate = CONTAINER_TYPES.find((c) => c.value === containerType)?.rateINR || 160000;
      baseINR = rate * containerQty * commMult * modeMult;
    } else if (mode === "ocean_lcl") {
      baseINR = Math.max(cargoVolume, 1) * 9500 * commMult * modeMult;
    } else if (mode === "air_standard") {
      const w = Math.max(cargoWeight || 0, (cargoVolume || 0) * 167);
      if (w >= 280 && w < 300) {
        airLowerBreakNotice = "Applied +300kg weight break lower-break rule (saved 600 INR)!";
        baseINR = 300 * 180 * commMult * modeMult;
      } else {
        baseINR = w * 400 * commMult * modeMult;
      }
    } else {
      baseINR = Math.max(distKm * 140 * (cargoWeight / 1000), 35000) * commMult * modeMult;
    }

    const fuelPct = rateConfig?.fuel_surcharge_pct || 12.5;
    const baseHandlingFee = rateConfig?.base_handling_fee || 1500;

    const items = [
      { name: "Base Freight Rate", inr: Math.round(baseINR), source: "RATE_CARD" }
    ];

    if (services.customs || incoterm === "DDP")
      items.push({ name: "Customs Entry & Clearance", inr: Math.round(baseHandlingFee * 10), source: "SURCHARGE_TABLE" });

    if ((services.insurance || incoterm === "CIF") && declaredValue > 0) {
      // CIF 110% Insurance Formula
      const insurableVal = (parseFloat(declaredValue) + baseINR) * 1.10;
      const insAmt = Math.max(Math.round(insurableVal * 0.0035), 3500);
      items.push({ name: "All-Risk Cargo Insurance (CIF 110%)", inr: insAmt, source: "SURCHARGE_TABLE" });
    }

    if (services.thc || incoterm === "FOB" || incoterm === "CFR" || incoterm === "CIF")
      items.push({ name: "Terminal Handling Charges (THC)", inr: 18000 * (mode === "ocean_fcl" ? containerQty : 1), source: "SURCHARGE_TABLE" });

    if (services.baf || incoterm === "CFR" || incoterm === "CIF")
      items.push({ name: `Bunker Fuel Surcharge (BAF ${fuelPct}%)`, inr: Math.round(baseINR * (fuelPct / 100)), source: "SURCHARGE_TABLE" });

    if (services.doorPickup || incoterm === "DAP" || incoterm === "DDP")
      items.push({ name: "First/Last-Mile Drayage & Delivery", inr: 28000, source: "SURCHARGE_TABLE" });

    if (services.greenOffset) items.push({ name: "Green Carbon Offset", inr: 3500, source: "SURCHARGE_TABLE" });

    const subtotalINR = items.reduce((s, i) => s + i.inr, 0);
    let discountINR = 0;
    if (activePromo) {
      const val = PROMOS[activePromo];
      discountINR = val < 1 ? Math.round(baseINR * val) : val;
    }
    const totalINR = Math.max(subtotalINR - discountINR, 5000);

    const rate = currency.rate;
    const sym = currency.symbol;

    return {
      id: "QT-2026-" + Math.floor(1000 + Math.random() * 9000),
      oPort,
      dPort,
      mode,
      incoterm,
      distKm,
      distNM,
      baseINR,
      subtotalINR,
      discountINR,
      totalINR,
      formattedTotal: formatCurrency(totalINR * rate, sym),
      formattedSubtotal: formatCurrency(subtotalINR * rate, sym),
      formattedDiscount: formatCurrency(discountINR * rate, sym),
      items: items.map((i) => ({ ...i, formatted: formatCurrency(i.inr * rate, sym) })),
      airLowerBreakNotice,
      transitDays: `${Math.round(distNM / 350) + 4} - ${Math.round(distNM / 350) + 9} Days`,
      co2Tonnes: (
        (distKm * Math.max(cargoWeight / 1000, 1.5) * (mode === "air_standard" ? 500 : 12)) /
        1000000
      ).toFixed(2),
      // eslint-disable-next-line react-hooks/exhaustive-deps
    };
  }, [
    mode,
    containerType,
    containerQty,
    cargoWeight,
    cargoVolume,
    commodity,
    declaredValue,
    incoterm,
    services,
    activePromo,
    currency,
    oPort,
    dPort,
  ]);

  // ---- Leaflet map: init once ----
  useEffect(() => {
    if (!mapElRef.current || mapInstanceRef.current) return;
    const map = L.map(mapElRef.current, { attributionControl: false }).setView([20, 0], 2);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png").addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // ---- Leaflet map: update markers/route on port change ----
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !oPort || !dPort) return;

    if (originMarkerRef.current) map.removeLayer(originMarkerRef.current);
    if (destMarkerRef.current) map.removeLayer(destMarkerRef.current);
    if (polylineRef.current) map.removeLayer(polylineRef.current);

    originMarkerRef.current = L.marker([oPort.lat, oPort.lng]).addTo(map).bindPopup(oPort.name);
    destMarkerRef.current = L.marker([dPort.lat, dPort.lng]).addTo(map).bindPopup(dPort.name);

    polylineRef.current = L.polyline(
      [
        [oPort.lat, oPort.lng],
        [(oPort.lat + dPort.lat) / 2 + 4, (oPort.lng + dPort.lng) / 2],
        [dPort.lat, dPort.lng],
      ],
      { color: "#ff9800", weight: 3, dashArray: "6, 6" }
    ).addTo(map);

    map.fitBounds(
      L.latLngBounds([
        [oPort.lat, oPort.lng],
        [dPort.lat, dPort.lng],
      ]),
      { padding: [30, 30] }
    );
  }, [oPort, dPort]);

  // ---- Chart.js donut: init once ----
  useEffect(() => {
    if (!chartCanvasRef.current || chartInstanceRef.current) return;
    chartInstanceRef.current = new Chart(chartCanvasRef.current, {
      type: "doughnut",
      data: {
        labels: ["Base Freight Rate", "Surcharges & Fees"],
        datasets: [{ data: [70, 30], backgroundColor: ["#0f172a", "#ff9800"], borderWidth: 0 }],
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: "70%", plugins: { legend: { position: "bottom" } } },
    });

    return () => {
      chartInstanceRef.current?.destroy();
      chartInstanceRef.current = null;
    };
  }, []);

  // ---- Chart.js donut: update on quote change ----
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart || !quote) return;
    chart.data.datasets[0].data = [quote.baseINR, quote.subtotalINR - quote.baseINR];
    chart.update();
  }, [quote]);

  const exportPDF = () => {
    const container = pdfContainerRef.current;
    if (!container) return;
    container.classList.remove("hidden");
    html2pdf()
      .set({ margin: 0.5, filename: `Freight_Quote_${quote.id}.pdf` })
      .from(container)
      .save()
      .then(() => {
        container.classList.add("hidden");
      });
  };

  return (
    <div className="qg-calculator">

      <div className="qg-container">
        <header className="qg-app-header">
          <div className="qg-brand">
            <Ship />
            <h1>
              Freight <span>Quote Generator</span>
            </h1>
          </div>
          <div className="qg-currency-picker">
            <IndianRupee />
            <select
              className="qg-currency-select"
              aria-label="Select Currency"
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </header>

        <div className="qg-calculator-grid">
          {/* Left Config Form */}
          <div className="qg-calc-card">
            {/* Step 1: Route & Mode */}
            <div className="qg-form-step">
              <div className="qg-step-title">
                <span className="qg-step-num">1</span>
                <h3>Route &amp; Mode Selection</h3>
              </div>

              <div className="qg-mode-tabs">
                {MODE_TABS.map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    className={`qg-mode-tab${mode === value ? " active" : ""}`}
                    onClick={() => setMode(value)}
                  >
                    <Icon />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              <div className="qg-form-row">
                <div className="qg-form-group qg-flex-1">
                  <label>
                    <MapPin style={{ color: "#ff9800" }} /> Origin Port / City
                  </label>
                  <select className="qg-form-select" value={originId} onChange={(e) => setOriginId(e.target.value)}>
                    <option value="" disabled hidden>-- Select Origin Port / City --</option>
                    {portsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.country})
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" className="qg-swap-btn" title="Swap Origin and Destination" onClick={swapPorts}>
                  <ArrowLeftRight />
                </button>
                <div className="qg-form-group qg-flex-1">
                  <label>
                    <MapPin style={{ color: "#16a34a" }} /> Destination Port / City
                  </label>
                  <select className="qg-form-select" value={destId} onChange={(e) => setDestId(e.target.value)}>
                    <option value="" disabled hidden>-- Select Destination Port / City --</option>
                    {portsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.country})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="qg-form-row qg-mt-3">
                <div className="qg-form-group" style={{ flex: 1 }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <Globe size={14} /> Incoterm 2020 — Trade Cost Responsibility
                  </label>
                  <select
                    className="qg-form-select"
                    value={incoterm}
                    onChange={(e) => setIncoterm(e.target.value)}
                  >
                    <option value="EXW">EXW — Ex Works (Buyer pays all legs)</option>
                    <option value="FCA">FCA — Free Carrier (Pickup + Export Clearance)</option>
                    <option value="FOB">FOB — Free On Board (Standard Port-to-Port)</option>
                    <option value="CFR">CFR — Cost &amp; Freight (Freight Included)</option>
                    <option value="CIF">CIF — Cost, Insurance &amp; Freight (110% Insured)</option>
                    <option value="DAP">DAP — Delivered At Place (Door Delivery)</option>
                    <option value="DDP">DDP — Delivered Duty Paid (Full Door &amp; Duty)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Step 2: Cargo Config */}
            <div className="qg-form-step">
              <div className="qg-step-title">
                <span className="qg-step-num">2</span>
                <h3>Cargo Specifications</h3>
              </div>

              {mode === "ocean_fcl" ? (
                <div>
                  <label>Container Type &amp; Size:</label>
                  <div className="qg-container-grid">
                    {CONTAINER_TYPES.map((c) => (
                      <label
                        key={c.value}
                        className={`qg-container-card${containerType === c.value ? " active" : ""}`}
                      >
                        <input
                          type="radio"
                          name="containerType"
                          value={c.value}
                          checked={containerType === c.value}
                          onChange={() => setContainerType(c.value)}
                        />
                        <div className="qg-c-info">
                          <strong>{c.label}</strong>
                          <span>{c.meta}</span>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="qg-form-group qg-mt-3">
                    <label>Container Quantity:</label>
                    <input
                      type="number"
                      className="qg-form-input"
                      value={containerQty}
                      min={1}
                      max={50}
                      onChange={(e) => setContainerQty(parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>
              ) : (
                <div className="qg-form-row qg-mt-3">
                  <div className="qg-form-group qg-flex-1">
                    <label>Gross Weight (KG)</label>
                    <input
                      type="number"
                      className="qg-form-input"
                      value={cargoWeight}
                      min={1}
                      onChange={(e) => setCargoWeight(parseFloat(e.target.value) || 1200)}
                    />
                  </div>
                  <div className="qg-form-group qg-flex-1">
                    <label>Volume (CBM)</label>
                    <input
                      type="number"
                      className="qg-form-input"
                      value={cargoVolume}
                      min={0.1}
                      step={0.1}
                      onChange={(e) => setCargoVolume(parseFloat(e.target.value) || 4.5)}
                    />
                  </div>
                </div>
              )}

              <div className="qg-form-row qg-mt-3">
                <div className="qg-form-group qg-flex-1">
                  <label>Commodity Category</label>
                  <select className="qg-form-select" value={commodity} onChange={(e) => setCommodity(e.target.value)}>
                    {COMMODITIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="qg-form-group qg-flex-1">
                  <label>Declared Cargo Value (₹ INR)</label>
                  <input
                    type="number"
                    className="qg-form-input"
                    value={declaredValue}
                    min={0}
                    step={50000}
                    onChange={(e) => setDeclaredValue(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Surcharges */}
            <div className="qg-form-step">
              <div className="qg-step-title">
                <span className="qg-step-num">3</span>
                <h3>Surcharges &amp; Services</h3>
              </div>

              <div className="qg-services-grid">
                <label className="qg-service-card">
                  <input type="checkbox" checked={services.customs} onChange={() => toggleService("customs")} />
                  <div className="qg-srv-text">
                    <strong>Customs Clearance</strong>
                    <span>Documentation &amp; filing (₹15,000)</span>
                  </div>
                </label>

                <label className="qg-service-card">
                  <input type="checkbox" checked={services.insurance} onChange={() => toggleService("insurance")} />
                  <div className="qg-srv-text">
                    <strong>All-Risk Cargo Insurance</strong>
                    <span>0.35% of declared cargo value</span>
                  </div>
                </label>

                <label className="qg-service-card">
                  <input type="checkbox" checked={services.thc} onChange={() => toggleService("thc")} />
                  <div className="qg-srv-text">
                    <strong>Terminal Handling (THC)</strong>
                    <span>Port crane handling fees (₹18,000)</span>
                  </div>
                </label>

                <label className="qg-service-card">
                  <input type="checkbox" checked={services.baf} onChange={() => toggleService("baf")} />
                  <div className="qg-srv-text">
                    <strong>Bunker Fuel Surcharge (BAF)</strong>
                    <span>12% fuel index surcharge</span>
                  </div>
                </label>

                <label className="qg-service-card">
                  <input type="checkbox" checked={services.doorPickup} onChange={() => toggleService("doorPickup")} />
                  <div className="qg-srv-text">
                    <strong>First/Last-Mile Drayage</strong>
                    <span>Trucking to/from warehouse (₹28,000)</span>
                  </div>
                </label>

                <label className="qg-service-card">
                  <input
                    type="checkbox"
                    checked={services.greenOffset}
                    onChange={() => toggleService("greenOffset")}
                  />
                  <div className="qg-srv-text">
                    <strong>Carbon Offset</strong>
                    <span>Fund ocean biofuel projects (₹3,500)</span>
                  </div>
                </label>
              </div>

              <div className="qg-promo-box qg-mt-3">
                <input
                  type="text"
                  className="qg-form-input"
                  placeholder="Promo Code (e.g. FREIGHT10)"
                  style={{ textTransform: "uppercase" }}
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                />
                <button type="button" className="qg-btn-sm" onClick={applyPromo}>
                  Apply
                </button>
              </div>
              <div
                className="qg-promo-msg"
                style={{ color: promoMsg.ok ? "#16a34a" : "#dc2626" }}
              >
                {promoMsg.text}
              </div>
            </div>
          </div>

          {/* Right Summary Column */}
          {!quote ? (
            <div
              className="qg-calc-card"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "360px",
                padding: "40px 24px",
                textAlign: "center",
                background: "#f8fafc",
                border: "2px dashed #cbd5e1",
                borderRadius: "16px",
              }}
            >
              <div style={{ marginBottom: "12px", display: "flex", justifyContent: "center" }}>
                <Box size={44} color="#94a3b8" />
              </div>
              <h3 style={{ fontSize: "17px", fontWeight: "700", color: "#0f172a", marginBottom: "6px" }}>
                Form Not Filled
              </h3>
              <p style={{ fontSize: "13px", color: "#64748b", maxWidth: "280px", margin: "0 auto" }}>
                Please select your origin port, destination port, and shipping mode to calculate live freight rates.
              </p>
            </div>
          ) : (
            <div className="qg-calc-card">
              <div className="qg-summary-header">
                <h3>
                  <Receipt /> Quote Summary
                </h3>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                  <span className="qg-quote-badge">{quote.id}</span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "700",
                      padding: "3px 8px",
                      borderRadius: "20px",
                      background: "#0c4a6e",
                      color: "#7dd3fc",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {incoterm}
                  </span>
                </div>
              </div>

              <div className="qg-transit-stats">
                <div className="qg-t-item">
                  <Clock />
                  <div>
                    <span>Est. Transit</span>
                    <strong>{quote.transitDays}</strong>
                  </div>
                </div>
                <div className="qg-t-item">
                  <Navigation />
                  <div>
                    <span>Distance</span>
                    <strong>{quote.distNM.toLocaleString()} NM</strong>
                  </div>
                </div>
                <div className="qg-t-item">
                  <Cloud />
                  <div>
                    <span>CO2 Footprint</span>
                    <strong>{quote.co2Tonnes} Tonnes</strong>
                  </div>
                </div>
              </div>

              {/* EXW zero-cost notice */}
              {quote.exwNotice && (
                <div
                  style={{
                    background: "#1c1917",
                    border: "1px solid #78716c",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    marginBottom: "12px",
                    color: "#d6d3d1",
                    fontSize: "12.5px",
                    display: "flex",
                    gap: "8px",
                    alignItems: "flex-start",
                  }}
                >
                  <Box size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
                  <span>{quote.exwNotice}</span>
                </div>
              )}

              {/* Air lower-break notice */}
              {quote.airLowerBreakNotice && (
                <div
                  style={{
                    background: "#052e16",
                    border: "1px solid #16a34a",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    marginBottom: "12px",
                    color: "#86efac",
                    fontSize: "12.5px",
                    display: "flex",
                    gap: "8px",
                    alignItems: "flex-start",
                  }}
                >
                  <Plane size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
                  <span>{quote.airLowerBreakNotice}</span>
                </div>
              )}

              <table className="qg-breakdown-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style={{ textAlign: "center", width: "90px" }}>Source</th>
                    <th className="qg-text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items.map((i, idx) => (
                    <tr key={idx}>
                      <td>{i.name}</td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: "700",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            letterSpacing: "0.3px",
                            background:
                              i.source === "RATE_CARD" ? "#1e3a5f" :
                              i.source === "PREDICTED" ? "#3b1e5f" :
                              "#1e3d2f",
                            color:
                              i.source === "RATE_CARD" ? "#93c5fd" :
                              i.source === "PREDICTED" ? "#c4b5fd" :
                              "#86efac",
                          }}
                        >
                          {i.source || "MANUAL"}
                        </span>
                      </td>
                      <td className="qg-text-right">{i.formatted}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>Subtotal</td>
                    <td className="qg-text-right">{quote.formattedSubtotal}</td>
                  </tr>
                  <tr>
                    <td colSpan={2}>Discount</td>
                    <td className="qg-text-right qg-text-emerald">-{quote.formattedDiscount}</td>
                  </tr>
                  <tr className="qg-total-row">
                    <td colSpan={2}>Total Freight Quote</td>
                    <td className="qg-text-right">{quote.formattedTotal}</td>
                  </tr>
                </tfoot>
              </table>

              <div className="qg-chart-box">
                <h4>Cost Distribution</h4>
                <div className="qg-chart-container">
                  <canvas ref={chartCanvasRef}></canvas>
                </div>
              </div>

              <div className="qg-map-box">
                <h4>Shipping Route Visualizer</h4>
                <div ref={mapElRef} className="qg-route-map"></div>
              </div>

              {submitMsg && (
                <div style={{ background: "#052e16", border: "1px solid #16a34a", color: "#86efac", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: "600", marginBottom: "12px" }}>
                  {submitMsg}
                </div>
              )}

              <div className="qg-action-row">
                <button className="qg-btn-dark" onClick={exportPDF}>
                  <FileText /> Export PDF Quote
                </button>
                <button
                  type="button"
                  className="qg-btn-dark"
                  style={{ background: "#0284c7", borderColor: "#0284c7" }}
                  onClick={submitToBrokerDesk}
                >
                  <PackageCheck /> Submit to Broker Desk
                </button>
                <button
                  type="button"
                  className="qg-btn-ship"
                  onClick={() => setShowShipModal(true)}
                >
                  <PackageCheck /> Ship This Quote
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showShipModal && (
        <div
          className="qg-ship-modal-overlay"
          onClick={() => setShowShipModal(false)}
        >
          <div
            className="qg-ship-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Create an account to ship this quote"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="qg-ship-modal-close"
              onClick={() => setShowShipModal(false)}
              aria-label="Close"
            >
              <X />
            </button>

            <div className="qg-ship-modal-icon">
              <PackageCheck />
            </div>

            <h3>Ready to ship this quote?</h3>
            <p>
              Create a free FreightAI account to lock in{" "}
              <strong>{quote.formattedTotal}</strong> for{" "}
              {quote.oPort.name} &rarr; {quote.dPort.name}, track your
              shipment in real time, and manage everything from one
              dashboard.
            </p>

            <Link
              to="/login?mode=signup"
              className="qg-btn-signup"
              onClick={() => setShowShipModal(false)}
            >
              <UserPlus /> Sign Up to Continue
            </Link>

            <button
              type="button"
              className="qg-ship-modal-later"
              onClick={() => setShowShipModal(false)}
            >
              Maybe later
            </button>
          </div>
        </div>
      )}

      {/* Hidden PDF Print Template */}
      {quote && (
      <div ref={pdfContainerRef} className="qg-pdf-export-container hidden">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ color: "#0f172a", margin: 0 }}>
            FREIGHT <span style={{ color: "#ff9800" }}>QUOTE</span>
          </h2>
          <div style={{ textAlign: "right" }}>
            <h3 style={{ color: "#ff9800", margin: 0 }}>{quote.id}</h3>
            <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0 0" }}>
              Date: {new Date().toLocaleDateString("en-IN")}
            </p>
          </div>
        </div>
        <hr style={{ border: "none", borderTop: "2px solid #ff9800", margin: "12px 0" }} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            background: "#f8fafc",
            padding: 12,
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          <div>
            <strong>ORIGIN:</strong> {quote.oPort.name} ({quote.oPort.country})
          </div>
          <div>
            <strong>DESTINATION:</strong> {quote.dPort.name} ({quote.dPort.country})
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 15, fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#0f172a", color: "#fff" }}>
              <th style={{ padding: 8, textAlign: "left" }}>Fee Item</th>
              <th style={{ padding: 8, textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((i, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: 6 }}>{i.name}</td>
                <td style={{ padding: 6, textAlign: "right" }}>{i.formatted}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: "bold", borderTop: "2px solid #0f172a" }}>
              <td style={{ padding: 10, fontSize: 15 }}>TOTAL ESTIMATED FREIGHT QUOTE</td>
              <td style={{ padding: 10, textAlign: "right", fontSize: 18, color: "#ff9800" }}>
                {quote.formattedTotal}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      )}

    </div>
  );
}
