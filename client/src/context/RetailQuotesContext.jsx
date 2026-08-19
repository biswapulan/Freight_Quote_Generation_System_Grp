import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { listQuotes } from "../api/quotes";
import { useAuth } from "./AuthContext";

export const PORTS_MASTER = [
  { id: "INNSA", code: "INNSA", name: "Nhava Sheva, Mumbai", country: "India", lat: 18.95, lng: 72.95 },
  { id: "INMAA", code: "INMAA", name: "Chennai Port, Tamil Nadu", country: "India", lat: 13.08, lng: 80.29 },
  { id: "AEJEA", code: "AEJEA", name: "Jebel Ali, Dubai", country: "UAE", lat: 24.98, lng: 55.02 },
  { id: "SGSIN", code: "SGSIN", name: "Port of Singapore", country: "Singapore", lat: 1.35, lng: 103.81 },
  { id: "NLRTM", code: "NLRTM", name: "Port of Rotterdam", country: "Netherlands", lat: 51.92, lng: 4.47 },
  { id: "CNSHA", code: "CNSHA", name: "Port of Shanghai", country: "China", lat: 31.23, lng: 121.47 },
  { id: "DEL", code: "DEL", name: "Delhi Indira Gandhi Airport", country: "India", lat: 28.55, lng: 77.1 },
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
