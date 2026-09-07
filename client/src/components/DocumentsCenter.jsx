import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileText,
  UploadCloud,
  Download,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  Eye,
  FileCheck,
  Shield,
  Trash2,
  X,
  Upload,
  FileUp,
} from "lucide-react";
import { deleteShipmentDocument, listShipmentDocuments, uploadShipmentDocument } from "../api/workflow";
import { usePlatformQuotes } from "../hooks/usePlatformQuotes";
import { useAuth } from "../context/AuthContext";
import "./DocumentsCenter.css";

// INITIAL_DOCUMENTS used to seed this screen with invented shipments/documents so the
// UI looked populated before any real data existed. The screen now renders
// live platform records, so the fixture has been removed.


/**
 * Map a platform ShipmentDocument onto the row shape this vault renders.
 *
 * The vault previously assembled itself from three localStorage keys, so the
 * documents it listed existed only in the browser that uploaded them and the
 * customs officer could never open one.
 */
export function mapApiDocument(doc, quotesById = new Map()) {
  const quote = quotesById.get(doc.shipment_id);
  const uploadedAt = doc.uploaded_at ? new Date(doc.uploaded_at) : null;

  return {
    id: doc.id,
    name: doc.file_name,
    type: doc.document_type,
    fileName: doc.file_name,
    fileUrl: doc.file_url || "",
    shipmentRef: doc.shipment_id,
    route: quote ? `${quote.origin} ➔ ${quote.destination}` : "—",
    uploadedAt: uploadedAt
      ? uploadedAt.toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—",
    size: doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : "—",
    status: doc.verification_status === "VERIFIED" ? "VERIFIED" : doc.verification_status,
    verifiedBy: doc.verified_by || "Awaiting verification",
    notes: doc.rejection_reason || `Uploaded by ${doc.uploaded_by || "customer"}.`,
  };
}

