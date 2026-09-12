import { useEffect, useState } from "react";
import { FileText, Loader2, ShieldCheck, X, XCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchShipmentDocumentFile } from "../api/workflow";
import "./DocumentViewer.css";

const WORDS = { VERIFIED: "verified", REJECTED: "rejected", PENDING: "awaiting review" };

/**
 * One uploaded trade document, open for a reviewer, with their verdict beside it.
 *
 * Verification is manual. The file is fetched through the API, which records
 * that this reviewer opened it, and Verify and Reject only work once it has
 * loaded, so nobody verifies a paper they have not seen.
 */
export default function DocumentViewer({
  document: doc,
  reviewerLabel,
  currentStatus,
  onDecide,
  onClose,
}) {
  const { token } = useAuth();
  const [url, setUrl] = useState(null);
  const [kind, setKind] = useState("");
  const [error, setError] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    setUrl(null);
    setError("");
    fetchShipmentDocumentFile(token, doc.id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setKind(blob.type || "");
        setUrl(objectUrl);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "The document could not be opened.");
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, doc.id]);

  async function decide(decision) {
    if (decision === "REJECTED" && !remarks.trim()) {
      setProblem("Say what is wrong with it. The customer reads this.");
      return;
    }
    setBusy(true);
    setProblem("");
    try {
      await onDecide(decision, remarks.trim());
      onClose();
    } catch (err) {
      setProblem(err.message || "Could not record that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dv-backdrop" onClick={onClose}>
      <div
        className="dv-modal"
        role="dialog"
        aria-label={`Review ${doc.documentType}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dv-head">
          <div>
            <strong>
              <FileText size={16} /> {doc.documentType}
            </strong>
            <span>
              {doc.fileName}
              {currentStatus ? ` · ${reviewerLabel}: ${WORDS[currentStatus] || currentStatus.toLowerCase()}` : ""}
            </span>
          </div>
          <button type="button" className="dv-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="dv-body">
          {error ? (
            <div className="dv-error">{error}</div>
          ) : !url ? (
            <div className="dv-loading">
              <Loader2 size={18} className="dv-spin" /> Opening the document…
            </div>
          ) : kind.startsWith("image/") ? (
            <img src={url} alt={doc.documentType} className="dv-image" />
          ) : (
            <iframe src={url} title={doc.documentType} className="dv-frame" />
          )}
        </div>

        {onDecide && (
          <div className="dv-decide">
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Remarks (required to reject; the customer reads them)"
            />
            {problem && <div className="dv-problem">{problem}</div>}
            <div className="dv-actions">
              {!url && !error && (
                <span className="dv-hint">Verify and Reject open up once the document has loaded.</span>
              )}
              <button
                type="button"
                className="dv-reject"
                disabled={!url || busy}
                onClick={() => decide("REJECTED")}
              >
                <XCircle size={15} /> Reject
              </button>
              <button
                type="button"
                className="dv-verify"
                disabled={!url || busy}
                onClick={() => decide("VERIFIED")}
              >
                <ShieldCheck size={15} /> Verify
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
