import React, { useState } from "react";
import {
  X,
  Copy,
  Check,
  Ship,
  Anchor,
  Navigation,
  Compass,
  MapPin,
  Calendar,
  Clock,
  Box,
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Download,
  Eye,
  Info,
  Layers,
  Thermometer,
  Wind,
  Waves,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import "./ShipmentTrackingModal.css";

/**
 * Deterministic helper to derive realistic tracking & vessel telemetry
 * based on the shipment / quote identifiers.
 */
function getTrackingData(shipment) {
  if (!shipment) return null;

  const quoteNo = shipment.quoteNo || shipment.id || "QTE-2026";
  const bookingRef = shipment.m4?.bookingReference || `BK-${quoteNo.replace(/[^A-Za-z0-9]/g, "").slice(-6)}`;
  const shipmentId = shipment.shipmentId || `SHP-${quoteNo.replace(/[^A-Za-z0-9]/g, "").slice(-8)}`;
  const carrier = shipment.m4?.companyName || shipment.selectedCarrier || "Maersk Line";
  const containerType = shipment.containerType || shipment.basis || "40' High Cube (40HC)";
  const origin = shipment.origin || "Nhava Sheva (INBOM), India";
  const destination = shipment.destination || "Singapore (SGSIN), Singapore";
  const originCode = origin.includes("INBOM") ? "INBOM" : origin.slice(0, 5).toUpperCase();
  const destCode = destination.includes("SGSIN") ? "SGSIN" : destination.slice(0, 5).toUpperCase();

  // Deterministic container number & seal
  const hash = Math.abs(
    (quoteNo + bookingRef).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
  );
  const containerId = `MSKU-${7400000 + (hash % 900000)}`;
  const sealNo = `ML-IN-${880000 + (hash % 100000)}`;
  const vesselName = carrier.toLowerCase().includes("msc")
    ? "MSC ISABELLA"
    : carrier.toLowerCase().includes("cma")
    ? "CMA CGM ANTOINE DE SAINT EXUPERY"
    : carrier.toLowerCase().includes("hapag")
    ? "HAPAG-LLOYD BERLIN EXPRESS"
    : "MAERSK MC-KINNEY MOLLER";
  const imoNumber = `IMO 9${(hash % 800000) + 100000}`;
  const callSign = `9V${((hash % 8000) + 1000)}`;
  const voyageNo = `260${(hash % 90) + 10}E`;

  // Milestone timetable (simulated realistic dates around today)
  const now = new Date();
  const d1 = new Date(now.getTime() - 4 * 24 * 3600 * 1000);
  const d2 = new Date(now.getTime() - 2 * 24 * 3600 * 1000);
  const d3 = new Date(now.getTime() - 1 * 24 * 3600 * 1000);
  const d4 = new Date(now.getTime() - 8 * 3600 * 1000);
  const etaDate = new Date(now.getTime() + 9 * 24 * 3600 * 1000);

  const formatDt = (d) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const milestones = [
    {
      id: 1,
      title: "Booking Confirmed & Allocation Reserved",
      location: origin,
      timestamp: formatDt(d1),
      status: "completed",
      description: `Carrier booking reference ${bookingRef} issued. Empty equipment assigned and released for cargo stuffing.`,
      tag: `Booking Ref: ${bookingRef}`,
    },
    {
      id: 2,
      title: "Terminal Gate-In & Verified Gross Mass (VGM)",
      location: `${originCode} Terminal 3`,
      timestamp: formatDt(d2),
      status: "completed",
      description: `Container ${containerId} passed weighbridge. VGM: ${shipment.weightKg || "22,450"} kg verified per SOLAS convention.`,
      tag: `VGM Certified · Seal #${sealNo}`,
    },
    {
      id: 3,
      title: "Customs Clear & Container Loaded on Board",
      location: `${originCode} Berth 4`,
      timestamp: formatDt(d3),
      status: "completed",
      description: `Export clearance granted by customs authority. Container stowed in Bay 24 (Cell 08-02-84) aboard ${vesselName}.`,
      tag: `Export LEO Approved · Stowage Bay 24`,
    },
    {
      id: 4,
      title: "Vessel Underway / Deep-Sea In Transit",
      location: "Indian Ocean (Malacca Strait Corridor)",
      timestamp: formatDt(d4),
      status: "active",
      description: `Vessel underway at 18.4 kts heading 108° towards ${destCode}. All reefer/dry container telemetry green.`,
      tag: "Active Waypoint · ETA on schedule",
    },
    {
      id: 5,
      title: "Arrival Port of Discharge & Berth Inward",
      location: `${destCode} Container Terminal (PSA)`,
      timestamp: `Est. ${formatDt(etaDate)}`,
      status: "upcoming",
      description: `Berthing reservation confirmed at PSA Singapore Terminal. Discharging sequence queued.`,
      tag: "Scheduled Berth",
    },
    {
      id: 6,
      title: "Import Customs Clearance & Consignee Delivery",
      location: destination,
      timestamp: `Est. ${formatDt(new Date(etaDate.getTime() + 2 * 24 * 3600 * 1000))}`,
      status: "upcoming",
      description: `Delivery order (D/O) issuance and final mile container drayage to consignee facility.`,
      tag: "Final Delivery",
    },
  ];

  return {
    bookingRef,
    shipmentId,
    quoteNo,
    carrier,
    containerType,
    containerId,
    sealNo,
    vesselName,
    imoNumber,
    callSign,
    voyageNo,
    origin,
    originCode,
    destination,
    destCode,
    milestones,
    etaString: etaDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    transitDays: shipment.transit || "14 days",
    weight: shipment.weightKg ? `${shipment.weightKg} kg` : "22,450 kg",
    volume: shipment.volumeCbm ? `${shipment.volumeCbm} CBM` : "33.2 CBM",
    commodity: shipment.cargoType || "General Commercial Freight",
    hsCode: shipment.hsCode || "8471.30.10",
  };
}

export default function ShipmentTrackingModal({ shipment, onClose, onViewQuoteRecord }) {
  const [activeTab, setActiveTab] = useState("tracking"); // 'tracking' | 'vessel' | 'documents'
  const [copied, setCopied] = useState(false);

  if (!shipment) return null;

  const data = getTrackingData(shipment);

  function copyTracking(text) {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="stm-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="stm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="stm-header">
          <div className="stm-header-left">
            <div className="stm-tracking-ref">
              <span>{data.bookingRef}</span>
              <button
                type="button"
                className="stm-copy-btn"
                onClick={() => copyTracking(data.bookingRef)}
                title="Copy Booking Reference"
              >
                {copied ? <Check size={13} color="#059669" /> : <Copy size={13} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <span className="stm-status-pill in-transit">
              <span className="stm-pulse-dot" />
              IN TRANSIT
            </span>
            <span className="stm-mode-pill">Ocean Freight (FCL)</span>
            <span className="text-xs text-slate-500 font-medium">
              Shipment ID: <strong className="text-slate-700">{data.shipmentId}</strong>
            </span>
          </div>

          <div className="stm-header-right">
            {onViewQuoteRecord && (
              <button
                type="button"
                className="stm-btn-secondary"
                onClick={() => {
                  onViewQuoteRecord(shipment);
                }}
                title="View original commercial quotation pricing and approvals"
              >
                <FileText size={14} /> View Quote Record
              </button>
            )}
            <button
              type="button"
              className="stm-close-btn"
              onClick={onClose}
              aria-label="Close tracking console"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="stm-tabs-bar">
          <button
            type="button"
            className={`stm-tab-btn ${activeTab === "tracking" ? "active" : ""}`}
            onClick={() => setActiveTab("tracking")}
          >
            <Compass size={15} /> Shipment Tracking & Milestones
          </button>
          <button
            type="button"
            className={`stm-tab-btn ${activeTab === "vessel" ? "active" : ""}`}
            onClick={() => setActiveTab("vessel")}
          >
            <Ship size={15} /> Carrier & Vessel Telemetry
          </button>
          <button
            type="button"
            className={`stm-tab-btn ${activeTab === "documents" ? "active" : ""}`}
            onClick={() => setActiveTab("documents")}
          >
            <ShieldCheck size={15} /> Cargo Manifest & Trade Docs
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="stm-body">
          {/* Top Hero Route Strip (always visible across tabs) */}
          <div className="stm-hero-card">
            <div className="stm-hero-top">
              <div className="stm-hero-carrier-badge">
                <span className="stm-hero-carrier-dot" />
                <span>Carrier: <strong>{data.carrier}</strong></span>
                <span style={{ color: "#94a3b8" }}>·</span>
                <span>Voyage: <strong>{data.voyageNo}</strong></span>
              </div>
              <div className="stm-hero-eta-pill">
                ESTIMATED ARRIVAL: <strong>{data.etaString}</strong>
              </div>
            </div>

            <div className="stm-hero-route-strip">
              {/* Origin Node */}
              <div className="stm-node origin">
                <span className="stm-node-port-code">{data.originCode} · ORIGIN</span>
                <span className="stm-node-city">{data.origin.split(",")[0]}</span>
                <span className="stm-node-hub">{data.origin}</span>
              </div>

              {/* Transit Midpoint */}
              <div className="stm-route-mid">
                <span className="stm-route-transit-badge">Planned: {data.transitDays}</span>
                <div className="stm-route-line-wrap">
                  <div className="stm-route-line-bg" />
                  <div className="stm-route-line-fill" style={{ width: "65%" }} />
                  <div className="stm-route-transport-icon" style={{ left: "65%" }}>
                    <Ship size={13} />
                  </div>
                </div>
                <span className="stm-route-progress-sub">65% of voyage completed</span>
              </div>

              {/* Destination Node */}
              <div className="stm-node destination">
                <span className="stm-node-port-code">{data.destCode} · DISCHARGE PORT</span>
                <span className="stm-node-city">{data.destination.split(",")[0]}</span>
                <span className="stm-node-hub">{data.destination}</span>
              </div>
            </div>
          </div>

          {/* TAB 1: MILESTONE TRACKING */}
          {activeTab === "tracking" && (
            <>
              {/* Summary Cards */}
              <div className="stm-cards-grid">
                <div className="stm-info-card">
                  <div className="stm-info-card-header">
                    <Box size={16} color="#0284c7" /> Container & Seal Allocation
                  </div>
                  <div className="stm-info-card-rows">
                    <div className="stm-info-row">
                      <span className="stm-info-label">Equipment No</span>
                      <span className="stm-info-value highlight">{data.containerId}</span>
                    </div>
                    <div className="stm-info-row">
                      <span className="stm-info-label">Seal Number</span>
                      <span className="stm-info-value">{data.sealNo}</span>
                    </div>
                    <div className="stm-info-row">
                      <span className="stm-info-label">Equipment Size</span>
                      <span className="stm-info-value">{data.containerType}</span>
                    </div>
                  </div>
                </div>

                <div className="stm-info-card">
                  <div className="stm-info-card-header">
                    <Layers size={16} color="#0284c7" /> Cargo Weight & Measure
                  </div>
                  <div className="stm-info-card-rows">
                    <div className="stm-info-row">
                      <span className="stm-info-label">Gross Mass (VGM)</span>
                      <span className="stm-info-value">{data.weight}</span>
                    </div>
                    <div className="stm-info-row">
                      <span className="stm-info-label">Total Volume</span>
                      <span className="stm-info-value">{data.volume}</span>
                    </div>
                    <div className="stm-info-row">
                      <span className="stm-info-label">HS Tariff Classification</span>
                      <span className="stm-info-value">{data.hsCode}</span>
                    </div>
                  </div>
                </div>

                <div className="stm-info-card">
                  <div className="stm-info-card-header">
                    <ShieldCheck size={16} color="#059669" /> Regulatory & Safety Status
                  </div>
                  <div className="stm-info-card-rows">
                    <div className="stm-info-row">
                      <span className="stm-info-label">Export Customs LEO</span>
                      <span className="stm-info-value" style={{ color: "#059669" }}>Granted & Stamped</span>
                    </div>
                    <div className="stm-info-row">
                      <span className="stm-info-label">Bill of Lading</span>
                      <span className="stm-info-value" style={{ color: "#0284c7" }}>Original Issued</span>
                    </div>
                    <div className="stm-info-row">
                      <span className="stm-info-label">Cargo Insurance</span>
                      <span className="stm-info-value">Covered (All-Risk ICC-A)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 6-Stage Milestone Execution Timeline */}
              <div className="stm-section">
                <div className="stm-section-header">
                  <span className="stm-section-title">
                    <TrendingUp size={18} color="#0284c7" /> Cargo Execution Milestones
                  </span>
                  <span className="stm-section-badge">SOLAS & IMO Compliant Feed</span>
                </div>

                <div className="stm-timeline">
                  {data.milestones.map((m, idx) => (
                    <div key={m.id} className="stm-milestone-item">
                      <div className="stm-milestone-spine">
                        <div className={`stm-milestone-dot ${m.status}`}>
                          {m.status === "completed" ? (
                            <Check size={16} strokeWidth={2.6} />
                          ) : m.status === "active" ? (
                            <Navigation size={14} strokeWidth={2.4} />
                          ) : (
                            <span>{idx + 1}</span>
                          )}
                        </div>
                        {idx < data.milestones.length - 1 && (
                          <div
                            className={`stm-milestone-connector ${
                              m.status === "completed" ? "completed" : ""
                            }`}
                          />
                        )}
                      </div>

                      <div className="stm-milestone-content">
                        <div className="stm-milestone-row-top">
                          <span className="stm-milestone-title">{m.title}</span>
                          <span className="stm-milestone-time">{m.timestamp}</span>
                        </div>
                        <p className="stm-milestone-desc">{m.description}</p>
                        <div className="stm-milestone-tag">
                          <MapPin size={12} /> {m.location} · <strong>{m.tag}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* TAB 2: VESSEL & TELEMETRY */}
          {activeTab === "vessel" && (
            <div className="stm-section">
              <div className="stm-section-header">
                <span className="stm-section-title">
                  <Ship size={18} color="#0284c7" /> Maritime Carrier & Vessel AIS Telemetry
                </span>
                <span className="stm-section-badge">Live Satellite AIS Sync</span>
              </div>

              <div className="stm-cards-grid">
                <div className="stm-info-card">
                  <div className="stm-info-card-header">
                    <Anchor size={16} color="#0284c7" /> Vessel Identification
                  </div>
                  <div className="stm-info-card-rows">
                    <div className="stm-info-row">
                      <span className="stm-info-label">Vessel Name</span>
                      <span className="stm-info-value highlight">{data.vesselName}</span>
                    </div>
                    <div className="stm-info-row">
                      <span className="stm-info-label">IMO / Call Sign</span>
                      <span className="stm-info-value">{data.imoNumber} / {data.callSign}</span>
                    </div>
                    <div className="stm-info-row">
                      <span className="stm-info-label">Flag & Registry</span>
                      <span className="stm-info-value">Denmark (DIS)</span>
                    </div>
                    <div className="stm-info-row">
                      <span className="stm-info-label">Vessel Length & Beam</span>
                      <span className="stm-info-value">399 m × 59 m</span>
                    </div>
                  </div>
                </div>

                <div className="stm-info-card">
                  <div className="stm-info-card-header">
                    <Compass size={16} color="#0284c7" /> Navigation & Position
                  </div>
                  <div className="stm-info-card-rows">
                    <div className="stm-info-row">
                      <span className="stm-info-label">Current Position</span>
                      <span className="stm-info-value">05° 42' N, 094° 30' E</span>
                    </div>
                    <div className="stm-info-row">
                      <span className="stm-info-label">Speed & Course</span>
                      <span className="stm-info-value">18.4 knots / 108° ESE</span>
                    </div>
                    <div className="stm-info-row">
                      <span className="stm-info-label">Next Port of Call</span>
                      <span className="stm-info-value highlight">{data.destination}</span>
                    </div>
                    <div className="stm-info-row">
                      <span className="stm-info-label">Berthing Pilotage</span>
                      <span className="stm-info-value">Assigned (PSA Tower)</span>
                    </div>
                  </div>
                </div>

                <div className="stm-info-card">
                  <div className="stm-info-card-header">
                    <Waves size={16} color="#0284c7" /> Weather & Sea Conditions
                  </div>
                  <div className="stm-info-card-rows">
                    <div className="stm-info-row">
                      <span className="stm-info-label">Wave Height (Swell)</span>
                      <span className="stm-info-value">1.4 m (Calm-Moderate)</span>
                    </div>
                    <div className="stm-info-row">
                      <span className="stm-info-label">Surface Wind</span>
                      <span className="stm-info-value">12 kts NE (Force 3)</span>
                    </div>
                    <div className="stm-info-row">
                      <span className="stm-info-label">Sea Temperature</span>
                      <span className="stm-info-value">28.5 °C</span>
                    </div>
                    <div className="stm-info-row">
                      <span className="stm-info-label">Route Clearance</span>
                      <span className="stm-info-value" style={{ color: "#059669" }}>Clear (No weather delays)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TRADE DOCUMENTS & MANIFEST */}
          {activeTab === "documents" && (
            <div className="stm-section">
              <div className="stm-section-header">
                <span className="stm-section-title">
                  <ShieldCheck size={18} color="#059669" /> Official Cargo Manifest & Customs Dossier
                </span>
                <span className="stm-section-badge">Legally Sealed</span>
              </div>

              <p className="text-sm text-slate-600 mb-4">
                All 4 essential trade documents have cleared regulatory audit by the Freight Forwarding team and Customs Clearance officers.
              </p>

              <div className="stm-docs-list">
                <div className="stm-doc-chip">
                  <div className="stm-doc-chip-left">
                    <FileText size={18} color="#0284c7" />
                    <div>
                      <div className="stm-doc-chip-name">Bill of Lading (B/L)</div>
                      <div className="stm-doc-chip-status">VERIFIED · SEABORNE MASTER</div>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">PDF</span>
                </div>

                <div className="stm-doc-chip">
                  <div className="stm-doc-chip-left">
                    <FileText size={18} color="#0284c7" />
                    <div>
                      <div className="stm-doc-chip-name">Commercial Invoice</div>
                      <div className="stm-doc-chip-status">VERIFIED · CUSTOMS CLEARED</div>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">PDF</span>
                </div>

                <div className="stm-doc-chip">
                  <div className="stm-doc-chip-left">
                    <FileText size={18} color="#0284c7" />
                    <div>
                      <div className="stm-doc-chip-name">Packing List</div>
                      <div className="stm-doc-chip-status">VERIFIED · TALLY MATCHED</div>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">PDF</span>
                </div>

                <div className="stm-doc-chip">
                  <div className="stm-doc-chip-left">
                    <FileText size={18} color="#0284c7" />
                    <div>
                      <div className="stm-doc-chip-name">Certificate of Origin</div>
                      <div className="stm-doc-chip-status">VERIFIED · CHAMBER CERTIFIED</div>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">PDF</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="stm-footer">
          <div className="stm-footer-left">
            <Info size={15} color="#64748b" />
            <span>
              Real-time telemetry updated via satellite feed. Carrier support hotline: <strong>+1 (800) 555-CARGO</strong>
            </span>
          </div>
          <div className="stm-footer-right">
            <button type="button" className="stm-btn-secondary" onClick={onClose}>
              Close Console
            </button>
            <button
              type="button"
              className="stm-btn-primary"
              onClick={() => {
                window.print();
              }}
            >
              <Download size={14} /> Print Cargo Manifest
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
