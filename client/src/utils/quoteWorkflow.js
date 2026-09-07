/**
 * Shared Quote Workflow & Lifecycle State
 *
 * Role Connection (PDF section 1):
 * Customer submits data -> AI services analyze it -> Freight Agent performs human
 * review -> Customs Officer participates when customs review is required ->
 * Freight Agent sends final quote -> Customer accepts/rejects -> Admin monitors.
 *
 * This module used to be a browser-local database: every portal read and wrote
 * `localStorage`, so a customer on one machine and a freight agent on another
 * never saw the same shipment, and the risk scores shown on the agent and admin
 * desks were hardcoded constants.
 *
 * It is now a thin cache over the platform API. The synchronous accessors are
 * kept so existing components continue to work, backed by a cache that
 * `refreshPlatformQuotes()` fills and that subscribers are notified about.
 */

import {
  approveQuote,
  decideOnQuote,
  listAllQuotes,
  listMyQuotes,
  modifyQuotePrice,
  rejectQuote,
  requestQuoteInfo,
  sendQuote,
} from "../api/workflow";

export const WORKFLOW_STAGES = [
  { id: "REQUESTED", label: "1. Requested", actor: "Customer", desc: "Shipment enquiry submitted by customer" },
  { id: "GENERATED", label: "2. Generated", actor: "AI Services", desc: "M1, M2 & M3 pricing and risk computed" },
  { id: "PENDING_REVIEW", label: "3. Pending Review", actor: "Customs / Agent", desc: "Customs document validation & operational check" },
  { id: "APPROVED", label: "4. Approved", actor: "Freight Agent", desc: "Commercial margin validated and approved" },
  { id: "SENT", label: "5. Sent", actor: "Freight Agent", desc: "Official final quote sent to customer" },
  { id: "ACCEPTED", label: "6. Decision", actor: "Customer", desc: "Customer accepts or rejects quote" },
];

export const STATUS_CONFIG = {
  DRAFT: { label: "DRAFT", badgeClass: "badge-draft", stepIndex: 1, color: "#64748b", bg: "#f1f5f9" },
  REQUESTED: { label: "REQUESTED", badgeClass: "badge-requested", stepIndex: 1, color: "#0284c7", bg: "#e0f2fe" },
  GENERATED: { label: "GENERATED", badgeClass: "badge-generated", stepIndex: 2, color: "#6366f1", bg: "#e0e7ff" },
  PENDING_REVIEW: { label: "PENDING_REVIEW", badgeClass: "badge-pending-review", stepIndex: 3, color: "#d97706", bg: "#fef3c7" },
  CUSTOMS_FLAGGED: { label: "CUSTOMS_FLAGGED", badgeClass: "badge-customs-flagged", stepIndex: 3, color: "#dc2626", bg: "#fee2e2" },
  APPROVED: { label: "APPROVED", badgeClass: "badge-approved", stepIndex: 4, color: "#7c3aed", bg: "#ede9fe" },
  SENT: { label: "SENT", badgeClass: "badge-sent", stepIndex: 5, color: "#0284c7", bg: "#dbeafe" },
  ACCEPTED: { label: "ACCEPTED", badgeClass: "badge-accepted", stepIndex: 6, color: "#059669", bg: "#ecfdf5" },
  REJECTED: { label: "REJECTED", badgeClass: "badge-rejected", stepIndex: 6, color: "#991b1b", bg: "#fef2f2" },
  EXPIRED: { label: "EXPIRED", badgeClass: "badge-expired", stepIndex: 6, color: "#64748b", bg: "#f1f5f9" },
};

/**
 * Canonical Shipment Status Flow (PDF section 10)
 * DRAFT -> SUBMITTED -> PROCESSING -> ANALYZED -> QUOTED -> CLOSED / CANCELLED
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

/** Standardize any legacy status string to the current workflow status. */
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

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

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

const CURRENCY_LOCALE = { USD: "en-US", INR: "en-IN", EUR: "de-DE", GBP: "en-GB" };

