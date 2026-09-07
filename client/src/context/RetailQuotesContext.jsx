import { createContext, useContext, useMemo } from "react";

import { usePlatformQuotes } from "../hooks/usePlatformQuotes";
import {
  addOrUpdatePlatformQuote,
  decideQuoteInStore,
  updateQuoteStatusInStore,
} from "../utils/quoteWorkflow";

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

/**
 * Customer-facing view of the shared platform quote store.
 *
 * This context used to hold three fabricated quotes and persist edits to
 * localStorage, so "My Quotes" showed the same invented shipments to every user
 * and never reflected what the freight agent did. It is now a thin wrapper over
 * the API-backed store in utils/quoteWorkflow.
 */
const RetailQuotesContext = createContext(null);

export function RetailQuotesProvider({ children }) {
  const { quotes, loading, error, reload } = usePlatformQuotes();

  const value = useMemo(
    () => ({
      quotations: quotes,
      loading,
      error,
      reloadQuotes: reload,

      /** Merge a freshly generated quote into the cache. */
      addQuotation: addOrUpdatePlatformQuote,

      /** Drive a quote to a new status through the workflow API. */
      updateQuotationStatus: updateQuoteStatusInStore,

      /** Customer accept/reject (PDF section 3, step 12). */
      decideQuotation: decideQuoteInStore,
    }),
    [quotes, loading, error, reload],
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
