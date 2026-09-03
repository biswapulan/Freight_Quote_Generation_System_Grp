/**
 * Shared Quote Workflow & Lifecycle State Definitions
 * Role Connection:
 * Customer submits data → AI services analyze it → Freight Agent performs human review 
 * → Customs Officer participates when customs review is required 
 * → Freight Agent sends final quote → Customer accepts/rejects 
 * → Admin manages and monitors the platform.
 */

export const WORKFLOW_STAGES = [
  { id: "REQUESTED", label: "1. Requested", actor: "Customer", desc: "Shipment details & documents submitted" },
  { id: "AI_ANALYZED", label: "2. AI Analyzed", actor: "AI Services", desc: "Pricing, route & risk engine computed" },
  { id: "CUSTOMS_REVIEWED", label: "3. Customs Review", actor: "Customs Officer", desc: "Participates when customs review is required" },
  { id: "FINAL_QUOTE_SENT", label: "4. Final Quote Sent", actor: "Freight Agent", desc: "Human review, commercial validation & margins" },
  { id: "ACCEPTED", label: "5. Customer Decision", actor: "Customer", desc: "Customer views final quote and accepts / rejects" },
];

export const STATUS_CONFIG = {
  REQUESTED: {
    label: "Requested",
    badgeClass: "badge-requested",
    stepIndex: 1,
    color: "#0284c7",
    bg: "#e0f2fe",
  },
  AI_ANALYZED: {
    label: "AI Analyzed",
    badgeClass: "badge-ai-analyzed",
    stepIndex: 2,
    color: "#6366f1",
    bg: "#e0e7ff",
  },
  CUSTOMS_REVIEWED: {
    label: "Customs Reviewed",
    badgeClass: "badge-customs-reviewed",
    stepIndex: 3,
    color: "#7c3aed",
    bg: "#ede9fe",
  },
  CUSTOMS_FLAGGED: {
    label: "Customs Flagged (Hold)",
    badgeClass: "badge-customs-flagged",
    stepIndex: 3,
    color: "#dc2626",
    bg: "#fee2e2",
  },
  FINAL_QUOTE_SENT: {
    label: "Final Quote Sent",
    badgeClass: "badge-final-sent",
    stepIndex: 4,
    color: "#d97706",
    bg: "#fef3c7",
  },
  ACCEPTED: {
    label: "Accepted & Confirmed",
    badgeClass: "badge-accepted",
    stepIndex: 5,
    color: "#059669",
    bg: "#ecfdf5",
  },
  REJECTED: {
    label: "Rejected / Archived",
    badgeClass: "badge-rejected",
    stepIndex: 5,
    color: "#991b1b",
    bg: "#fef2f2",
  },
};

/**
 * Standardize any legacy status string to current workflow status
 */
export function normalizeWorkflowStatus(rawStatus) {
  if (!rawStatus) return "REQUESTED";
  const upper = String(rawStatus).toUpperCase().trim();
  
  if (upper === "REQUESTED" || upper === "DRAFT" || upper === "PENDING") return "REQUESTED";
  if (upper === "AI_ANALYZED" || upper === "GENERATED" || upper === "ANALYZED") return "AI_ANALYZED";
  if (upper === "CUSTOMS_REVIEWED" || upper === "PENDING_REVIEW") return "CUSTOMS_REVIEWED";
  if (upper === "CUSTOMS_FLAGGED" || upper === "FLAGGED") return "CUSTOMS_FLAGGED";
  if (upper === "FINAL_QUOTE_SENT" || upper === "ISSUED" || upper === "APPROVED" || upper === "SENT") return "FINAL_QUOTE_SENT";
  if (upper === "ACCEPTED" || upper === "BOOKED" || upper === "CONFIRMED") return "ACCEPTED";
  if (upper === "REJECTED" || upper === "CANCELLED") return "REJECTED";
  
  return "REQUESTED";
}

/**
 * Get or seed platform shared quotes from localStorage
 */
const STORAGE_KEY = "freightai_platform_quotes_v2";

