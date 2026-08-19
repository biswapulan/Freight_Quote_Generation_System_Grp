import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { listQuotes } from "../api/quotes";
import { useAuth } from "./AuthContext";

export const PORTS_MASTER = [
  // --- OCEAN MARITIME SEAPORTS ---
  { id: "INNSA", code: "INNSA", name: "Nhava Sheva (JNPT), Mumbai", type: "Seaport", modes: ["ocean"], country: "India", lat: 18.95, lng: 72.95 },
  { id: "INMAA", code: "INMAA", name: "Chennai Port, Tamil Nadu", type: "Seaport", modes: ["ocean"], country: "India", lat: 13.08, lng: 80.29 },
  { id: "INMUN", code: "INMUN", name: "Mundra Port, Gujarat", type: "Seaport", modes: ["ocean"], country: "India", lat: 22.74, lng: 69.70 },
  { id: "INCOK", code: "INCOK", name: "Cochin Port, Kerala", type: "Seaport", modes: ["ocean"], country: "India", lat: 9.96, lng: 76.27 },
  { id: "INVTZ", code: "INVTZ", name: "Visakhapatnam Port, Andhra Pradesh", type: "Seaport", modes: ["ocean"], country: "India", lat: 17.68, lng: 83.28 },
  { id: "SGSIN", code: "SGSIN", name: "Port of Singapore", type: "Seaport", modes: ["ocean"], country: "Singapore", lat: 1.35, lng: 103.81 },
  { id: "AEJEA", code: "AEJEA", name: "Jebel Ali Port, Dubai", type: "Seaport", modes: ["ocean"], country: "UAE", lat: 24.98, lng: 55.02 },
  { id: "NLRTM", code: "NLRTM", name: "Port of Rotterdam", type: "Seaport", modes: ["ocean"], country: "Netherlands", lat: 51.92, lng: 4.47 },
  { id: "CNSHA", code: "CNSHA", name: "Port of Shanghai", type: "Seaport", modes: ["ocean"], country: "China", lat: 31.23, lng: 121.47 },
  { id: "DEHAM", code: "DEHAM", name: "Port of Hamburg", type: "Seaport", modes: ["ocean"], country: "Germany", lat: 53.53, lng: 9.97 },
  { id: "USLAX", code: "USLAX", name: "Port of Los Angeles", type: "Seaport", modes: ["ocean"], country: "USA", lat: 33.74, lng: -118.27 },

  // --- AIR CARGO HUBS & AIRPORTS (Air Freight & Express) ---
  { id: "DEL", code: "DEL", name: "Delhi Indira Gandhi Int'l Air Cargo", type: "Airport", modes: ["air", "express"], country: "India", lat: 28.55, lng: 77.10 },
  { id: "BOM", code: "BOM", name: "Mumbai Chhatrapati Shivaji Air Cargo", type: "Airport", modes: ["air", "express"], country: "India", lat: 19.09, lng: 72.87 },
  { id: "BLR", code: "BLR", name: "Bengaluru Kempegowda Air Cargo Complex", type: "Airport", modes: ["air", "express"], country: "India", lat: 13.20, lng: 77.71 },
  { id: "MAA-AIR", code: "MAA", name: "Chennai Int'l Air Cargo Facility", type: "Airport", modes: ["air", "express"], country: "India", lat: 12.99, lng: 80.17 },
  { id: "HYD", code: "HYD", name: "Hyderabad Rajiv Gandhi Air Cargo", type: "Airport", modes: ["air", "express"], country: "India", lat: 17.24, lng: 78.43 },
  { id: "SIN-AIR", code: "SIN", name: "Singapore Changi Air Cargo Terminal", type: "Airport", modes: ["air", "express"], country: "Singapore", lat: 1.36, lng: 103.99 },
  { id: "DXB", code: "DXB", name: "Dubai Int'l Airport Cargo Gateway", type: "Airport", modes: ["air", "express"], country: "UAE", lat: 25.25, lng: 55.36 },
  { id: "FRA", code: "FRA", name: "Frankfurt Airport CargoCity", type: "Airport", modes: ["air", "express"], country: "Germany", lat: 50.03, lng: 8.57 },
  { id: "LHR", code: "LHR", name: "London Heathrow World Cargo Centre", type: "Airport", modes: ["air", "express"], country: "UK", lat: 51.47, lng: -0.45 },
  { id: "JFK", code: "JFK", name: "New York JFK Air Freight Hub", type: "Airport", modes: ["air", "express"], country: "USA", lat: 40.64, lng: -73.78 },
  { id: "PVG", code: "PVG", name: "Shanghai Pudong Int'l Air Cargo", type: "Airport", modes: ["air", "express"], country: "China", lat: 31.14, lng: 121.80 },

  // --- INLAND CONTAINER DEPOTS (ICDs) & ROAD / RAIL HUBS ---
  { id: "IN-TKD", code: "IN-TKD", name: "ICD Tughlakabad, Delhi NCR", type: "Inland Depot", modes: ["ground", "road", "rail"], country: "India", lat: 28.50, lng: 77.29 },
  { id: "IN-BHI", code: "IN-BHI", name: "Bhiwandi Logistics Hub, Mumbai MMR", type: "Inland Depot", modes: ["ground", "road", "rail"], country: "India", lat: 19.29, lng: 73.06 },
  { id: "IN-WFD", code: "IN-WFD", name: "ICD Whitefield, Bengaluru", type: "Inland Depot", modes: ["ground", "road", "rail"], country: "India", lat: 12.98, lng: 77.74 },
  { id: "IN-SNF", code: "IN-SNF", name: "ICD Sanathnagar, Hyderabad", type: "Inland Depot", modes: ["ground", "road", "rail"], country: "India", lat: 17.46, lng: 78.44 },
  { id: "IN-ACT", code: "IN-ACT", name: "Ahmedabad Concor Multi-Modal Park", type: "Inland Depot", modes: ["ground", "road", "rail"], country: "India", lat: 23.03, lng: 72.58 },
  { id: "IN-LUD", code: "IN-LUD", name: "ICD Dhandari Kalan, Ludhiana", type: "Inland Depot", modes: ["ground", "road", "rail"], country: "India", lat: 30.87, lng: 75.92 },
  { id: "IN-CHN-ICD", code: "IN-CHN", name: "Chennai Outer Ring Domestic Hub", type: "Inland Depot", modes: ["ground", "road", "rail"], country: "India", lat: 13.05, lng: 80.18 },
  { id: "IN-NAG", code: "IN-NAG", name: "Mihan Multi-Modal Logistics Hub, Nagpur", type: "Inland Depot", modes: ["ground", "road", "rail"], country: "India", lat: 21.14, lng: 79.08 },
  { id: "IN-PUN", code: "IN-PUN", name: "Chakan-Talegaon Logistics Park, Pune", type: "Inland Depot", modes: ["ground", "road", "rail"], country: "India", lat: 18.73, lng: 73.68 },
];

