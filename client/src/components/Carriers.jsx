import { useMemo, useState } from "react";
import { FaSearch } from "react-icons/fa";
import "./Carriers.css";

// Sample data mirrors the seed carrier/carrier-service data. Swap for a real
// `GET /api/v1/carriers` call once that endpoint exists — the shape below
// (name, scac, mode, onTime, reliability, lanes[]) is what the UI expects.
const CARRIER_DATA = [
  {
    name: "Maersk Line", scac: "MAEU", mode: "OCEAN", onTime: 82, reliability: 0.82,
    lanes: [
      { route: "Mumbai (INBOM) → Rotterdam (NLRTM)", service: "AE7", sailingsPerWeek: 1, reefer: true, hazmat: true },
      { route: "Mumbai (INBOM) → Shanghai (CNSHA)", service: "IN2C", sailingsPerWeek: 1, reefer: false, hazmat: true },
      { route: "Mumbai (INBOM) → Felixstowe (GBFXT)", service: "AE10", sailingsPerWeek: 1, reefer: false, hazmat: true },
      { route: "Singapore (SGSIN) → Rotterdam (NLRTM)", service: "AE2-SIN-RTM", sailingsPerWeek: 2, reefer: true, hazmat: true },
    ],
  },
  {
    name: "MSC", scac: "MSCU", mode: "OCEAN", onTime: 78, reliability: 0.78,
    lanes: [
      { route: "Mumbai (INBOM) → Rotterdam (NLRTM)", service: "Swan", sailingsPerWeek: 1, reefer: true, hazmat: false },
      { route: "Mumbai (INBOM) → Jebel Ali (AEJEA)", service: "Gulf Express", sailingsPerWeek: 3, reefer: true, hazmat: true },
    ],
  },
  {
    name: "CMA CGM", scac: "CMDU", mode: "OCEAN", onTime: 80, reliability: 0.80,
    lanes: [
      { route: "Mumbai (INBOM) → Singapore (SGSIN)", service: "IPAK2", sailingsPerWeek: 2, reefer: true, hazmat: true },
      { route: "Mumbai (INBOM) → Los Angeles (USLAX)", service: "NWX", sailingsPerWeek: 1, reefer: true, hazmat: false },
      { route: "Chennai (INMAA) → Singapore (SGSIN)", service: "IPAK2-MAA", sailingsPerWeek: 2, reefer: true, hazmat: true },
    ],
  },
  {
    name: "Emirates SkyCargo", scac: "EK", mode: "AIR", onTime: 91, reliability: 0.91,
    lanes: [
      { route: "Mumbai (BOM) → Dubai (DXB)", service: "EK-CARGO-BOMDXB", sailingsPerWeek: 14, reefer: true, hazmat: true },
      { route: "Mumbai (BOM) → London (LHR)", service: "EK-CARGO-BOMLHR", sailingsPerWeek: 7, reefer: true, hazmat: false },
      { route: "Delhi (DEL) → New York (JFK)", service: "EK-CARGO-DELJFK", sailingsPerWeek: 7, reefer: true, hazmat: true },
    ],
  },
  {
    name: "DHL Global Forwarding", scac: "DHL", mode: "EXPRESS_AIR", onTime: 93, reliability: 0.93,
    lanes: [
      { route: "Mumbai (BOM) → London (LHR)", service: "DHL-EXPRESS-BOMLHR", sailingsPerWeek: 7, reefer: false, hazmat: false },
      { route: "Mumbai (BOM) → Singapore (SIN)", service: "DHL-EXPRESS-BOMSIN", sailingsPerWeek: 7, reefer: false, hazmat: false },
    ],
  },
  {
    name: "Indian Rail Freight Corp", scac: "IRFC", mode: "GROUND_RAIL", onTime: 74, reliability: 0.74,
    lanes: [
      { route: "Mumbai Hub → Delhi Hub", service: "IR-BOM-DEL", sailingsPerWeek: 7, reefer: false, hazmat: true },
    ],
  },
];

const MODE_LABELS = { OCEAN: "Ocean", AIR: "Air", EXPRESS_AIR: "Express Air", GROUND_RAIL: "Ground & Rail" };
const MODE_CHIPS = ["ALL", "OCEAN", "AIR", "EXPRESS_AIR", "GROUND_RAIL"];

function initials(name) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function Ring({ pct }) {
  const r = 24;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="car-ring-svg">
      <circle className="car-ring-track" cx="28" cy="28" r={r} />
      <circle className="car-ring-value" cx="28" cy="28" r={r} strokeDasharray={c} strokeDashoffset={offset} />
    </svg>
  );
}

