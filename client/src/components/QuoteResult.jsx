function QuoteResult() {
  return (
    <section className="py-16 bg-blue-50">
      <div className="max-w-4xl mx-auto px-6">

        <h2 className="text-3xl font-bold text-center mb-8">
          AI Freight Quote
        </h2>

        <div className="bg-white rounded-xl shadow-xl p-8">

          <div className="grid grid-cols-2 gap-6">

            <div>
              <h4 className="font-semibold">Distance</h4>
              <p>1033 km</p>
            </div>

            <div>
              <h4 className="font-semibold">Transport</h4>
              <p>Air Cargo</p>
            </div>

            <div>
              <h4 className="font-semibold">Cargo Type</h4>
              <p>Express Fragile</p>
            </div>

            <div>
              <h4 className="font-semibold">Risk Factor</h4>
              <p>1.3x</p>
            </div>

            <div>
              <h4 className="font-semibold">Estimated Price</h4>
              <p className="text-green-700 font-bold text-xl">
                ₹ 18,750
              </p>
            </div>

            <div>
              <h4 className="font-semibold">Delivery Time</h4>
              <p>1–2 Days</p>
            </div>

          </div>

          <button className="mt-8 w-full bg-blue-700 text-white py-3 rounded-lg hover:bg-blue-800">
            Generate Quote
          </button>

        </div>

      </div>
    </section>
  );
}

export default QuoteResult;