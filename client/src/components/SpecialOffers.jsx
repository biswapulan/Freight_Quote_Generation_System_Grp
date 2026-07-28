function SpecialOffers() {
  return (
    <section className="py-16 bg-yellow-50">
      <div className="max-w-7xl mx-auto px-6">

        <h2 className="text-3xl font-bold text-center mb-10">
          Special Offers
        </h2>

        <div className="grid md:grid-cols-3 gap-6">

          <div className="bg-white shadow-lg rounded-xl p-6">
            <h3 className="text-xl font-bold">✈ Air Cargo Offer</h3>
            <p className="mt-3">
              Flat 20% Discount on Express Shipping
            </p>
          </div>

          <div className="bg-white shadow-lg rounded-xl p-6">
            <h3 className="text-xl font-bold">🚢 Ocean Freight</h3>
            <p className="mt-3">
              Free Insurance upto ₹50,000
            </p>
          </div>

          <div className="bg-white shadow-lg rounded-xl p-6">
            <h3 className="text-xl font-bold">🚛 Road Express</h3>
            <p className="mt-3">
              Free Pickup Service
            </p>
          </div>

        </div>

      </div>
    </section>
  );
}

export default SpecialOffers;