export default function Carriers() {
  const [search, setSearch] = useState("");
  const [activeMode, setActiveMode] = useState("ALL");
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CARRIER_DATA.filter((c) => {
      const matchesMode = activeMode === "ALL" || c.mode === activeMode;
      const matchesQuery = !q || c.name.toLowerCase().includes(q) || c.scac.toLowerCase().includes(q);
      return matchesMode && matchesQuery;
    });
  }, [search, activeMode]);

  return (
    <section className="car-page" aria-labelledby="car-title">
      <div className="car-shell">
        <div className="car-eyebrow">{CARRIER_DATA.length} active carriers</div>
        <h1 id="car-title" className="car-h1">Carriers</h1>
        <p className="car-sub">Browse the carriers on your network, see how they perform, and check which lanes they service before you book.</p>

        <div className="car-controls">
          <div className="car-search">
            <FaSearch />
            <input
              type="text"
              placeholder="Search carriers by name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="car-filter-chips">
            {MODE_CHIPS.map((mode) => (
              <button
                key={mode}
                type="button"
                className={`car-chip${activeMode === mode ? " active" : ""}`}
                onClick={() => setActiveMode(mode)}
              >
                {mode === "ALL" ? "All modes" : MODE_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>

        <p className="car-count">
          <strong>{filtered.length}</strong> carrier{filtered.length === 1 ? "" : "s"} found
        </p>

        {filtered.length === 0 ? (
          <div className="car-empty visible">No carriers match your search or filter.</div>
        ) : (
          <div className="car-grid">
            {filtered.map((c) => (
              <article className="car-card" key={c.scac} onClick={() => setSelected(c)}>
                <div className="car-card-top">
                  <div className="car-avatar">{initials(c.name)}</div>
                  <span className="car-mode-badge">{MODE_LABELS[c.mode]}</span>
                </div>
                <p className="car-card-name">{c.name}</p>
                <p className="car-card-scac">SCAC: {c.scac}</p>
                <div className="car-stats-row">
                  <div className="car-ring-wrap">
                    <Ring pct={c.onTime} />
                    <div className="car-ring-label">{c.onTime}%</div>
                  </div>
                  <div>
                    <p className="car-stat-text-label">Reliability</p>
                    <p className="car-stat-text-value">{c.reliability.toFixed(2)} / 1.00</p>
                  </div>
                </div>
                <div className="car-lanes-count">
                  <span><strong>{c.lanes.length}</strong> lane{c.lanes.length === 1 ? "" : "s"} serviced</span>
                  <span className="car-view-link">View details →</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {selected && <div className="car-backdrop open" onClick={() => setSelected(null)} />}
      <aside className={`car-detail-panel${selected ? " open" : ""}`}>
        {selected && (
          <>
            <div className="car-detail-header">
              <div className="car-detail-header-info">
                <div className="car-detail-avatar">{initials(selected.name)}</div>
                <div>
                  <p className="car-detail-name">{selected.name}</p>
                  <p className="car-detail-scac">SCAC: {selected.scac} · {MODE_LABELS[selected.mode]}</p>
                </div>
              </div>
              <button type="button" className="car-detail-close" onClick={() => setSelected(null)} aria-label="Close">&times;</button>
            </div>
            <div className="car-detail-body">
              <div className="car-detail-stats">
                <div className="car-detail-stat">
                  <p className="car-detail-stat-label">On-time</p>
                  <p className="car-detail-stat-value">{selected.onTime}%</p>
                </div>
                <div className="car-detail-stat">
                  <p className="car-detail-stat-label">Reliability score</p>
                  <p className="car-detail-stat-value">{selected.reliability.toFixed(2)}</p>
                </div>
              </div>

              <p className="car-detail-section-title">Lanes serviced</p>
              {selected.lanes.map((lane) => (
                <div className="car-lane-item" key={lane.route + lane.service}>
                  <div className="car-lane-route">{lane.route}</div>
                  <div className="car-lane-meta">
                    <span>Service {lane.service}</span>
                    <span>{lane.sailingsPerWeek}x / week</span>
                  </div>
                  {(lane.reefer || lane.hazmat) && (
                    <div className="car-lane-tags">
                      {lane.reefer && <span className="car-lane-tag">Reefer</span>}
                      {lane.hazmat && <span className="car-lane-tag">Hazmat OK</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </aside>
    </section>
  );
}