export const SEED_WORKFLOW_QUOTES = [
  {
    id: "FQ-9001",
    quoteNo: "FQ-9001",
    customerName: "Apex Exports Pvt Ltd",
    customerEmail: "business@freightai.com",
    origin: "Chennai, India (INMAA)",
    destination: "Rotterdam, Netherlands (NLRTM)",
    laneCode: "INMAA-NLRTM",
    mode: "ocean_fcl",
    modeLabel: "Ocean FCL (40ft HC)",
    cargoType: "High-Tech Electronics",
    hsCode: "8517.12",
    weightKg: 14500,
    volumeCbm: 65,
    status: "FINAL_QUOTE_SENT",
    requiresCustomsReview: true,
    customsRemarks: "HS Code 8517.12 verified against EU CE conformity regulations. Cleared by Officer Sharma.",
    agentRemarks: "12.5% Commercial margin applied. Maersk Line space locked.",
    baseRate: 185000,
    marginPct: 12.5,
    fuelSurcharge: 18500,
    totalNum: 218500,
    totalFormatted: "₹ 2,18,500",
    transit: "18 Days",
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    documents: [
      { name: "Commercial Invoice", status: "VERIFIED" },
      { name: "Bill of Lading Draft", status: "VERIFIED" },
      { name: "CE Certificate of Conformity", status: "VERIFIED" }
    ]
  },
  {
    id: "FQ-9002",
    quoteNo: "FQ-9002",
    customerName: "Zenith Pharmaceuticals",
    customerEmail: "pharma@zenith.com",
    origin: "Mumbai Port (INBOM)",
    destination: "Hamburg, Germany (DEHAM)",
    laneCode: "INBOM-DEHAM",
    mode: "air",
    modeLabel: "Air Cargo Temperature-Controlled",
    cargoType: "Industrial Chemicals (Class 3)",
    hsCode: "2902.11",
    weightKg: 3200,
    volumeCbm: 12,
    status: "CUSTOMS_REVIEWED",
    requiresCustomsReview: true,
    customsRemarks: "MSDS / Safety Data Sheet verified. DG declaration approved for Lufthansa Cargo.",
    agentRemarks: "",
    baseRate: 240000,
    marginPct: 10.0,
    fuelSurcharge: 24000,
    totalNum: 288000,
    totalFormatted: "₹ 2,88,000",
    transit: "3 Days",
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    documents: [
      { name: "Dangerous Goods Declaration (DGD)", status: "VERIFIED" },
      { name: "Material Safety Data Sheet (SDS)", status: "VERIFIED" }
    ]
  },
  {
    id: "FQ-9003",
    quoteNo: "FQ-9003",
    customerName: "Anand Verma (Retail)",
    customerEmail: "retail@freightai.com",
    origin: "Nhava Sheva (INNSA)",
    destination: "Singapore Port (SGSIN)",
    laneCode: "INNSA-SGSIN",
    mode: "ocean_lcl",
    modeLabel: "Ocean LCL (Consolidated)",
    cargoType: "Textiles & Garments",
    hsCode: "6109.10",
    weightKg: 1800,
    volumeCbm: 8,
    status: "AI_ANALYZED",
    requiresCustomsReview: false,
    customsRemarks: "Standard consumer goods, automated green-lane clearance.",
    agentRemarks: "",
    baseRate: 48000,
    marginPct: 8.0,
    fuelSurcharge: 4500,
    totalNum: 56340,
    totalFormatted: "₹ 56,340",
    transit: "7 Days",
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    documents: [
      { name: "Packing List", status: "VERIFIED" },
      { name: "Commercial Invoice", status: "VERIFIED" }
    ]
  },
  {
    id: "FQ-9004",
    quoteNo: "FQ-9004",
    customerName: "Global Trade Hub",
    customerEmail: "contact@globaltrade.org",
    origin: "Mundra Port (INMUN)",
    destination: "Jebel Ali, Dubai (AEJEA)",
    laneCode: "INMUN-AEJEA",
    mode: "ocean_fcl",
    modeLabel: "Ocean FCL (20ft Standard)",
    cargoType: "Automotive Parts",
    hsCode: "8708.29",
    weightKg: 8500,
    volumeCbm: 30,
    status: "ACCEPTED",
    requiresCustomsReview: true,
    customsRemarks: "Certificate of Origin verified. Customs gate cleared.",
    agentRemarks: "Confirmed vessel MSC Paloma V.24. Gate-in completed.",
    baseRate: 92000,
    marginPct: 10.0,
    fuelSurcharge: 9200,
    totalNum: 110400,
    totalFormatted: "₹ 1,10,400",
    transit: "5 Days",
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    documents: [
      { name: "Certificate of Origin (COO)", status: "VERIFIED" },
      { name: "Bill of Lading", status: "VERIFIED" }
    ]
  }
];

export function getPlatformQuotes() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return SEED_WORKFLOW_QUOTES;
}

export function savePlatformQuotes(quotes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
  } catch {}
}

export function updateQuoteStatusInStore(quoteId, newStatus, extraFields = {}) {
  const current = getPlatformQuotes();
  const updated = current.map((q) => {
    if (q.id === quoteId || q.quoteNo === quoteId) {
      return {
        ...q,
        status: newStatus,
        ...extraFields,
        updatedAt: new Date().toISOString()
      };
    }
    return q;
  });
  savePlatformQuotes(updated);
  return updated;
}
