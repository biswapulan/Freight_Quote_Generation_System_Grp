import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Chart from "chart.js/auto";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import html2pdf from "html2pdf.js";
import { Ship, Plane, Truck, Zap, Plus, Trash2, X, CheckCircle, FileText, Check } from "lucide-react";
import { PORTS_MASTER } from "../context/RetailQuotesContext";
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
  readyDate: "",
  deliveryDate: "",
  mode: "",
  loadType: "",
  incoterm: "",
  declaredVal: "",
  currency: "",
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

  const [form, setForm] = useState(initialFormState);
  const [items, setItems] = useState([EMPTY_ITEM]);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [addressesError, setAddressesError] = useState("");
  const [quoteError, setQuoteError] = useState("");
  const [generatedQuote, setGeneratedQuote] = useState(null);
  const [generating, setGenerating] = useState(false);
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
    setForm((current) => ({
      ...current,
      readyDate: value,
      deliveryDate: current.deliveryDate && current.deliveryDate <= value ? "" : current.deliveryDate,
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
    try {
      const address = await createSavedAddress(token, { ...addressForm, is_default: addressForm.isDefault });
      setSavedAddresses((list) => address.isDefault ? [address, ...list.map((item) => ({ ...item, isDefault: false }))] : [address, ...list]);
      setField(addressModalType === "pickup" ? "pickupAddr" : "deliveryAddr", address.id);
      setAddressModalType("");
    } catch (error) {
      setAddressesError(error.message || "Unable to save this address.");
    } finally {
      setSavingAddress(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    getSavedAddresses(token)
      .then((addresses) => {
        if (!cancelled) setSavedAddresses(addresses);
      })
      .catch((error) => {
        if (!cancelled) setAddressesError(error.message || "Unable to load saved addresses.");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

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

  // ---- Rate calculation (ported as-is from the reference calculator) ----
  const quote = useMemo(() => {
    let totalContainers = 0;
    let totalWeight = 0;
    let containerSummaryStr = "";

    items.forEach((item) => {
      totalContainers += parseInt(item.count, 10) || 1;
      totalWeight += parseFloat(item.weight) || 0;
      containerSummaryStr += `${item.count} × ${item.containerType} `;
    });
    containerSummaryStr = containerSummaryStr.trim() || "1 × 40HC";

    const baseFreight = totalContainers * 145000;
    const thcCost = totalContainers * 18000;
    const customsCost = 15000;
    const bafCost = Math.round(baseFreight * 0.12);
    const hazmatCost = form.chkHazardous ? 25000 : 0;
    const declaredVal = parseFloat(form.declaredVal) || 0;
    const insuranceCost = form.chkInsurance ? Math.max(Math.round(declaredVal * 0.0035), 7000) : 0;

    const surchargesTotal = thcCost + customsCost + bafCost + hazmatCost + insuranceCost;
    const grandTotal = baseFreight + surchargesTotal;
    const quoteId = "QT-2026-00" + Math.floor(935 + Math.random() * 50);

    return {
      id: quoteId,
      totalContainers,
      totalWeight,
      containerSummaryStr,
      baseFreight,
      thcCost,
      customsCost,
      bafCost,
      hazmatCost,
      insuranceCost,
      surchargesTotal,
      grandTotal,
      formattedPrice: money(grandTotal),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, form.chkHazardous, form.chkInsurance, form.declaredVal]);

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

  // ---- Chart.js doughnut: update on quote change ----
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return;
    chart.data.datasets[0].data = [quote.baseFreight, quote.surchargesTotal];
    chart.update();
  }, [quote.baseFreight, quote.surchargesTotal]);

  const pickupAddresses = savedAddresses.filter((address) =>
    ["Pickup (Origin)", "Both (Origin & Destination)"].includes(address.type)
  );
  const deliveryAddresses = savedAddresses.filter((address) =>
    ["Delivery (Destination)", "Both (Origin & Destination)"].includes(address.type)
  );

  async function handleGenerateQuote() {
    if (!form.originId || !form.destId || !form.readyDate || !form.mode || !form.loadType || !form.incoterm) {
      setQuoteError("Select the required route, date, and service details before generating a quote.");
      return;
    }

    setGenerating(true);
    setQuoteError("");
    const cityByPort = {
      INNSA: "Mumbai",
      AEJEA: "Dubai",
      SGSIN: "Singapore",
      NLRTM: "Rotterdam",
      CNSHA: "Shanghai",
      DEL: "Delhi",
    };
    const apiMode = form.mode === "ground" ? "road" : form.mode === "express" ? "air" : form.mode;
    const cargoType = form.chkHazardous ? "hazardous" : form.chkTemp ? "cold_chain" : form.mode === "express" ? "express" : "general";

    try {
      const result = await estimateQuote(token, {
        origin: cityByPort[oPort.id],
        destination: cityByPort[dPort.id],
        weightKg: Math.max(quote.totalWeight, 1),
        volumeM3: Math.max(quote.totalContainers * 20, 1),
        cargoType,
        mode: apiMode,
        pickupAddressId: form.pickupAddr,
        deliveryAddressId: form.deliveryAddr,
      });
      setGeneratedQuote(result);
      setShowQuoteModal(true);
    } catch (error) {
      setQuoteError(error.message || "Unable to generate this quote.");
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
    } catch (error) {
      setQuoteError(error.message || "Unable to book this shipment.");
    } finally {
      setConfirming(false);
    }
  }

  function exportPDF() {
    const el = modalContentRef.current;
    if (!el) return;
    html2pdf().set({ margin: 0.5, filename: `Freight_Quote_${quote.id}.pdf` }).from(el).save();
  }

  return (
    <div className="enquiryView">
      <div className="top-bar">
        <div className="breadcrumb">
          <span className="bc-path">Shipments / New</span>
          <h1 className="page-title">New shipment enquiry</h1>
        </div>
        <div className="action-btns">
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
                <label>Pickup address <span className="hint">(door pickup only)</span></label>
                <select className="form-select" value={form.pickupAddr} onFocus={() => savedAddresses.length === 0 && openAddressModal("pickup")} onChange={(e) => setField("pickupAddr", e.target.value)}>
                  <option value="">{savedAddresses.length === 0 ? "Enter a pickup address" : "Select a saved pickup address"}</option>
                  {pickupAddresses.map((address) => <option key={address.id} value={address.id}>{address.label} — {address.city}, {address.country}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Delivery address <span className="hint">(door delivery only)</span> <span className="badge-new">NEW</span></label>
                <select className="form-select" value={form.deliveryAddr} onFocus={() => savedAddresses.length === 0 && openAddressModal("delivery")} onChange={(e) => setField("deliveryAddr", e.target.value)}>
                  <option value="">{savedAddresses.length === 0 ? "Enter a delivery address" : "Select a saved delivery address"}</option>
                  {deliveryAddresses.map((address) => <option key={address.id} value={address.id}>{address.label} — {address.city}, {address.country}</option>)}
                </select>
              </div>
            </div>
            {addressesError && <p className="quote-api-error" role="alert">{addressesError}</p>}

            <div className="form-row">
              <div className="form-group">
                <label>Ready date <span className="req">*</span></label>
                <input type="date" className="form-input" value={form.readyDate} onChange={(e) => updateReadyDate(e.target.value)} />
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
        </div>

        {/* RIGHT STICKY COLUMN */}
        <div className="right-sidebar-column">
          {/* LIVE ESTIMATE CARD */}
          <div className="live-card">
            <div className="live-card-header">LIVE ESTIMATE</div>

            <div className="charge-basis-box">
              <span className="cb-label">Charge basis</span>
              <strong className="cb-val">Per container — FCL</strong>
            </div>

            <div className="summary-rows">
              <div className="s-row"><span>Containers</span><strong>{quote.containerSummaryStr}</strong></div>
              <div className="s-row"><span>Gross weight</span><strong>{quote.totalWeight.toLocaleString("en-IN")} kg</strong></div>
              <div className="s-row"><span>Sea distance</span><strong>1,205 nm</strong></div>
              <div className="s-row"><span>Estimated transit</span><strong>6–10 d</strong></div>
              <div className="s-row"><span>Est. arrival</span><strong>22 Aug</strong></div>
              <div className="s-row"><span>Route options</span><strong>3 found</strong></div>
            </div>

            <div className="est-total-label">ESTIMATED TOTAL</div>
            <div className="est-total-price">{quote.formattedPrice}</div>

            <div className="rate-badge">◆ INDICATIVE — M1 FLAT RATE</div>

            <button type="button" className="btn-generate" onClick={handleGenerateQuote} disabled={generating}>
              {generating ? "Generating quotation..." : "➔ Generate full quotation"}
            </button>

            <p className="disclaimer">
              Final rate confirmed by your account manager within business hours. Estimate excludes duties &amp; taxes.
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
          <button type="button" className="btn-dark-export" onClick={exportPDF}>
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
                <span style={{ fontSize: 18, fontWeight: 800, color: "#ff9800", display: "block" }}>{quote.id}</span>
                <span style={{ fontSize: 12, color: "#64748b" }}>Date: 12 Aug 2026</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", background: "#f8fafc", padding: 14, borderRadius: 10, marginBottom: 20 }}>
              <div>
                <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 800 }}>ORIGIN PORT</span>
                <strong style={{ display: "block", fontSize: 15, color: "#0f172a" }}>{oPort.code} ({oPort.name.split(",")[0]})</strong>
              </div>
              <div style={{ textAlign: "center" }}>
                <span style={{ background: "#08162d", color: "#fff", padding: "4px 10px", borderRadius: 4, fontSize: 12, fontWeight: 700 }}>OCEAN FCL</span>
                <span style={{ display: "block", fontSize: 11, color: "#64748b", marginTop: 2 }}>Est. 6–10 Days</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 800 }}>DESTINATION PORT</span>
                <strong style={{ display: "block", fontSize: 15, color: "#0f172a" }}>{dPort.code} ({dPort.name.split(",")[0]})</strong>
              </div>
            </div>

            <h4 style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>Itemized Rate Breakdown</h4>
            <table className="modal-table">
              <thead>
                <tr><th>Description</th><th className="text-right">Amount (₹)</th></tr>
              </thead>
              <tbody>
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
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: "bold", background: "#f8fafc" }}>
                  <td style={{ fontSize: 16, color: "#0f172a" }}>TOTAL ESTIMATED QUOTE</td>
                  <td className="text-right" style={{ fontSize: 20, color: "#e65100" }}>{quote.formattedPrice}</td>
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
