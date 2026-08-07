import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search, Anchor, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { PORTS_MASTER } from "../context/RetailQuotesContext";
import "./RetailPortCongestion.css";

// ---------------------------------------------------------------------------
// Static seed content, same pattern as RetailQuotesContext's seed
// quotations — not backed by a live feed yet, easy to extend or swap for a
// real congestion API later.
// ---------------------------------------------------------------------------

const CONGESTION = [
  {
    portId: "INNSA",
    type: "sea",
    level: "Moderate",
    avgWait: "1.6 days vessel wait",
    dwellDays: 3.1,
    dwellLabel: "3.1 days",
    trend: "down",
    trendLabel: "-0.4d vs last week",
    updated: "6 hours ago",
    note: "Yard utilization easing after peak clearance",
  },
  {
    portId: "AEJEA",
    type: "sea",
    level: "Low",
    avgWait: "0.4 days vessel wait",
    dwellDays: 1.9,
    dwellLabel: "1.9 days",
    trend: "down",
    trendLabel: "-0.3d vs last week",
    updated: "3 hours ago",
    note: "Congestion cleared following the Eid backlog",
  },
  {
    portId: "SGSIN",
    type: "sea",
    level: "High",
    avgWait: "2.9 days vessel wait",
    dwellDays: 4.2,
    dwellLabel: "4.2 days",
    trend: "up",
    trendLabel: "+0.8d vs last week",
    updated: "2 hours ago",
    note: "Transshipment volumes surging ahead of the next GRI",
  },
  {
    portId: "NLRTM",
    type: "sea",
    level: "Severe",
    avgWait: "4.5 days vessel wait",
    dwellDays: 6.8,
    dwellLabel: "6.8 days",
    trend: "up",
    trendLabel: "+1.2d vs last week",
    updated: "5 hours ago",
    note: "Barge backlog compounding Red Sea diversions",
  },
  {
    portId: "CNSHA",
    type: "sea",
    level: "Moderate",
    avgWait: "1.9 days vessel wait",
    dwellDays: 3.4,
    dwellLabel: "3.4 days",
    trend: "flat",
    trendLabel: "steady vs last week",
    updated: "8 hours ago",
    note: "Normal peak-season congestion for the corridor",
  },
  {
    portId: "DEL",
    type: "air",
    level: "Low",
    avgWait: "35 min ground delay",
    dwellDays: null,
    dwellLabel: "—",
    trend: "down",
    trendLabel: "-10 min vs last week",
    updated: "1 hour ago",
    note: "Cargo terminal operating within capacity",
  },
];

const LEVEL_CLASS = { Low: "low", Moderate: "moderate", High: "high", Severe: "severe" };
const LEVEL_COLOR = { Low: "#16a34a", Moderate: "#ca8a04", High: "#f97316", Severe: "#dc2626" };
const TREND_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus };

