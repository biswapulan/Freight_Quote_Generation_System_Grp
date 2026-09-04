import React, { useState } from "react";
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
import "./DocumentsCenter.css";

const INITIAL_DOCUMENTS = [
  {
    id: "doc-1",
    name: "Commercial_Invoice_INV-2026-88.pdf",
    type: "Commercial Invoice",
    shipmentRef: "SHP-1001",
    route: "Chennai ➔ Rotterdam",
    uploadedAt: "Today, 14:20",
    size: "1.4 MB",
    status: "VERIFIED",
    verifiedBy: "Customs Officer Sharma",
    notes: "HS Code 8517.12 declaration matched with manufacturer packing specs.",
  },
  {
    id: "doc-2",
    name: "Bill_of_Lading_Draft_MAEU9921.pdf",
    type: "Bill of Lading Draft",
    shipmentRef: "SHP-1001",
    route: "Chennai ➔ Rotterdam",
    uploadedAt: "Today, 11:05",
    size: "840 KB",
    status: "VERIFIED",
    verifiedBy: "Maersk Carrier EDI",
    notes: "Original maritime draft approved for vessel CMA CGM Voltaire.",
  },
  {
    id: "doc-3",
    name: "CE_Certificate_Conformity_EU.pdf",
    type: "CE Certificate",
    shipmentRef: "SHP-1001",
    route: "Chennai ➔ Rotterdam",
    uploadedAt: "Yesterday",
    size: "2.1 MB",
    status: "VERIFIED",
    verifiedBy: "Customs Officer Sharma",
    notes: "EU Directives 2014/53/EU compliant for electronics consignments.",
  },
  {
    id: "doc-4",
    name: "Safety_Data_Sheet_MSDS_Chem.pdf",
    type: "Safety Data Sheet (MSDS)",
    shipmentRef: "SHP-1002",
    route: "Mumbai ➔ Hamburg",
    uploadedAt: "2 days ago",
    size: "3.2 MB",
    status: "ACTION_REQUIRED",
    verifiedBy: "Pending Verification",
    notes: "Section 14 Transport Information requires revised UN number flashpoint.",
  },
  {
    id: "doc-5",
    name: "Certificate_of_Origin_Textiles.pdf",
    type: "Certificate of Origin",
    shipmentRef: "SHP-1003",
    route: "Nhava Sheva ➔ Jebel Ali",
    uploadedAt: "3 days ago",
    size: "950 KB",
    status: "UNDER_REVIEW",
    verifiedBy: "Chamber of Commerce",
    notes: "Awaiting digital stamp from export authority.",
  },
];

export default function DocumentsCenter() {
  const [documents, setDocuments] = useState(() => {
    try {
      const saved = localStorage.getItem("freightai_vault_docs_v2");
      if (saved) {
        const parsed = JSON.parse(saved);
        const cleaned = parsed.filter((d) => d.name !== "Uploaded_Customs_Declaration.pdf");
        localStorage.setItem("freightai_vault_docs_v2", JSON.stringify(cleaned));
        return cleaned;
      }
      return INITIAL_DOCUMENTS;
    } catch {
      return INITIAL_DOCUMENTS;
    }
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Real Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [docType, setDocType] = useState("Customs Declaration");
  const [shipmentRef, setShipmentRef] = useState("SHP-1001");

  const shipmentRoutes = {
    "SHP-1001": "Chennai ➔ Rotterdam",
    "SHP-1002": "Mumbai ➔ Hamburg",
    "SHP-1003": "Nhava Sheva ➔ Jebel Ali",
    "SHP-1004": "Hyderabad ➔ New York JFK",
  };

  const handleOpenUploadModal = () => {
    setSelectedFile(null);
    setIsUploadModalOpen(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleConfirmUpload = (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    const sizeFormatted = selectedFile.size > 1024 * 1024
      ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(selectedFile.size / 1024)} KB`;

    const newDoc = {
      id: `doc-${Date.now()}`,
      name: selectedFile.name,
      type: docType,
      shipmentRef: shipmentRef,
      route: shipmentRoutes[shipmentRef] || "Chennai ➔ Rotterdam",
      uploadedAt: "Just now",
      size: sizeFormatted,
      status: "UNDER_REVIEW",
      verifiedBy: "AI Automated OCR Scanner",
      notes: `Uploaded by user (${selectedFile.name}). Queued for OCR validation & Customs Officer verification.`,
    };

    const updated = [newDoc, ...documents];
    setDocuments(updated);
    try {
      localStorage.setItem("freightai_vault_docs_v2", JSON.stringify(updated));
    } catch {}

    setSuccessMsg(`"${selectedFile.name}" successfully uploaded and queued for automated OCR validation & customs review.`);
    setUploadSuccess(true);
    setIsUploadModalOpen(false);
    setSelectedFile(null);
    setTimeout(() => setUploadSuccess(false), 6000);
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.shipmentRef.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.type.toLowerCase().includes(searchTerm.toLowerCase());

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

        <button className="doc-upload-btn" onClick={handleOpenUploadModal}>
          <UploadCloud size={18} /> Upload Document
        </button>
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
                  No documents found matching the filter criteria.
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
                        <div className="doc-filename">{doc.name}</div>
                        <div className="doc-category">{doc.type} • {doc.size}</div>
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
                        onClick={() => alert(`Downloading ${doc.name}`)}
                      >
                        <Download size={16} />
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
                }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmUpload} className="doc-modal-form">
              <div className="doc-field-group">
                <label className="doc-field-label">Document Type *</label>
                <select
                  className="doc-select-input"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                >
                  <option value="Customs Declaration">Customs Declaration</option>
                  <option value="Commercial Invoice">Commercial Invoice</option>
                  <option value="Bill of Lading Draft">Bill of Lading Draft</option>
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
              </div>

              <div className="doc-modal-footer">
                <button
                  type="button"
                  className="doc-btn-secondary"
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    setSelectedFile(null);
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
