import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search, Route as RouteIcon, Ship, Plane } from "lucide-react";
import { useRetailQuotes, PORTS_MASTER } from "../context/RetailQuotesContext";
import "./RetailRoutes.css";

// ---------------------------------------------------------------------------
// Static seed content, same pattern as RetailQuotesContext's seed
// quotations — not backed by an API yet, easy to extend later. A couple of
// lanes reach ports that aren't in the shared PORTS_MASTER (Callao,
// Colombo); those are kept local to this page so the shared master list
// used by Generate Quote is left untouched.
// ---------------------------------------------------------------------------

const EXTRA_PORTS = {
  PECLL: { id: "PECLL", code: "PECLL", name: "Callao, Peru", country: "Peru", lat: -12.05, lng: -77.13 },
  LKCMB: { id: "LKCMB", code: "LKCMB", name: "Colombo", country: "Sri Lanka", lat: 6.93, lng: 79.85 },
};

function portLookup(id) {
  return PORTS_MASTER.find((p) => p.id === id) || EXTRA_PORTS[id];
}

const LANES = [
  {
    originId: "INNSA",
    destId: "AEJEA",
    modes: ["ocean", "air"],
    transit: "6–10 d (ocean) · 2–3 d (air)",
    status: "Active",
    note: "High-frequency corridor, twice-weekly ocean sailings",
  },
  {
    originId: "INNSA",
    destId: "NLRTM",
    modes: ["ocean"],
    transit: "24–28 d",
    status: "Active",
    note: "BAF revised to 14% this week",
  },
  {
    originId: "INNSA",
    destId: "SGSIN",
    modes: ["ocean", "air"],
    transit: "11–16 d (ocean) · 3–4 d (air)",
    status: "Active",
    note: "New direct weekly ocean service added",
  },
  {
    originId: "INNSA",
    destId: "CNSHA",
    modes: ["ocean"],
    transit: "13–18 d",
    status: "Active",
    note: "Standard transpacific feeder rotation",
  },
  {
    originId: "DEL",
    destId: "AEJEA",
    modes: ["air"],
    transit: "1–2 d",
    status: "Active",
    note: "Popular express air corridor",
  },
  {
    originId: "INNSA",
    destId: "PECLL",
    modes: ["ocean"],
    transit: "—",
    status: "Suspended",
    note: "No vessel coverage until further notice",
  },
  {
    originId: "INNSA",
    destId: "LKCMB",
    modes: ["ocean"],
    transit: "5–7 d",
    status: "New",
    note: "Newly opened trade lane — book online now",
  },
  {
    originId: "AEJEA",
    destId: "NLRTM",
    modes: ["ocean"],
    transit: "18–22 d",
    status: "Delayed",
    note: "Red Sea diversions adding transit days",
  },
];

const STATUS_LINE_COLOR = {
  Active: "#16a34a",
  New: "#0284c7",
  Delayed: "#f59e0b",
  Suspended: "#dc2626",
};

const STATUS_CLASS = {
  Active: "active",
  New: "new",
  Delayed: "delayed",
  Suspended: "suspended",
};

const MODE_ICON = { ocean: Ship, air: Plane };

function markerIcon({ hub }) {
  return L.divIcon({
    className: "",
    html: `<div class="rt-marker${hub ? " hub" : ""}" style="background:${hub ? "#ff9800" : "#0f172a"}"></div>`,
    iconSize: hub ? [18, 18] : [14, 14],
    iconAnchor: hub ? [9, 9] : [7, 7],
  });
}

