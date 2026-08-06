import {
  FaMoneyBillWave,
  FaClock,
  FaRoute,
  FaWeightHanging,
  FaCheckCircle,
} from "react-icons/fa";

const MODE_LABELS = { air: "Air Freight", ocean: "Ocean Freight", road: "Road", rail: "Rail" };
const CARGO_LABELS = {
  general: "General Cargo",
  express: "Express Cargo",
  cold_chain: "Cold Chain",
  hazardous: "Hazardous Cargo",
};

export default function QuoteResult({ quote, onConfirm, confirming }) {
  if (!quote) return null;

  const { breakdown } = quote;

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-800">
            Freight Quote Result
          </h2>
          <p className="text-gray-500 mt-3">
            Rule-based estimate generated from your shipment details.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-10">
          <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-8">
            <div className="bg-blue-50 rounded-2xl p-6 text-center">
              <FaMoneyBillWave className="text-4xl text-blue-600 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-700">Estimated Price</h3>
              <p className="text-3xl font-bold mt-2 text-blue-700">
                {quote.currency} {breakdown.total.toLocaleString()}
              </p>
            </div>

            <div className="bg-green-50 rounded-2xl p-6 text-center">
              <FaClock className="text-4xl text-green-600 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-700">Transit Time</h3>
              <p className="text-3xl font-bold mt-2 text-green-700">
                {quote.transit_days} Day{quote.transit_days === 1 ? "" : "s"}
              </p>
            </div>

            <div className="bg-orange-50 rounded-2xl p-6 text-center">
              <FaRoute className="text-4xl text-orange-500 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-700">Distance</h3>
              <p className="text-3xl font-bold mt-2 text-orange-600">
                {quote.distance_km.toLocaleString()} KM
              </p>
            </div>

            <div className="bg-purple-50 rounded-2xl p-6 text-center">
              <FaWeightHanging className="text-4xl text-purple-600 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-700">Chargeable Weight</h3>
              <p className="text-3xl font-bold mt-2 text-purple-700">
                {quote.chargeable_weight_kg.toLocaleString()} kg
              </p>
            </div>
          </div>

          <div className="mt-10 border-t pt-8">
            <h3 className="text-2xl font-bold mb-6">Shipment Summary</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-center gap-3">
                <FaCheckCircle className="text-green-600" />
                Origin : {quote.origin}
              </div>
              <div className="flex items-center gap-3">
                <FaCheckCircle className="text-green-600" />
                Destination : {quote.destination}
              </div>
              <div className="flex items-center gap-3">
                <FaCheckCircle className="text-green-600" />
                Transport : {MODE_LABELS[quote.mode] || quote.mode}
              </div>
              <div className="flex items-center gap-3">
                <FaCheckCircle className="text-green-600" />
                Cargo : {CARGO_LABELS[quote.cargo_type] || quote.cargo_type}
              </div>
            </div>
          </div>

          <div className="mt-10 border-t pt-8">
            <h3 className="text-2xl font-bold mb-6">Cost Breakdown</h3>
            <div className="divide-y">
              <BreakdownRow label="Base handling fee" value={breakdown.base_handling_fee} currency={quote.currency} />
              <BreakdownRow label="Distance & weight cost" value={breakdown.distance_cost} currency={quote.currency} />
              <BreakdownRow label="Cargo type charge" value={breakdown.cargo_charge} currency={quote.currency} />
              <BreakdownRow label="Fuel surcharge" value={breakdown.fuel_surcharge} currency={quote.currency} />
              <BreakdownRow label="Total" value={breakdown.total} currency={quote.currency} bold />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 mt-12">
            <span
              className={`px-4 py-2 rounded-full text-sm font-semibold ${
                quote.status === "confirmed"
                  ? "bg-green-100 text-green-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              Status: {quote.status}
            </span>

            {quote.status === "draft" && (
              <button
                onClick={onConfirm}
                disabled={confirming}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-8 py-3 rounded-xl"
              >
                {confirming ? "Confirming..." : "Confirm Quote"}
              </button>
            )}

            <span className="text-sm text-gray-500">
              Valid until {new Date(quote.expires_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function BreakdownRow({ label, value, currency, bold }) {
  return (
    <div className={`flex justify-between py-3 ${bold ? "font-bold text-lg" : "text-gray-700"}`}>
      <span>{label}</span>
      <span>
        {currency} {value.toLocaleString()}
      </span>
    </div>
  );
}
