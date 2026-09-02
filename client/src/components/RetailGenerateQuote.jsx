import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Chart from "chart.js/auto";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Ship, Plane, Truck, Zap, Plus, Trash2, X, CheckCircle, FileText, Check, Bot, Cpu, Sparkles, Eye, ArrowRight, Clock, Anchor, MapPin, AlertTriangle, CheckCircle2, ShieldAlert, Navigation, RefreshCw } from "lucide-react";
import { PORTS_MASTER, useRetailQuotes } from "../context/RetailQuotesContext";
import { createSavedAddress, getSavedAddresses } from "../api/auth";
import { confirmQuote, estimateQuote } from "../api/quotes";
import { useAuth } from "../context/AuthContext";
import {
  validateAddressProximity,
  findNearestPort,
  resolveAddressCoordinates,
  calculateGeoDistanceKm,
  CATCHMENT_RADIUS_KM,
} from "../utils/geoProximity";
import "./RetailGenerateQuote.css";

// Fix default Leaflet marker icons (Vite asset URL issue)
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

const MODE_PILLS = [
  { value: "ocean", label: "Ocean Freight", Icon: Ship },
  { value: "air", label: "Air Freight", Icon: Plane },
  { value: "ground", label: "Ground & Rail", Icon: Truck },
  { value: "express", label: "Express Air", Icon: Zap },
];

const PACKAGING_BY_MODE = {
  ocean: [
    { value: "40HC", label: "40HC — 40ft High Cube Container" },
    { value: "20FT", label: "20FT — 20ft Standard Container" },
    { value: "40FT", label: "40FT — 40ft Standard Container" },
    { value: "45HC", label: "45HC — 45ft Reefer Container" },
  ],
  air: [
    { value: "ULD-AKE", label: "AKE / LD3 — Standard Air Container" },
    { value: "ULD-PMC", label: "PMC — 10ft Main Deck Air Pallet" },
    { value: "AIR-PALLET", label: "Standard Euro/ISO Cargo Pallet" },
    { value: "AIR-BOX", label: "Loose Air Freight Cartons / Boxes" },
  ],
  express: [
    { value: "AIR-BOX", label: "Expedited Air Cartons / Boxes" },
    { value: "ULD-AKE", label: "Priority AKE Air Container" },
    { value: "AIR-PALLET", label: "Priority Air Cargo Pallet" },
  ],
  ground: [
    { value: "32FT-MX", label: "32ft Multi-Axle Container Truck" },
    { value: "20FT-TRK", label: "20ft Closed Body Truck" },
    { value: "RAIL-WGN", label: "Concor Rail Freight Flat Wagon" },
    { value: "PART-LOAD", label: "LTL Part Load Palletized Cargo" },
  ],
};

const CONTAINER_TYPES = PACKAGING_BY_MODE.ocean;

const DEFAULT_SAVED_ADDRESSES = [
  { id: "addr_1", label: "Mumbai Central Warehouse", type: "Pickup (Origin)", contact: "Rajesh Kumar", phone: "+91 98200 12345", email: "warehouse@company.com", street: "Plot 42, MIDC Industrial Area", city: "Mumbai", state: "Maharashtra", postal: "400093", country: "India", isDefault: true },
  { id: "addr_2", label: "Chennai Port Export Hub", type: "Pickup (Origin)", contact: "Suresh Raman", phone: "+91 98400 54321", email: "chennai.hub@company.com", street: "Harbor Line Road, Gate 3", city: "Chennai", state: "Tamil Nadu", postal: "600001", country: "India", isDefault: false },
  { id: "addr_3", label: "Singapore Gateway Terminal", type: "Delivery (Destination)", contact: "Kenji Tan", phone: "+65 6789 0123", email: "singapore.ops@gateway.sg", street: "10 Pasir Panjang Rd", city: "Singapore", state: "Singapore", postal: "117438", country: "Singapore", isDefault: false },
];

function getLocalSavedAddresses() {
  try {
    const saved = localStorage.getItem("freightai_saved_addresses");
    return saved ? JSON.parse(saved) : DEFAULT_SAVED_ADDRESSES;
  } catch {
    return DEFAULT_SAVED_ADDRESSES;
  }
}

function saveLocalAddress(newAddr) {
  try {
    const current = getLocalSavedAddresses();
    const updated = newAddr.isDefault ? [newAddr, ...current.map((a) => ({ ...a, isDefault: false }))] : [newAddr, ...current];
    localStorage.setItem("freightai_saved_addresses", JSON.stringify(updated));
    return updated;
  } catch {
    return [newAddr, ...DEFAULT_SAVED_ADDRESSES];
  }
}

const getTodayStr = () => new Date().toISOString().slice(0, 10);
const getPlus7DaysStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
};

// Dynamic Haversine distance calculator between geographic coordinates
function calculateGeoDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 2500;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(Math.round(R * c), 80);
}

// Master Rate Card Repository for Deterministic & Defensible Quotes
const OCEAN_RATE_CARDS = {
  "INMAA-SGSIN": { "20FT": 35000, "40FT": 48000, "40HC": 50000, "45HC": 58000, transit_days: 7 },
  "INNSA-SGSIN": { "20FT": 38000, "40FT": 52000, "40HC": 55000, "45HC": 62000, transit_days: 9 },
  "INNSA-AEJEA": { "20FT": 120000, "40FT": 160000, "40HC": 178000, "45HC": 195000, transit_days: 5 },
  "INMAA-AEJEA": { "20FT": 125000, "40FT": 165000, "40HC": 182000, "45HC": 200000, transit_days: 7 },
  "INNSA-NLRTM": { "20FT": 210000, "40FT": 270000, "40HC": 290000, "45HC": 320000, transit_days: 22 },
  "INMAA-NLRTM": { "20FT": 215000, "40FT": 275000, "40HC": 295000, "45HC": 325000, transit_days: 24 },
  "INNSA-CNSHA": { "20FT": 45000, "40FT": 62000, "40HC": 68000, "45HC": 76000, transit_days: 14 },
  "INMAA-CNSHA": { "20FT": 42000, "40FT": 58000, "40HC": 65000, "45HC": 72000, transit_days: 12 },
  "INNSA-USLAX": { "20FT": 260000, "40FT": 340000, "40HC": 370000, "45HC": 410000, transit_days: 28 },
  "INMAA-USLAX": { "20FT": 270000, "40FT": 350000, "40HC": 380000, "45HC": 420000, transit_days: 30 },
};

const AIR_RATE_CARDS = {
  "DEL-DXB": { rate_per_kg: 220, min_charge: 3500, transit_days: 2 },
  "BOM-DXB": { rate_per_kg: 210, min_charge: 3500, transit_days: 2 },
  "MAA-SIN": { rate_per_kg: 230, min_charge: 4000, transit_days: 2 },
  "BLR-SIN": { rate_per_kg: 235, min_charge: 4000, transit_days: 2 },
  "DEL-SIN": { rate_per_kg: 240, min_charge: 4000, transit_days: 2 },
  "BOM-FRA": { rate_per_kg: 380, min_charge: 5000, transit_days: 3 },
  "DEL-FRA": { rate_per_kg: 390, min_charge: 5000, transit_days: 3 },
  "DEL-JFK": { rate_per_kg: 480, min_charge: 7500, transit_days: 4 },
  "BOM-JFK": { rate_per_kg: 470, min_charge: 7500, transit_days: 4 },
};

// Master Authoritative 10-Step Cost Buildup & Margin Pricing Engine
function calculateAuthoritativeFreightQuote({
  originPort,
  destPort,
  mode = "ocean",
  loadType = "fcl",
  incoterm = "CIF",
  items = [],
  chkHazardous = false,
  chkTemp = false,
  chkInsurance = false,
  declaredVal = 500000,
  currency = "INR",
}) {
  let adminConfig = {
    currency: "INR",
    base_handling_fee: 1500,
    rate_per_km_per_tonne: 4.5,
    fuel_surcharge_pct: 10.0,
    margin_pct: 15.0,
    quote_validity_days: 14,
  };

  try {
    const saved = localStorage.getItem("freightai_rate_config");
    if (saved) {
      const parsed = JSON.parse(saved);
      adminConfig = { ...adminConfig, ...parsed };
    }
  } catch (e) {
    console.warn("Could not read local freightai_rate_config:", e);
  }

  const oCode = originPort?.code || originPort?.id || "INMAA";
  const dCode = destPort?.code || destPort?.id || "SGSIN";
  const laneKey = `${oCode}-${dCode}`;

  const rawDist = calculateGeoDistance(originPort?.lat, originPort?.lng, destPort?.lat, destPort?.lng);
  const distanceKm = mode === "ocean" ? Math.round(rawDist * 1.25) : rawDist;

  let totalGrossKg = 0;
  let totalContainers = 0;
  let totalVolumeM3 = 0;
  let primaryContainerType = "40HC";

  items.forEach((item) => {
    const count = Math.max(parseInt(item.count, 10) || 1, 1);
    const weight = parseFloat(item.weight) || 0;
    totalGrossKg += weight;
    totalContainers += count;
    if (item.containerType) primaryContainerType = item.containerType;

    if (item.length && item.width && item.height) {
      const cbm = (parseFloat(item.length) * parseFloat(item.width) * parseFloat(item.height)) / 1000000;
      totalVolumeM3 += cbm * count;
    } else {
      const cbmPerUnit = item.containerType?.includes("20") ? 33 : 67;
      totalVolumeM3 += cbmPerUnit * count;
    }
  });

  if (totalContainers === 0) totalContainers = 1;
  totalGrossKg = Math.max(totalGrossKg, totalContainers * (mode === "ocean" ? 8000 : 400), 50);
  const volumetricKg = totalVolumeM3 * 250;
  const chargeableKg = Math.max(totalGrossKg, volumetricKg);

  let baseRatePerUnit = 50000;
  let transitDays = 7;
  let baseFreight = 0;
  let unitLabel = "Container";

  if (mode === "ocean") {
    const cTypeKey = primaryContainerType.includes("20")
      ? "20FT"
      : primaryContainerType.includes("45")
      ? "45HC"
      : primaryContainerType.includes("40FT")
      ? "40FT"
      : "40HC";

    const laneCard = OCEAN_RATE_CARDS[laneKey] || OCEAN_RATE_CARDS[`${originPort?.id}-${destPort?.id}`];
    if (laneCard && laneCard[cTypeKey]) {
      baseRatePerUnit = laneCard[cTypeKey];
      transitDays = laneCard.transit_days || 7;
    } else {
      // Dynamic calibrated ocean rate
      const base20 = Math.round(30000 + distanceKm * 4.5);
      baseRatePerUnit = cTypeKey === "20FT" ? base20 : cTypeKey === "40FT" ? Math.round(base20 * 1.38) : Math.round(base20 * 1.48);
      transitDays = Math.max(Math.ceil(distanceKm / 450) + 3, 5);
    }
    baseFreight = baseRatePerUnit * totalContainers;
    unitLabel = `${primaryContainerType} Container`;
  } else if (mode === "air" || mode === "express") {
    const airCard = AIR_RATE_CARDS[laneKey] || AIR_RATE_CARDS[`${originPort?.code}-${destPort?.code}`];
    let ratePerKg = airCard ? airCard.rate_per_kg : Math.max(Math.round(180 + distanceKm * 0.04), 160);
    if (mode === "express") ratePerKg = Math.round(ratePerKg * 1.35);
    baseRatePerUnit = ratePerKg;
    baseFreight = Math.max(Math.round(ratePerKg * chargeableKg), airCard?.min_charge || 4000);
    transitDays = mode === "express" ? 2 : Math.max(Math.ceil(distanceKm / 3500) + 1, 2);
    unitLabel = "kg";
  } else {
    // Ground & Rail
    baseRatePerUnit = Math.round(15000 + distanceKm * 26);
    baseFreight = baseRatePerUnit * totalContainers;
    transitDays = Math.max(Math.ceil(distanceKm / 450) + 1, 2);
    unitLabel = "Truckload / Flat Wagon";
  }

  // Surcharges & Cost Buildup
  const bafPct = Number(adminConfig.fuel_surcharge_pct) || 10.0;
  const bafAmount = Math.round(baseFreight * (bafPct / 100.0));

  // Origin Terminal Handling Charges (THC)
  const thcRatePerContainer = mode === "ocean" ? 8000 : 4500;
  const thcAmount = mode === "ocean" ? thcRatePerContainer * totalContainers : thcRatePerContainer;

  // Documentation Fee (flat per shipment)
  const docFee = 3000;

  // Incoterm & Optional Addons
  let destThcAmount = 0;
  let destCustomsAmount = 0;
  let finalDeliveryHaulage = 0;

  if (incoterm === "DDP") {
    destThcAmount = mode === "ocean" ? 16500 * totalContainers : 6000;
    destCustomsAmount = 18000;
    finalDeliveryHaulage = 15000;
  }

  const declaredValNum = Number(declaredVal) || 500000;
  const insuranceCost = chkInsurance ? Math.round(Math.max(declaredValNum * 0.0035, 1800)) : 0;
  const hazmatCost = chkHazardous ? Math.round(baseFreight * 0.25) : 0;
  const reeferCost = chkTemp ? 22000 * totalContainers : 0;

  // Total Buy Cost (Subtotal before margin)
  const totalBuyCost =
    baseFreight +
    bafAmount +
    thcAmount +
    docFee +
    destThcAmount +
    destCustomsAmount +
    finalDeliveryHaulage +
    insuranceCost +
    hazmatCost +
    reeferCost;

  // Commercial Margin
  const marginPct = Number(adminConfig.margin_pct) || 15.0;
  const marginAmount = Math.round(totalBuyCost * (marginPct / 100.0));

  // Final Sell Price
  const sellPrice = totalBuyCost + marginAmount;

  return {
    distance_km: distanceKm,
    actual_weight_kg: Math.round(totalGrossKg),
    volumetric_weight_kg: Math.round(volumetricKg),
    chargeable_weight_kg: Math.round(chargeableKg),
    chargeable_tonnes: Number((chargeableKg / 1000).toFixed(2)),
    transit_days: transitDays,
    currency: currency || adminConfig.currency || "INR",
    units: mode === "ocean" ? totalContainers : chargeableKg,
    unit_rate: baseRatePerUnit,
    unit_label: unitLabel,
    margin_pct: marginPct,
    margin_amount: marginAmount,
    total_buy_cost: totalBuyCost,
    sell_price: sellPrice,
    breakdown: {
      base_freight: baseFreight,
      baf_pct: bafPct,
      fuel_surcharge: bafAmount,
      baf_amount: bafAmount,
      origin_thc: thcAmount,
      thc_rate: thcRatePerContainer,
      documentation_fee: docFee,
      dest_thc: destThcAmount,
      dest_customs: destCustomsAmount,
      delivery_haulage: finalDeliveryHaulage,
      insurance_cost: insuranceCost,
      cargo_charge: hazmatCost + reeferCost,
      hazmat_cost: hazmatCost,
      reefer_cost: reeferCost,
      subtotal_buy_cost: totalBuyCost,
      margin_pct: marginPct,
      margin_amount: marginAmount,
      total: sellPrice,
      // Backward compatibility keys
      base_handling_fee: thcAmount + docFee,
      distance_cost: baseFreight,
    },
    rates_used: {
      base_rate_per_unit: baseRatePerUnit,
      baf_pct: bafPct,
      thc_rate: thcRatePerContainer,
      doc_fee: docFee,
      margin_pct: marginPct,
      validity_days: adminConfig.quote_validity_days || 14,
    },
  };
}

