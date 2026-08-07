import { createContext, useCallback, useContext, useMemo, useState } from "react";

// Seed data ported 1:1 from the reference dashboard (Quotations table).
const INITIAL_QUOTATIONS = [
  {
    quoteNo: "QT-2026-00934",
    customerName: "Sharma Textiles",
    customerCity: "Mumbai",
    laneCode: "INNSA → AEJEA",
    laneSub: "Mumbai → Dubai",
    mode: "ocean_fcl",
    modeLabel: "Ocean FCL",
    basis: "2 × 40HC",
    transit: "6–10 d",
    totalFormatted: "₹ 3,84,500",
    totalNum: 384500,
    status: "Draft",
    created: "2 min ago",
  },
  {
    quoteNo: "QT-2026-00933",
    customerName: "Nordic Imports AB",
    customerCity: "Gothenburg",
    laneCode: "INNSA → NLRTM",
    laneSub: "Mumbai → Rotterdam",
    mode: "ocean_fcl",
    modeLabel: "Ocean FCL",
    basis: "1 × 20GP",
    transit: "24–28 d",
    totalFormatted: "₹ 2,15,800",
    totalNum: 215800,
    status: "Issued",
    created: "1 hour ago",
  },
  {
    quoteNo: "QT-2026-00932",
    customerName: "Gulf Machinery LLC",
    customerCity: "Dubai",
    laneCode: "BOM → DXB",
    laneSub: "Mumbai → Dubai",
    mode: "air",
    modeLabel: "Air Freight",
    basis: "250 kg ch.",
    transit: "5–7 d",
    totalFormatted: "₹ 64,300",
    totalNum: 64300,
    status: "Issued",
    created: "3 hours ago",
  },
  {
    quoteNo: "QT-2026-00931",
    customerName: "Sharma Textiles",
    customerCity: "Mumbai",
    laneCode: "INNSA → SGSIN",
    laneSub: "Mumbai → Singapore",
    mode: "ocean_lcl",
    modeLabel: "Ocean LCL",
    basis: "4.2 R/T",
    transit: "11–16 d",
    totalFormatted: "₹ 88,400",
    totalNum: 88400,
    status: "Draft",
    created: "Yesterday",
  },
  {
    quoteNo: "QT-2026-00930",
    customerName: "Andes Trading",
    customerCity: "Callao",
    laneCode: "INNSA → PECLL",
    laneSub: "Mumbai → Callao",
    mode: "ocean_fcl",
    modeLabel: "Ocean FCL",
    basis: "—",
    transit: "—",
    totalFormatted: "Not serviced",
    totalNum: 0,
    status: "No routing",
    created: "Yesterday",
  },
];

export const PORTS_MASTER = [
  { id: "INNSA", code: "INNSA", name: "Nhava Sheva, Mumbai", country: "India", lat: 18.95, lng: 72.95 },
  { id: "AEJEA", code: "AEJEA", name: "Jebel Ali, Dubai", country: "UAE", lat: 24.98, lng: 55.02 },
  { id: "SGSIN", code: "SGSIN", name: "Port of Singapore", country: "Singapore", lat: 1.35, lng: 103.81 },
  { id: "NLRTM", code: "NLRTM", name: "Port of Rotterdam", country: "Netherlands", lat: 51.92, lng: 4.47 },
  { id: "CNSHA", code: "CNSHA", name: "Port of Shanghai", country: "China", lat: 31.23, lng: 121.47 },
  { id: "DEL", code: "DEL", name: "Delhi Indira Gandhi Airport", country: "India", lat: 28.55, lng: 77.1 },
];

const RetailQuotesContext = createContext(null);

export function RetailQuotesProvider({ children }) {
  const [quotations, setQuotations] = useState(INITIAL_QUOTATIONS);

  const addQuotation = useCallback((entry) => {
    setQuotations((prev) => [entry, ...prev]);
  }, []);

  const value = useMemo(() => ({ quotations, addQuotation }), [quotations, addQuotation]);

  return <RetailQuotesContext.Provider value={value}>{children}</RetailQuotesContext.Provider>;
}

export function useRetailQuotes() {
  const ctx = useContext(RetailQuotesContext);
  if (!ctx) {
    throw new Error("useRetailQuotes must be used within a RetailQuotesProvider");
  }
  return ctx;
}