export default function DocumentsCenter() {
  const { token, user } = useAuth();
  const { quotes } = usePlatformQuotes();
  const [documents, setDocuments] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [loadError, setLoadError] = useState("");
  const [uploading, setUploading] = useState(false);

  // Every shipment the caller can see, so their documents can be listed.
  const shipmentIds = useMemo(
    () => [...new Set(quotes.map((q) => q.shipmentId).filter(Boolean))],
    [quotes],
  );
  const quotesByShipment = useMemo(
    () => new Map(quotes.filter((q) => q.shipmentId).map((q) => [q.shipmentId, q])),
    [quotes],
  );

  const loadDocuments = useCallback(async () => {
    if (!token || !shipmentIds.length) {
      setDocuments([]);
      return;
    }
    try {
      setLoadError("");
      const batches = await Promise.all(
        shipmentIds.map((id) =>
          listShipmentDocuments(token, id)
            .then((d) => d.results || [])
            .catch(() => []),
        ),
      );
      setDocuments(batches.flat().map((d) => mapApiDocument(d, quotesByShipment)));
    } catch (err) {
      setLoadError(err.message || "Could not load documents.");
    }
  }, [token, shipmentIds, quotesByShipment]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Real Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState("");
  const [shipmentRef, setShipmentRef] = useState("SHP-1001");

  const shipmentRoutes = {
    "SHP-1001": "Chennai ➔ Rotterdam",
    "SHP-1002": "Mumbai ➔ Hamburg",
    "SHP-1003": "Nhava Sheva ➔ Jebel Ali",
    "SHP-1004": "Hyderabad ➔ New York JFK",
  };

  const handleOpenUploadModal = () => {
    setSelectedFile(null);
    setDocName("");
    setDocType("");
    setIsUploadModalOpen(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const [deletingDoc, setDeletingDoc] = useState(null);

  /**
   * Remove a document from the vault.
   *
   * This used to be a no-op alert because removal needs an audit trail the
   * platform did not expose. It does now, so the button actually works: the
   * server checks ownership, refuses to drop a customs-verified record, and
   * logs what was destroyed.
   */
  const handleDeleteDoc = async (docId) => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc || deletingDoc) return;

    const confirmed = window.confirm(
      `Remove "${doc.fileName}" from the vault?\n\n` +
        `Type: ${doc.type}\nShipment: ${doc.shipmentRef}\n\nThis cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingDoc(docId);
    setLoadError("");
    try {
      await deleteShipmentDocument(token, docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      setLoadError(
        err?.status === 403
          ? `You can only remove documents on your own shipments.`
          : err.message || `Could not remove "${doc.fileName}".`,
      );
    } finally {
      setDeletingDoc(null);
    }
  };

  /** Upload a real file against a shipment. */
  const handleConfirmUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile || uploading) return;

    if (!shipmentRef) {
      setLoadError("Choose which shipment this document belongs to.");
      return;
    }

    setUploading(true);
    setLoadError("");
    try {
      await uploadShipmentDocument(token, {
        shipmentId: shipmentRef,
        documentType: docType.trim() || docName.trim() || selectedFile.name,
        file: selectedFile,
        uploadedBy: user?.full_name || "Customer",
      });

      await loadDocuments();

      setSuccessMsg(
        `"${docName.trim() || selectedFile.name}" uploaded and queued for customs verification.`,
      );
      setUploadSuccess(true);
      setIsUploadModalOpen(false);
      setSelectedFile(null);
      setDocName("");
      setDocType("");
      setTimeout(() => setUploadSuccess(false), 6000);
    } catch (err) {
      setLoadError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const filteredDocs = documents.filter((doc) => {
    const docNameStr = (doc.name || doc.fileName || "").toLowerCase();
    const docRefStr = (doc.shipmentRef || "").toLowerCase();
    const docTypeStr = (doc.type || "").toLowerCase();
    const matchesSearch =
      docNameStr.includes(searchTerm.toLowerCase()) ||
      docRefStr.includes(searchTerm.toLowerCase()) ||
      docTypeStr.includes(searchTerm.toLowerCase());

    if (filterStatus === "verified") return matchesSearch && doc.status === "VERIFIED";
    if (filterStatus === "review") return matchesSearch && doc.status === "UNDER_REVIEW";
    if (filterStatus === "action") return matchesSearch && doc.status === "ACTION_REQUIRED";
    return matchesSearch;
  });

  return (
    <div className="doc-center">
      {/* Header */}
      <div className="doc-header">
        <div className="doc-title-wrap">
          <div className="doc-icon-badge">
            <FileText size={24} />
          </div>
          <div>
            <h1>Document Management &amp; Vault</h1>
            <p>Upload, verify, and manage customs paperwork, Bills of Lading, and trade certificates.</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {/* "Clear vault" and "Restore samples" are gone: documents are now
              server-side compliance records, not a local scratch list. */}
          <button className="doc-upload-btn" onClick={handleOpenUploadModal}>
            <UploadCloud size={18} /> Upload Document
          </button>
        </div>
      </div>

      {uploadSuccess && (
        <div className="doc-alert-success">
          <CheckCircle2 size={18} />
          <span>{successMsg || "Document successfully uploaded and queued for automated OCR validation & customs review."}</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="doc-controls">
        <div className="doc-search-wrap">
          <Search size={18} className="doc-search-icon" />
          <input
            type="text"
            placeholder="Search by filename, shipment ID, document type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="doc-search-input"
          />
        </div>

        <div className="doc-filter-buttons">
          <button
            className={`doc-filter-btn ${filterStatus === "all" ? "active" : ""}`}
            onClick={() => setFilterStatus("all")}
          >
            All ({documents.length})
          </button>
          <button
            className={`doc-filter-btn ${filterStatus === "verified" ? "active" : ""}`}
            onClick={() => setFilterStatus("verified")}
          >
            Verified ({documents.filter((d) => d.status === "VERIFIED").length})
          </button>
          <button
            className={`doc-filter-btn ${filterStatus === "review" ? "active" : ""}`}
            onClick={() => setFilterStatus("review")}
          >
            Under Review ({documents.filter((d) => d.status === "UNDER_REVIEW").length})
          </button>
          <button
            className={`doc-filter-btn ${filterStatus === "action" ? "active" : ""}`}
            onClick={() => setFilterStatus("action")}
          >
            Action Needed ({documents.filter((d) => d.status === "ACTION_REQUIRED").length})
          </button>
        </div>
      </div>

      {/* Document Cards / Table */}
      <div className="doc-table-card">
        <table className="doc-table">
          <thead>
            <tr>
              <th>Document Name &amp; Type</th>
              <th>Shipment Ref</th>
              <th>Route</th>
              <th>Uploaded</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocs.length === 0 ? (
              <tr>
                <td colSpan={6} className="doc-empty-cell">
                  No documents found in vault. Click "Upload Document" or "Restore Samples".
                </td>
              </tr>
            ) : (
              filteredDocs.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <div className="doc-name-cell">
                      <div className="doc-type-icon">
                        <FileText size={18} />
                      </div>
                      <div>
                        <div className="doc-filename">
                          {doc.name ? (
                            doc.name
                          ) : (
                            <span style={{ color: "#94a3b8", fontStyle: "italic" }}>
                              {doc.fileName || "(Empty Name)"}
                            </span>
                          )}
                        </div>
                        <div className="doc-category">
                          {doc.type ? (
                            `${doc.type} • `
                          ) : (
                            <span style={{ color: "#94a3b8", fontStyle: "italic" }}>
                              (Empty Type) •{" "}
                            </span>
                          )}
                          {doc.size}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="doc-shipment-pill">{doc.shipmentRef}</span>
                  </td>
                  <td>
                    <span className="doc-route-text">{doc.route}</span>
                  </td>
                  <td>
                    <span className="doc-date-text">{doc.uploadedAt}</span>
                  </td>
                  <td>
                    {doc.status === "VERIFIED" ? (
                      <span className="doc-status-badge status-verified">
                        <CheckCircle2 size={12} /> Verified
                      </span>
                    ) : doc.status === "ACTION_REQUIRED" ? (
                      <span className="doc-status-badge status-action">
                        <AlertTriangle size={12} /> Action Needed
                      </span>
                    ) : (
                      <span className="doc-status-badge status-review">
                        <Clock size={12} /> Under Review
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="doc-action-group">
                      <button
                        className="doc-icon-btn"
                        title="Download Document"
                        onClick={() => {
                          const url =
                            doc.fileDataUrl ||
                            (doc.fileName
                              ? `/sample_trade_documents/${doc.fileName}`
                              : "/sample_trade_documents/Bill_of_Lading_Draft_BL4810.pdf");
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = doc.fileName || `${doc.name || "document"}.pdf`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }}
                      >
                        <Download size={16} />
                      </button>
                      <button
                        className="doc-icon-btn"
                        style={{ color: "#ef4444" }}
                        title="Delete Document"
                        onClick={() => handleDeleteDoc(doc.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Real Upload Document Modal */}
      {isUploadModalOpen && (
        <div className="doc-modal-overlay" onClick={() => setIsUploadModalOpen(false)}>
          <div className="doc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="doc-modal-header">
              <div className="doc-modal-title">
                <UploadCloud size={22} className="doc-modal-icon" />
                <h3>Upload Document to Vault</h3>
              </div>
              <button
                className="doc-modal-close"
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setSelectedFile(null);
                  setDocName("");
                  setDocType("");
                }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmUpload} className="doc-modal-form">
              <div className="doc-field-group">
                <label className="doc-field-label">Document Name</label>
                <input
                  type="text"
                  className="doc-select-input"
                  placeholder="Leave empty or enter custom document name..."
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                />
              </div>

              <div className="doc-field-group">
                <label className="doc-field-label">Document Type</label>
                <select
                  className="doc-select-input"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                >
                  <option value="">-- Leave Empty or Select Document Type --</option>
                  <option value="Commercial Invoice">Commercial Invoice</option>
                  <option value="Bill of Lading Draft">Bill of Lading Draft</option>
                  <option value="Customs Declaration">Customs Declaration</option>
                  <option value="Packing List">Packing List</option>
                  <option value="Certificate of Origin">Certificate of Origin</option>
                  <option value="Safety Data Sheet (MSDS)">Safety Data Sheet (MSDS)</option>
                  <option value="Inspection Certificate">Inspection Certificate</option>
                  <option value="Other">Other Supporting Document</option>
                </select>
              </div>

              <div className="doc-field-group">
                <label className="doc-field-label">Shipment Reference *</label>
                <select
                  className="doc-select-input"
                  value={shipmentRef}
                  onChange={(e) => setShipmentRef(e.target.value)}
                >
                  <option value="SHP-1001">SHP-1001 (Chennai ➔ Rotterdam)</option>
                  <option value="SHP-1002">SHP-1002 (Mumbai ➔ Hamburg)</option>
                  <option value="SHP-1003">SHP-1003 (Nhava Sheva ➔ Jebel Ali)</option>
                  <option value="SHP-1004">SHP-1004 (Hyderabad ➔ New York JFK)</option>
                </select>
              </div>

              <div className="doc-field-group">
                <label className="doc-field-label">Select File to Upload *</label>
                <input
                  type="file"
                  id="vault-file-upload-input"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.csv"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
                <label htmlFor="vault-file-upload-input" className={`doc-dropzone ${selectedFile ? "has-file" : ""}`}>
                  {selectedFile ? (
                    <div className="doc-dropzone-selected">
                      <FileCheck size={36} color="#16a34a" />
                      <div className="doc-dropzone-fileinfo">
                        <span className="doc-dropzone-filename">{selectedFile.name}</span>
                        <span className="doc-dropzone-filesize">
                          {selectedFile.size > 1024 * 1024
                            ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`
                            : `${Math.round(selectedFile.size / 1024)} KB`}
                        </span>
                      </div>
                      <span className="doc-dropzone-change">Click to choose another file</span>
                    </div>
                  ) : (
                    <div className="doc-dropzone-prompt">
                      <FileUp size={36} color="#f97316" />
                      <div className="doc-dropzone-title">Click to select document from your computer</div>
                      <div className="doc-dropzone-sub">Supports PDF, DOCX, XLSX, PNG, JPG (Max 25 MB)</div>
                    </div>
                  )}
                </label>
                {!selectedFile && (
                  <p className="doc-file-hint-error">
                    * Please choose a document file from your computer before uploading.
                  </p>
                )}

                <div style={{ background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: "10px", padding: "10px 14px", fontSize: "12px", color: "#475569", marginTop: "4px" }}>
                  <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>
                    Need sample trade documents to verify?
                  </div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ color: "#64748b" }}>Download sample PDFs:</span>
                    <a href="/sample_trade_documents/Commercial_Invoice_INV2026.pdf" download style={{ color: "#0284c7", fontWeight: 700, textDecoration: "underline" }}>Commercial Invoice</a> &bull;
                    <a href="/sample_trade_documents/Packing_List_PL9921.pdf" download style={{ color: "#0284c7", fontWeight: 700, textDecoration: "underline" }}>Packing List</a> &bull;
                    <a href="/sample_trade_documents/Bill_of_Lading_Draft_BL4810.pdf" download style={{ color: "#0284c7", fontWeight: 700, textDecoration: "underline" }}>B/L Draft</a> &bull;
                    <a href="/sample_trade_documents/Certificate_of_Origin_COO2026.pdf" download style={{ color: "#0284c7", fontWeight: 700, textDecoration: "underline" }}>Certificate of Origin</a>
                  </div>
                </div>
              </div>

              <div className="doc-modal-footer">
                <button
                  type="button"
                  className="doc-btn-secondary"
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    setSelectedFile(null);
                    setDocName("");
                    setDocType("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="doc-btn-primary"
                  disabled={!selectedFile}
                >
                  <UploadCloud size={16} /> Upload to Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