const MODE_LABELS = {
  ocean: "Ocean Freight",
  ocean_fcl: "Ocean FCL",
  ocean_lcl: "Ocean LCL",
  air: "Air Freight",
  road: "Road Freight",
  rail: "Rail Freight",
  ground: "Ground Freight",
  express: "Express Air",
};

function formatDate(iso) {
  if (!iso) return "Recent";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatMoney(amount, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function transformApiQuote(quote, defaultCustomerName = "Retail Customer") {
  const quoteId = quote.id || quote._id || "";
  const createdDate = quote.created_at ? new Date(quote.created_at) : new Date();

  return {
    id: quoteId,
    quoteNo: quoteId ? `QT-${quoteId.slice(-8).toUpperCase()}` : "QT-NEW",
    customerName: quote.user_name || defaultCustomerName,
    customerCity: quote.origin || "Origin",
    laneCode: `${quote.origin || ""} → ${quote.destination || ""}`,
    laneSub: `${quote.origin || ""} → ${quote.destination || ""}`,
    origin: quote.origin,
    destination: quote.destination,
    mode: quote.mode || "ocean",
    modeLabel: MODE_LABELS[quote.mode] || quote.mode || "Freight",
    basis: quote.weight_kg ? `${quote.weight_kg} kg / ${quote.volume_m3 || 1} m³` : "—",
    transit: quote.transit_days ? `${quote.transit_days} d` : "—",
    totalFormatted: formatMoney(quote.breakdown?.total, quote.currency),
    totalNum: Number(quote.breakdown?.total || 0),
    breakdown: quote.breakdown || {},
    status: quote.status === "confirmed" ? "Booked" : quote.status === "draft" ? "Draft" : (quote.status || "Draft"),
    created: formatDate(quote.created_at),
    createdAt: createdDate,
  };
}

const MOCK_RETAIL_QUOTES = [
  {
    id: "qt_uz11yzv0",
    quoteNo: "QT-UZ11YZV0",
    customerName: "Anand Verma",
    customerCity: "Chennai",
    laneCode: "Chennai Port, Tamil Nadu → Port of Singapore",
    laneSub: "INMAA → SGSIN",
    origin: "Chennai Port, Tamil Nadu",
    destination: "Port of Singapore",
    mode: "ocean",
    modeLabel: "Ocean Freight",
    basis: "12,500 kg / 1 × 40HC",
    transit: "14 d",
    totalFormatted: "₹ 1,48,500",
    totalNum: 148500,
    breakdown: {
      base_handling_fee: 14500,
      distance_cost: 115000,
      fuel_surcharge: 19000,
      total: 148500,
    },
    status: "Booked",
    created: "Today",
    createdAt: new Date().toISOString(),
  },
  {
    id: "qt_sda7tsj2",
    quoteNo: "QT-SDA7TSJ2",
    customerName: "Anand Verma",
    customerCity: "Mumbai",
    laneCode: "Nhava Sheva, Mumbai → Port of Singapore",
    laneSub: "INNSA → SGSIN",
    origin: "Nhava Sheva, Mumbai",
    destination: "Port of Singapore",
    mode: "ocean",
    modeLabel: "Ocean Freight",
    basis: "12,500 kg / 1 × 40HC",
    transit: "15 d",
    totalFormatted: "₹ 1,98,750",
    totalNum: 198750,
    breakdown: {
      base_handling_fee: 14500,
      distance_cost: 159500,
      fuel_surcharge: 24750,
      total: 198750,
    },
    status: "Booked",
    created: "Today",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "qt_rtm4491a",
    quoteNo: "QT-RTM4491A",
    customerName: "Verma Exports",
    customerCity: "Mumbai",
    laneCode: "Nhava Sheva, Mumbai → Port of Rotterdam",
    laneSub: "INNSA → NLRTM",
    origin: "Nhava Sheva, Mumbai",
    destination: "Port of Rotterdam",
    mode: "ocean",
    modeLabel: "Ocean Freight",
    basis: "24,000 kg / 2 × 40HC",
    transit: "24 d",
    totalFormatted: "₹ 4,12,300",
    totalNum: 412300,
    breakdown: {
      base_handling_fee: 22000,
      distance_cost: 342000,
      fuel_surcharge: 48300,
      total: 412300,
    },
    status: "Draft",
    created: "Yesterday",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

function getLocalRetailQuotes() {
  try {
    const saved = localStorage.getItem("freightai_retail_quotes");
    return saved ? JSON.parse(saved) : MOCK_RETAIL_QUOTES;
  } catch {
    return MOCK_RETAIL_QUOTES;
  }
}

function saveLocalRetailQuotes(list) {
  try {
    localStorage.setItem("freightai_retail_quotes", JSON.stringify(list));
  } catch {}
}

function syncToAgentDesk(quoteEntry) {
  try {
    const saved = localStorage.getItem("freightai_agent_quotes");
    const currentList = saved ? JSON.parse(saved) : [];
    const agentQuote = {
      id: quoteEntry.quoteNo || `FQ-${quoteEntry.id?.slice(-4) || "8930"}`,
      client: quoteEntry.customerName || "Retail Customer",
      clientEmail: "retail@freightai.com",
      origin: quoteEntry.origin || "Chennai Port (INMAA)",
      destination: quoteEntry.destination || "Port of Singapore (SGSIN)",
      mode: quoteEntry.modeLabel || "Ocean FCL",
      cargoClass: "General Cargo",
      weightKg: quoteEntry.totalNum ? Math.round(quoteEntry.totalNum / 40) : 12500,
      baseRate: quoteEntry.breakdown?.distance_cost || 436250,
      marginPct: 10,
      fuelSurchargePct: 12,
      portFee: quoteEntry.breakdown?.base_handling_fee || 18500,
      status: quoteEntry.status === "Booked" ? "Approved" : "Pending Review",
      requestedDate: new Date().toISOString().slice(0, 10),
    };
    const updated = [agentQuote, ...currentList.filter((q) => q.id !== agentQuote.id)];
    localStorage.setItem("freightai_agent_quotes", JSON.stringify(updated));
  } catch {}
}

const RetailQuotesContext = createContext(null);

export function RetailQuotesProvider({ children }) {
  const { token, user } = useAuth();
  const [quotations, setQuotations] = useState(() => getLocalRetailQuotes());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reloadQuotes = useCallback(async () => {
    const local = getLocalRetailQuotes();
    setQuotations(local);

    if (!token) return local;

    try {
      setLoading(true);
      setError("");
      const data = await listQuotes(token);
      const records = Array.isArray(data) ? data : data?.results || [];
      if (records.length > 0) {
        const transformed = records.map((q) => transformApiQuote(q, user?.full_name));
        const merged = [...transformed, ...local.filter((l) => !transformed.some((t) => t.id === l.id))];
        setQuotations(merged);
        saveLocalRetailQuotes(merged);
        return merged;
      }
      return local;
    } catch {
      // Keep local state on token error
      return local;
    } finally {
      setLoading(false);
    }
  }, [token, user?.full_name]);

  useEffect(() => {
    reloadQuotes();
  }, [reloadQuotes]);

  const addQuotation = useCallback((entry) => {
    const transformed = entry.quoteNo ? entry : transformApiQuote(entry, user?.full_name);
    setQuotations((prev) => {
      const updated = [transformed, ...prev.filter((q) => q.id !== transformed.id)];
      saveLocalRetailQuotes(updated);
      syncToAgentDesk(transformed);
      return updated;
    });
  }, [user?.full_name]);

  const updateQuotationStatus = useCallback((idOrQuoteNo, newStatus) => {
    setQuotations((prev) => {
      const updated = prev.map((q) => {
        if (q.id === idOrQuoteNo || q.quoteNo === idOrQuoteNo) {
          const u = { ...q, status: newStatus };
          syncToAgentDesk(u);
          return u;
        }
        return q;
      });
      saveLocalRetailQuotes(updated);
      return updated;
    });
  }, []);

  const value = useMemo(
    () => ({
      quotations,
      loading,
      error,
      reloadQuotes,
      addQuotation,
      updateQuotationStatus,
    }),
    [quotations, loading, error, reloadQuotes, addQuotation, updateQuotationStatus]
  );

  return <RetailQuotesContext.Provider value={value}>{children}</RetailQuotesContext.Provider>;
}

export function useRetailQuotes() {
  const ctx = useContext(RetailQuotesContext);
  if (!ctx) {
    throw new Error("useRetailQuotes must be used within a RetailQuotesProvider");
  }
  return ctx;
}
