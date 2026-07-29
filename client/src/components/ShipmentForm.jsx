function ShipmentForm() {
  return (
    <section className="py-12 bg-gray-100">
      <div className="max-w-5xl mx-auto px-6">

        <h2 className="text-3xl font-bold text-center mb-8">
          Shipment Details
        </h2>

        <div className="bg-white rounded-xl shadow-lg p-8">

          <div className="grid md:grid-cols-2 gap-6">

            {/* Weight */}
            <div>
              <label className="font-semibold">
                Weight
              </label>

              <input
                type="number"
                placeholder="Enter Weight"
                className="w-full mt-2 border rounded-lg p-3"
              />
            </div>

            {/* Quantity */}
            <div>
              <label className="font-semibold">
                Quantity
              </label>

              <input
                type="number"
                placeholder="Enter Quantity"
                className="w-full mt-2 border rounded-lg p-3"
              />
            </div>

            {/* Kilo Quantity */}
            <div className="md:col-span-2">
              <label className="font-semibold">
                Kilo Quantity (kg)
              </label>

              <input
                type="number"
                placeholder="Enter Kilo Quantity"
                className="w-full mt-2 border rounded-lg p-3"
              />
            </div>

          </div>

          <div className="text-center mt-8">
            <button className="bg-black hover:bg-gray-800 text-white px-8 py-3 rounded-lg">
              Generate Quotation
            </button>
          </div>

        </div>

      </div>
    </section>
  );
}

export default ShipmentForm;