export function formatMoney(amount, currency = "USD") {
  const value = Number(amount || 0);
  try {
    return new Intl.NumberFormat(CURRENCY_LOCALE[currency] || "en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function riskLabel(score) {
  if (score === null || score === undefined) return "Not assessed";
  const value = Number(score);
  const band = value <= 30 ? "Low" : value <= 60 ? "Moderate" : value <= 80 ? "High" : "Critical";
  return `${band} (${value}/100)`;
}

/**
 * Map a server quote onto the shape the portal components render.
 *
 * Every risk and price value here comes from the API. Previously these were
 * literals baked into this file, so every quote showed the same scores.
 */
export function mapApiQuote(apiQuote) {
  const shipment = apiQuote.shipmentDetails || {};
  const analysis = apiQuote.analysis || null;
  const currency = apiQuote.currency || "USD";

  const origin = shipment.origin || "";
  const destination = shipment.destination || "";
  const mode = shipment.transportMode || shipment.transport_mode || "ocean";
  const total = Number(apiQuote.totalPrice ?? apiQuote.total_price ?? 0);

  // List endpoints omit the full orchestrator output and send `customsSummary`
  // instead. Reading only `analysis.customs` made every listed quote look like
  // it had no missing paperwork, so the customs queue showed "All documents on
  // file" for consignments with nothing uploaded at all.
  const customsAnalysis = analysis?.customs || apiQuote.customsSummary || null;
  const missingDocs = customsAnalysis?.missing_documents || [];
  const checklist = customsAnalysis?.checklist_items || [];

  return {
    id: apiQuote.id,
    quoteNo: apiQuote.id,
    shipmentId: apiQuote.shipmentId || apiQuote.shipment_id,
    customerId: apiQuote.customer_id,
    customerName: shipment.customer_email || apiQuote.customer_id || "Customer",
    customerEmail: shipment.customer_email || "",

    origin,
    destination,
    laneCode: analysis?.route
      ? `${analysis.route.origin_code}-${analysis.route.dest_code}`
      : `${origin} - ${destination}`,
    laneSub: `${origin} → ${destination}`,
    routePath: apiQuote.routePath || "",
    carrier: apiQuote.carrier || "",

    mode,
    modeLabel: MODE_LABELS[mode] || mode,
    cargoType: shipment.cargoType || shipment.cargo_type || "General Cargo",
    hsCode: shipment.hsCode || shipment.hs_code || "",
    weightKg: Number(shipment.weight || 0),
    volumeCbm: Number(shipment.volume || 0),
    containerType: shipment.containerType || shipment.container_type || "",
    basis: shipment.weight
      ? `${Number(shipment.weight).toLocaleString()} kg / ${shipment.volume} CBM`
      : "—",

    distanceKm: Number(apiQuote.distanceKm ?? apiQuote.distance ?? 0),
    transitDays: apiQuote.estimatedTransitDays,
    transit: apiQuote.estimatedTransitDays ? `${apiQuote.estimatedTransitDays} d` : "—",

    // ---- Pricing (PDF section 8) ----
    currency,
    ruleBasedPrice: Number(apiQuote.rulePrice ?? total),
    aiPredictedPrice: apiQuote.aiPredictedPrice ?? null,
    recommendedPrice: apiQuote.recommendedPrice ?? null,
    mlStatus: apiQuote.mlStatus || "UNAVAILABLE",
    pricingStrategy: apiQuote.pricing_strategy || "",
    baseRate: Number(apiQuote.basePrice ?? apiQuote.base_price ?? 0),
    fuelSurcharge: Number(apiQuote.fuelCharge ?? apiQuote.fuel_charge ?? 0),
    distanceCharge: Number(apiQuote.distanceCharge ?? apiQuote.distance_charge ?? 0),
    weightCharge: Number(apiQuote.weightCharge ?? apiQuote.weight_charge ?? 0),
    totalNum: total,
    totalFormatted: formatMoney(total, currency),
    originalTotal: apiQuote.original_total_price,

    // ---- Risk (PDF section 8) ----
    weatherRiskScore: apiQuote.weatherRisk,
    weatherRiskLevel: riskLabel(apiQuote.weatherRisk),
    customsRiskScore: apiQuote.customsRisk,
    customsRiskLevel: riskLabel(apiQuote.customsRisk),
    routeRiskScore: apiQuote.routeRisk,
    routeRiskLevel: riskLabel(apiQuote.routeRisk),
    overallRiskScore: apiQuote.overallRiskScore,
    overallRisk: apiQuote.overallRisk || "",
    policyAction: apiQuote.policy_action || "",
    requiresHumanReview: Boolean(apiQuote.requiresHumanReview),

    // ---- Review state ----
    status: normalizeWorkflowStatus(apiQuote.status),
    rawStatus: apiQuote.status,
    shipmentStatus: shipment.status || getShipmentStatusFromQuoteStatus(apiQuote.status),
    reviewedBy: apiQuote.reviewed_by || "",
    reviewReason: apiQuote.review_reason || "",
    agentRemarks: apiQuote.review_reason || apiQuote.admin_notes || "",
    customsRemarks: customsAnalysis?.advisory || "",
    requiresCustomsReview: Boolean(missingDocs.length) || customsAnalysis?.status !== "APPROVED",
    customsCheckId: customsAnalysis?.check_id || null,
    missingDocuments: missingDocs,

    documents: checklist.map((item) => ({
      name: item.item_name,
      status: item.status === "SATISFIED" ? "VERIFIED" : "PENDING",
      mandatory: item.mandatory,
      citation: item.citation || "",
    })),

    analysis,
    createdAt: apiQuote.created_at,
    created: apiQuote.created_at
      ? new Date(apiQuote.created_at).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "Today",
    ...getQuoteRouteData(apiQuote.id, apiQuote),

    // The server is the authority on the carrier and its agent. The spread
    // above reads this browser's localStorage, which holds only a preview
    // default for anyone who did not make the choice on this machine — that
    // is how the agent desk ended up showing "Maersk" for every quote.
    ...(apiQuote.assignedAgentEmail || apiQuote.selectedCarrier
      ? {
          selectedCarrier: apiQuote.selectedCarrier || apiQuote.carrier,
          assignedAgentEmail: apiQuote.assignedAgentEmail || "",
          assignedAgentName: apiQuote.assignedAgentName || "",
          carrierSelectedAt: apiQuote.carrierSelectedAt || null,
          routeConfirmed: true,
        }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Route Recommendations & Multi-Stage Approval Sequence Helpers
// ---------------------------------------------------------------------------

export function generateRouteOptions(quote) {
  const baseTotal = Number(
    quote?.totalNum ||
    quote?.total_price ||
    quote?.serverQuote?.totalPrice ||
    quote?.breakdown?.total ||
    282021
  );
  const transitBase = Number(
    quote?.transitDays ||
    quote?.estimatedTransitDays ||
    quote?.transit_days ||
    14
  );

  return [
    {
      id: "maersk",
      carrier: "Maersk",
      agentName: "Apex Global Logistics (Agent John)",
      agentEmail: "agent.apex@freightai.com",
      recommended: true,
      service: "MECL Service · weekly sailing",
      transitDays: transitBase,
      price: Math.round(baseTotal),
      transitScore: 0.92,
      costScore: 0.78,
      reliability: 0.94,
      congestion: 0.71,
      docFee: 3000,
      dwellDays: 2.5,
      co2Kg: 420,
    },
    {
      id: "cmacgm",
      carrier: "CMA CGM",
      agentName: "Pacific Ocean Forwarders (Agent Sarah)",
      agentEmail: "agent.pacific@freightai.com",
      recommended: false,
      service: "via Salalah · biweekly",
      transitDays: Math.max(transitBase - 2, 8),
      price: Math.round(baseTotal * 0.88),
      transitScore: 0.64,
      costScore: 0.95,
      reliability: 0.88,
      congestion: 0.66,
      docFee: 3000,
      dwellDays: 3.8,
      co2Kg: 490,
    },
    {
      id: "hapag",
      carrier: "Hapag-Lloyd",
      agentName: "Orient Marine Line (Agent David)",
      agentEmail: "agent.orient@freightai.com",
      recommended: false,
      service: "IMEX Service · fortnightly",
      transitDays: transitBase + 2,
      price: Math.round(baseTotal * 1.05),
      transitScore: 0.58,
      costScore: 0.70,
      reliability: 0.91,
      congestion: 0.71,
      docFee: 3000,
      dwellDays: 2.1,
      co2Kg: 405,
    },
  ];
}

export function getQuoteRouteData(quoteId, fallbackQuote = {}) {
  if (!quoteId) return {};
  try {
    const raw = localStorage.getItem(`freightai_carrier_selection_${quoteId}`);
    if (raw) {
      const data = JSON.parse(raw);
      // Records written before routeConfirmed existed carry no flag. A record
      // is only ever written by selectQuoteRoute or an approval step, so its
      // presence means the customer already got past carrier selection.
      // Without this, every pre-existing quote would drop out of My Quotes.
      if (data.routeConfirmed === undefined) data.routeConfirmed = true;
      // Synchronize sequence with workflow status
      const norm = normalizeWorkflowStatus(fallbackQuote.status || data.status);
      if (norm === "APPROVED") {
        data.approvalSequence = {
          ...data.approvalSequence,
          agentReview: "APPROVED",
        };
      } else if (norm === "SENT") {
        data.approvalSequence = {
          agentReview: "APPROVED",
          customsCheck: "APPROVED",
          customerAcceptance: data.approvalSequence?.customerAcceptance === "ACCEPTED" ? "ACCEPTED" : "ACTION_REQUIRED",
        };
      } else if (norm === "ACCEPTED") {
        data.approvalSequence = {
          agentReview: "APPROVED",
          customsCheck: "APPROVED",
          customerAcceptance: "ACCEPTED",
        };
      } else if (norm === "REJECTED") {
        data.approvalSequence = {
          ...data.approvalSequence,
          customerAcceptance: "REJECTED",
        };
      }
      return data;
    }
  } catch {}

  const routes = generateRouteOptions(fallbackQuote);
  const defaultOption = routes.find((r) => r.recommended) || routes[0];
  const norm = normalizeWorkflowStatus(fallbackQuote?.status);

  return {
    selectedRouteOption: defaultOption,
    selectedCarrier: defaultOption?.carrier || "Maersk",
    // No explicit pick has been persisted yet — this is only a preview default
    // shown while the customer is still on the Recommendations screen. My
    // Quotes uses this flag to decide whether the quote is ready to be listed.
    routeConfirmed: false,
    routeOptions: routes,
    approvalSequence: {
      agentReview: ["APPROVED", "SENT", "ACCEPTED"].includes(norm) ? "APPROVED" : "PENDING",
      customsCheck: ["SENT", "ACCEPTED"].includes(norm) ? "APPROVED" : "PENDING",
      customerAcceptance: norm === "ACCEPTED" ? "ACCEPTED" : norm === "SENT" ? "ACTION_REQUIRED" : "LOCKED",
    },
  };
}

export function saveQuoteRouteData(quoteId, data) {
  if (!quoteId) return;
  try {
    const existing = getQuoteRouteData(quoteId);
    const merged = { ...existing, ...data };
    localStorage.setItem(`freightai_carrier_selection_${quoteId}`, JSON.stringify(merged));

    // Update in-memory cache as well
    cache = cache.map((q) => {
      if (q.id === quoteId || q.quoteNo === quoteId) {
        return { ...q, ...merged };
      }
      return q;
    });
    notify();
    window.dispatchEvent(new CustomEvent("freightai_route_selection_updated", { detail: { quoteId, ...merged } }));
  } catch (err) {
    console.error("Failed to save quote route data:", err);
  }
}

export function selectQuoteRoute(quoteId, routeOption) {
  if (!quoteId || !routeOption) return;
  saveQuoteRouteData(quoteId, {
    selectedRouteOption: routeOption,
    selectedCarrier: routeOption.carrier,
    assignedAgentName: routeOption.agentName || `${routeOption.carrier} Operations Desk`,
    assignedAgentEmail: routeOption.agentEmail || "agent@freightai.com",
    indicativeTotal: routeOption.price,
    status: "PENDING_REVIEW",
    // Marks the quote -> route recommendation step as finished. Only once
    // this is true should the quote surface in the customer's My Quotes list.
    routeConfirmed: true,
  });
}

/** Has the customer picked a carrier on the Recommendations screen yet? */
export function isRouteConfirmed(quoteId, fallbackQuote) {
  return Boolean(getQuoteRouteData(quoteId, fallbackQuote)?.routeConfirmed);
}

export async function approveQuoteAgentStep(quoteId, reason = "Commercial tariff validated by Freight Agent.") {
  const data = getQuoteRouteData(quoteId);
  const nextSequence = {
    ...data.approvalSequence,
    agentReview: "APPROVED",
  };
  saveQuoteRouteData(quoteId, {
    approvalSequence: nextSequence,
    agentApprovalNote: reason,
  });

  try {
    await updateQuoteStatusInStore(quoteId, "APPROVED", { reason });
  } catch (err) {
    console.warn("API approve failed, local sequence updated:", err);
  }
}

export async function approveQuoteCustomsStep(quoteId, reason = "Customs inspection passed · Documents cleared.") {
  const data = getQuoteRouteData(quoteId);
  const nextSequence = {
    ...data.approvalSequence,
    customsCheck: "APPROVED",
    customerAcceptance: "ACTION_REQUIRED",
  };
  saveQuoteRouteData(quoteId, {
    approvalSequence: nextSequence,
    customsApprovalNote: reason,
  });

  try {
    await updateQuoteStatusInStore(quoteId, "SENT", { reason });
  } catch (err) {
    console.warn("API send failed, local sequence updated:", err);
  }
}

export async function acceptQuoteCustomerStep(quoteId, reason = "Accepted by customer.") {
  const data = getQuoteRouteData(quoteId);
  const nextSequence = {
    ...data.approvalSequence,
    customerAcceptance: "ACCEPTED",
  };
  saveQuoteRouteData(quoteId, {
    approvalSequence: nextSequence,
  });

  try {
    await updateQuoteStatusInStore(quoteId, "ACCEPTED", { reason });
  } catch (err) {
    console.warn("API accept failed, local sequence updated:", err);
  }
}

export async function rejectQuoteCustomerStep(quoteId, reason = "Declined by customer.") {
  const data = getQuoteRouteData(quoteId);
  const nextSequence = {
    ...data.approvalSequence,
    customerAcceptance: "REJECTED",
  };
  saveQuoteRouteData(quoteId, {
    approvalSequence: nextSequence,
  });

  try {
    await updateQuoteStatusInStore(quoteId, "REJECTED", { reason });
  } catch (err) {
    console.warn("API reject failed, local sequence updated:", err);
  }
}


let cache = [];
let lastError = null;
let loading = false;
const subscribers = new Set();

function notify() {
  subscribers.forEach((fn) => {
    try {
      fn(cache);
    } catch (err) {
      console.error("Workflow subscriber failed:", err);
    }
  });
}

function authToken() {
  try {
    return localStorage.getItem("freightai_token");
  } catch {
    return null;
  }
}

function currentRole() {
  try {
    const raw = localStorage.getItem("freightai_user");
    return raw ? (JSON.parse(raw).role || "").toLowerCase() : "";
  } catch {
    return "";
  }
}

const STAFF_ROLES = ["admin", "agent", "customs", "customs_officer"];

/** Synchronous read of the cached platform quotes. */
export function getPlatformQuotes() {
  return cache;
}

export function getWorkflowState() {
  return { quotes: cache, loading, error: lastError };
}

export function subscribeToPlatformQuotes(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

/**
 * Fetch the caller's quotes from the API and refresh the cache.
 *
 * Staff roles see every quote on the platform; a customer sees only their own.
 */
// Several portal components mount at once and each asks for a refresh; without
// this they fire the same request four times on every dashboard load.
let inFlight = null;

export async function refreshPlatformQuotes() {
  const token = authToken();
  if (!token) {
    cache = [];
    notify();
    return cache;
  }

  if (inFlight) return inFlight;

  loading = true;
  lastError = null;
  notify();

  inFlight = (async () => {
    try {
      const role = currentRole();
      const raw = STAFF_ROLES.includes(role)
        ? await listAllQuotes(token)
        : await listMyQuotes(token);

      const records = Array.isArray(raw) ? raw : raw?.results || [];
      cache = records.map(mapApiQuote);
      return cache;
    } catch (err) {
      // A rejected token means the session is over. Clearing localStorage is
      // not enough on its own: AuthContext holds the token in React state, so
      // the UI kept looking signed in while every list came back empty. The
      // event below lets it drop the session and bounce to the login page.
      if (err?.isAuthError) {
        lastError = "Your session has expired. Please sign in again.";
        cache = [];
        try {
          localStorage.removeItem("freightai_token");
          localStorage.removeItem("freightai_user");
        } catch {}
        try {
          window.dispatchEvent(new CustomEvent("freightai_session_expired"));
        } catch {}
      } else {
        lastError = err.message || "Unable to load quotes";
      }
      console.error("Failed to refresh platform quotes:", err);
      return cache;
    } finally {
      loading = false;
      inFlight = null;
      notify();
    }
  })();

  return inFlight;
}

/** Merge a single quote (e.g. straight after generation) into the cache. */
export function addOrUpdatePlatformQuote(apiQuote) {
  if (!apiQuote) return cache;
  const mapped = apiQuote.quoteNo && apiQuote.totalNum !== undefined ? apiQuote : mapApiQuote(apiQuote);
  cache = [mapped, ...cache.filter((q) => q.id !== mapped.id)];
  notify();
  return cache;
}

/**
 * Drive a quote to a new status through the API.
 *
 * Kept on the original signature so existing call sites do not change, but it
 * now performs the real workflow action and returns a promise.
 */
export async function updateQuoteStatusInStore(quoteId, newStatus, extraFields = {}) {
  const token = authToken();
  if (!token) throw new Error("You must be signed in to update a quote.");

  const target = normalizeWorkflowStatus(newStatus);
  const reason = extraFields.reason || extraFields.agentRemarks || extraFields.customsRemarks || "";

  switch (target) {
    case "APPROVED":
      await approveQuote(token, quoteId, reason);
      break;
    case "SENT":
      await sendQuote(token, quoteId, reason);
      break;
    case "REJECTED":
      await rejectQuote(token, quoteId, reason || "Rejected by reviewer.");
      break;
    case "ACCEPTED":
      await decideOnQuote(token, quoteId, "ACCEPTED", reason);
      break;
    case "PENDING_REVIEW":
    case "CUSTOMS_FLAGGED":
      await requestQuoteInfo(token, quoteId, reason || "Additional information required.");
      break;
    default:
      throw new Error(`Unsupported workflow transition to ${target}.`);
  }

  return refreshPlatformQuotes();
}

/** Change the commercial price. The reason is mandatory and is audited. */
export async function modifyQuoteInStore(quoteId, totalPrice, reason) {
  const token = authToken();
  if (!token) throw new Error("You must be signed in to modify a quote.");
  if (!reason) throw new Error("A reason is required when changing the quoted price.");

  await modifyQuotePrice(token, quoteId, totalPrice, reason);
  return refreshPlatformQuotes();
}

/** Customer accept/reject. */
export async function decideQuoteInStore(quoteId, decision, reason = "") {
  const token = authToken();
  if (!token) throw new Error("You must be signed in to respond to a quote.");

  await decideOnQuote(token, quoteId, decision, reason);
  return refreshPlatformQuotes();
}

/**
 * Retained for compatibility with the document vault UI, which still keeps a
 * local view of uploaded files. Server-side documents are the source of truth
 * and are read through api/workflow.js `listShipmentDocuments`.
 */
export function syncQuoteDocumentsToVault(quote, documents) {
  if (!quote || !Array.isArray(documents)) return;
  try {
    const qId = quote.quoteNo || quote.id;
    const routeStr =
      quote.laneCode || (quote.origin && quote.destination ? `${quote.origin} ➔ ${quote.destination}` : "");

    const saved = localStorage.getItem("freightai_vault_docs_v2");
    let vaultList = [];
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) vaultList = parsed;
    }

    documents.forEach((d) => {
      if (d.status !== "UPLOADED" && d.status !== "VERIFIED" && !d.fileName) return;

      const docId = `doc-${qId}-${d.name.replace(/[^a-zA-Z0-9]/g, "_")}`;
      const entry = {
        id: docId,
        name: d.fileName || `${d.name.replace(/\s+/g, "_")}.pdf`,
        type: d.name,
        fileName: d.fileName || `${d.name.replace(/\s+/g, "_")}.pdf`,
        shipmentRef: qId,
        route: routeStr,
        uploadedAt: d.uploadedAt || "Just now",
        size: d.fileSize || "—",
        status: d.status === "VERIFIED" ? "VERIFIED" : "UNDER_REVIEW",
        verifiedBy: d.status === "VERIFIED" ? quote.assignedOfficer || "Customs Officer" : "Pending verification",
        notes:
          d.status === "VERIFIED"
            ? `Verified and cleared for shipment ${qId}.`
            : `Uploaded for shipment ${qId}. Queued for Customs Officer verification.`,
      };

      const idx = vaultList.findIndex((v) => v.id === docId);
      if (idx >= 0) vaultList[idx] = { ...vaultList[idx], ...entry };
      else vaultList.unshift(entry);
    });

    localStorage.setItem("freightai_vault_docs_v2", JSON.stringify(vaultList));
    localStorage.removeItem("freightai_vault_cleared");
    window.dispatchEvent(new CustomEvent("freightai_vault_updated"));
  } catch (err) {
    console.error("Failed to sync quote documents to vault:", err);
  }
}
