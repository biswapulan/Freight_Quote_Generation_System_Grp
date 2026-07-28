function TransportModes() {
  return (
    <section className="py-16 bg-gray-100">
      <div className="max-w-7xl mx-auto px-6">

        <h2 className="text-3xl font-bold text-center mb-10">
          Select Transport Mode
        </h2>

        <div className="grid md:grid-cols-4 gap-6">

          <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-blue-600">
            <h3 className="text-xl font-bold">✈ Air Cargo Express</h3>
            <p className="text-gray-600 mt-2">1–2 Days Transit</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-bold">🚢 Ocean Container</h3>
            <p className="text-gray-600 mt-2">12–25 Days Transit</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-bold">🚛 Road Express</h3>
            <p className="text-gray-600 mt-2">3–5 Days Transit</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-bold">🚆 Rail Freight</h3>
            <p className="text-gray-600 mt-2">5–8 Days Transit</p>
          </div>

        </div>

      </div>
    </section>
  );
}

export default TransportModes;