export default function RetailRoutes() {
  const { quotations } = useRetailQuotes();
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const mapElRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const lanes = useMemo(
    () =>
      LANES.map((lane) => {
        const origin = portLookup(lane.originId);
        const dest = portLookup(lane.destId);
        const laneCode = `${lane.originId} → ${lane.destId}`;
        const quoteCount = quotations.filter((q) => q.laneCode === laneCode).length;
        return { ...lane, origin, dest, laneCode, quoteCount };
      }),
    [quotations]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lanes.filter((lane) => {
      const matchesSearch =
        !q ||
        lane.laneCode.toLowerCase().includes(q) ||
        lane.origin.name.toLowerCase().includes(q) ||
        lane.dest.name.toLowerCase().includes(q);
      const matchesMode = modeFilter === "all" || lane.modes.includes(modeFilter);
      const matchesStatus = statusFilter === "all" || lane.status === statusFilter;
      return matchesSearch && matchesMode && matchesStatus;
    });
  }, [lanes, search, modeFilter, statusFilter]);

  function clearFilters() {
    setSearch("");
    setModeFilter("all");
    setStatusFilter("all");
  }

  const kpis = useMemo(() => {
    const activeCount = lanes.filter((l) => l.status === "Active" || l.status === "New").length;
    const flaggedCount = lanes.filter((l) => l.status === "Delayed" || l.status === "Suspended").length;
    const portSet = new Set();
    lanes.forEach((l) => {
      portSet.add(l.originId);
      portSet.add(l.destId);
    });
    const liveQuotes = lanes.reduce((sum, l) => sum + l.quoteCount, 0);
    return { activeCount, flaggedCount, portCount: portSet.size, liveQuotes };
  }, [lanes]);

  // ---- Leaflet network map: init once ----
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

  // ---- Leaflet network map: draw lanes + ports whenever data changes ----
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const layerGroup = L.layerGroup().addTo(map);
    const seenPorts = new Set();
    const bounds = [];

    lanes.forEach((lane) => {
      L.polyline(
        [
          [lane.origin.lat, lane.origin.lng],
          [(lane.origin.lat + lane.dest.lat) / 2 + 4, (lane.origin.lng + lane.dest.lng) / 2],
          [lane.dest.lat, lane.dest.lng],
        ],
        {
          color: STATUS_LINE_COLOR[lane.status] || "#64748b",
          weight: 2.5,
          dashArray: lane.status === "Suspended" ? "5, 6" : null,
          opacity: 0.85,
        }
      ).addTo(layerGroup);

      [lane.origin, lane.dest].forEach((port) => {
        if (seenPorts.has(port.id)) return;
        seenPorts.add(port.id);
        bounds.push([port.lat, port.lng]);
        const isHub = port.id === "INNSA";
        L.marker([port.lat, port.lng], { icon: markerIcon({ hub: isHub }) })
          .addTo(layerGroup)
          .bindPopup(
            `<div class="rt-popup-title">${port.name}</div><div class="rt-popup-sub">${port.country}${isHub ? " · Home hub" : ""}</div>`
          );
      });
    });

    if (bounds.length) map.fitBounds(L.latLngBounds(bounds), { padding: [26, 26] });

    return () => {
      layerGroup.clearLayers();
      map.removeLayer(layerGroup);
    };
  }, [lanes]);

  return (
    <div className="rt-page">
      <div className="rt-top-bar">
        <div className="rt-breadcrumb">
          <span className="rt-bc-path">Network / Routes</span>
          <h1 className="rt-page-title">Routes</h1>
          <span className="rt-page-sub">Lanes you can quote today, and what's changing on them</span>
        </div>
        <Link to="/dashboard/generate-quote" className="rt-btn-orange">
          + New enquiry
        </Link>
      </div>

      <div className="rt-kpi-grid">
        <div className="rt-kpi-card">
          <div className="rt-kpi-title">Active lanes</div>
          <div className="rt-kpi-value">{kpis.activeCount}</div>
          <div className="rt-kpi-sub green">serviceable now</div>
        </div>
        <div className="rt-kpi-card">
          <div className="rt-kpi-title">Ports & airports served</div>
          <div className="rt-kpi-value">{kpis.portCount}</div>
          <div className="rt-kpi-sub slate">across the network</div>
        </div>
        <div className="rt-kpi-card">
          <div className="rt-kpi-title">Lanes flagged</div>
          <div className="rt-kpi-value">{kpis.flaggedCount}</div>
          <div className="rt-kpi-sub amber">delayed or suspended</div>
        </div>
        <div className="rt-kpi-card">
          <div className="rt-kpi-title">Quotes on these lanes</div>
          <div className="rt-kpi-value">{kpis.liveQuotes}</div>
          <div className="rt-kpi-sub slate">from your quote history</div>
        </div>
      </div>

      <div className="rt-map-card">
        <div className="rt-card-head">
          <span className="rt-card-title"><RouteIcon size={16} /> Network map</span>
          <div className="rt-map-legend">
            <span className="rt-legend-item"><span className="rt-legend-swatch" style={{ background: "#16a34a" }} /> Active</span>
            <span className="rt-legend-item"><span className="rt-legend-swatch" style={{ background: "#0284c7" }} /> New</span>
            <span className="rt-legend-item"><span className="rt-legend-swatch" style={{ background: "#f59e0b" }} /> Delayed</span>
            <span className="rt-legend-item"><span className="rt-legend-swatch" style={{ background: "#dc2626" }} /> Suspended</span>
          </div>
        </div>
        <div ref={mapElRef} className="rt-map-el" />
      </div>

      <div className="rt-filter-card">
        <div className="rt-filter-controls">
          <div className="rt-search-wrap">
            <Search />
            <input
              type="text"
              className="rt-input"
              placeholder="Lane, port or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="rt-select" value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
            <option value="all">All modes</option>
            <option value="ocean">Ocean</option>
            <option value="air">Air</option>
          </select>
          <select className="rt-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="Active">Active</option>
            <option value="New">New</option>
            <option value="Delayed">Delayed</option>
            <option value="Suspended">Suspended</option>
          </select>
          <button type="button" className="rt-btn-clear" onClick={clearFilters}>
            Clear
          </button>
          <span className="rt-results-count">{filtered.length} lanes</span>
        </div>

        <div className="rt-table-wrap">
          <table className="rt-table">
            <thead>
              <tr>
                <th>LANE</th>
                <th>MODES</th>
                <th>TRANSIT</th>
                <th>STATUS</th>
                <th>WHAT'S NEW</th>
                <th>QUOTES</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>
                    No matching lanes found.
                  </td>
                </tr>
              ) : (
                filtered.map((lane) => (
                  <tr key={lane.laneCode}>
                    <td>
                      <span className="rt-lane-code">{lane.laneCode}</span>
                      <span className="rt-lane-sub">
                        {lane.origin.name.split(",")[0]} → {lane.dest.name.split(",")[0]}
                      </span>
                    </td>
                    <td>
                      <div className="rt-mode-badges">
                        {lane.modes.map((m) => {
                          const Icon = MODE_ICON[m];
                          return (
                            <span className={`rt-mode-badge ${m}`} key={m}>
                              <Icon size={11} /> {m === "ocean" ? "Ocean" : "Air"}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td style={{ color: "#64748b" }}>{lane.transit}</td>
                    <td>
                      <span className={`rt-status-badge ${STATUS_CLASS[lane.status]}`}>{lane.status}</span>
                    </td>
                    <td className="rt-note">{lane.note}</td>
                    <td>
                      <span className={`rt-quote-count${lane.quoteCount === 0 ? " zero" : ""}`}>
                        {lane.quoteCount || "—"}
                      </span>
                    </td>
                    <td>
                      {lane.status === "Suspended" ? (
                        <span className="rt-btn-quote disabled">Unavailable</span>
                      ) : (
                        <Link
                          to={`/dashboard/generate-quote?origin=${lane.originId}&dest=${lane.destId}`}
                          className="rt-btn-quote"
                        >
                          Get a quote
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