function markerIcon(color) {
  return L.divIcon({
    className: "",
    html: `<div class="pc-marker" style="background:${color}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export default function RetailPortCongestion() {
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const mapElRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const ports = useMemo(
    () =>
      CONGESTION.map((c) => ({ ...c, port: PORTS_MASTER.find((p) => p.id === c.portId) })).filter((c) => c.port),
    []
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ports.filter((c) => {
      const matchesSearch =
        !q || c.port.name.toLowerCase().includes(q) || c.port.country.toLowerCase().includes(q) || c.port.code.toLowerCase().includes(q);
      const matchesLevel = levelFilter === "all" || c.level === levelFilter;
      const matchesType = typeFilter === "all" || c.type === typeFilter;
      return matchesSearch && matchesLevel && matchesType;
    });
  }, [ports, search, levelFilter, typeFilter]);

  function clearFilters() {
    setSearch("");
    setLevelFilter("all");
    setTypeFilter("all");
  }

  const kpis = useMemo(() => {
    const elevated = ports.filter((c) => c.level === "High" || c.level === "Severe").length;
    const worsening = ports.filter((c) => c.trend === "up").length;
    const seaDwells = ports.filter((c) => c.dwellDays != null).map((c) => c.dwellDays);
    const avgDwell = seaDwells.length ? (seaDwells.reduce((a, b) => a + b, 0) / seaDwells.length).toFixed(1) : "—";
    return { monitored: ports.length, elevated, worsening, avgDwell };
  }, [ports]);

  // ---- Leaflet status map: init once ----
  useEffect(() => {
    if (!mapElRef.current || mapInstanceRef.current) return;
    const map = L.map(mapElRef.current, { attributionControl: false, zoomControl: true }).setView([20, 30], 2);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png").addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // ---- Leaflet status map: plot ports colored by congestion level ----
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const layerGroup = L.layerGroup().addTo(map);
    const bounds = [];

    ports.forEach((c) => {
      const color = LEVEL_COLOR[c.level] || "#94a3b8";
      bounds.push([c.port.lat, c.port.lng]);
      L.marker([c.port.lat, c.port.lng], { icon: markerIcon(color) })
        .addTo(layerGroup)
        .bindPopup(
          `<div class="pc-popup-title">${c.port.name}</div><div class="pc-popup-sub">${c.port.country}</div><div class="pc-popup-level" style="color:${color}">${c.level} congestion</div>`
        );
    });

    if (bounds.length) map.fitBounds(L.latLngBounds(bounds), { padding: [26, 26] });

    return () => {
      layerGroup.clearLayers();
      map.removeLayer(layerGroup);
    };
  }, [ports]);

  return (
    <div className="pc-page">
      <div className="pc-top-bar">
        <div className="pc-breadcrumb">
          <span className="pc-bc-path">Network / Port Congestion</span>
          <h1 className="pc-page-title">Port Congestion</h1>
          <span className="pc-page-sub">Live-style status across the ports and airports on your lanes</span>
        </div>
        <span className="pc-updated">Updated as of a few hours ago</span>
      </div>

      <div className="pc-kpi-grid">
        <div className="pc-kpi-card">
          <div className="pc-kpi-title">Ports monitored</div>
          <div className="pc-kpi-value">{kpis.monitored}</div>
          <div className="pc-kpi-sub slate">sea & air combined</div>
        </div>
        <div className="pc-kpi-card">
          <div className="pc-kpi-title">Elevated congestion</div>
          <div className="pc-kpi-value">{kpis.elevated}</div>
          <div className="pc-kpi-sub red">high or severe right now</div>
        </div>
        <div className="pc-kpi-card">
          <div className="pc-kpi-title">Avg sea dwell time</div>
          <div className="pc-kpi-value">{kpis.avgDwell}<span style={{ fontSize: 14, fontWeight: 700 }}> d</span></div>
          <div className="pc-kpi-sub slate">across monitored seaports</div>
        </div>
        <div className="pc-kpi-card">
          <div className="pc-kpi-title">Worsening this week</div>
          <div className="pc-kpi-value">{kpis.worsening}</div>
          <div className="pc-kpi-sub amber">ports trending up</div>
        </div>
      </div>

      <div className="pc-map-card">
        <div className="pc-card-head">
          <span className="pc-card-title"><Anchor size={16} /> Congestion map</span>
          <div className="pc-map-legend">
            <span className="pc-legend-item"><span className="pc-legend-dot" style={{ background: "#16a34a" }} /> Low</span>
            <span className="pc-legend-item"><span className="pc-legend-dot" style={{ background: "#ca8a04" }} /> Moderate</span>
            <span className="pc-legend-item"><span className="pc-legend-dot" style={{ background: "#f97316" }} /> High</span>
            <span className="pc-legend-item"><span className="pc-legend-dot" style={{ background: "#dc2626" }} /> Severe</span>
          </div>
        </div>
        <div ref={mapElRef} className="pc-map-el" />
      </div>

      <div className="pc-filter-card">
        <div className="pc-filter-controls">
          <div className="pc-search-wrap">
            <Search />
            <input
              type="text"
              className="pc-input"
              placeholder="Port, city or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="pc-select" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
            <option value="all">All levels</option>
            <option value="Low">Low</option>
            <option value="Moderate">Moderate</option>
            <option value="High">High</option>
            <option value="Severe">Severe</option>
          </select>
          <select className="pc-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">Sea & air</option>
            <option value="sea">Sea ports</option>
            <option value="air">Airports</option>
          </select>
          <button type="button" className="pc-btn-clear" onClick={clearFilters}>
            Clear
          </button>
          <span className="pc-results-count">{filtered.length} ports</span>
        </div>

        <div className="pc-table-wrap">
          <table className="pc-table">
            <thead>
              <tr>
                <th>PORT</th>
                <th>TYPE</th>
                <th>CONGESTION</th>
                <th>AVG WAIT</th>
                <th>DWELL TIME</th>
                <th>TREND</th>
                <th>NOTE</th>
                <th>UPDATED</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>
                    No matching ports found.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const TrendIcon = TREND_ICON[c.trend];
                  return (
                    <tr key={c.portId}>
                      <td>
                        <span className="pc-port-name">{c.port.name}</span>
                        <span className="pc-port-sub">{c.port.country} · {c.port.code}</span>
                      </td>
                      <td>
                        <span className={`pc-type-badge ${c.type}`}>{c.type === "sea" ? "Sea" : "Air"}</span>
                      </td>
                      <td>
                        <span className={`pc-level-badge ${LEVEL_CLASS[c.level]}`}>
                          <span className="pc-level-dot" /> {c.level}
                        </span>
                      </td>
                      <td style={{ color: "#64748b" }}>{c.avgWait}</td>
                      <td style={{ fontWeight: 600 }}>{c.dwellLabel}</td>
                      <td>
                        <span className={`pc-trend ${c.trend}`}>
                          <TrendIcon size={13} /> {c.trendLabel}
                        </span>
                      </td>
                      <td className="pc-note">{c.note}</td>
                      <td className="pc-updated-cell">{c.updated}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
