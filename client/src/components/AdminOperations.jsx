import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Package, FileText, AlertTriangle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { listAllQuotes, listBookings } from "../api/workflow";
import "./AdminOperations.css";

function statusLabel(value) {
  return String(value || "UNKNOWN").replaceAll("_", " ");
}

function shipmentFromQuote(quote) {
  return quote.shipmentDetails || quote.shipment || {};
}

export default function AdminOperations({ view = "quotes" }) {
  const { token } = useAuth();
  const [quotes, setQuotes] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [quoteData, bookingData] = await Promise.all([
        listAllQuotes(token),
        listBookings(token),
      ]);
      setQuotes(Array.isArray(quoteData) ? quoteData : quoteData?.results || []);
      setBookings(bookingData?.results || []);
    } catch (err) {
      setError(err.message || "Could not load platform operations data.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const title = view === "shipments" ? "All Shipments" : "All Quotes";
  const subtitle = view === "shipments"
    ? "Platform-wide shipment and booking visibility across M1-M4."
    : "Platform-wide quote, pricing, risk, and workflow visibility across M1-M3.\n";

  return (
    <section className="admin-operations">
      <header className="admin-operations-header">
        <div>
          <p className="admin-operations-eyebrow">Administrator operations</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="admin-operations-refresh">
          <RefreshCw size={15} className={loading ? "admin-operations-spin" : ""} /> Refresh
        </button>
      </header>

      {error && <div className="admin-operations-error"><AlertTriangle size={16} /> {error}</div>}

      <div className="admin-operations-kpis">
        <div><FileText size={18} /><strong>{quotes.length}</strong><span>Platform quotes</span></div>
        <div><Package size={18} /><strong>{new Set(quotes.map((q) => q.shipmentId || q.shipment_id)).size}</strong><span>Shipments with quotes</span></div>
        <div><Package size={18} /><strong>{bookings.length}</strong><span>Confirmed bookings</span></div>
      </div>

      {loading ? (
        <div className="admin-operations-empty">Loading platform data...</div>
      ) : view === "shipments" ? (
        <ShipmentTable bookings={bookings} quotes={quotes} />
      ) : (
        <QuoteTable quotes={quotes} />
      )}
    </section>
  );
}

function QuoteTable({ quotes }) {
  if (!quotes.length) return <div className="admin-operations-empty">No platform quotes found.</div>;
  return (
    <div className="admin-operations-table-wrap">
      <table className="admin-operations-table">
        <thead><tr><th>Quote</th><th>Customer</th><th>Route</th><th>Price</th><th>Risk</th><th>Status</th></tr></thead>
        <tbody>{quotes.map((quote) => {
          const shipment = shipmentFromQuote(quote);
          return (
            <tr key={quote.id}>
              <td><strong>{quote.id}</strong><small>{quote.shipmentId || quote.shipment_id || "—"}</small></td>
              <td>{shipment.customer_email || quote.customer_email || quote.customer_id || "—"}</td>
              <td>{shipment.origin || "—"} &rarr; {shipment.destination || "—"}</td>
              <td>{quote.currency || ""} {Number(quote.totalPrice ?? quote.total_price ?? 0).toLocaleString()}</td>
              <td>{quote.overallRisk || quote.overall_risk_level || "Not assessed"}</td>
              <td><span className="admin-operations-status">{statusLabel(quote.status)}</span></td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

function ShipmentTable({ bookings, quotes }) {
  const rows = bookings.length
    ? bookings
    : quotes.map((quote) => ({
      reference: quote.shipmentId || quote.shipment_id || quote.id,
      status: quote.status,
      shipment: shipmentFromQuote(quote),
      company: { name: quote.selectedCarrier || quote.company || "Awaiting company" },
    }));
  if (!rows.length) return <div className="admin-operations-empty">No platform shipments found.</div>;
  return (
    <div className="admin-operations-table-wrap">
      <table className="admin-operations-table">
        <thead><tr><th>Reference</th><th>Customer</th><th>Route</th><th>Company</th><th>Status</th></tr></thead>
        <tbody>{rows.map((row) => {
          const shipment = row.shipment || {};
          const origin = row.origin || shipment.origin;
          const destination = row.destination || shipment.destination;
          return (
            <tr key={row.reference}>
              <td><strong>{row.reference}</strong></td>
              <td>{row.customer_email || row.customerEmail || shipment.customer_email || row.customer_id || "—"}</td>
              <td>{origin || "—"} &rarr; {destination || "—"}</td>
              <td>{row.company?.name || row.companyName || "—"}</td>
              <td><span className="admin-operations-status">{statusLabel(row.status)}</span></td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}