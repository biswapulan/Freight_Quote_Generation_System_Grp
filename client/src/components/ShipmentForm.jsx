function ShipmentForm() {
  return (
    <section className="py-16">
      <div className="max-w-7xl mx-auto px-6">

        <h2 className="text-3xl font-bold text-center mb-10">
          Shipment Details
        </h2>

        <div className="grid md:grid-cols-2 gap-6">

          <div>
            <label className="font-semibold">Weight (kg)</label>
            <input
              type="number"
              placeholder="Enter Weight"
              className="w-full mt-2 border rounded-lg p-3"
            />
          </div>

          <div>
            <label className="font-semibold">Quantity</label>
            <input
              type="number"
              placeholder="Enter Quantity"
              className="w-full mt-2 border rounded-lg p-3"
            />
          </div>

          <div>
            <label className="font-semibold">Length (cm)</label>
            <input
              type="number"
              placeholder="Length"
              className="w-full mt-2 border rounded-lg p-3"
            />
          </div>

          <div>
            <label className="font-semibold">Width (cm)</label>
            <input
              type="number"
              placeholder="Width"
              className="w-full mt-2 border rounded-lg p-3"
            />
          </div>

          <div>
            <label className="font-semibold">Height (cm)</label>
            <input
              type="number"
              placeholder="Height"
              className="w-full mt-2 border rounded-lg p-3"
            />
          </div>

        </div>

      </div>
    </section>
  );
}

export default ShipmentForm;