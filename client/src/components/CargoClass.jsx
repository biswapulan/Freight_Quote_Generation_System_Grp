function CargoClass() {
  return (
    <section className="py-12 bg-white">
      <div className="max-w-6xl mx-auto px-6">

        <h2 className="text-3xl font-bold text-center mb-8">
          Cargo Handling Class
        </h2>

        <div className="grid md:grid-cols-4 gap-5">

          <div className="bg-white border rounded-xl p-4 shadow-md text-center hover:shadow-xl transition">
            <h3 className="font-bold">📦 General</h3>
            <p className="text-sm text-gray-600 mt-2">
              Standard Cargo
            </p>
          </div>

          <div className="bg-black text-white rounded-xl p-4 shadow-md text-center hover:shadow-xl transition">
            <h3 className="font-bold">💎 Fragile</h3>
            <p className="text-sm mt-2">
              Glass & Electronics
            </p>
          </div>

          <div className="bg-white border rounded-xl p-4 shadow-md text-center hover:shadow-xl transition">
            <h3 className="font-bold">❄ Cold Chain</h3>
            <p className="text-sm text-gray-600 mt-2">
              Pharma & Food
            </p>
          </div>

          <div className="bg-white border rounded-xl p-4 shadow-md text-center hover:shadow-xl transition">
            <h3 className="font-bold">☣ Hazardous</h3>
            <p className="text-sm text-gray-600 mt-2">
              Chemicals
            </p>
          </div>

        </div>

      </div>
    </section>
  );
}

export default CargoClass;