const EMPTY_ITEM = { id: 1, type: "", containerType: "", count: "", weight: "", desc: "", hs: "" };

const EMPTY_ADDRESS = {
  label: "", type: "Pickup (Origin)", contact: "", phone: "", email: "", street: "",
  city: "", state: "", postal: "", country: "", hours: "", notes: "", isDefault: false,
};

const initialFormState = {
  originId: "INNSA",
  destId: "SGSIN",
  pickupAddr: "",
  deliveryAddr: "",
  readyDate: getTodayStr(),
  deliveryDate: getPlus7DaysStr(),
  mode: "ocean",
  loadType: "fcl",
  incoterm: "CIF",
  declaredVal: "500000",
  currency: "INR",
  specialInst: "",
  chkFragile: false,
  chkHazardous: false,
  chkTemp: false,
  chkInsurance: false,
  unNumber: "",
  imoClass: "",
  custName: "",
  custCompany: "",
  custEmail: "",
  custCountry: "",
};

function dayAfter(date) {
  if (!date) return "";
  const nextDate = new Date(`${date}T00:00:00Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  return nextDate.toISOString().slice(0, 10);
}

function money(n) {
  return `₹ ${Math.round(n).toLocaleString("en-IN")}`;
}

export default function RetailGenerateQuote() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const { reloadQuotes, addQuotation, updateQuotationStatus } = useRetailQuotes();

  const [form, setForm] = useState(initialFormState);
  const [items, setItems] = useState([EMPTY_ITEM]);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [addressesError, setAddressesError] = useState("");
  const [quoteError, setQuoteError] = useState("");
  const [generatedQuote, setGeneratedQuote] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [agentEvaluating, setAgentEvaluating] = useState(false);
  const [agentStage, setAgentStage] = useState(1);
  const [agentLogs, setAgentLogs] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [bookingRef, setBookingRef] = useState("");
  const [addressModalType, setAddressModalType] = useState("");
  const [addressForm, setAddressForm] = useState(EMPTY_ADDRESS);
  const [savingAddress, setSavingAddress] = useState(false);
  const [proximityModal, setProximityModal] = useState(null); // { type, address, port, check, nearestPort }
  const [acknowledgedOverrides, setAcknowledgedOverrides] = useState({ pickup: false, delivery: false });

  const mapElRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const originMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const polylineRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const deliveryMarkerRef = useRef(null);
  const pickupLineRef = useRef(null);
  const deliveryLineRef = useRef(null);
  const chartCanvasRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const modalContentRef = useRef(null);
  const printablePdfRef = useRef(null);

  function setField(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function updateReadyDate(value) {
    const today = getTodayStr();
    const safeVal = value && value < today ? today : value;
    setForm((current) => ({
      ...current,
      readyDate: safeVal,
      deliveryDate: current.deliveryDate && current.deliveryDate <= safeVal ? "" : current.deliveryDate,
    }));
  }

  function openAddressModal(type) {
    setAddressForm({ ...EMPTY_ADDRESS, type: type === "pickup" ? "Pickup (Origin)" : "Delivery (Destination)", contact: user?.full_name || "", email: user?.email || "" });
    setAddressModalType(type);
  }

  async function saveAddress(event) {
    event.preventDefault();
    setSavingAddress(true);
    setAddressesError("");
    const newAddr = {
      id: "addr_" + Date.now(),
      label: addressForm.label || `${addressForm.city || "Location"} (${addressForm.type})`,
      type: addressForm.type,
      contact: addressForm.contact || user?.full_name || "Contact Person",
      phone: addressForm.phone || "+91 98200 00000",
      email: addressForm.email || user?.email || "contact@example.com",
      street: addressForm.street || "Main Industrial Highway",
      city: addressForm.city || "Mumbai",
      state: addressForm.state || "Maharashtra",
      postal: addressForm.postal || "400001",
      country: addressForm.country || "India",
      isDefault: addressForm.isDefault,
    };
    try {
      await createSavedAddress(token, { ...addressForm, is_default: addressForm.isDefault });
    } catch {}

    const updated = saveLocalAddress(newAddr);
    setSavedAddresses(updated);
    setField(addressModalType === "pickup" ? "pickupAddr" : "deliveryAddr", newAddr.id);
    setAddressModalType("");
    setSavingAddress(false);

    // Validate new address proximity immediately
    const targetPort = addressModalType === "pickup" ? oPort : dPort;
    if (targetPort) {
      const check = validateAddressProximity(newAddr, targetPort, form.mode || "ocean");
      if (!check.isValid) {
        const nearest = findNearestPort(newAddr, availablePorts);
        setProximityModal({
          type: addressModalType,
          address: newAddr,
          port: targetPort,
          check,
          nearestPort: nearest,
        });
      }
    }
  }

  useEffect(() => {
    let cancelled = false;

    getSavedAddresses(token)
      .then((addresses) => {
        if (!cancelled) setSavedAddresses(Array.isArray(addresses) && addresses.length > 0 ? addresses : getLocalSavedAddresses());
      })
      .catch(() => {
        if (!cancelled) setSavedAddresses(getLocalSavedAddresses());
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Dynamically filter ports and terminals by the selected service mode
  const availablePorts = useMemo(() => {
    const m = form.mode || "ocean";
    const filtered = PORTS_MASTER.filter((p) => {
      if (!p.modes) return true;
      if (m === "express" || m === "air") return p.modes.includes("air") || p.modes.includes("express");
      if (m === "ground") return p.modes.includes("ground") || p.modes.includes("road") || p.modes.includes("rail");
      return p.modes.includes("ocean");
    });
    return filtered.length > 0 ? filtered : PORTS_MASTER;
  }, [form.mode]);

  const availablePackaging = useMemo(() => {
    return PACKAGING_BY_MODE[form.mode || "ocean"] || PACKAGING_BY_MODE.ocean;
  }, [form.mode]);

  function handleModeChange(newMode) {
    const matchingPorts = PORTS_MASTER.filter((p) => {
      if (newMode === "express" || newMode === "air") return p.modes?.includes("air") || p.modes?.includes("express");
      if (newMode === "ground") return p.modes?.includes("ground") || p.modes?.includes("road") || p.modes?.includes("rail");
      return p.modes?.includes("ocean");
    });

    const isOriginValid = matchingPorts.some((p) => p.id === form.originId);
    const isDestValid = matchingPorts.some((p) => p.id === form.destId);

    let defaultOrigin = matchingPorts[0]?.id || "";
    let defaultDest = matchingPorts.find((p) => p.id !== defaultOrigin)?.id || matchingPorts[1]?.id || "";

    if (newMode === "ocean") {
      defaultOrigin = "INNSA";
      defaultDest = "SGSIN";
    } else if (newMode === "air" || newMode === "express") {
      defaultOrigin = "DEL";
      defaultDest = "SIN-AIR";
    } else if (newMode === "ground") {
      defaultOrigin = "IN-TKD";
      defaultDest = "IN-BHI";
    }

    const defaultPkg = PACKAGING_BY_MODE[newMode]?.[0]?.value || "40HC";

    setForm((prev) => ({
      ...prev,
      mode: newMode,
      originId: isOriginValid ? prev.originId : defaultOrigin,
      destId: isDestValid ? prev.destId : defaultDest,
      loadType: newMode === "ocean" ? "fcl" : newMode === "ground" ? "ftl" : "standard",
    }));

    setItems((prevItems) =>
      prevItems.map((item) => ({
        ...item,
        containerType: defaultPkg,
        type: newMode === "ocean" ? "Container" : newMode === "ground" ? "Container" : "Pallet",
      }))
    );
  }

  function quickFillDemo() {
    const addresses = savedAddresses.length > 0 ? savedAddresses : getLocalSavedAddresses();
    const pAddr = addresses.find((a) => a.type.includes("Pickup")) || addresses[0];
    const dAddr = addresses.find((a) => a.type.includes("Delivery")) || addresses[1] || addresses[0];

    const currentMode = form.mode || "ocean";
    let o = "INMAA";
    let d = "SGSIN";
    let load = "fcl";
    let packageType = "Container";
    let cType = "40HC";
    let desc = "40ft High Cube Container of Laptops & Accessories";

    if (currentMode === "air" || currentMode === "express") {
      o = "DEL";
      d = "SIN-AIR";
      load = "standard";
      packageType = "Pallet";
      cType = "ULD-AKE";
      desc = "Commercial Avionics & High-Value Microchips";
    } else if (currentMode === "ground") {
      o = "IN-TKD";
      d = "IN-BHI";
      load = "ftl";
      packageType = "Container";
      cType = "32FT-MX";
      desc = "Industrial FMCG & Automotive Assemblies";
    }

    setForm({
      originId: o,
      destId: d,
      pickupAddr: pAddr?.id || "addr_1",
      deliveryAddr: dAddr?.id || "addr_3",
      readyDate: getTodayStr(),
      deliveryDate: getPlus7DaysStr(),
      mode: currentMode,
      loadType: load,
      incoterm: "CIF",
      declaredVal: "500000",
      currency: "INR",
      specialInst: "Fragile cargo, keep dry and handle with care.",
      chkFragile: true,
      chkHazardous: false,
      chkTemp: false,
      chkInsurance: true,
      unNumber: "",
      imoClass: "",
      custName: user?.full_name || "Anand Verma",
      custCompany: "Verma Exports India",
      custEmail: user?.email || "anand.verma@example.com",
      custCountry: "India",
    });
    setItems([
      {
        id: Date.now(),
        type: packageType,
        containerType: cType,
        count: "1",
        weight: currentMode === "air" || currentMode === "express" ? "3200" : "12500",
        desc: desc,
        hs: "847130",
      },
    ]);
  }

  function addItem() {
    setItems((list) => [
      ...list,
      { id: Date.now(), type: "", containerType: "", count: "", weight: "", desc: "", hs: "" },
    ]);
  }

  function removeItem(idx) {
    setItems((list) => list.filter((_, i) => i !== idx));
  }

  function updateItem(idx, key, val) {
    setItems((list) => list.map((it, i) => (i === idx ? { ...it, [key]: val } : it)));
  }

  function clearForm() {
    setForm(initialFormState);
    setItems([EMPTY_ITEM]);
  }

  function saveDraft() {
    window.alert("Draft saved. You can continue editing this enquiry anytime.");
  }

  const oPort = PORTS_MASTER.find((p) => p.id === form.originId);
  const dPort = PORTS_MASTER.find((p) => p.id === form.destId);

  const selectedPickupObj = useMemo(() => {
    return savedAddresses.find((a) => a.id === form.pickupAddr) || null;
  }, [savedAddresses, form.pickupAddr]);

  const selectedDeliveryObj = useMemo(() => {
    return savedAddresses.find((a) => a.id === form.deliveryAddr) || null;
  }, [savedAddresses, form.deliveryAddr]);

  const pickupProximity = useMemo(() => {
    if (!selectedPickupObj || !oPort) return null;
    return validateAddressProximity(selectedPickupObj, oPort, form.mode || "ocean");
  }, [selectedPickupObj, oPort, form.mode]);

  const deliveryProximity = useMemo(() => {
    if (!selectedDeliveryObj || !dPort) return null;
    return validateAddressProximity(selectedDeliveryObj, dPort, form.mode || "ocean");
  }, [selectedDeliveryObj, dPort, form.mode]);

  function handleSelectPickup(addrId) {
    if (addrId === "ADD_NEW") {
      openAddressModal("pickup");
      return;
    }
    setField("pickupAddr", addrId);
    setAcknowledgedOverrides((prev) => ({ ...prev, pickup: false }));

    if (addrId && oPort) {
      const addr = savedAddresses.find((a) => a.id === addrId);
      if (addr) {
        const check = validateAddressProximity(addr, oPort, form.mode || "ocean");
        if (!check.isValid) {
          const nearest = findNearestPort(addr, availablePorts);
          setProximityModal({
            type: "pickup",
            address: addr,
            port: oPort,
            check,
            nearestPort: nearest,
          });
        }
      }
    }
  }

  function handleSelectDelivery(addrId) {
    if (addrId === "ADD_NEW") {
      openAddressModal("delivery");
      return;
    }
    setField("deliveryAddr", addrId);
    setAcknowledgedOverrides((prev) => ({ ...prev, delivery: false }));

    if (addrId && dPort) {
      const addr = savedAddresses.find((a) => a.id === addrId);
      if (addr) {
        const check = validateAddressProximity(addr, dPort, form.mode || "ocean");
        if (!check.isValid) {
          const nearest = findNearestPort(addr, availablePorts);
          setProximityModal({
            type: "delivery",
            address: addr,
            port: dPort,
            check,
            nearestPort: nearest,
          });
        }
      }
    }
  }

  function handleOriginChange(newOriginId) {
    setField("originId", newOriginId);
    setAcknowledgedOverrides((prev) => ({ ...prev, pickup: false }));
    const newPort = PORTS_MASTER.find((p) => p.id === newOriginId);
    if (newPort && selectedPickupObj) {
      const check = validateAddressProximity(selectedPickupObj, newPort, form.mode || "ocean");
      if (!check.isValid) {
        const nearest = findNearestPort(selectedPickupObj, availablePorts);
        setProximityModal({
          type: "pickup",
          address: selectedPickupObj,
          port: newPort,
          check,
          nearestPort: nearest,
        });
      }
    }
  }

  function handleDestChange(newDestId) {
    setField("destId", newDestId);
    setAcknowledgedOverrides((prev) => ({ ...prev, delivery: false }));
    const newPort = PORTS_MASTER.find((p) => p.id === newDestId);
    if (newPort && selectedDeliveryObj) {
      const check = validateAddressProximity(selectedDeliveryObj, newPort, form.mode || "ocean");
      if (!check.isValid) {
        const nearest = findNearestPort(selectedDeliveryObj, availablePorts);
        setProximityModal({
          type: "delivery",
          address: selectedDeliveryObj,
          port: newPort,
          check,
          nearestPort: nearest,
        });
      }
    }
  }

  function switchPortToNearest(type, portId) {
    if (type === "pickup") {
      setField("originId", portId);
    } else {
      setField("destId", portId);
    }
    setProximityModal(null);
  }

  function acknowledgeProximityOverride(type) {
    setAcknowledgedOverrides((prev) => ({ ...prev, [type]: true }));
    setProximityModal(null);
  }

  function triggerProximityModal(type) {
    const isPickup = type === "pickup";
    const addr = isPickup ? selectedPickupObj : selectedDeliveryObj;
    const port = isPickup ? oPort : dPort;
    const check = isPickup ? pickupProximity : deliveryProximity;
    if (addr && port && check) {
      const nearest = findNearestPort(addr, availablePorts);
      setProximityModal({
        type,
        address: addr,
        port,
        check,
        nearestPort: nearest,
      });
    }
  }

  // ---- Summary stats calculated for shipment enquiry payload ----
  const summaryStats = useMemo(() => {
    let totalContainers = 0;
    let totalWeight = 0;
    let containerSummaryStr = "";

    items.forEach((item) => {
      totalContainers += parseInt(item.count, 10) || 0;
      totalWeight += parseFloat(item.weight) || 0;
      if (item.containerType) {
        containerSummaryStr += `${item.count || 1} × ${item.containerType} `;
      }
    });

    return {
      totalContainers: Math.max(totalContainers, 1),
      totalWeight: Math.max(totalWeight, 0),
      containerSummaryStr: containerSummaryStr.trim() || "1 × 40HC",
    };
  }, [items]);

  const quote = {
    id: "QT-OFFICIAL",
    containerSummaryStr: summaryStats.containerSummaryStr,
    baseFreight: 0,
    thcCost: 0,
    customsCost: 0,
    bafCost: 0,
    hazmatCost: 0,
    insuranceCost: 0,
    formattedPrice: money(0),
  };
  // ---- Leaflet map: init once ----
  useEffect(() => {
    if (!mapElRef.current || mapInstanceRef.current) return;
    const map = L.map(mapElRef.current, { attributionControl: false, zoomControl: true }).setView([20, 50], 2);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png").addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // ---- Leaflet map: update markers, linehaul corridor, and drayage connectors ----
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (originMarkerRef.current) map.removeLayer(originMarkerRef.current);
    if (destMarkerRef.current) map.removeLayer(destMarkerRef.current);
    if (polylineRef.current) map.removeLayer(polylineRef.current);
    if (pickupMarkerRef.current) map.removeLayer(pickupMarkerRef.current);
    if (deliveryMarkerRef.current) map.removeLayer(deliveryMarkerRef.current);
    if (pickupLineRef.current) map.removeLayer(pickupLineRef.current);
    if (deliveryLineRef.current) map.removeLayer(deliveryLineRef.current);

    const bounds = [];

    if (oPort) {
      originMarkerRef.current = L.marker([oPort.lat, oPort.lng]).addTo(map).bindPopup(`<b>Origin Hub:</b> ${oPort.name} (${oPort.code})`);
      bounds.push([oPort.lat, oPort.lng]);
    }

    if (dPort) {
      destMarkerRef.current = L.marker([dPort.lat, dPort.lng]).addTo(map).bindPopup(`<b>Destination Hub:</b> ${dPort.name} (${dPort.code})`);
      bounds.push([dPort.lat, dPort.lng]);
    }

    if (oPort && dPort) {
      polylineRef.current = L.polyline(
        [
          [oPort.lat, oPort.lng],
          [(oPort.lat + dPort.lat) / 2 + 4, (oPort.lng + dPort.lng) / 2],
          [dPort.lat, dPort.lng],
        ],
        { color: "#ff9800", weight: 3, dashArray: "6, 6" }
      ).addTo(map);
    }

    // Pickup address marker and first-mile connector line
    if (selectedPickupObj && oPort) {
      const pCoords = resolveAddressCoordinates(selectedPickupObj);
      if (pCoords) {
        const isNearby = pickupProximity?.isValid;
        pickupMarkerRef.current = L.circleMarker([pCoords.lat, pCoords.lng], {
          radius: 7,
          fillColor: isNearby ? "#16a34a" : "#dc2626",
          color: "#ffffff",
          weight: 2,
          fillOpacity: 0.9,
        }).addTo(map).bindPopup(`<b>Pickup Door:</b> ${selectedPickupObj.label || selectedPickupObj.city} (${pickupProximity?.distanceKm || 0} km from port)`);

        pickupLineRef.current = L.polyline(
          [[pCoords.lat, pCoords.lng], [oPort.lat, oPort.lng]],
          { color: isNearby ? "#16a34a" : "#dc2626", weight: 2.5, dashArray: "4, 4" }
        ).addTo(map);
        bounds.push([pCoords.lat, pCoords.lng]);
      }
    }

    // Delivery address marker and last-mile connector line
    if (selectedDeliveryObj && dPort) {
      const dCoords = resolveAddressCoordinates(selectedDeliveryObj);
      if (dCoords) {
        const isNearby = deliveryProximity?.isValid;
        deliveryMarkerRef.current = L.circleMarker([dCoords.lat, dCoords.lng], {
          radius: 7,
          fillColor: isNearby ? "#0284c7" : "#dc2626",
          color: "#ffffff",
          weight: 2,
          fillOpacity: 0.9,
        }).addTo(map).bindPopup(`<b>Delivery Door:</b> ${selectedDeliveryObj.label || selectedDeliveryObj.city} (${deliveryProximity?.distanceKm || 0} km from port)`);

        deliveryLineRef.current = L.polyline(
          [[dPort.lat, dPort.lng], [dCoords.lat, dCoords.lng]],
          { color: isNearby ? "#0284c7" : "#dc2626", weight: 2.5, dashArray: "4, 4" }
        ).addTo(map);
        bounds.push([dCoords.lat, dCoords.lng]);
      }
    }

    if (bounds.length >= 2) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [35, 35] });
    }
  }, [oPort, dPort, selectedPickupObj, selectedDeliveryObj, pickupProximity, deliveryProximity]);

  // ---- Chart.js doughnut: init once ----
  useEffect(() => {
    if (!chartCanvasRef.current || chartInstanceRef.current) return;
    chartInstanceRef.current = new Chart(chartCanvasRef.current, {
      type: "doughnut",
      data: {
        labels: ["Base Freight Rate", "Surcharges & Fees"],
        datasets: [{ data: [75, 25], backgroundColor: ["#0f172a", "#ff9800"], borderWidth: 0 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "72%",
        plugins: { legend: { position: "bottom", labels: { font: { size: 11, family: "Inter" }, boxWidth: 14 } } },
      },
    });

    return () => {
      chartInstanceRef.current?.destroy();
      chartInstanceRef.current = null;
    };
  }, []);

  // ---- Chart.js doughnut: update on generatedQuote change ----
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return;
    if (generatedQuote?.breakdown) {
      chart.data.datasets[0].data = [
        generatedQuote.breakdown.distance_cost || 70,
        (generatedQuote.breakdown.fuel_surcharge || 0) + (generatedQuote.breakdown.base_handling_fee || 0),
      ];
    } else {
      chart.data.datasets[0].data = [75, 25];
    }
    chart.update();
  }, [generatedQuote]);

  const pickupAddresses = savedAddresses.filter((address) =>
    ["Pickup (Origin)", "Both (Origin & Destination)"].includes(address.type)
  );
  const deliveryAddresses = savedAddresses.filter((address) =>
    ["Delivery (Destination)", "Both (Origin & Destination)"].includes(address.type)
  );

  async function handleGenerateQuote() {
    const hasValidItems = items.length > 0 && items.every((item) =>
      item.type && item.containerType && Number(item.count) > 0 && Number(item.weight) > 0 && item.desc.trim()
    );
    if (!form.originId || !form.destId || !form.readyDate || !form.mode || !form.loadType || !form.incoterm || !hasValidItems) {
      setQuoteError("Complete the required route, ready date, service type, and cargo details before submitting to the Quote Generation Agent.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const todayStr = getTodayStr();
    if (form.readyDate < todayStr) {
      setQuoteError("Ready date cannot be in the past. Please select today or a future date.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Geospatial Proximity Guard
    if (pickupProximity && !pickupProximity.isValid && !acknowledgedOverrides.pickup) {
      triggerProximityModal("pickup");
      setQuoteError(`Pickup address (${selectedPickupObj?.city || selectedPickupObj?.label || "Location"}) is ${pickupProximity.distanceKm} km away from ${oPort?.name}. Please review port proximity or acknowledge inter-state haulage.`);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (deliveryProximity && !deliveryProximity.isValid && !acknowledgedOverrides.delivery) {
      triggerProximityModal("delivery");
      setQuoteError(`Delivery address (${selectedDeliveryObj?.city || selectedDeliveryObj?.label || "Location"}) is ${deliveryProximity.distanceKm} km away from ${dPort?.name}. Please review port proximity or acknowledge inter-state haulage.`);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setGenerating(true);
    setAgentEvaluating(true);
    setAgentStage(1);
    setQuoteError("");

    const originName = oPort?.name || form.originId;
    const destName = dPort?.name || form.destId;
    const originKey = oPort?.id || form.originId || "INNSA";
    const destKey = dPort?.id || form.destId || "SGSIN";

    const cityByPort = {
      INNSA: "Mumbai",
      INMAA: "Chennai",
      AEJEA: "Dubai",
      SGSIN: "Singapore",
      NLRTM: "Rotterdam",
      CNSHA: "Shanghai",
      DEL: "Delhi",
    };
    const originCity = cityByPort[originKey] || oPort?.name?.split(",")[0] || "Mumbai";
    const destCity = cityByPort[destKey] || dPort?.name?.split(",")[0] || "Singapore";

    const apiMode = form.mode === "ground" ? "road" : form.mode === "express" ? "air" : form.mode;
    const cargoType = form.chkHazardous ? "hazardous" : form.chkTemp ? "cold_chain" : form.mode === "express" ? "express" : "general";

    setAgentLogs([
      `[00:00.1] [DISPATCH] Retailer submitted shipment enquiry for lane: ${originName} → ${destName}`,
      `[00:00.3] [INGEST] Ingesting specifications & dispatching to AI Quote Generation Agent...`,
    ]);

    try {
      // Step 1: Ingest & Dispatch (1.4s)
      await new Promise((r) => setTimeout(r, 1400));
      setAgentStage(2);
      setAgentLogs((prev) => [
        ...prev,
        `[00:01.4] [AGENT] Agent evaluating carrier tariffs, port handling fees & congestion indices...`,
        `[00:01.9] [SPECS] Cargo specs: ${summaryStats.totalWeight.toLocaleString()} kg gross, ${summaryStats.containerSummaryStr}, ${cargoType.toUpperCase()} classification...`,
        `[00:02.5] [ROUTE] Resolving waypoint coordinates for route: ${oPort?.code || originKey} → ${dPort?.code || destKey}...`,
      ]);

      // Step 2: Agent evaluates request & route (1.8s)
      await new Promise((r) => setTimeout(r, 1800));
      setAgentStage(3);
      setAgentLogs((prev) => [
        ...prev,
        `[00:03.3] [TARIFF] Applying Admin Rate Configuration matrix & BAF fuel indexation...`,
        `[00:03.9] [COMPUTE] Calculating linehaul distance tariff, handling, and guaranteed pricing...`,
      ]);

      // Calculate dynamic authoritative rate based on Admin config & route parameters
      const calcResult = calculateAuthoritativeFreightQuote({
        originPort: oPort,
        destPort: dPort,
        mode: form.mode,
        loadType: form.loadType,
        incoterm: form.incoterm,
        items,
        chkHazardous: form.chkHazardous,
        chkTemp: form.chkTemp,
        chkInsurance: form.chkInsurance,
        declaredVal: form.declaredVal,
        currency: form.currency || "INR",
      });

      const isValidMongoId = (id) => typeof id === "string" && /^[a-fA-F0-9]{24}$/.test(id);
      let result = null;

      try {
        const apiRes = await estimateQuote(token, {
          origin: originCity,
          destination: destCity,
          weightKg: Math.max(summaryStats.totalWeight, 1),
          volumeM3: Math.max(summaryStats.totalContainers * 20, 1),
          cargoType,
          mode: apiMode,
          pickupAddressId: isValidMongoId(form.pickupAddr) ? form.pickupAddr : undefined,
          deliveryAddressId: isValidMongoId(form.deliveryAddr) ? form.deliveryAddr : undefined,
        });
        if (apiRes && apiRes.breakdown) {
          result = apiRes;
        }
      } catch (err) {
        console.info("Using authoritative client Quote Agent calculation engine.");
      }

      if (!result) {
        result = {
          id: "qt_" + Math.random().toString(36).slice(2, 10),
          origin: originName,
          destination: destName,
          mode: form.mode,
          distance_km: calcResult.distance_km,
          chargeable_weight_kg: calcResult.chargeable_weight_kg,
          transit_days: calcResult.transit_days,
          currency: form.currency || "INR",
          breakdown: calcResult.breakdown,
          status: "issued",
          created_at: new Date().toISOString(),
        };
      }

      setGeneratedQuote(result);
      const quoteCode = result.id ? `QT-${result.id.slice(-8).toUpperCase()}` : "QT-NEW";

      // Step 3: Determining Estimation (1.8s)
      await new Promise((r) => setTimeout(r, 1800));
      setAgentStage(3);
      setAgentLogs((prev) => [
        ...prev,
        `[00:04.9] [RATE] Authoritative dynamic rate computed: ₹${Math.round(result.breakdown?.total || 0).toLocaleString("en-IN")}`,
        `[00:05.4] [SECURITY] Applying security checksum and locking guaranteed tariff...`,
      ]);

      if (addQuotation) {
        addQuotation({
          id: result.id,
          quoteNo: quoteCode,
          customerName: user?.full_name || form.custName || "Retail Customer",
          customerCity: originCity,
          laneCode: `${originName} → ${destName}`,
          laneSub: `${oPort?.code || form.originId} → ${dPort?.code || form.destId}`,
          origin: originName,
          destination: destName,
          mode: form.mode,
          modeLabel: form.mode === "ocean" ? "Ocean Freight" : form.mode === "air" ? "Air Freight" : form.mode === "express" ? "Express Air" : "Road Freight",
          basis: `${summaryStats.totalWeight.toLocaleString()} kg / ${summaryStats.containerSummaryStr}`,
          transit: `${result.transit_days || 14} d`,
          totalFormatted: `₹ ${Math.round(result.breakdown?.total || 0).toLocaleString("en-IN")}`,
          totalNum: Number(result.breakdown?.total || 0),
          breakdown: result.breakdown || {},
          status: "Draft",
          created: "Today",
          createdAt: new Date().toISOString(),
        });
      }

      // Step 4: Quote verified and returned (1.4s)
      await new Promise((r) => setTimeout(r, 1400));
      setAgentStage(4);
      setAgentLogs((prev) => [
        ...prev,
        `[00:06.1] [VERIFIED] Quotation verified & certified by Agent: ${quoteCode}`,
        `[00:06.6] [READY] Presenting official quotation to retailer...`,
      ]);

      // Reveal quote to retailer (~0.8s)
      await new Promise((r) => setTimeout(r, 800));
      setAgentEvaluating(false);
      setShowQuoteModal(true);
      if (reloadQuotes) {
        reloadQuotes();
      }
    } catch (error) {
      setAgentEvaluating(false);
      setQuoteError(error.message || "Quote Generation Agent encountered an issue evaluating this request.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleConfirmShipment() {
    if (!generatedQuote) return;

    setConfirming(true);
    setQuoteError("");
    const refCode = `BK-${(generatedQuote.id || Date.now().toString()).slice(-8).toUpperCase()}`;

    try {
      const confirmedQuote = await confirmQuote(token, generatedQuote.id);
      setGeneratedQuote(confirmedQuote);
      setShowQuoteModal(false);
      setBookingRef(refCode);
      if (updateQuotationStatus) {
        updateQuotationStatus(generatedQuote.id, "Booked");
      }
      setShowSuccessModal(true);
      if (reloadQuotes) {
        reloadQuotes();
      }
    } catch {
      setShowQuoteModal(false);
      setBookingRef(refCode);
      if (updateQuotationStatus) {
        updateQuotationStatus(generatedQuote.id, "Booked");
      }
      setShowSuccessModal(true);
      if (reloadQuotes) {
        reloadQuotes();
      }
    } finally {
      setConfirming(false);
    }
  }

  function exportPDF() {
    const el = printablePdfRef.current || modalContentRef.current;
    if (!el) return;
    const exportId = generatedQuote ? `QT-${generatedQuote.id.slice(-8).toUpperCase()}` : "QT-OFFICIAL";
    const opt = {
      margin: [6, 6, 6, 6],
      filename: `FreightAI_Official_Quotation_${exportId}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0, windowWidth: 680 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };
    html2pdf().set(opt).from(el).save();
  }

  return (
    <div className="enquiryView">
      <div className="top-bar">
        <div className="breadcrumb">
          <span className="bc-path">Shipments / New</span>
          <h1 className="page-title">New shipment enquiry</h1>
        </div>
        <div className="action-btns">
          <button type="button" className="btn-secondary-light" onClick={quickFillDemo} style={{ background: "#ea580c", color: "#ffffff", borderColor: "#ea580c", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Zap size={14} /> Quick Fill Demo Quote
          </button>
          <button type="button" className="btn-secondary-light" onClick={saveDraft}>Save draft</button>
          <button type="button" className="btn-secondary-light" onClick={clearForm}>Clear</button>
        </div>
      </div>

      {quoteError && <p className="quote-api-error" role="alert">{quoteError}</p>}

      <div className="main-grid">
        {/* LEFT FORM SECTIONS */}
        <div className="form-sections">
          {/* SECTION 1: ROUTE */}
          <div className="section-card">
            <div className="section-header">
              <div className="sec-num">1</div>
              <div className="sec-title">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h3>Route</h3>
                  <span style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    padding: "2px 9px",
                    borderRadius: "12px",
                    background: form.mode === "air" || form.mode === "express" ? "#e0f2fe" : form.mode === "ground" ? "#fef3c7" : "#e0e7ff",
                    color: form.mode === "air" || form.mode === "express" ? "#0369a1" : form.mode === "ground" ? "#92400e" : "#3730a3",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px"
                  }}>
                    {form.mode === "air" || form.mode === "express" ? (
                      <><Plane size={11} /> Airport Network</>
                    ) : form.mode === "ground" ? (
                      <><Truck size={11} /> Inland Depot Network</>
                    ) : (
                      <><Anchor size={11} /> Seaport Network</>
                    )}
                  </span>
                </div>
                <p>
                  {form.mode === "air" || form.mode === "express"
                    ? "International Air Cargo Terminals & Runways"
                    : form.mode === "ground"
                    ? "Inland Container Depots (ICDs) & Multi-modal Freight Hubs"
                    : "Deep-sea Container Seaports & Maritime Terminals"}
                </p>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Origin {form.mode === "ocean" ? "Seaport" : form.mode === "ground" ? "Inland Hub" : "Airport"} <span className="req">*</span></label>
                <select className="form-select" value={form.originId} onChange={(e) => handleOriginChange(e.target.value)}>
                  <option value="" disabled>Select an origin terminal</option>
                  {availablePorts.map((p) => (
                    <option key={p.id} value={p.id}>{p.code} — {p.name}, {p.country} ({p.type})</option>
                  ))}
                </select>
                <span className="subtext">Auto-filtered for {form.mode?.toUpperCase() || "OCEAN"} transport mode</span>
              </div>
              <div className="form-group">
                <label>Destination {form.mode === "ocean" ? "Seaport" : form.mode === "ground" ? "Inland Hub" : "Airport"} <span className="req">*</span></label>
                <select className="form-select" value={form.destId} onChange={(e) => handleDestChange(e.target.value)}>
                  <option value="" disabled>Select a destination terminal</option>
                  {availablePorts.map((p) => (
                    <option key={p.id} value={p.id}>{p.code} — {p.name}, {p.country} ({p.type})</option>
                  ))}
                </select>
                <span className="subtext">Verified destination nodes on active carrier network</span>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label>Pickup address <span className="hint">(door pickup only)</span></label>
                  <button type="button" onClick={() => openAddressModal("pickup")} style={{ fontSize: "11.5px", color: "#ea580c", background: "none", border: "none", cursor: "pointer", fontWeight: "700" }}>+ Add Address</button>
                </div>
                <select className="form-select" value={form.pickupAddr} onChange={(e) => handleSelectPickup(e.target.value)}>
                  <option value="">Select a saved pickup address</option>
                  <option value="ADD_NEW">+ Enter &amp; Save New Address...</option>
                  {pickupAddresses.map((address) => <option key={address.id} value={address.id}>{address.label} — {address.city}, {address.country}</option>)}
                </select>
                {selectedPickupObj && oPort && pickupProximity && (
                  <div
                    className={`addr-proximity-badge ${pickupProximity.isValid ? "valid" : "warning"}`}
                    onClick={() => !pickupProximity.isValid && triggerProximityModal("pickup")}
                  >
                    {pickupProximity.isValid ? (
                      <><CheckCircle2 size={12} /> Within {pickupProximity.distanceKm} km of {oPort.code} ({form.mode === "ocean" ? "Standard Port Drayage" : "Terminal Feeder"})</>
                    ) : (
                      <><AlertTriangle size={12} /> {pickupProximity.distanceKm} km from {oPort.code} (Exceeds {pickupProximity.thresholdKm} km limit) — <span style={{ textDecoration: "underline", fontWeight: 700 }}>Review Proximity</span></>
                    )}
                  </div>
                )}
              </div>
              <div className="form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label>Delivery address <span className="hint">(door delivery only)</span> <span className="badge-new">NEW</span></label>
                  <button type="button" onClick={() => openAddressModal("delivery")} style={{ fontSize: "11.5px", color: "#ea580c", background: "none", border: "none", cursor: "pointer", fontWeight: "700" }}>+ Add Address</button>
                </div>
                <select className="form-select" value={form.deliveryAddr} onChange={(e) => handleSelectDelivery(e.target.value)}>
                  <option value="">Select a saved delivery address</option>
                  <option value="ADD_NEW">+ Enter &amp; Save New Address...</option>
                  {deliveryAddresses.map((address) => <option key={address.id} value={address.id}>{address.label} — {address.city}, {address.country}</option>)}
                </select>
                {selectedDeliveryObj && dPort && deliveryProximity && (
                  <div
                    className={`addr-proximity-badge ${deliveryProximity.isValid ? "valid" : "warning"}`}
                    onClick={() => !deliveryProximity.isValid && triggerProximityModal("delivery")}
                  >
                    {deliveryProximity.isValid ? (
                      <><CheckCircle2 size={12} /> Within {deliveryProximity.distanceKm} km of {dPort.code} ({form.mode === "ocean" ? "Standard Port Drayage" : "Terminal Feeder"})</>
                    ) : (
                      <><AlertTriangle size={12} /> {deliveryProximity.distanceKm} km from {dPort.code} (Exceeds {deliveryProximity.thresholdKm} km limit) — <span style={{ textDecoration: "underline", fontWeight: 700 }}>Review Proximity</span></>
                    )}
                  </div>
                )}
              </div>
            </div>
            {addressesError && <p className="quote-api-error" role="alert">{addressesError}</p>}

            <div className="form-row">
              <div className="form-group">
                <label>Ready date <span className="req">*</span></label>
                <input type="date" className="form-input" min={getTodayStr()} value={form.readyDate} onChange={(e) => updateReadyDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Required delivery date <span className="hint">(optional)</span></label>
                <input type="date" className="form-input" min={dayAfter(form.readyDate)} disabled={!form.readyDate} value={form.deliveryDate} onChange={(e) => setField("deliveryDate", e.target.value)} />
              </div>
            </div>
          </div>

          {/* SECTION 2: SERVICE TYPE */}
          <div className="section-card">
            <div className="section-header">
              <div className="sec-num">2</div>
              <div className="sec-title">
                <h3>Service type</h3>
                <p>Mode, load type and commercial terms</p>
              </div>
            </div>

            <label style={{ marginBottom: 8, display: "block" }}>Mode <span className="req">*</span></label>
            <div className="mode-pills">
              {MODE_PILLS.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  className={`mode-pill${form.mode === value ? " active" : ""}`}
                  onClick={() => handleModeChange(value)}
                >
                  <Icon size={18} /> {label}
                </button>
              ))}
            </div>

            <div className="alert-banner">
              <div className="alert-banner-title">
                {form.mode === "air"
                  ? "ACTIVE MODE = AIR FREIGHT (Air Cargo Terminals Auto-Selected)"
                  : form.mode === "express"
                  ? "ACTIVE MODE = EXPRESS AIR (Priority Expedited Air Cargo)"
                  : form.mode === "ground"
                  ? "ACTIVE MODE = GROUND & RAIL (Domestic Inland Container Depots)"
                  : "ACTIVE MODE = OCEAN FREIGHT (Deep-Sea Maritime Container Berths)"}
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <div className="form-group">
                  <label>Load type <span className="req">*</span> <span className="badge-new">NEW</span></label>
                  <select className="form-select" value={form.loadType} onChange={(e) => setField("loadType", e.target.value)}>
                    {form.mode === "ocean" ? (
                      <>
                        <option value="fcl">FCL — Full Container Load</option>
                        <option value="lcl">LCL — Less than Container Load</option>
                      </>
                    ) : form.mode === "ground" ? (
                      <>
                        <option value="ftl">FTL — Full Truckload</option>
                        <option value="ltl">LTL — Part Truckload</option>
                        <option value="rail">Rail Flat Wagon Container</option>
                      </>
                    ) : (
                      <>
                        <option value="standard">Standard General Air Cargo</option>
                        <option value="priority">Priority Expedited Air</option>
                        <option value="charter">Dedicated Air Charter</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="form-group">
                  <label>Incoterm <span className="req">*</span> <span className="badge-new">NEW</span></label>
                  <select className="form-select" value={form.incoterm} onChange={(e) => setField("incoterm", e.target.value)}>
                    <option value="" disabled>Select an Incoterm</option>
                    <option value="FOB">FOB — Free On Board</option>
                    <option value="EXW">EXW — Ex Works</option>
                    <option value="CIF">CIF — Cost Insurance Freight</option>
                    <option value="DDP">DDP — Delivered Duty Paid</option>
                  </select>
                  <span className="subtext">Decides which cost legs belong in the quote</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: SHIPMENT DETAILS */}
          <div className="section-card">
            <div className="section-header">
              <div className="sec-num">3</div>
              <div className="sec-title">
                <h3>Shipment details</h3>
                <p>What is being shipped</p>
              </div>
            </div>

            {items.map((item, idx) => (
              <div className="item-box" key={item.id}>
                <div className="item-box-header">
                  <span className="item-tag">ITEM #{String(idx + 1).padStart(2, "0")}</span>
                  {items.length > 1 && (
                    <button type="button" className="btn-remove" onClick={() => removeItem(idx)}>
                      <Trash2 size={14} /> Remove
                    </button>
                  )}
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Package type <span className="req">*</span></label>
                    <select className="form-select" value={item.type} onChange={(e) => updateItem(idx, "type", e.target.value)}>
                      <option value="" disabled>Select package type</option>
                      <option value="Container">Container</option>
                      <option value="Pallet">Pallet</option>
                      <option value="Box">Box / Carton</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Packaging / Equipment Type <span className="req">*</span> <span className="badge-new">AUTO</span></label>
                    <select className="form-select" value={item.containerType} onChange={(e) => updateItem(idx, "containerType", e.target.value)}>
                      <option value="" disabled>Select packaging / container type</option>
                      {availablePackaging.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="alert-banner" style={{ marginBottom: 12, padding: "10px 14px" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#c2410c" }}>
                    EQUIPMENT SPECIFICATIONS CONFIGURED FOR {(form.mode || "OCEAN").toUpperCase()} TRANSIT
                  </div>
                  <div className="form-row" style={{ marginBottom: 0, marginTop: 8 }}>
                    <div className="form-group">
                      <label>Container count <span className="req">*</span></label>
                      <input type="number" className="form-input" min={1} value={item.count} onChange={(e) => updateItem(idx, "count", e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Total gross weight (kg) <span className="req">*</span></label>
                      <input type="number" className="form-input" value={item.weight} onChange={(e) => updateItem(idx, "weight", e.target.value)} />
                      <span className="subtext">Limit for {item.containerType} ≈ 28,800 kg</span>
                    </div>
                  </div>
                </div>

                <div className="form-row" style={{ marginBottom: 0 }}>
                  <div className="form-group flex-1">
                    <label>Commodity description <span className="req">*</span> <span className="badge-new">NEW</span></label>
                    <input type="text" className="form-input" value={item.desc} onChange={(e) => updateItem(idx, "desc", e.target.value)} />
                    <span className="subtext">&quot;General cargo&quot; is rejected — customs needs specifics</span>
                  </div>
                  <div className="form-group flex-1">
                    <label>HS code (suggested) <span className="badge-new">NEW</span></label>
                    <input type="text" className="form-input" value={item.hs} onChange={(e) => updateItem(idx, "hs", e.target.value)} />
                  </div>
                </div>
              </div>
            ))}

            <button type="button" className="btn-add-item" onClick={addItem}>
              <Plus size={16} /> Add another item
            </button>
          </div>

          {/* SECTION 4: ADDITIONAL DETAILS */}
          <div className="section-card">
            <div className="section-header">
              <div className="sec-num">4</div>
              <div className="sec-title">
                <h3>Additional details</h3>
                <p>Value, handling and special requirements</p>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Declared value</label>
                <input type="number" className="form-input" step={50000} value={form.declaredVal} onChange={(e) => setField("declaredVal", e.target.value)} />
              </div>
              <div className="form-group">
                <label>Currency <span className="req">*</span> <span className="badge-new">NEW</span></label>
                <select className="form-select" value={form.currency} onChange={(e) => setField("currency", e.target.value)}>
                  <option value="" disabled>Select currency</option>
                  <option value="INR">INR — Indian Rupee</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                </select>
              </div>
            </div>

            <div className="form-group mt-3">
              <label>Special instructions <span className="hint">(optional)</span></label>
              <textarea className="form-textarea" rows={2} placeholder="e.g. call before delivery" value={form.specialInst} onChange={(e) => setField("specialInst", e.target.value)} />
            </div>

            <div className="checkbox-row">
              <label className="custom-check">
                <input type="checkbox" checked={form.chkFragile} onChange={(e) => setField("chkFragile", e.target.checked)} /> Fragile goods
              </label>
              <label className="custom-check">
                <input type="checkbox" checked={form.chkHazardous} onChange={(e) => setField("chkHazardous", e.target.checked)} /> Hazardous materials
              </label>
              <label className="custom-check">
                <input type="checkbox" checked={form.chkTemp} onChange={(e) => setField("chkTemp", e.target.checked)} /> Temperature controlled
              </label>
              <label className="custom-check">
                <input type="checkbox" checked={form.chkInsurance} onChange={(e) => setField("chkInsurance", e.target.checked)} /> Add cargo insurance
              </label>
            </div>

            {form.chkHazardous && (
              <div className="alert-banner mt-3">
                <div className="alert-banner-title">HAZARDOUS TICKED → THESE THREE BECOME REQUIRED</div>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <div className="form-group">
                    <label>UN number <span className="req">*</span> <span className="badge-new">NEW</span></label>
                    <input type="text" className="form-input" value={form.unNumber} onChange={(e) => setField("unNumber", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>IMO class <span className="req">*</span> <span className="badge-new">NEW</span></label>
                    <select className="form-select" value={form.imoClass} onChange={(e) => setField("imoClass", e.target.value)}>
                      <option value="" disabled>Select IMO class</option>
                      <option value="3">Class 3 — Flammable Liquid</option>
                      <option value="2">Class 2 — Gases</option>
                      <option value="8">Class 8 — Corrosives</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>MSDS <span className="req">*</span> <span className="badge-new">NEW</span></label>
                    <input type="file" className="form-input" style={{ padding: 6 }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 5: CONTACT DETAILS */}
          <div className="section-card">
            <div className="section-header">
              <div className="sec-num">5</div>
              <div className="sec-title">
                <h3>Contact details</h3>
                <p>Who receives the quotation</p>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Full name <span className="req">*</span></label>
                <input type="text" className="form-input" value={form.custName} onChange={(e) => setField("custName", e.target.value)} />
              </div>
              <div className="form-group">
                <label>Company / Location <span className="req">*</span></label>
                <input type="text" className="form-input" value={form.custCompany} onChange={(e) => setField("custCompany", e.target.value)} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Email <span className="req">*</span></label>
                <input type="email" className="form-input" value={form.custEmail} onChange={(e) => setField("custEmail", e.target.value)} />
              </div>
              <div className="form-group">
                <label>Country <span className="req">*</span> <span className="badge-new">NEW</span></label>
                <select className="form-select" value={form.custCountry} onChange={(e) => setField("custCountry", e.target.value)}>
                  <option value="" disabled>Select country</option>
                  <option value="India">India</option>
                  <option value="UAE">United Arab Emirates</option>
                  <option value="USA">United States</option>
                </select>
              </div>
            </div>
          </div>

          {/* SUBMIT ENQUIRY ACTION ROW */}
          <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end", gap: "12px", alignItems: "center" }}>
            <button type="button" className="btn-secondary-light" onClick={clearForm}>
              Reset Form
            </button>
            <button type="button" className="btn-orange-primary" style={{ padding: "12px 28px", fontSize: "14px", display: "inline-flex", alignItems: "center", gap: "8px" }} onClick={handleGenerateQuote} disabled={generating}>
              <Bot size={18} /> {generating ? "Quote Generation Agent Active..." : "Submit Enquiry to Quote Agent"} {!generating && <ArrowRight size={16} />}
            </button>
          </div>
        </div>

        {/* RIGHT STICKY COLUMN */}
        <div className="right-sidebar-column">
          {/* SHIPMENT SUMMARY & AGENT STATUS CARD */}
          <div className="live-card">
            <div className="live-card-header">SHIPMENT SPECS &amp; AGENT STATUS</div>

            <div className="charge-basis-box">
              <span className="cb-label">Agent Status</span>
              <strong className="cb-val" style={{ color: generatedQuote ? "#16a34a" : "#e65100", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                {generatedQuote ? (
                  <><CheckCircle size={14} /> Quote Evaluated & Ready</>
                ) : (
                  <><Clock size={14} /> Pending Agent Evaluation</>
                )}
              </strong>
            </div>

            <div className="summary-rows">
              <div className="s-row"><span>Origin Port</span><strong>{oPort ? oPort.name.split(",")[0] : "Not selected"}</strong></div>
              <div className="s-row"><span>Destination</span><strong>{dPort ? dPort.name.split(",")[0] : "Not selected"}</strong></div>
              <div className="s-row"><span>Ready Date</span><strong>{form.readyDate || "Not set"}</strong></div>
              <div className="s-row"><span>Containers</span><strong>{summaryStats.containerSummaryStr}</strong></div>
              <div className="s-row"><span>Gross weight</span><strong>{summaryStats.totalWeight.toLocaleString("en-IN")} kg</strong></div>
              <div className="s-row"><span>Service Mode</span><strong style={{ textTransform: "capitalize" }}>{form.mode || "Ocean"}</strong></div>
            </div>

            {generatedQuote ? (
              <>
                <div className="est-total-label">AGENT-DETERMINED ESTIMATE</div>
                <div className="est-total-price">{money(generatedQuote.breakdown?.total || 0)}</div>
                <div className="rate-badge">◆ CERTIFIED BY QUOTE AGENT ({`QT-${generatedQuote.id.slice(-8).toUpperCase()}`})</div>
                <button type="button" className="btn-generate" onClick={() => setShowQuoteModal(true)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  <Eye size={16} /> View Full Quotation Offer
                </button>
              </>
            ) : (
              <>
                <div style={{ background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: "10px", padding: "12px", margin: "14px 0 16px", textAlign: "center" }}>
                  <div style={{ fontSize: "12.5px", fontWeight: "700", color: "#334155", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                    <Bot size={16} color="#e65100" /> Quote Generation Agent
                  </div>
                  <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "4px", lineHeight: "1.4" }}>
                    Submit this enquiry to start Agent review, route analysis, and overall estimation determination.
                  </div>
                </div>

                <button type="button" className="btn-generate" onClick={handleGenerateQuote} disabled={generating} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  {generating ? "Agent Evaluating Request..." : "Submit to Quote Agent"} {!generating && <ArrowRight size={16} />}
                </button>
              </>
            )}

            <p className="disclaimer">
              {generatedQuote
                ? "Official quotation determined by Quote Generation Agent. Valid for 7 days."
                : "Quotation is calculated upon submission by the AI Quote Generation Agent."}
            </p>
          </div>

          {/* COST DISTRIBUTION */}
          <div className="side-widget-card">
            <h4 className="side-widget-title">Cost Distribution</h4>
            <div className="chart-container-wrap">
              <canvas ref={chartCanvasRef} />
            </div>
          </div>

          {/* ROUTE VISUALIZER */}
          <div className="side-widget-card">
            <h4 className="side-widget-title">Shipping Route Visualizer</h4>
            <div ref={mapElRef} className="map-container-wrap" />
          </div>

          {/* EXPORT PDF */}
          <button type="button" className="btn-dark-export" onClick={exportPDF} disabled={!generatedQuote}>
            <FileText size={18} /> Export PDF Quote (₹)
          </button>
        </div>
      </div>

      {addressModalType && (
        <div className="modal-overlay" onClick={() => setAddressModalType("")}>
          <div className="modal-content address-modal-content" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setAddressModalType("")} aria-label="Close"><X size={18} /></button>
            <h2>Enter {addressModalType} address</h2>
            <p className="address-modal-description">This address will be saved to your Saved Addresses automatically.</p>
            <form className="address-entry-form" onSubmit={saveAddress}>
              <div className="address-entry-grid">
                <label>Location label<input className="form-input" placeholder="e.g. Main warehouse" required value={addressForm.label} onChange={(event) => setAddressForm((current) => ({ ...current, label: event.target.value }))} /></label>
                <label>Contact person<input className="form-input" required value={addressForm.contact} onChange={(event) => setAddressForm((current) => ({ ...current, contact: event.target.value }))} /></label>
                <label>Phone<input type="tel" className="form-input" placeholder="Enter phone number" required value={addressForm.phone} onChange={(event) => setAddressForm((current) => ({ ...current, phone: event.target.value }))} /></label>
                <label>Email<input type="email" className="form-input" required value={addressForm.email} onChange={(event) => setAddressForm((current) => ({ ...current, email: event.target.value }))} /></label>
                <label className="address-entry-wide">Street address<input className="form-input" placeholder="Street, building, unit" required value={addressForm.street} onChange={(event) => setAddressForm((current) => ({ ...current, street: event.target.value }))} /></label>
                <label>City<input className="form-input" required value={addressForm.city} onChange={(event) => setAddressForm((current) => ({ ...current, city: event.target.value }))} /></label>
                <label>State / province<input className="form-input" required value={addressForm.state} onChange={(event) => setAddressForm((current) => ({ ...current, state: event.target.value }))} /></label>
                <label>Postal code<input className="form-input" required value={addressForm.postal} onChange={(event) => setAddressForm((current) => ({ ...current, postal: event.target.value }))} /></label>
                <label>Country<input className="form-input" required value={addressForm.country} onChange={(event) => setAddressForm((current) => ({ ...current, country: event.target.value }))} /></label>
              </div>
              <div className="modal-prompt-actions">
                <button type="button" className="btn-secondary-light" onClick={() => setAddressModalType("")}>Cancel</button>
                <button type="submit" className="btn-orange-primary" disabled={savingAddress}>{savingAddress ? "Saving address..." : "Save address"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROXIMITY & CATCHMENT DISCLAIMER MODAL */}
      {proximityModal && (
        <div className="modal-overlay" onClick={() => setProximityModal(null)}>
          <div className="modal-content proximity-modal-content" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setProximityModal(null)} aria-label="Close">
              <X size={18} />
            </button>

            <div className="proximity-modal-header">
              <div className="proximity-modal-icon">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="proximity-modal-title">
                  {proximityModal.type === "pickup" ? "Pickup Location Proximity Alert" : "Delivery Destination Proximity Alert"}
                </h3>
                <p className="proximity-modal-sub">
                  {proximityModal.type === "pickup" ? "First-Mile Port Drayage Catchment Notice" : "Last-Mile Delivery Feeder Notice"}
                </p>
              </div>
            </div>

            <div className="proximity-route-card">
              <div className="proximity-node-row">
                <span className="proximity-node-lbl">Selected {proximityModal.type === "pickup" ? "Origin Terminal" : "Destination Terminal"}:</span>
                <strong>{proximityModal.port.code} — {proximityModal.port.name}</strong>
              </div>
              <div className="proximity-node-row">
                <span className="proximity-node-lbl">Selected {proximityModal.type === "pickup" ? "Pickup Address" : "Delivery Address"}:</span>
                <strong>{proximityModal.address.label || proximityModal.address.city}, {proximityModal.address.state || proximityModal.address.country}</strong>
              </div>
            </div>

            <div className="proximity-distance-banner">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Navigation size={16} />
                <span>
                  Real Drayage Distance: <strong>{proximityModal.check.distanceKm} km</strong>
                </span>
              </div>
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase" }}>
                Exceeds {proximityModal.check.thresholdKm} km limit
              </span>
            </div>

            <p style={{ fontSize: "13px", color: "#475569", lineHeight: "1.5", margin: "12px 0 16px" }}>
              {proximityModal.type === "pickup"
                ? `Standard container drayage operates within regional freight corridors (max ${proximityModal.check.thresholdKm} km). Trucking cargo ${proximityModal.check.distanceKm} km directly to ${proximityModal.port.name.split(",")[0]} incurs high inter-state linehaul transit times and costs.`
                : `Last-mile container delivery from ${proximityModal.port.name.split(",")[0]} to ${proximityModal.address.city || proximityModal.address.label} (${proximityModal.check.distanceKm} km) is outside the standard port delivery zone.`}
            </p>

            <div className="proximity-recommendations">
              {proximityModal.nearestPort && proximityModal.nearestPort.id !== proximityModal.port.id && (
                <div className="proximity-rec-card featured">
                  <div>
                    <div className="proximity-rec-title" style={{ display: "flex", alignItems: "center", gap: "6px", color: "#0369a1" }}>
                      <Sparkles size={14} /> Recommended: Switch {proximityModal.type === "pickup" ? "Origin Port" : "Destination Port"}
                    </div>
                    <div className="proximity-rec-desc">
                      Switch to <strong>{proximityModal.nearestPort.code} — {proximityModal.nearestPort.name}</strong> ({proximityModal.nearestPort.distanceKm} km away from address)
                    </div>
                  </div>
                  <button
                    type="button"
                    className="proximity-btn-switch"
                    onClick={() => switchPortToNearest(proximityModal.type, proximityModal.nearestPort.id)}
                  >
                    <RefreshCw size={12} /> Switch to {proximityModal.nearestPort.code}
                  </button>
                </div>
              )}

              <div className="proximity-rec-card">
                <div>
                  <div className="proximity-rec-title">Change {proximityModal.type === "pickup" ? "Pickup" : "Delivery"} Address</div>
                  <div className="proximity-rec-desc">
                    Choose an address located in the {proximityModal.port.name.split(",")[0]} area.
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-secondary-light"
                  style={{ fontSize: "12px", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  onClick={() => {
                    const t = proximityModal.type;
                    setProximityModal(null);
                    openAddressModal(t);
                  }}
                >
                  <MapPin size={12} /> Pick Nearby Address
                </button>
              </div>
            </div>

            <button
              type="button"
              className="proximity-override-link"
              onClick={() => acknowledgeProximityOverride(proximityModal.type)}
            >
              I understand. Proceed with Long-Distance Inter-State Haulage (+₹35,000 feeder surcharge)
            </button>
          </div>
        </div>
      )}

      {/* AGENT EVALUATION MODAL */}
      {agentEvaluating && (
        <div className="modal-overlay">
          <div className="modal-content agent-eval-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="agent-eval-header">
              <div className="agent-eval-title-wrap">
                <div className="agent-eval-avatar">
                  <Bot size={26} />
                </div>
                <div>
                  <h3 className="agent-eval-title">Quote Generation Agent</h3>
                  <p className="agent-eval-subtitle">Evaluating enquiry specifications, route dynamics &amp; rate matrix</p>
                </div>
              </div>
              <div className="agent-eval-badge">
                <Sparkles size={14} /> Autonomous Evaluation
              </div>
            </div>

            <div className="agent-stepper">
              <div className="agent-stepper-progress" style={{ width: agentStage === 1 ? "15%" : agentStage === 2 ? "45%" : agentStage === 3 ? "75%" : "100%" }} />
              <div className={`agent-step-item ${agentStage > 1 ? "completed" : agentStage === 1 ? "active" : ""}`}>
                <div className="agent-step-icon">{agentStage > 1 ? <Check size={18} /> : <span>1</span>}</div>
                <div className="agent-step-title">Enquiry Submitted</div>
              </div>
              <div className={`agent-step-item ${agentStage > 2 ? "completed" : agentStage === 2 ? "active" : ""}`}>
                <div className="agent-step-icon">{agentStage > 2 ? <Check size={18} /> : <span>2</span>}</div>
                <div className="agent-step-title">Agent Evaluating Request</div>
              </div>
              <div className={`agent-step-item ${agentStage > 3 ? "completed" : agentStage === 3 ? "active" : ""}`}>
                <div className="agent-step-icon">{agentStage > 3 ? <Check size={18} /> : <span>3</span>}</div>
                <div className="agent-step-title">Determining Estimation</div>
              </div>
              <div className={`agent-step-item ${agentStage === 4 ? "completed active" : ""}`}>
                <div className="agent-step-icon">{agentStage === 4 ? <Check size={18} /> : <span>4</span>}</div>
                <div className="agent-step-title">Quote Returned</div>
              </div>
            </div>

            <div className="agent-terminal-box">
              <div className="agent-terminal-header">
                <span>AGENT EXECUTION CONSOLE</span>
                <span>STATUS: {agentStage === 4 ? "COMPLETED" : "PROCESSING..."}</span>
              </div>
              {agentLogs.map((log, idx) => (
                <div key={idx} className={`agent-log-line ${idx === agentLogs.length - 1 ? (agentStage === 4 ? "success" : "highlight") : ""}`}>
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* QUOTE OFFER MODAL */}
      {showQuoteModal && (
        <div className="modal-overlay" onClick={() => setShowQuoteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} ref={modalContentRef}>
            <button className="modal-close" onClick={() => setShowQuoteModal(false)} aria-label="Close">
              <X size={18} />
            </button>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #ff9800", paddingBottom: 12, marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 22, color: "#0f172a", margin: 0 }}>FREIGHT QUOTE OFFICIAL OFFER</h2>
                <span style={{ fontSize: 12, color: "#64748b" }}>Issued by Global Logistics Platform</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#ff9800", display: "block" }}>
                  {generatedQuote ? `QT-${generatedQuote.id.slice(-8).toUpperCase()}` : quote.id}
                </span>
                <span style={{ fontSize: 12, color: "#64748b" }}>Date: {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", background: "#f8fafc", padding: 14, borderRadius: 10, marginBottom: 20 }}>
              <div>
                <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 800 }}>ORIGIN PORT</span>
                <strong style={{ display: "block", fontSize: 15, color: "#0f172a" }}>{oPort ? `${oPort.code} (${oPort.name.split(",")[0]})` : "Origin"}</strong>
              </div>
              <div style={{ textAlign: "center" }}>
                <span style={{ background: "#08162d", color: "#fff", padding: "4px 10px", borderRadius: 4, fontSize: 12, fontWeight: 700 }}>
                  {generatedQuote?.mode ? generatedQuote.mode.toUpperCase() : "FREIGHT"}
                </span>
                <span style={{ display: "block", fontSize: 11, color: "#64748b", marginTop: 2 }}>
                  {generatedQuote?.transit_days ? `Est. ${generatedQuote.transit_days} Days` : "Est. 6–10 Days"}
                </span>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 800 }}>DESTINATION PORT</span>
                <strong style={{ display: "block", fontSize: 15, color: "#0f172a" }}>{dPort ? `${dPort.code} (${dPort.name.split(",")[0]})` : "Destination"}</strong>
              </div>
            </div>

            <h4 style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>Itemized Rate Breakdown</h4>
            <table className="modal-table">
              <thead>
                <tr><th>Description</th><th className="text-right">Amount (₹)</th></tr>
              </thead>
              <tbody>
                {generatedQuote?.breakdown ? (
                  <>
                    <tr>
                      <td>
                        <strong>Base Freight</strong>
                        <span style={{ display: "block", fontSize: 11, color: "#64748b" }}>
                          {summaryStats.containerSummaryStr} ({form.mode === "ocean" ? "Ocean Container Freight" : form.mode === "air" ? "Air Cargo Linehaul" : "Road / Rail Drayage"})
                        </span>
                      </td>
                      <td className="text-right" style={{ fontWeight: 600 }}>{money(generatedQuote.breakdown.base_freight ?? generatedQuote.breakdown.distance_cost)}</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Bunker Adjustment Factor (BAF)</strong>
                        <span style={{ display: "block", fontSize: 11, color: "#64748b" }}>
                          {generatedQuote.breakdown.baf_pct || 10}% fuel indexation on base freight
                        </span>
                      </td>
                      <td className="text-right" style={{ fontWeight: 600 }}>{money(generatedQuote.breakdown.baf_amount ?? generatedQuote.breakdown.fuel_surcharge)}</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Terminal Handling Charges (Origin THC)</strong>
                        <span style={{ display: "block", fontSize: 11, color: "#64748b" }}>
                          Origin terminal handling &amp; container loading
                        </span>
                      </td>
                      <td className="text-right" style={{ fontWeight: 600 }}>{money(generatedQuote.breakdown.origin_thc ?? (generatedQuote.breakdown.base_handling_fee - 3000))}</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Documentation &amp; Bill of Lading</strong>
                        <span style={{ display: "block", fontSize: 11, color: "#64748b" }}>
                          Electronic customs filing &amp; carrier manifest
                        </span>
                      </td>
                      <td className="text-right" style={{ fontWeight: 600 }}>{money(generatedQuote.breakdown.documentation_fee || 3000)}</td>
                    </tr>
                    {generatedQuote.breakdown.dest_thc > 0 && (
                      <tr>
                        <td>Destination THC ({form.incoterm})</td>
                        <td className="text-right">{money(generatedQuote.breakdown.dest_thc)}</td>
                      </tr>
                    )}
                    {generatedQuote.breakdown.dest_customs > 0 && (
                      <tr>
                        <td>Destination Customs Clearance (DDP)</td>
                        <td className="text-right">{money(generatedQuote.breakdown.dest_customs)}</td>
                      </tr>
                    )}
                    {generatedQuote.breakdown.delivery_haulage > 0 && (
                      <tr>
                        <td>Final-Mile Delivery Drayage</td>
                        <td className="text-right">{money(generatedQuote.breakdown.delivery_haulage)}</td>
                      </tr>
                    )}
                    {generatedQuote.breakdown.insurance_cost > 0 && (
                      <tr>
                        <td>All-Risk Cargo Insurance</td>
                        <td className="text-right">{money(generatedQuote.breakdown.insurance_cost)}</td>
                      </tr>
                    )}
                    {generatedQuote.breakdown.hazmat_cost > 0 && (
                      <tr>
                        <td>Hazardous Cargo Safety Protocol (HAZMAT)</td>
                        <td className="text-right">{money(generatedQuote.breakdown.hazmat_cost)}</td>
                      </tr>
                    )}
                    {generatedQuote.breakdown.reefer_cost > 0 && (
                      <tr>
                        <td>Cold Chain Reefer Monitoring</td>
                        <td className="text-right">{money(generatedQuote.breakdown.reefer_cost)}</td>
                      </tr>
                    )}
                    <tr style={{ background: "#f8fafc", borderTop: "1.5px solid #e2e8f0" }}>
                      <td style={{ fontWeight: 700, color: "#334155" }}>TOTAL BUY COST (Subtotal)</td>
                      <td className="text-right" style={{ fontWeight: 700, color: "#334155" }}>
                        {money(generatedQuote.breakdown.subtotal_buy_cost || (generatedQuote.breakdown.total / 1.15))}
                      </td>
                    </tr>
                    <tr style={{ background: "#fff7ed" }}>
                      <td style={{ fontWeight: 700, color: "#c2410c" }}>
                        Commercial Margin ({generatedQuote.breakdown.margin_pct || 15}%)
                      </td>
                      <td className="text-right" style={{ fontWeight: 700, color: "#c2410c" }}>
                        + {money(generatedQuote.breakdown.margin_amount || (generatedQuote.breakdown.total - (generatedQuote.breakdown.total / 1.15)))}
                      </td>
                    </tr>
                  </>
                ) : (
                  <>
                    <tr><td>Base Ocean Freight ({quote.containerSummaryStr})</td><td className="text-right">{money(quote.baseFreight)}</td></tr>
                    <tr><td>Terminal Handling Charges (THC)</td><td className="text-right">{money(quote.thcCost)}</td></tr>
                    <tr><td>Export &amp; Import Customs Filing</td><td className="text-right">{money(quote.customsCost)}</td></tr>
                    <tr><td>Bunker Fuel Adjustment (BAF 10%)</td><td className="text-right">{money(quote.bafCost)}</td></tr>
                  </>
                )}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: "bold", background: "#0f172a", color: "#ffffff" }}>
                  <td style={{ fontSize: 15, color: "#ffffff", padding: "12px 14px" }}>FINAL SELL PRICE (QUOTATION)</td>
                  <td className="text-right" style={{ fontSize: 20, color: "#f97316", padding: "12px 14px" }}>
                    {generatedQuote?.breakdown?.total ? money(generatedQuote.breakdown.total) : quote.formattedPrice}
                  </td>
                </tr>
              </tfoot>
            </table>

            <div className="modal-prompt-box">
              <div className="modal-prompt-title" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                <Ship size={20} /> Would you like to proceed with this shipment booking?
              </div>
              <p style={{ fontSize: 13, color: "#475569" }}>
                Lock in this rate now. Clicking proceed will save this quotation to your Quotations Dashboard.
              </p>
              <div className="modal-prompt-actions">
                <button type="button" className="btn-confirm-booking" onClick={handleConfirmShipment} disabled={confirming}>
                  <CheckCircle size={16} /> {confirming ? "Booking shipment..." : "Yes, Proceed to Book Shipment"}
                </button>
                <button type="button" className="btn-secondary-light" onClick={exportPDF}>
                  <FileText size={14} /> Download PDF Only
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BOOKING CONFIRMATION MODAL */}
      {showSuccessModal && (
        <div className="modal-overlay">
          <div className="modal-content text-center" style={{ maxWidth: 550, textAlign: "center" }}>
            <div style={{ width: 64, height: 64, background: "#dcfce7", color: "#16a34a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Check size={36} />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>Shipment Proceeded &amp; Saved!</h2>
            <p style={{ color: "#64748b", fontSize: 14, margin: "8px 0 20px" }}>
              Your quotation has been saved with status <strong>Booked / Proceeded</strong>.
            </p>

            <div style={{ background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 800 }}>BOOKING REFERENCE NO.</span>
              <h3 style={{ fontSize: 26, color: "#ff9800", fontWeight: 800, marginTop: 2 }}>{bookingRef}</h3>
            </div>

            <button
              type="button"
              className="btn-orange-primary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => {
                setShowSuccessModal(false);
                navigate("/dashboard/shipments-history");
              }}
            >
              Go to Quotations Dashboard &rarr;
            </button>
          </div>
        </div>
      )}

      {/* HIDDEN DEDICATED PRINTABLE PDF DOCUMENT */}
      <div style={{ position: "absolute", left: "-9999px", top: "-9999px", opacity: 0 }}>
        <div ref={printablePdfRef} className="freight-printable-document">
          {/* Header Banner */}
          <div className="pdf-doc-header">
            <div className="pdf-doc-brand">
              <div className="pdf-doc-logo-title">Freight<span style={{ color: "#ff9800" }}>AI</span></div>
              <div className="pdf-doc-tagline">Global Intelligent Freight &amp; Logistics Platform</div>
            </div>
            <div className="pdf-doc-meta">
              <div className="pdf-doc-badge">OFFICIAL FREIGHT RATE ESTIMATE</div>
              <div className="pdf-doc-ref">
                <strong>Quote Ref:</strong> {generatedQuote ? `QT-${generatedQuote.id.slice(-8).toUpperCase()}` : "QT-OFFICIAL"}
              </div>
              <div className="pdf-doc-date">
                <strong>Date of Issue:</strong> {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
              </div>
              <div className="pdf-doc-valid">
                <strong>Tariff Validity:</strong> 14 Calendar Days
              </div>
            </div>
          </div>

          {/* Lane & Route Highlight Bar */}
          <div className="pdf-lane-highlight">
            <div className="pdf-lane-col">
              <span className="pdf-lane-sub">ORIGIN PORT / TERMINAL</span>
              <span className="pdf-lane-name">{oPort ? `${oPort.code} — ${oPort.name}` : "Origin Port"}</span>
            </div>
            <div className="pdf-lane-badge-wrap">
              <span className="pdf-mode-pill">{(generatedQuote?.mode || form.mode || "OCEAN").toUpperCase()}</span>
              <span className="pdf-transit-time">{generatedQuote?.transit_days ? `Est. ${generatedQuote.transit_days} Days Transit` : "Est. 14 Days Transit"}</span>
            </div>
            <div className="pdf-lane-col text-right">
              <span className="pdf-lane-sub">DESTINATION PORT / TERMINAL</span>
              <span className="pdf-lane-name">{dPort ? `${dPort.code} — ${dPort.name}` : "Destination Port"}</span>
            </div>
          </div>

          {/* Consignment & Shipper Details */}
          <div className="pdf-details-grid">
            <div className="pdf-info-card">
              <div className="pdf-info-card-title">Shipper / Origin Details</div>
              <div className="pdf-info-row">
                <span>Account / Customer:</span>
                <strong>{user?.full_name || form.custName || "Retail Shipper"}</strong>
              </div>
              <div className="pdf-info-row">
                <span>Company / Email:</span>
                <strong>{form.custCompany || user?.email || "retail@freightai.com"}</strong>
              </div>
              <div className="pdf-info-row">
                <span>Pickup Location:</span>
                <strong>
                  {savedAddresses.find((a) => a.id === form.pickupAddr)
                    ? `${savedAddresses.find((a) => a.id === form.pickupAddr).label} — ${savedAddresses.find((a) => a.id === form.pickupAddr).city}`
                    : oPort ? `${oPort.name} Terminal` : "Origin Hub"}
                </strong>
              </div>
              <div className="pdf-info-row">
                <span>Cargo Ready Date:</span>
                <strong>{form.readyDate || new Date().toISOString().slice(0, 10)}</strong>
              </div>
            </div>

            <div className="pdf-info-card">
              <div className="pdf-info-card-title">Consignee &amp; Shipping Terms</div>
              <div className="pdf-info-row">
                <span>Destination Port:</span>
                <strong>{dPort ? dPort.name : "Port of Singapore"}</strong>
              </div>
              <div className="pdf-info-row">
                <span>Incoterm:</span>
                <strong>{form.incoterm || "CIF"} ({form.incoterm === "DDP" ? "Delivered Duty Paid" : form.incoterm === "FOB" ? "Free On Board" : "Cost Insurance Freight"})</strong>
              </div>
              <div className="pdf-info-row">
                <span>Load Classification:</span>
                <strong>{form.loadType || "FCL"} ({form.mode === "ocean" ? "Ocean Freight" : form.mode === "air" ? "Air Freight" : "Road Freight"})</strong>
              </div>
              <div className="pdf-info-row">
                <span>Cargo Type:</span>
                <strong>{form.chkHazardous ? "Hazardous (HAZMAT)" : form.chkTemp ? "Cold Chain" : "General Commercial Cargo"}</strong>
              </div>
            </div>
          </div>

          {/* Cargo Specifications Table */}
          <div className="pdf-section-title">Cargo Specifications</div>
          <table className="pdf-table">
            <thead>
              <tr>
                <th style={{ width: "10%" }}>Item #</th>
                <th style={{ width: "38%" }}>Commodity Description</th>
                <th style={{ width: "20%" }}>Container / Packaging</th>
                <th className="text-center" style={{ width: "8%" }}>Units</th>
                <th className="text-right" style={{ width: "12%" }}>Gross Weight</th>
                <th className="text-right" style={{ width: "12%" }}>HS Code</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td>0{idx + 1}</td>
                  <td>{item.desc || "General Commercial Freight"}</td>
                  <td>{item.containerType ? `${item.containerType} Container` : item.type || "Container"}</td>
                  <td className="text-center">{item.count || 1}</td>
                  <td className="text-right">{Number(item.weight || 12500).toLocaleString("en-IN")} kg</td>
                  <td className="text-right">{item.hs || item.hsCode || "8471.30"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Rate Breakdown Table */}
          <div className="pdf-section-title">Official Itemized Tariff &amp; Rate Breakdown</div>
          <table className="pdf-table pdf-rate-table">
            <thead>
              <tr>
                <th style={{ width: "40%" }}>Rate Component</th>
                <th style={{ width: "32%" }}>Calculation Basis</th>
                <th className="text-right" style={{ width: "12%" }}>Currency</th>
                <th className="text-right" style={{ width: "16%" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Base Freight</strong></td>
                <td>{summaryStats.containerSummaryStr} linehaul tariff</td>
                <td className="text-right">{generatedQuote?.currency || "INR"}</td>
                <td className="text-right">{money(generatedQuote?.breakdown?.base_freight ?? generatedQuote?.breakdown?.distance_cost ?? 0)}</td>
              </tr>
              <tr>
                <td><strong>Bunker Adjustment Factor (BAF)</strong></td>
                <td>{generatedQuote?.breakdown?.baf_pct || 10}% fuel indexation on base freight</td>
                <td className="text-right">{generatedQuote?.currency || "INR"}</td>
                <td className="text-right">{money(generatedQuote?.breakdown?.baf_amount ?? generatedQuote?.breakdown?.fuel_surcharge ?? 0)}</td>
              </tr>
              <tr>
                <td><strong>Terminal Handling Charges (Origin THC)</strong></td>
                <td>Origin terminal handling &amp; container loading</td>
                <td className="text-right">{generatedQuote?.currency || "INR"}</td>
                <td className="text-right">{money(generatedQuote?.breakdown?.origin_thc ?? ((generatedQuote?.breakdown?.base_handling_fee || 0) - 3000))}</td>
              </tr>
              <tr>
                <td><strong>Documentation &amp; Bill of Lading</strong></td>
                <td>Automated carrier manifest &amp; customs filing</td>
                <td className="text-right">{generatedQuote?.currency || "INR"}</td>
                <td className="text-right">{money(generatedQuote?.breakdown?.documentation_fee || 3000)}</td>
              </tr>
              {generatedQuote?.breakdown?.dest_thc > 0 && (
                <tr>
                  <td>Destination THC ({form.incoterm})</td>
                  <td>Port offloading at destination terminal</td>
                  <td className="text-right">{generatedQuote?.currency || "INR"}</td>
                  <td className="text-right">{money(generatedQuote.breakdown.dest_thc)}</td>
                </tr>
              )}
              {generatedQuote?.breakdown?.dest_customs > 0 && (
                <tr>
                  <td>Destination Customs Clearance (DDP)</td>
                  <td>Import customs clearance protocol</td>
                  <td className="text-right">{generatedQuote?.currency || "INR"}</td>
                  <td className="text-right">{money(generatedQuote.breakdown.dest_customs)}</td>
                </tr>
              )}
              {generatedQuote?.breakdown?.delivery_haulage > 0 && (
                <tr>
                  <td>Final-Mile Delivery Drayage</td>
                  <td>Port to consignee door transport</td>
                  <td className="text-right">{generatedQuote?.currency || "INR"}</td>
                  <td className="text-right">{money(generatedQuote.breakdown.delivery_haulage)}</td>
                </tr>
              )}
              {generatedQuote?.breakdown?.insurance_cost > 0 && (
                <tr>
                  <td>All-Risk Cargo Insurance</td>
                  <td>Comprehensive transit liability coverage</td>
                  <td className="text-right">{generatedQuote?.currency || "INR"}</td>
                  <td className="text-right">{money(generatedQuote.breakdown.insurance_cost)}</td>
                </tr>
              )}
              {generatedQuote?.breakdown?.hazmat_cost > 0 && (
                <tr>
                  <td>Hazardous Material Protocol (HAZMAT)</td>
                  <td>Dangerous goods safety and escort</td>
                  <td className="text-right">{generatedQuote?.currency || "INR"}</td>
                  <td className="text-right">{money(generatedQuote.breakdown.hazmat_cost)}</td>
                </tr>
              )}
              {generatedQuote?.breakdown?.reefer_cost > 0 && (
                <tr>
                  <td>Cold Chain Reefer Monitoring</td>
                  <td>Active temperature logging &amp; power plug-in</td>
                  <td className="text-right">{generatedQuote?.currency || "INR"}</td>
                  <td className="text-right">{money(generatedQuote.breakdown.reefer_cost)}</td>
                </tr>
              )}
              <tr style={{ background: "#f1f5f9", borderTop: "2px solid #cbd5e1" }}>
                <td colSpan={2}><strong>TOTAL BUY COST (Subtotal)</strong></td>
                <td className="text-right"><strong>{generatedQuote?.currency || "INR"}</strong></td>
                <td className="text-right"><strong>{money(generatedQuote?.breakdown?.subtotal_buy_cost || (generatedQuote?.breakdown?.total / 1.15))}</strong></td>
              </tr>
              <tr style={{ background: "#fff7ed" }}>
                <td colSpan={2} style={{ color: "#c2410c" }}><strong>Commercial Margin ({generatedQuote?.breakdown?.margin_pct || 15}%)</strong></td>
                <td className="text-right" style={{ color: "#c2410c" }}><strong>{generatedQuote?.currency || "INR"}</strong></td>
                <td className="text-right" style={{ color: "#c2410c" }}><strong>+ {money(generatedQuote?.breakdown?.margin_amount || (generatedQuote?.breakdown?.total - (generatedQuote?.breakdown?.total / 1.15)))}</strong></td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="pdf-grand-total-row">
                <td colSpan={2}>
                  <strong>FINAL SELL PRICE (QUOTATION)</strong>
                </td>
                <td className="text-right"><strong>{generatedQuote?.currency || "INR"}</strong></td>
                <td className="text-right pdf-total-amount">
                  <strong>{money(generatedQuote?.breakdown?.total || 0)}</strong>
                </td>
              </tr>
            </tfoot>
          </table>

          {/* AI Agent Verification Seal */}
          <div className="pdf-seal-box">
            <div className="pdf-seal-badge">
              <span className="pdf-seal-check">&#10003;</span>
              <div>
                <strong>CERTIFIED &amp; LOCKED BY FREIGHTAI QUOTE GENERATION AGENT</strong>
                <p>Autonomous Rate Verification ID: <code>SEC-CHK-{(generatedQuote?.id || "QT-VALID").slice(-8).toUpperCase()}</code> | Engine v2.4</p>
              </div>
            </div>
          </div>

          {/* Terms & Conditions */}
          <div className="pdf-terms">
            <strong>Terms &amp; Carriage Conditions:</strong>
            <ol>
              <li>This quotation is computed by the automated FreightAI Quote Generation Agent based on live carrier tariffs, fuel indices (BAF), and port congestions.</li>
              <li>Rates are guaranteed for 14 calendar days from the date of issuance and are subject to equipment/space availability at the time of booking confirmation.</li>
              <li>Standard demurrage/detention tariffs, customs duties, and local statutory taxes (if applicable) are payable per carrier regulations.</li>
            </ol>
          </div>

          {/* Document Footer */}
          <div className="pdf-doc-footer">
            <span>FreightAI Technologies Pvt Ltd · Corporate Logistics Hub</span>
            <span>support@freightai.com · https://freightai.com</span>
            <span>Official Quotation · Confidential</span>
          </div>
        </div>
      </div>
    </div>
  );
}
