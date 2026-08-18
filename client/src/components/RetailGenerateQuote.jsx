import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Chart from "chart.js/auto";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import html2pdf from "html2pdf.js";
import { Ship, Plane, Truck, Zap, Plus, Trash2, X, CheckCircle, FileText, Check, Bot, Cpu, Sparkles } from "lucide-react";
import { PORTS_MASTER, useRetailQuotes } from "../context/RetailQuotesContext";
import { createSavedAddress, getSavedAddresses } from "../api/auth";
import { confirmQuote, estimateQuote } from "../api/quotes";
import { useAuth } from "../context/AuthContext";
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

const CONTAINER_TYPES = [
  { value: "40HC", label: "40HC — 40ft High Cube" },
  { value: "20FT", label: "20FT — 20ft Standard" },
  { value: "40FT", label: "40FT — 40ft Standard" },
  { value: "45HC", label: "45HC — 45ft Reefer" },
];

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

const EMPTY_ITEM = { id: 1, type: "", containerType: "", count: "", weight: "", desc: "", hs: "" };

const EMPTY_ADDRESS = {
  label: "", type: "Pickup (Origin)", contact: "", phone: "", email: "", street: "",
  city: "", state: "", postal: "", country: "", hours: "", notes: "", isDefault: false,
};

const initialFormState = {
  originId: "",
  destId: "",
  pickupAddr: "",
  deliveryAddr: "",
  readyDate: getTodayStr(),
  deliveryDate: getPlus7DaysStr(),
  mode: "",
  loadType: "",
  incoterm: "",
  declaredVal: "",
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
  const { reloadQuotes } = useRetailQuotes();

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

  const mapElRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const originMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const polylineRef = useRef(null);
  const chartCanvasRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const modalContentRef = useRef(null);

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

  function quickFillDemo() {
    const addresses = savedAddresses.length > 0 ? savedAddresses : getLocalSavedAddresses();
    const pAddr = addresses.find((a) => a.type.includes("Pickup")) || addresses[0];
    const dAddr = addresses.find((a) => a.type.includes("Delivery")) || addresses[1] || addresses[0];

    setForm({
      originId: "INMAA",
      destId: "SGSIN",
      pickupAddr: pAddr?.id || "addr_1",
      deliveryAddr: dAddr?.id || "addr_3",
      readyDate: getTodayStr(),
      deliveryDate: getPlus7DaysStr(),
      mode: "ocean",
      loadType: "FCL",
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
      { id: Date.now(), type: "Consumer Electronics", containerType: "40HC", count: "1", weight: "12500", desc: "40ft High Cube Container of Laptops & Accessories", hs: "847130" },
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

    map.fitBounds(L.latLngBounds([[oPort.lat, oPort.lng], [dPort.lat, dPort.lng]]), { padding: [30, 30] });
  }, [oPort, dPort]);

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

    setGenerating(true);
    setAgentEvaluating(true);
    setAgentStage(1);
    setQuoteError("");

    const originName = oPort?.name || form.originId;
    const destName = dPort?.name || form.destId;

    setAgentLogs([
      `[00:00.1] 🚀 Retailer submitted shipment enquiry for lane: ${originName} → ${destName}`,
      `[00:00.3] 📡 Dispatching enquiry parameters to AI Quote Generation Agent...`,
    ]);

    const cityByPort = {
      INNSA: "Mumbai",
      INMAA: "Chennai",
      AEJEA: "Dubai",
      SGSIN: "Singapore",
      NLRTM: "Rotterdam",
      CNSHA: "Shanghai",
      DEL: "Delhi",
    };
    const apiMode = form.mode === "ground" ? "road" : form.mode === "express" ? "air" : form.mode;
    const cargoType = form.chkHazardous ? "hazardous" : form.chkTemp ? "cold_chain" : form.mode === "express" ? "express" : "general";

    try {
      // Step 2: Agent evaluates request & route (approx 750ms)
      await new Promise((r) => setTimeout(r, 750));
      setAgentStage(2);
      setAgentLogs((prev) => [
        ...prev,
        `[00:00.9] 🔍 Quote Generation Agent evaluating routing options & vessel schedules...`,
        `[00:01.4] 📦 Evaluating cargo profile: ${summaryStats.totalWeight.toLocaleString()} kg, ${summaryStats.containerSummaryStr}, ${cargoType} classification...`,
        `[00:01.8] ⚓ Checking port handling tariffs, customs rules & congestion factors...`,
      ]);

      // Step 3: Agent determines quote estimation (approx 850ms)
      await new Promise((r) => setTimeout(r, 850));
      setAgentStage(3);
      setAgentLogs((prev) => [
        ...prev,
        `[00:02.3] ⚙️ Agent determining dynamic rate matrix, BAF fuel surcharge & handling fees...`,
        `[00:02.6] 🧮 Calling pricing engine algorithms for authoritative rate estimation...`,
      ]);

      const originKey = oPort?.id || form.originId || "INNSA";
      const destKey = dPort?.id || form.destId || "SGSIN";
      const originCity = cityByPort[originKey] || oPort?.name?.split(",")[0] || "Mumbai";
      const destCity = cityByPort[destKey] || dPort?.name?.split(",")[0] || "Singapore";

      const result = await estimateQuote(token, {
        origin: originCity,
        destination: destCity,
        weightKg: Math.max(summaryStats.totalWeight, 1),
        volumeM3: Math.max(summaryStats.totalContainers * 20, 1),
        cargoType,
        mode: apiMode,
        pickupAddressId: form.pickupAddr,
        deliveryAddressId: form.deliveryAddr,
      });

      setGeneratedQuote(result);
      setAgentLogs((prev) => [
        ...prev,
        `[00:03.2] 📊 Dynamic rate calculated: ₹${Math.round(result.breakdown?.total || 0).toLocaleString("en-IN")}`,
      ]);

      // Step 4: Quote verified and returned
      await new Promise((r) => setTimeout(r, 750));
      setAgentStage(4);
      const quoteCode = result.id ? `QT-${result.id.slice(-8).toUpperCase()}` : "QT-NEW";
      setAgentLogs((prev) => [
        ...prev,
        `[00:03.8] ✅ Quotation verified & certified by Agent: ${quoteCode}`,
        `[00:04.1] 📋 Returning official quotation to retailer...`,
      ]);

      // Reveal quote to retailer
      await new Promise((r) => setTimeout(r, 650));
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
    try {
      const confirmedQuote = await confirmQuote(token, generatedQuote.id);
      setGeneratedQuote(confirmedQuote);
      setShowQuoteModal(false);
      setBookingRef(`BK-${confirmedQuote.id.slice(-8).toUpperCase()}`);
      setShowSuccessModal(true);
      if (reloadQuotes) {
        reloadQuotes();
      }
    } catch (error) {
      setQuoteError(error.message || "Unable to book this shipment.");
    } finally {
      setConfirming(false);
    }
  }

  function exportPDF() {
    const el = modalContentRef.current;
    if (!el) return;
    const exportId = generatedQuote ? `QT-${generatedQuote.id.slice(-8).toUpperCase()}` : "QT-ESTIMATE";
    html2pdf().set({ margin: 0.5, filename: `Freight_Quote_${exportId}.pdf` }).from(el).save();
  }

  return (
    <div className="enquiryView">
      <div className="top-bar">
        <div className="breadcrumb">
          <span className="bc-path">Shipments / New</span>
          <h1 className="page-title">New shipment enquiry</h1>
        </div>
        <div className="action-btns">
          <button type="button" className="btn-secondary-light" onClick={quickFillDemo} style={{ background: "#ea580c", color: "#ffffff", borderColor: "#ea580c", fontWeight: "700" }}>⚡ Quick Fill Demo Quote</button>
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
                <h3>Route</h3>
                <p>Where the cargo moves from and to</p>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Origin port / airport <span className="req">*</span></label>
                <select className="form-select" value={form.originId} onChange={(e) => setField("originId", e.target.value)}>
                  <option value="" disabled>Select an origin port / airport</option>
                  {PORTS_MASTER.map((p) => (
                    <option key={p.id} value={p.id}>{p.code} — {p.name}, {p.country}</option>
                  ))}
                </select>
                <span className="subtext">Searchable — select from master data, not free text</span>
              </div>
              <div className="form-group">
                <label>Destination port / airport <span className="req">*</span></label>
                <select className="form-select" value={form.destId} onChange={(e) => setField("destId", e.target.value)}>
                  <option value="" disabled>Select a destination port / airport</option>
                  {PORTS_MASTER.map((p) => (
                    <option key={p.id} value={p.id}>{p.code} — {p.name}, {p.country}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label>Pickup address <span className="hint">(door pickup only)</span></label>
                  <button type="button" onClick={() => openAddressModal("pickup")} style={{ fontSize: "11.5px", color: "#ea580c", background: "none", border: "none", cursor: "pointer", fontWeight: "700" }}>+ Add Address</button>
                </div>
                <select className="form-select" value={form.pickupAddr} onChange={(e) => {
                  if (e.target.value === "ADD_NEW") openAddressModal("pickup");
                  else setField("pickupAddr", e.target.value);
                }}>
                  <option value="">Select a saved pickup address</option>
                  <option value="ADD_NEW">+ Enter &amp; Save New Address...</option>
                  {pickupAddresses.map((address) => <option key={address.id} value={address.id}>{address.label} — {address.city}, {address.country}</option>)}
                </select>
              </div>
              <div className="form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label>Delivery address <span className="hint">(door delivery only)</span> <span className="badge-new">NEW</span></label>
                  <button type="button" onClick={() => openAddressModal("delivery")} style={{ fontSize: "11.5px", color: "#ea580c", background: "none", border: "none", cursor: "pointer", fontWeight: "700" }}>+ Add Address</button>
                </div>
                <select className="form-select" value={form.deliveryAddr} onChange={(e) => {
                  if (e.target.value === "ADD_NEW") openAddressModal("delivery");
                  else setField("deliveryAddr", e.target.value);
                }}>
                  <option value="">Select a saved delivery address</option>
                  <option value="ADD_NEW">+ Enter &amp; Save New Address...</option>
                  {deliveryAddresses.map((address) => <option key={address.id} value={address.id}>{address.label} — {address.city}, {address.country}</option>)}
                </select>
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
                  onClick={() => setField("mode", value)}
                >
                  <Icon size={18} /> {label}
                </button>
              ))}
            </div>

            <div className="alert-banner">
              <div className="alert-banner-title">SHOWN BECAUSE MODE = OCEAN</div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <div className="form-group">
                  <label>Load type <span className="req">*</span> <span className="badge-new">NEW</span></label>
                  <select className="form-select" value={form.loadType} onChange={(e) => setField("loadType", e.target.value)}>
                    <option value="" disabled>Select load type</option>
                    <option value="fcl">FCL — Full container</option>
                    <option value="lcl">LCL — Consolidated</option>
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
                      <option value="Box">Box</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Container type <span className="req">*</span> <span className="badge-new">NEW</span></label>
                    <select className="form-select" value={item.containerType} onChange={(e) => updateItem(idx, "containerType", e.target.value)}>
                      <option value="" disabled>Select container type</option>
                      {CONTAINER_TYPES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="alert-banner" style={{ marginBottom: 12, padding: "10px 14px" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#c2410c" }}>
                    CONTAINER SELECTED → FCL FIELDS (no dimensions — FCL is priced per box)
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
            <button type="button" className="btn-orange-primary" style={{ padding: "12px 28px", fontSize: "14px" }} onClick={handleGenerateQuote} disabled={generating}>
              <Bot size={18} /> {generating ? "Quote Generation Agent Active..." : "Submit Enquiry to Quote Agent ➔"}
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
              <strong className="cb-val" style={{ color: generatedQuote ? "#16a34a" : "#e65100" }}>
                {generatedQuote ? "✓ Quote Evaluated & Ready" : "⏳ Pending Agent Evaluation"}
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
                <button type="button" className="btn-generate" onClick={() => setShowQuoteModal(true)}>
                  👁️ View Full Quotation Offer
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

                <button type="button" className="btn-generate" onClick={handleGenerateQuote} disabled={generating}>
                  {generating ? "Agent Evaluating Request..." : "➔ Submit to Quote Agent"}
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

      {/* QUOTE GENERATION AGENT EVALUATION MODAL */}
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

            {/* Stepper */}
            <div className="agent-stepper">
              <div
                className="agent-stepper-progress"
                style={{
                  width:
                    agentStage === 1 ? "15%" : agentStage === 2 ? "45%" : agentStage === 3 ? "75%" : "100%",
                }}
              />
              
              <div className={`agent-step-item ${agentStage > 1 ? "completed" : agentStage === 1 ? "active" : ""}`}>
                <div className="agent-step-icon">
                  {agentStage > 1 ? <Check size={18} /> : <span>1</span>}
                </div>
                <div className="agent-step-title">Enquiry Submitted</div>
              </div>

              <div className={`agent-step-item ${agentStage > 2 ? "completed" : agentStage === 2 ? "active" : ""}`}>
                <div className="agent-step-icon">
                  {agentStage > 2 ? <Check size={18} /> : <span>2</span>}
                </div>
                <div className="agent-step-title">Agent Evaluating Request</div>
              </div>

              <div className={`agent-step-item ${agentStage > 3 ? "completed" : agentStage === 3 ? "active" : ""}`}>
                <div className="agent-step-icon">
                  {agentStage > 3 ? <Check size={18} /> : <span>3</span>}
                </div>
                <div className="agent-step-title">Determining Estimation</div>
              </div>

              <div className={`agent-step-item ${agentStage === 4 ? "completed active" : ""}`}>
                <div className="agent-step-icon">
                  {agentStage === 4 ? <Check size={18} /> : <span>4</span>}
                </div>
                <div className="agent-step-title">Quote Returned</div>
              </div>
            </div>

            {/* Live Terminal Log */}
            <div className="agent-terminal-box">
              <div className="agent-terminal-header">
                <span>AGENT EXECUTION CONSOLE</span>
                <span>STATUS: {agentStage === 4 ? "COMPLETED" : "PROCESSING..."}</span>
              </div>
              {agentLogs.map((log, idx) => (
                <div
                  key={idx}
                  className={`agent-log-line ${
                    idx === agentLogs.length - 1 ? (agentStage === 4 ? "success" : "highlight") : ""
                  }`}
                >
                  {log}
                </div>
              ))}
            </div>

            <div className="agent-eval-status-bar">
              <div className="agent-spinner-dot" />
              <span>
                {agentStage === 1 && "Ingesting shipment parameters & dispatching to Quote Agent..."}
                {agentStage === 2 && "Agent evaluating lane distance, carrier rules & cargo constraints..."}
                {agentStage === 3 && "Agent determining dynamic freight pricing & surcharges..."}
                {agentStage === 4 && "Quotation determined! Returning official quote offer to retailer..."}
              </span>
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
                    <tr><td>Base Handling Fee</td><td className="text-right">{money(generatedQuote.breakdown.base_handling_fee)}</td></tr>
                    <tr><td>Distance Freight Cost ({generatedQuote.distance_km ? `${generatedQuote.distance_km.toLocaleString("en-IN")} km` : ""})</td><td className="text-right">{money(generatedQuote.breakdown.distance_cost)}</td></tr>
                    {generatedQuote.breakdown.cargo_charge > 0 && (
                      <tr><td>Cargo Special Handling Fee</td><td className="text-right">{money(generatedQuote.breakdown.cargo_charge)}</td></tr>
                    )}
                    <tr><td>Fuel Surcharge (BAF)</td><td className="text-right">{money(generatedQuote.breakdown.fuel_surcharge)}</td></tr>
                  </>
                ) : (
                  <>
                    <tr><td>Base Ocean Freight ({quote.containerSummaryStr})</td><td className="text-right">{money(quote.baseFreight)}</td></tr>
                    <tr><td>Terminal Handling Charges (THC)</td><td className="text-right">{money(quote.thcCost)}</td></tr>
                    <tr><td>Export &amp; Import Customs Filing</td><td className="text-right">{money(quote.customsCost)}</td></tr>
                    <tr><td>Bunker Fuel Adjustment (BAF 12%)</td><td className="text-right">{money(quote.bafCost)}</td></tr>
                    {form.chkHazardous && (
                      <tr><td>Hazardous Material (HAZMAT) Fee</td><td className="text-right">{money(quote.hazmatCost)}</td></tr>
                    )}
                    {form.chkInsurance && (
                      <tr><td>All-Risk Cargo Insurance</td><td className="text-right">{money(quote.insuranceCost)}</td></tr>
                    )}
                  </>
                )}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: "bold", background: "#f8fafc" }}>
                  <td style={{ fontSize: 16, color: "#0f172a" }}>TOTAL ESTIMATED QUOTE</td>
                  <td className="text-right" style={{ fontSize: 20, color: "#e65100" }}>
                    {generatedQuote?.breakdown?.total ? money(generatedQuote.breakdown.total) : quote.formattedPrice}
                  </td>
                </tr>
              </tfoot>
            </table>

            <div className="modal-prompt-box">
              <div className="modal-prompt-title">🚢 Would you like to proceed with this shipment booking?</div>
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
    </div>
  );
}
