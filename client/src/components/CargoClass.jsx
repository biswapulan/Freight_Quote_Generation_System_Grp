function CargoClass() {
  return (
    <section className="py-16 bg-gray-100">
      <div className="max-w-7xl mx-auto px-6">

        <h2 className="text-3xl font-bold text-center mb-10">
          Cargo Handling Class
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">

          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-bold">📦 General Cargo</h3>
            <p className="mt-2 text-gray-600">
              Standard dry goods & electronics
            </p>
            <p className="mt-3 font-semibold text-blue-700">
              1.0x Base
            </p>
          </div>

          <div className="bg-blue-700 text-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-bold">
              💎 Express Fragile
            </h3>
            <p className="mt-2">
              Glass, High-Tech & Textiles
            </p>
            <p className="mt-3 font-semibold">
              1.3x Risk (Selected)
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-bold">
              ❄ Cold Chain
            </h3>
            <p className="mt-2 text-gray-600">
              Pharma & Fresh Produce
            </p>
            <p className="mt-3 font-semibold text-blue-700">
              1.4x Climate
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-bold">
              ☣ Hazardous
            </h3>
            <p className="mt-2 text-gray-600">
              Batteries & Chemicals
            </p>
            <p className="mt-3 font-semibold text-blue-700">
              1.6x Hazmat
            </p>
          </div>

        </div>

      </div>
    </section>
  );
}

export default CargoClass;