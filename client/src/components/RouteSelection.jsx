function RouteSelection() {
  return (
    <section className="py-12 bg-white">
      <div className="max-w-6xl mx-auto px-6">

        <h2 className="text-3xl font-bold text-center text-black mb-8">
          Origin & Destination
        </h2>

        <div className="grid md:grid-cols-2 gap-6">

          <div>
            <label className="block font-semibold mb-2">Origin</label>
            <input
              type="text"
              placeholder="Enter Origin"
              className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div>
            <label className="block font-semibold mb-2">Destination</label>
            <input
              type="text"
              placeholder="Enter Destination"
              className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

        </div>

      </div>
    </section>
  );
}

export default RouteSelection;