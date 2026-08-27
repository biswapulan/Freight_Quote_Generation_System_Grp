// client/src/api/customs.js
import { apiRequest } from "./client";

export async function validateCustomsCompliance({
  shipment_id,
  origin_country,
  destination_country,
  hs_code,
  commodity = "General Cargo",
  incoterm = "FOB",
  token,
}) {
  return apiRequest("/v1/customs/validate/", {
    method: "POST",
    token,
    body: {
      shipment_id,
      origin_country,
      destination_country,
      hs_code,
      commodity,
      incoterm,
    },
    timeoutMs: 8000,
  });
}

export async function signOffCustoms({
  check_id,
  decision,
  officer_name,
  comments = "",
  token,
}) {
  return apiRequest(`/v1/customs/${encodeURIComponent(check_id)}/sign-off/`, {
    method: "POST",
    token,
    body: {
      decision,
      officer_name,
      comments,
    },
    timeoutMs: 5000,
  });
}

export async function uploadCustomsDocument({
  shipment_id,
  checklist_item_id,
  document_type,
  file_name,
  file_url,
  uploaded_by = "Shipping Agent",
  token,
}) {
  return apiRequest("/v1/customs/documents/upload/", {
    method: "POST",
    token,
    body: {
      shipment_id,
      checklist_item_id,
      document_type,
      file_name,
      file_url,
      uploaded_by,
    },
    timeoutMs: 6000,
  });
}

export async function searchRegulations({
  query,
  country = "",
  hs_code = "",
  top_k = 5,
  token,
}) {
  return apiRequest("/v1/regulations/search/", {
    method: "POST",
    token,
    body: {
      query,
      country,
      hs_code,
      top_k,
    },
    timeoutMs: 6000,
  });
}

export async function getHSCodes(token) {
  return apiRequest("/v1/customs/hs-codes/", {
    method: "GET",
    token,
    timeoutMs: 5000,
  });
}
