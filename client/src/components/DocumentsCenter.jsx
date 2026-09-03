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
  const [documents, setDocuments] = useState(INITIAL_DOCUMENTS);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleSimulatedUpload = (e) => {
    e.preventDefault();
    const newDoc = {
      id: `doc-${Date.now()}`,
      name: "Uploaded_Customs_Declaration.pdf",
      type: "Customs Declaration",
      shipmentRef: "SHP-1001",
      route: "Chennai ➔ Rotterdam",
      uploadedAt: "Just now",
      size: "1.1 MB",
      status: "UNDER_REVIEW",
      verifiedBy: "AI Automated Scanner",
      notes: "Document parsed and routed to Customs Officer desk.",
    };
    setDocuments([newDoc, ...documents]);
    setUploadSuccess(true);
    setTimeout(() => setUploadSuccess(false), 4000);
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

        <button className="doc-upload-btn" onClick={handleSimulatedUpload}>
          <UploadCloud size={18} /> Upload Document
        </button>
      </div>

      {uploadSuccess && (
        <div className="doc-alert-success">
          <CheckCircle2 size={18} />
          <span>Document successfully uploaded and queued for automated OCR validation &amp; customs review.</span>
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
    </div>
  );
}
