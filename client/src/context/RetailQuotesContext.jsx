import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { listQuotes } from "../api/quotes";
import { useAuth } from "./AuthContext";

export const PORTS_MASTER = [
  { id: "INNSA", code: "INNSA", name: "Nhava Sheva, Mumbai", country: "India", lat: 18.95, lng: 72.95 },
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

const RetailQuotesContext = createContext(null);

export function RetailQuotesProvider({ children }) {
  const { token, user } = useAuth();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reloadQuotes = useCallback(async () => {
    if (!token) {
      setQuotations([]);
      setLoading(false);
      return [];
    }
    try {
      setLoading(true);
      setError("");
      const data = await listQuotes(token);
      const records = Array.isArray(data) ? data : data?.results || [];
      const transformed = records.map((q) => transformApiQuote(q, user?.full_name));
      setQuotations(transformed);
      return transformed;
    } catch (err) {
      setError(err.message || "Failed to load quotations");
      return [];
    } finally {
      setLoading(false);
    }
  }, [token, user?.full_name]);

  useEffect(() => {
    reloadQuotes();
  }, [reloadQuotes]);

  const addQuotation = useCallback((entry) => {
    const transformed = entry.quoteNo ? entry : transformApiQuote(entry, user?.full_name);
    setQuotations((prev) => [transformed, ...prev]);
  }, [user?.full_name]);

  const value = useMemo(
    () => ({
      quotations,
      loading,
      error,
      reloadQuotes,
      addQuotation,
    }),
    [quotations, loading, error, reloadQuotes, addQuotation]
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
