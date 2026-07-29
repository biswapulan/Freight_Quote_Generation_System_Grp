function ShipmentProcess() {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-6xl mx-auto px-6">

        <h2 className="text-4xl font-bold text-center mb-10 text-black">
          Shipment Details
        </h2>

        <div className="bg-gray-100 p-8 rounded-xl shadow-lg">

          {/* Origin & Destination */}
          <div className="grid md:grid-cols-2 gap-6">

            <div>
              <label className="font-semibold">Origin</label>
              <input
                type="text"
                placeholder="Enter Origin"
                className="w-full mt-2 p-3 border rounded-lg"
              />
            </div>

            <div>
              <label className="font-semibold">Destination</label>
              <input
                type="text"
                placeholder="Enter Destination"
                className="w-full mt-2 p-3 border rounded-lg"
              />
            </div>

          </div>

          {/* Transport Mode & Cargo */}
          <div className="grid md:grid-cols-2 gap-6 mt-6">

            <div>
              <label className="font-semibold">
                Transport Mode
              </label>

              <select className="w-full mt-2 p-3 border rounded-lg">
                <option>Air</option>
                <option>Sea</option>
                <option>Road</option>
                <option>Rail</option>
              </select>
            </div>

            <div>
              <label className="font-semibold">
                Cargo Handling Class
              </label>

              <select className="w-full mt-2 p-3 border rounded-lg">
                <option>Standard</option>
                <option>Fragile</option>
                <option>Hazardous</option>
                <option>Perishable</option>
              </select>
            </div>

          </div>

          {/* Weight */}
          <div className="mt-6">
            <label className="font-semibold">
              Weight / Quantity (kg)
            </label>

            <input
              type="number"
              placeholder="Enter Weight in KG"
              className="w-full mt-2 p-3 border rounded-lg"
            />
          </div>

          {/* Button */}
          <div className="mt-8 text-center">
            <button className="bg-black text-white px-8 py-3 rounded-lg hover:bg-gray-800">
              Generate Quotation
            </button>
          </div>

        </div>

      </div>
    </section>
  );
}

export default ShipmentProcess;