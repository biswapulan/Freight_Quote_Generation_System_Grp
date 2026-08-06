import { FaPlane, FaShip, FaTruck, FaTrain } from "react-icons/fa";

// Values here are the exact slugs the backend's pricing engine understands
// (see server/pricing/engine.py: VALID_MODES / DEFAULT_CARGO_MULTIPLIERS).
// Keeping the slug and the label together in one place avoids the two
// drifting apart as the form evolves.
const TRANSPORT_MODES = [
  { value: "air", label: "Air", icon: <FaPlane /> },
  { value: "ocean", label: "Ocean", icon: <FaShip /> },
  { value: "road", label: "Road", icon: <FaTruck /> },
  { value: "rail", label: "Rail", icon: <FaTrain /> },
];

const CARGO_TYPES = [
  { value: "general", label: "General Cargo" },
  { value: "express", label: "Express Cargo" },
  { value: "cold_chain", label: "Cold Chain" },
  { value: "hazardous", label: "Hazardous Cargo" },
];

export default function ShipmentForm({ values, onChange, onSubmit, loading, errorMsg }) {
  function update(field, value) {
    onChange({ ...values, [field]: value });
  }

  return (
    <section className="bg-gray-100 py-16 relative z-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="bg-[#0B1E3F] rounded-3xl shadow-2xl p-10">
          <h2 className="text-3xl text-white font-bold mb-8">
            Get Instant Freight Quote
          </h2>

          {/* Transport mode tabs */}
          <div className="flex flex-wrap gap-4 mb-8">
            {TRANSPORT_MODES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => update("mode", item.value)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl transition ${
                  values.mode === item.value
                    ? "bg-orange-500 text-white"
                    : "bg-white text-gray-700"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>

          <form
            onSubmit={onSubmit}
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            <input
              type="text"
              placeholder="Origin city (e.g. Mumbai)"
              className="p-4 rounded-xl outline-none"
              required
              value={values.origin}
              onChange={(e) => update("origin", e.target.value)}
            />

            <input
              type="text"
              placeholder="Destination city (e.g. Delhi)"
              className="p-4 rounded-xl outline-none"
              required
              value={values.destination}
              onChange={(e) => update("destination", e.target.value)}
            />

            <select
              className="p-4 rounded-xl outline-none"
              value={values.cargoType}
              onChange={(e) => update("cargoType", e.target.value)}
            >
              {CARGO_TYPES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Weight (KG)"
              className="p-4 rounded-xl outline-none"
              required
              value={values.weightKg}
              onChange={(e) => update("weightKg", e.target.value)}
            />

            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Volume (m³)"
              className="p-4 rounded-xl outline-none"
              required
              value={values.volumeM3}
              onChange={(e) => update("volumeM3", e.target.value)}
            />

            <button
              type="submit"
              disabled={loading}
              className="bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-xl font-bold text-lg lg:col-span-2"
            >
              {loading ? "Calculating..." : "Generate Quote"}
            </button>
          </form>

          {errorMsg && (
            <p className="text-red-400 font-medium mt-4">{errorMsg}</p>
          )}
        </div>
      </div>
    </section>
  );
}
