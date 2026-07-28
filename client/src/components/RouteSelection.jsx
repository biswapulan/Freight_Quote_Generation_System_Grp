function RouteSelection() {
  return (
    <section className="py-16">
      <div className="max-w-7xl mx-auto px-6">

        <h2 className="text-3xl font-bold text-center mb-10">
          Origin & Destination
        </h2>

        <div className="grid md:grid-cols-2 gap-6">

          <div className="bg-white shadow-lg rounded-xl p-6">
            <label className="font-semibold">From</label>
            <input
              type="text"
              value="MAA - Chennai, India"
              readOnly
              className="w-full mt-2 border p-3 rounded-lg"
            />
          </div>

          <div className="bg-white shadow-lg rounded-xl p-6">
            <label className="font-semibold">To</label>
            <input
              type="text"
              value="BOM - Mumbai, India"
              readOnly
              className="w-full mt-2 border p-3 rounded-lg"
            />
          </div>

        </div>

        <p className="text-center mt-6 text-blue-700 font-semibold">
          Haversine Air Route Distance: 1033 km | +12% Long Route Surcharge
        </p>

      </div>
    </section>
  );
}

export default RouteSelection;