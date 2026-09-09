// client/src/api/workflow.js
//
// The connected M1-M3 workflow: shipments, AI quote generation, freight-agent
// review, customer decisions, notifications, audit and agent telemetry.
//
// Everything the four portals share now goes through here rather than through
// browser localStorage, so a customer on one machine and an agent on another
// are looking at the same shipment.

import { API_BASE, apiRequest } from "./client";

// ---------------------------------------------------------------------------
// Shipments
// ---------------------------------------------------------------------------

export function createShipment(token, payload) {
  return apiRequest("/shipments", {
    method: "POST",
    token,
    body: {
      origin: payload.origin,
      destination: payload.destination,
      cargoType: payload.cargoType,
      weight: Number(payload.weightKg),
      volume: Number(payload.volumeCbm),
      transportMode: payload.transportMode,
      containerType: payload.containerType,
      hsCode: payload.hsCode,
    },
    timeoutMs: 15000,
  });
}

export function listShipments(token, { status, customerId } = {}) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (customerId) params.set("customer_id", customerId);
  const qs = params.toString();
  return apiRequest(`/shipments/my${qs ? `?${qs}` : ""}`, { token });
}

export function getShipment(token, shipmentId) {
  return apiRequest(`/shipments/${encodeURIComponent(shipmentId)}`, { token });
}

/**
 * Runs the whole AI pipeline for a shipment: route, rule price, ML price,
 * weather, customs, composite risk, then the quote engine.
 *
 * This is synchronous server-side and touches the ML model, so it is given a
 * generous timeout compared with ordinary reads.
 */
export function generateQuote(token, shipmentId) {
  return apiRequest(`/shipments/${encodeURIComponent(shipmentId)}/quote`, {
    method: "POST",
    token,
    body: {},
    timeoutMs: 60000,
  });
}

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

export function listMyQuotes(token) {
  return apiRequest("/quotes/my", { token });
}

export function getQuoteDetail(token, quoteId) {
  return apiRequest(`/quotes/${encodeURIComponent(quoteId)}`, { token });
}

/** Every quote on the platform. Freight agent, customs officer and admin only. */
export function listAllQuotes(token, { status, riskLevel, pendingReview } = {}) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (riskLevel) params.set("risk_level", riskLevel);
  if (pendingReview) params.set("pending_review", "1");
  const qs = params.toString();
  return apiRequest(`/admin/quotes${qs ? `?${qs}` : ""}`, { token });
}

/** Quotes sitting in the human-review queue. */
export function listApprovalQueue(token) {
  return apiRequest("/v1/quotes/approvals/queue", { token });
}

// -- Freight agent review actions (PDF section 3, step 10) ------------------

function reviewAction(token, quoteId, body) {
  return apiRequest(`/quotes/${encodeURIComponent(quoteId)}/review`, {
    method: "POST",
    token,
    body,
    timeoutMs: 15000,
  });
}

export function approveQuote(token, quoteId, reason = "") {
  return reviewAction(token, quoteId, { action: "approve", reason });
}

export function sendQuote(token, quoteId, reason = "") {
  return reviewAction(token, quoteId, { action: "send", reason });
}

/** Reason is mandatory — it is written to the quote and the audit trail. */
export function modifyQuotePrice(token, quoteId, totalPrice, reason) {
  return reviewAction(token, quoteId, {
    action: "modify",
    total_price: Number(totalPrice),
    reason,
  });
}

export function rejectQuote(token, quoteId, reason) {
  return reviewAction(token, quoteId, { action: "reject", reason });
}

export function requestQuoteInfo(token, quoteId, reason) {
  return reviewAction(token, quoteId, { action: "request_info", reason });
}

// -- Customer decision (PDF section 3, step 12) -----------------------------

/** M4: the company offers a customer compares for one quote. */
export function listCompanyQuotes(token, quoteId, { refresh = false } = {}) {
  return apiRequest(
    `/quotes/${encodeURIComponent(quoteId)}/company-quotes${refresh ? "?refresh=1" : ""}`,
    { token, timeoutMs: 20000 },
  );
}

