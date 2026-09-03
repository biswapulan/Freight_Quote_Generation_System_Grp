/**
 * Shared Quote Workflow & Lifecycle State Definitions
 * Role Connection:
 * Customer submits data → AI services analyze it → Freight Agent performs human review 
 * → Customs Officer participates when customs review is required 
 * → Freight Agent sends final quote → Customer accepts/rejects 
 * → Admin manages and monitors the platform.
 */

export const WORKFLOW_STAGES = [
  { id: "DRAFT", label: "1. Draft", actor: "Customer", desc: "Shipment details & documents submitted" },
  { id: "GENERATED", label: "2. Generated", actor: "AI Services", desc: "M1, M2 & M3 pricing and risk computed" },
  { id: "PENDING_REVIEW", label: "3. Pending Review", actor: "Customs / Agent", desc: "Customs document validation & operational check" },
  { id: "APPROVED", label: "4. Approved", actor: "Freight Agent", desc: "Commercial margin validated and approved" },
  { id: "SENT", label: "5. Sent", actor: "Freight Agent", desc: "Official final quote sent to customer" },
  { id: "ACCEPTED", label: "6. Decision", actor: "Customer", desc: "Customer accepts or rejects quote" },
];

export const STATUS_CONFIG = {
  DRAFT: {
    label: "DRAFT",
    badgeClass: "badge-draft",
    stepIndex: 1,
    color: "#0284c7",
    bg: "#e0f2fe",
  },
  GENERATED: {
    label: "GENERATED",
    badgeClass: "badge-generated",
    stepIndex: 2,
    color: "#6366f1",
    bg: "#e0e7ff",
  },
  PENDING_REVIEW: {
    label: "PENDING_REVIEW",
    badgeClass: "badge-pending-review",
    stepIndex: 3,
    color: "#d97706",
    bg: "#fef3c7",
  },
  CUSTOMS_FLAGGED: {
    label: "CUSTOMS_FLAGGED",
    badgeClass: "badge-customs-flagged",
    stepIndex: 3,
    color: "#dc2626",
    bg: "#fee2e2",
  },
  APPROVED: {
    label: "APPROVED",
    badgeClass: "badge-approved",
    stepIndex: 4,
    color: "#7c3aed",
    bg: "#ede9fe",
  },
  SENT: {
    label: "SENT",
    badgeClass: "badge-sent",
    stepIndex: 5,
    color: "#0284c7",
    bg: "#dbeafe",
  },
  ACCEPTED: {
    label: "ACCEPTED",
    badgeClass: "badge-accepted",
    stepIndex: 6,
    color: "#059669",
    bg: "#ecfdf5",
  },
  REJECTED: {
    label: "REJECTED",
    badgeClass: "badge-rejected",
    stepIndex: 6,
    color: "#991b1b",
    bg: "#fef2f2",
  },
  EXPIRED: {
    label: "EXPIRED",
    badgeClass: "badge-expired",
    stepIndex: 6,
    color: "#64748b",
    bg: "#f1f5f9",
  },
};

/**
 * Standardize any legacy status string to current workflow status
 */
export function normalizeWorkflowStatus(rawStatus) {
  if (!rawStatus) return "DRAFT";
  const upper = String(rawStatus).toUpperCase().trim();
  
  if (upper === "DRAFT" || upper === "REQUESTED" || upper === "CREATED" || upper === "SUBMITTED") return "DRAFT";
  if (upper === "GENERATED" || upper === "AI_ANALYZED" || upper === "ANALYZED") return "GENERATED";
  if (upper === "PENDING_REVIEW" || upper === "CUSTOMS_REVIEWED" || upper === "PENDING" || upper === "REVIEW") return "PENDING_REVIEW";
  if (upper === "CUSTOMS_FLAGGED" || upper === "FLAGGED") return "CUSTOMS_FLAGGED";
  if (upper === "APPROVED") return "APPROVED";
  if (upper === "SENT" || upper === "FINAL_QUOTE_SENT" || upper === "ISSUED") return "SENT";
  if (upper === "ACCEPTED" || upper === "BOOKED" || upper === "CONFIRMED") return "ACCEPTED";
  if (upper === "REJECTED" || upper === "CANCELLED") return "REJECTED";
  if (upper === "EXPIRED") return "EXPIRED";
  
  return "DRAFT";
}

/**
 * Get or seed platform shared quotes from localStorage
 */
const STORAGE_KEY = "freightai_platform_quotes_v2";

export const SEED_WORKFLOW_QUOTES = [
  {
    id: "SHP-1001",
    quoteNo: "SHP-1001",
    shipmentId: "SHP-1001",
    customerName: "ABC Electronics Pvt Ltd",
    customerEmail: "abc.electronics@freightai.com",
    origin: "Chennai, India (INMAA)",
    destination: "Rotterdam, Netherlands (NLRTM)",
    laneCode: "INMAA-NLRTM",
    mode: "ocean_fcl",
    modeLabel: "Sea Freight (40FT)",
    cargoType: "Electronics",
    hsCode: "8517.12",
    weightKg: 5000,
    volumeCbm: 12,
    containerType: "40FT",
    distanceKm: 8950,
    transit: "24 Days",
    status: "PENDING_REVIEW",
    ruleBasedPrice: 87000,
    aiPredictedPrice: 85500,
    recommendedPrice: 86000,
    weatherRiskScore: 30,
    weatherRiskLevel: "Moderate (30/100)",
    customsRiskScore: 40,
    customsRiskLevel: "Medium (40/100)",
    routeRiskScore: 20,
    routeRiskLevel: "Low (20/100)",
    overallRisk: "MEDIUM",
    requiresCustomsReview: true,
    customsRemarks: "Electronics HS 8517.12 declaration and documentation under standard customs review.",
    agentRemarks: "Rule-based price ₹87,000 / AI predicted ₹85,500. Recommended price ₹86,000 ready for review.",
    baseRate: 75000,
    marginPct: 12.0,
    fuelSurcharge: 11000,
    totalNum: 86000,
    totalFormatted: "₹ 86,000",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    documents: [
      { name: "Commercial Invoice", status: "VERIFIED" },
      { name: "Packing List", status: "VERIFIED" },
      { name: "Bill of Lading Draft", status: "PENDING" }
    ]
  },
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
