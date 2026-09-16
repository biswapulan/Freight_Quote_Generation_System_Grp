import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Package, FileText, AlertTriangle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { listAllQuotes, listBookings } from "../api/workflow";
import ListFilterBar from "./ListFilterBar";
import { filterRows, optionsFrom } from "../utils/listFilters";
import "./AdminOperations.css";

function statusLabel(value) {
  return String(value || "UNKNOWN").replaceAll("_", " ");
}

function shipmentFromQuote(quote) {
  return quote.shipmentDetails || quote.shipment || {};
}

/** The lane a row is on, as both tables print it. */
function rowLane(row) {
  const shipment = row.shipment || shipmentFromQuote(row);
  const origin = row.origin || shipment.origin || "";
  const destination = row.destination || shipment.destination || "";
  if (!origin && !destination) return "";
  return `${origin || "—"} → ${destination || "—"}`;
}

/** The customer account on a row, from whichever field carries it. */
function rowCustomer(row) {
  const shipment = row.shipment || shipmentFromQuote(row);
  return row.customer_email || row.customerEmail || shipment.customer_email || row.customer_id || "";
}

// What each table prints, which is what its search reads.
const QUOTE_SEARCH_FIELDS = [
  "id",
  (q) => q.shipmentId || q.shipment_id,
  (q) => rowCustomer(q),
  (q) => shipmentFromQuote(q).origin,
  (q) => shipmentFromQuote(q).destination,
  (q) => q.overallRisk || q.overall_risk_level,
  "status",
];

const SHIPMENT_SEARCH_FIELDS = [
  "reference",
  (row) => rowCustomer(row),
  (row) => row.company?.name || row.companyName,
  (row) => (row.shipment || {}).origin,
  (row) => (row.shipment || {}).destination,
  "status",
];

export default function AdminOperations({ view = "quotes" }) {
  const { token } = useAuth();
  const [quotes, setQuotes] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [listFilters, setListFilters] = useState({});

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

  /**
   * The shipment rows, decided before anything is filtered.
   *
   * A booking is the shipment once one exists; before that the row is derived
   * from its quote. That choice has to be made on the whole list, otherwise
   * filtering every booking away would silently swap in quote rows instead of
   * honestly reporting no match.
   */
  const shipmentRows = useMemo(
    () =>
      bookings.length
        ? bookings
        : quotes.map((quote) => ({
            reference: quote.shipmentId || quote.shipment_id || quote.id,
            status: quote.status,
            shipment: shipmentFromQuote(quote),
            company: { name: quote.selectedCarrier || quote.company || "Awaiting company" },
          })),
    [bookings, quotes],
  );

  const setListFilter = (key, value) => setListFilters((prev) => ({ ...prev, [key]: value }));
  const clearListFilters = () => {
    setSearch("");
    setListFilters({});
  };

  // One set of dropdowns serves whichever table is on screen; the other's
  // values are never set, so they exclude nothing.
  const listFilterSpecs = useCallback(
    () => [
      { value: listFilters.status, matches: (row, status) => row.status === status },
      { value: listFilters.lane, matches: (row, lane) => rowLane(row) === lane },
      {
        value: listFilters.risk,
        matches: (row, risk) => (row.overallRisk || row.overall_risk_level || "") === risk,
      },
    ],
    [listFilters],
  );

  const visibleQuotes = useMemo(
    () => filterRows(quotes, { search, fields: QUOTE_SEARCH_FIELDS, filters: listFilterSpecs() }),
    [quotes, search, listFilterSpecs],
  );
  const visibleShipmentRows = useMemo(
    () =>
      filterRows(shipmentRows, {
        search,
        fields: SHIPMENT_SEARCH_FIELDS,
        filters: listFilterSpecs(),
      }),
    [shipmentRows, search, listFilterSpecs],
  );

  const laneOptions = useMemo(
    () =>
      view === "shipments"
        ? optionsFrom(shipmentRows, rowLane)
        : optionsFrom(quotes, (q) => rowLane(q)),
    [quotes, shipmentRows, view],
  );
  const statusOptions = useMemo(
    () =>
      optionsFrom(
        view === "shipments" ? shipmentRows : quotes,
        (row) => row.status,
        (status) => statusLabel(status),
      ),
    [quotes, shipmentRows, view],
  );
  const riskOptions = useMemo(
    () =>
      view === "shipments"
        ? []
        : optionsFrom(quotes, (q) => q.overallRisk || q.overall_risk_level, (risk) => String(risk)),
    [quotes, view],
  );

  const visibleCount = view === "shipments" ? visibleShipmentRows.length : visibleQuotes.length;
  const narrowed =
    Boolean(search.trim()) ||
    Object.values(listFilters).some((value) => value && value !== "all");

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
      ) : (
        <>
          <ListFilterBar
            search={search}
            onSearch={setSearch}
            searchLabel={view === "shipments" ? "Search platform shipments" : "Search platform quotes"}
            searchPlaceholder={
              view === "shipments"
                ? "Reference, customer, company, lane..."
                : "Quote, shipment, customer, lane..."
            }
            filters={[
              {
                key: "status",
                label: "All statuses",
                ariaLabel: "Filter by status",
                value: listFilters.status || "all",
                options: statusOptions,
              },
              {
                key: "lane",
                label: "All lanes",
                ariaLabel: "Filter by lane",
                value: listFilters.lane || "all",
                options: laneOptions,
              },
              ...(view === "shipments"
                ? []
                : [
                    {
                      key: "risk",
                      label: "All risk levels",
                      ariaLabel: "Filter by risk level",
                      value: listFilters.risk || "all",
                      options: riskOptions,
                    },
                  ]),
            ]}
            onFilterChange={setListFilter}
            onClear={clearListFilters}
            resultCount={visibleCount}
            resultNoun={view === "shipments" ? "shipments" : "quotes"}
          />

          {view === "shipments" ? (
            <ShipmentTable
              rows={visibleShipmentRows}
              emptyLabel={
                narrowed ? "No shipments match your search." : "No platform shipments found."
              }
            />
          ) : (
            <QuoteTable
              rows={visibleQuotes}
              emptyLabel={narrowed ? "No quotes match your search." : "No platform quotes found."}
            />
          )}
        </>
      )}
    </section>
  );
}

function QuoteTable({ rows, emptyLabel }) {
  if (!rows.length)
    return <div className="admin-operations-empty">{emptyLabel || "No platform quotes found."}</div>;
  return (
    <div className="admin-operations-table-wrap">
      <table className="admin-operations-table">
        <thead><tr><th>Quote</th><th>Customer</th><th>Route</th><th>Price</th><th>Risk</th><th>Status</th></tr></thead>
        <tbody>{rows.map((quote) => {
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

function ShipmentTable({ rows, emptyLabel }) {
  if (!rows.length)
    return (
      <div className="admin-operations-empty">
        {emptyLabel || "No platform shipments found."}
      </div>
    );
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