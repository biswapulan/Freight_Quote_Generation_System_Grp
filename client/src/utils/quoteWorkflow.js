/**
 * Shared Quote Workflow & Lifecycle State Definitions
 * Role Connection:
 * Customer submits data → AI services analyze it → Freight Agent performs human review 
 * → Customs Officer participates when customs review is required 
 * → Freight Agent sends final quote → Customer accepts/rejects 
 * → Admin manages and monitors the platform.
 */

export const WORKFLOW_STAGES = [
  { id: "REQUESTED", label: "1. Requested", actor: "Customer", desc: "Shipment enquiry submitted by customer" },
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
    color: "#64748b",
    bg: "#f1f5f9",
  },
  REQUESTED: {
    label: "REQUESTED",
    badgeClass: "badge-requested",
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
 * Canonical Shipment Status Flow (Section 10)
 * DRAFT → SUBMITTED → PROCESSING → ANALYZED → QUOTED → CLOSED / CANCELLED
 */
export const SHIPMENT_STATUS_FLOW = [
  "DRAFT",
  "SUBMITTED",
  "PROCESSING",
  "ANALYZED",
  "QUOTED",
  "CLOSED",
  "CANCELLED",
];

export const SHIPMENT_STATUS_CONFIG = {
  DRAFT: { label: "DRAFT", color: "#64748b", bg: "#f1f5f9" },
  SUBMITTED: { label: "SUBMITTED", color: "#0284c7", bg: "#e0f2fe" },
  PROCESSING: { label: "PROCESSING", color: "#6366f1", bg: "#e0e7ff" },
  ANALYZED: { label: "ANALYZED", color: "#d97706", bg: "#fef3c7" },
  QUOTED: { label: "QUOTED", color: "#0284c7", bg: "#dbeafe" },
  CLOSED: { label: "CLOSED", color: "#059669", bg: "#ecfdf5" },
  CANCELLED: { label: "CANCELLED", color: "#991b1b", bg: "#fef2f2" },
};

export function normalizeShipmentStatus(raw) {
  if (!raw) return "SUBMITTED";
  const upper = String(raw).toUpperCase().trim();
  if (upper === "DRAFT") return "DRAFT";
  if (upper === "SUBMITTED" || upper === "CREATED" || upper === "REQUESTED") return "SUBMITTED";
  if (upper === "PROCESSING" || upper === "IN_PROGRESS" || upper === "ROUTING") return "PROCESSING";
  if (upper === "ANALYZED" || upper === "EVALUATED" || upper === "REVIEWED") return "ANALYZED";
  if (upper === "QUOTED" || upper === "QUOTE_ISSUED" || upper === "OFFERED") return "QUOTED";
  if (upper === "CLOSED" || upper === "ACCEPTED" || upper === "BOOKED" || upper === "COMPLETED") return "CLOSED";
  if (upper === "CANCELLED" || upper === "REJECTED" || upper === "EXPIRED") return "CANCELLED";
  return "SUBMITTED";
}

export function getShipmentStatusFromQuoteStatus(quoteStatus) {
  const norm = normalizeWorkflowStatus(quoteStatus);
  switch (norm) {
    case "DRAFT":
      return "DRAFT";
    case "REQUESTED":
      return "SUBMITTED";
    case "GENERATED":
      return "PROCESSING";
    case "PENDING_REVIEW":
    case "CUSTOMS_FLAGGED":
      return "ANALYZED";
    case "APPROVED":
    case "SENT":
      return "QUOTED";
    case "ACCEPTED":
      return "CLOSED";
    case "REJECTED":
    case "EXPIRED":
      return "CANCELLED";
    default:
      return "SUBMITTED";
  }
}

/**
 * Standardize any legacy status string to current workflow status
 */
export function normalizeWorkflowStatus(rawStatus) {
  if (!rawStatus) return "REQUESTED";
  const upper = String(rawStatus).toUpperCase().trim();
  
  if (upper === "DRAFT") return "DRAFT";
  if (upper === "REQUESTED" || upper === "CREATED" || upper === "SUBMITTED") return "REQUESTED";
  if (upper === "GENERATED" || upper === "AI_ANALYZED" || upper === "ANALYZED") return "GENERATED";
  if (upper === "PENDING_REVIEW" || upper === "CUSTOMS_REVIEWED" || upper === "PENDING" || upper === "REVIEW") return "PENDING_REVIEW";
  if (upper === "CUSTOMS_FLAGGED" || upper === "FLAGGED") return "CUSTOMS_FLAGGED";
  if (upper === "APPROVED") return "APPROVED";
  if (upper === "SENT" || upper === "FINAL_QUOTE_SENT" || upper === "ISSUED") return "SENT";
  if (upper === "ACCEPTED" || upper === "BOOKED" || upper === "CONFIRMED") return "ACCEPTED";
  if (upper === "REJECTED" || upper === "CANCELLED") return "REJECTED";
  if (upper === "EXPIRED") return "EXPIRED";
  
  return "REQUESTED";
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

export function syncQuoteDocumentsToVault(quote, documents) {
  if (!quote || !documents || !Array.isArray(documents)) return;
  try {
    const qId = quote.quoteNo || quote.id || "SHP-1001";
    const routeStr = quote.laneCode ||
      (quote.origin && quote.destination
        ? `${quote.origin} ➔ ${quote.destination}`
        : "Chennai ➔ Rotterdam");

    const savedVault = localStorage.getItem("freightai_vault_docs_v2");
    let vaultList = [];
    if (savedVault) {
      try {
        const parsed = JSON.parse(savedVault);
        if (Array.isArray(parsed)) vaultList = parsed;
      } catch {}
    }

    documents.forEach((d) => {
      if (d.status === "UPLOADED" || d.status === "VERIFIED" || d.fileName) {
        const docId = `doc-${qId}-${d.name.replace(/[^a-zA-Z0-9]/g, "_")}`;
        const fileName = d.fileName || `${d.name.replace(/\s+/g, "_")}.pdf`;
        const sizeStr = d.fileSize || "1.2 MB";
        const uploadedTime = d.uploadedAt
          ? (d.uploadedAt.includes("T")
              ? "Today, " + new Date(d.uploadedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : d.uploadedAt)
          : "Just now";

        const vaultEntry = {
          id: docId,
          name: fileName,
          type: d.name,
          fileName: fileName,
          shipmentRef: qId,
          route: routeStr,
          uploadedAt: uploadedTime,
          size: sizeStr,
          status: d.status === "VERIFIED" ? "VERIFIED" : "UNDER_REVIEW",
          verifiedBy: d.status === "VERIFIED" ? (quote.assignedOfficer || "Customs Officer Sharma") : "AI Automated OCR Scanner",
          notes: d.status === "VERIFIED"
            ? `Verified & cleared by Customs Officer for shipment ${qId}.`
            : `Uploaded by customer for shipment ${qId}. Queued for automated OCR validation & Customs Officer verification.`,
        };

        const existingIdx = vaultList.findIndex(
          (v) => v.id === docId || (v.shipmentRef === qId && v.type === d.name)
        );

        if (existingIdx >= 0) {
          vaultList[existingIdx] = { ...vaultList[existingIdx], ...vaultEntry };
        } else {
          vaultList.unshift(vaultEntry);
        }
      }
    });

    localStorage.setItem("freightai_vault_docs_v2", JSON.stringify(vaultList));
    localStorage.removeItem("freightai_vault_cleared");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("freightai_vault_updated"));
    }
  } catch (err) {
    console.error("Failed to sync quote documents to vault:", err);
  }
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

  // Sync to customs shipments if present
  try {
    const savedCustoms = localStorage.getItem("freightai_customs_shipments");
    if (savedCustoms) {
      const customsList = JSON.parse(savedCustoms);
      const updatedCustoms = customsList.map((cs) => {
        if (cs.id === quoteId || cs.quoteNo === quoteId) {
          return {
            ...cs,
            status: newStatus,
            ...(extraFields.customsRemarks ? { officerNotes: extraFields.customsRemarks } : {}),
            ...(extraFields.documents ? { documents: extraFields.documents } : {}),
            ...(extraFields.documentsStatus ? { documentsStatus: extraFields.documentsStatus } : {}),
          };
        }
        return cs;
      });
      localStorage.setItem("freightai_customs_shipments", JSON.stringify(updatedCustoms));
    }
  } catch {}

  // Sync to Document Management & Vault
  if (extraFields.documents && Array.isArray(extraFields.documents)) {
    const targetQuote = updated.find((q) => q.id === quoteId || q.quoteNo === quoteId);
    if (targetQuote) {
      syncQuoteDocumentsToVault(targetQuote, extraFields.documents);
    }
  }

  return updated;
}

export function addOrUpdatePlatformQuote(entry) {
  const current = getPlatformQuotes();
  const qId = entry.id || entry.quoteNo || `QT-${Date.now().toString().slice(-6)}`;
  const qNo = entry.quoteNo || (qId.startsWith("QT-") ? qId : `QT-${qId.slice(-8).toUpperCase()}`);
  
  const existingIdx = current.findIndex((q) => q.id === qId || q.quoteNo === qNo);
  
  const standardDocuments = entry.documents && entry.documents.length > 0 ? entry.documents : [
    { name: "Commercial Invoice", status: "PENDING" },
    { name: "Packing List", status: "PENDING" },
    { name: "Bill of Lading Draft", status: "PENDING" },
    { name: "Certificate of Origin", status: "PENDING" }
  ];

  const fullQuote = {
    id: qId,
    quoteNo: qNo,
    customerName: entry.customerName || entry.client || "Retail Customer",
    customerEmail: entry.customerEmail || entry.clientEmail || "customer@freightai.com",
    origin: entry.origin || entry.customerCity || "Nhava Sheva (INNSA)",
    destination: entry.destination || "Port of Singapore (SGSIN)",
    laneCode: entry.laneCode || "INNSA-SGSIN",
    mode: entry.mode || "ocean",
    modeLabel: entry.modeLabel || "Ocean Freight",
    cargoType: entry.cargoType || "General Commercial Goods",
    hsCode: entry.hsCode || "8471.30",
    weightKg: entry.weightKg || (entry.basis ? parseInt(entry.basis) : 12500) || 12500,
    volumeCbm: entry.volumeCbm || 30,
    basis: entry.basis || "12,500 kg / 1 × 40HC",
    transit: entry.transit || "14 d",
    ruleBasedPrice: entry.ruleBasedPrice || entry.totalNum || 148500,
    aiPredictedPrice: entry.aiPredictedPrice || (entry.totalNum ? Math.round(entry.totalNum * 0.98) : 145000),
    recommendedPrice: entry.recommendedPrice || entry.totalNum || 148500,
    baseRate: entry.baseRate || entry.breakdown?.distance_cost || 115000,
    marginPct: entry.marginPct || 10.0,
    fuelSurcharge: entry.fuelSurcharge || entry.breakdown?.fuel_surcharge || 19000,
    totalNum: Number(entry.totalNum || 148500),
    totalFormatted: entry.totalFormatted || `₹ ${Number(entry.totalNum || 148500).toLocaleString("en-IN")}`,
    breakdown: entry.breakdown || {},
    status: entry.status || "REQUESTED",
    shipmentStatus: entry.shipmentStatus || getShipmentStatusFromQuoteStatus(entry.status || "REQUESTED"),
    weatherRiskScore: 24,
    weatherRiskLevel: "Low (24/100)",
    customsRiskScore: 35,
    customsRiskLevel: "Moderate (35/100)",
    routeRiskScore: 18,
    routeRiskLevel: "Low (18/100)",
    overallRisk: "LOW",
    requiresCustomsReview: entry.requiresCustomsReview !== undefined ? entry.requiresCustomsReview : true,
    customsRemarks: entry.customsRemarks || "Awaiting customer document upload and customs officer compliance check.",
    agentRemarks: entry.agentRemarks || "Quote enquiry ingested. Operations review pending commercial signoff.",
    documents: standardDocuments,
    documentsStatus: entry.documentsStatus || "Pending Documents Upload",
    createdAt: entry.createdAt || new Date().toISOString(),
    created: entry.created || "Today"
  };

  let updatedList;
  if (existingIdx >= 0) {
    updatedList = [...current];
    updatedList[existingIdx] = { ...updatedList[existingIdx], ...fullQuote };
  } else {
    updatedList = [fullQuote, ...current];
  }

  savePlatformQuotes(updatedList);

  // Synchronize with customs shipments list
  try {
    const savedCustoms = localStorage.getItem("freightai_customs_shipments");
    const customsList = savedCustoms ? JSON.parse(savedCustoms) : [];
    const csShipment = {
      id: fullQuote.id,
      quoteNo: fullQuote.quoteNo,
      customer: fullQuote.customerName,
      origin: fullQuote.origin,
      destination: fullQuote.destination,
      cargoType: fullQuote.cargoType,
      hsCode: fullQuote.hsCode,
      documentsStatus: fullQuote.documentsStatus,
      riskLevel: fullQuote.overallRisk === "LOW" ? "LOW" : "MEDIUM",
      riskScore: fullQuote.customsRiskScore,
      status: fullQuote.status === "APPROVED" || fullQuote.status === "SENT" ? "APPROVED" : "PENDING_REVIEW",
      assignedOfficer: "Officer Sharma",
      documents: fullQuote.documents,
    };
    const updatedCustoms = [csShipment, ...customsList.filter((s) => s.id !== csShipment.id && s.quoteNo !== csShipment.quoteNo)];
    localStorage.setItem("freightai_customs_shipments", JSON.stringify(updatedCustoms));
  } catch {}

  // Synchronize with agent quotes desk
  try {
    const savedAgent = localStorage.getItem("freightai_agent_quotes");
    const agentList = savedAgent ? JSON.parse(savedAgent) : [];
    const agentEntry = {
      id: fullQuote.quoteNo,
      client: fullQuote.customerName,
      clientEmail: fullQuote.customerEmail,
      origin: fullQuote.origin,
      destination: fullQuote.destination,
      mode: fullQuote.modeLabel,
      cargoClass: fullQuote.cargoType,
      weightKg: fullQuote.weightKg,
      baseRate: fullQuote.baseRate,
      marginPct: fullQuote.marginPct,
      fuelSurchargePct: 8,
      portFee: 15000,
      status: fullQuote.status,
      requestedDate: new Date().toISOString().slice(0, 10),
    };
    const updatedAgent = [agentEntry, ...agentList.filter((a) => a.id !== agentEntry.id)];
    localStorage.setItem("freightai_agent_quotes", JSON.stringify(updatedAgent));
  } catch {}

  return updatedList;
}

