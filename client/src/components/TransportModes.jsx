function TransportModes() {
  return (
    <section className="py-10 bg-gray-100">
      <div className="max-w-6xl mx-auto px-6">

        <h2 className="text-3xl font-bold text-center mb-8">
          Select Transport Mode
        </h2>

        <div className="grid md:grid-cols-4 gap-5">

          <div className="bg-black text-white rounded-xl p-5 shadow-lg text-center hover:scale-105 transition">
            <h3 className="text-lg font-bold">✈ Air</h3>
            <p className="text-sm mt-2">1–2 Days</p>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-lg text-center hover:scale-105 transition">
            <h3 className="text-lg font-bold">🚢 Ocean</h3>
            <p className="text-sm mt-2">12–25 Days</p>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-lg text-center hover:scale-105 transition">
            <h3 className="text-lg font-bold">🚛 Road</h3>
            <p className="text-sm mt-2">3–5 Days</p>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-lg text-center hover:scale-105 transition">
            <h3 className="text-lg font-bold">🚆 Rail</h3>
            <p className="text-sm mt-2">5–8 Days</p>
          </div>

        </div>

      </div>
    </section>
  );
}

export default TransportModes;