/** Customer's closing step: lock a carrier and route the quote to its agent. */
export function selectQuoteCarrier(token, quoteId, { companyQuoteId, carrier, transitDays }) {
  return apiRequest(`/quotes/${encodeURIComponent(quoteId)}/select-carrier`, {
    method: "POST",
    token,
    // The servicing agent is resolved from company membership server-side. The
    // browser no longer names its own reviewer, which was spoofable.
    body: {
      company_quote_id: companyQuoteId,
      carrier,
      transit_days: transitDays,
    },
    timeoutMs: 15000,
  });
}

export function decideOnQuote(token, quoteId, decision, reason = "") {
  return apiRequest(`/quotes/${encodeURIComponent(quoteId)}/decision`, {
    method: "POST",
    token,
    body: { decision, reason },
    timeoutMs: 15000,
  });
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export function listNotifications(token, { unread, category, limit } = {}) {
  const params = new URLSearchParams();
  if (unread) params.set("unread", "1");
  if (category) params.set("category", category);
  if (limit) params.set("limit", String(limit));
  const qs = params.toString();
  return apiRequest(`/v1/notifications${qs ? `?${qs}` : ""}`, { token });
}

export function markNotificationRead(token, notificationId) {
  return apiRequest(`/v1/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: "POST",
    token,
    body: {},
  });
}

export function markAllNotificationsRead(token) {
  return apiRequest("/v1/notifications/read-all", { method: "POST", token, body: {} });
}

// ---------------------------------------------------------------------------
// Audit trail (Admin portal)
// ---------------------------------------------------------------------------

export function listAuditLogs(token, { entityType, entityId, action, actorRole, limit } = {}) {
  const params = new URLSearchParams();
  if (entityType) params.set("entity_type", entityType);
  if (entityId) params.set("entity_id", entityId);
  if (action) params.set("action", action);
  if (actorRole) params.set("actor_role", actorRole);
  if (limit) params.set("limit", String(limit));
  const qs = params.toString();
  return apiRequest(`/v1/audit/logs${qs ? `?${qs}` : ""}`, { token });
}

export function getAuditTrail(token, entityType, entityId) {
  return apiRequest(
    `/v1/audit/trail/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`,
    { token },
  );
}

// ---------------------------------------------------------------------------
// AI Orchestrator telemetry (Admin portal -> AI Agent Monitor)
// ---------------------------------------------------------------------------

export function getAgentMonitor(token) {
  return apiRequest("/v1/orchestrator/agents", { token });
}

export function listOrchestrationRuns(token, { shipmentId, limit } = {}) {
  const params = new URLSearchParams();
  if (shipmentId) params.set("shipment_id", shipmentId);
  if (limit) params.set("limit", String(limit));
  const qs = params.toString();
  return apiRequest(`/v1/orchestrator/runs${qs ? `?${qs}` : ""}`, { token });
}

export function analyzeShipment(token, shipmentId) {
  return apiRequest("/v1/orchestrator/analyze", {
    method: "POST",
    token,
    body: { shipment_id: shipmentId },
    timeoutMs: 60000,
  });
}

// ---------------------------------------------------------------------------
// Trade documents
// ---------------------------------------------------------------------------

export function listShipmentDocuments(token, shipmentId) {
  const qs = shipmentId ? `?shipment_id=${encodeURIComponent(shipmentId)}` : "";
  return apiRequest(`/v1/customs/documents/${qs}`, { token });
}

/**
 * Uploads the actual file. Uses fetch directly rather than apiRequest because
 * the body is multipart and must not carry a JSON Content-Type header.
 */
export async function uploadShipmentDocument(token, { shipmentId, documentType, file, uploadedBy }) {
  const form = new FormData();
  form.append("shipment_id", shipmentId);
  form.append("document_type", documentType);
  if (uploadedBy) form.append("uploaded_by", uploadedBy);
  form.append("file", file);

  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/v1/customs/documents/upload/`, {
    method: "POST",
    headers,
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.detail || "Document upload failed");
  }
  return data;
}

/** Remove an uploaded document from the vault. Audited server-side. */
export function deleteShipmentDocument(token, documentId, { force = false } = {}) {
  return apiRequest(
    `/v1/customs/documents/${encodeURIComponent(documentId)}${force ? "?force=1" : ""}`,
    { method: "DELETE", token, timeoutMs: 15000 },
  );
}

export function verifyShipmentDocument(token, documentId, { decision, officerName, remarks }) {
  return apiRequest(`/v1/customs/documents/${encodeURIComponent(documentId)}/verify/`, {
    method: "POST",
    token,
    body: { decision, officer_name: officerName, remarks },
  });
}

export function signOffCustomsCheck(token, checkId, { decision, officerName, comments }) {
  return apiRequest(`/v1/customs/${encodeURIComponent(checkId)}/sign-off/`, {
    method: "POST",
    token,
    body: { decision, officer_name: officerName, comments },
    timeoutMs: 15000,
  });
}

// ---------------------------------------------------------------------------
// M4: company verification, selections and bookings
// ---------------------------------------------------------------------------

/** The caller's company verification queue. Scoped server-side by membership. */
export function listVerificationRequests(token, { pending, status } = {}) {
  const params = new URLSearchParams();
  if (pending) params.set("pending", "1");
  if (status) params.set("status", status);
  const qs = params.toString();
  return apiRequest(`/verification-requests${qs ? `?${qs}` : ""}`, {
    token,
    timeoutMs: 20000,
  });
}

/** One request. Opening it starts the response clock server-side. */
export function getVerificationRequest(token, reference) {
  return apiRequest(`/verification-requests/${encodeURIComponent(reference)}`, {
    token,
    timeoutMs: 20000,
  });
}

/** Record one line of the nine-point verification checklist. */
export function submitVerificationCheck(token, reference, { area, result, remarks }) {
  return apiRequest(`/verification-requests/${encodeURIComponent(reference)}/checks`, {
    method: "POST",
    token,
    body: { area, result, remarks },
    timeoutMs: 15000,
  });
}

/** Approve, modify, reject, request info or escalate. Reason is mandatory. */
export function submitVerificationDecision(
  token,
  reference,
  { action, reason, revision, requestedInformation },
) {
  return apiRequest(`/verification-requests/${encodeURIComponent(reference)}/decision`, {
    method: "POST",
    token,
    body: {
      action,
      reason,
      revision,
      requested_information: requestedInformation,
    },
    timeoutMs: 20000,
  });
}

/** The customer's selections and where each one stands. */
export function listMySelections(token, { active } = {}) {
  return apiRequest(`/selections/my${active ? "?active=1" : ""}`, {
    token,
    timeoutMs: 20000,
  });
}

export function getSelection(token, reference) {
  return apiRequest(`/selections/${encodeURIComponent(reference)}`, {
    token,
    timeoutMs: 20000,
  });
}

/** Accept or decline a company's counter-offer. */
export function respondToRevision(token, reference, { decision, note }) {
  return apiRequest(
    `/selections/${encodeURIComponent(reference)}/revision-response`,
    { method: "POST", token, body: { decision, note }, timeoutMs: 20000 },
  );
}

/** Supply what the company asked for, sending the request back to them. */
export function provideSelectionInformation(token, reference, { note, provided }) {
  return apiRequest(`/selections/${encodeURIComponent(reference)}/information`, {
    method: "POST",
    token,
    body: { note, provided },
    timeoutMs: 20000,
  });
}

/** Bookings visible to the caller: their own, or their company's. */
export function listBookings(token, { status } = {}) {
  return apiRequest(`/bookings${status ? `?status=${encodeURIComponent(status)}` : ""}`, {
    token,
    timeoutMs: 20000,
  });
}

export function cancelBooking(token, reference, reason) {
  return apiRequest(`/bookings/${encodeURIComponent(reference)}/cancel`, {
    method: "POST",
    token,
    body: { reason },
    timeoutMs: 20000,
  });
}
