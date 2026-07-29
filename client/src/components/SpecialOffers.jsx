function SpecialOffers() {
  return (
    <section className="py-12 bg-white">
      <div className="max-w-7xl mx-auto px-6">

        <h2 className="text-3xl font-bold text-center mb-8">
          Special Offers
        </h2>

        <div className="grid md:grid-cols-3 gap-6">

          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800"
              alt="Air Cargo"
              className="w-full h-48 object-cover"
            />
            <div className="p-5">
              <h3 className="font-bold">✈ Air Cargo</h3>
              <p>20% Discount on Express Shipping</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=800"
              alt="Ocean Freight"
              className="w-full h-48 object-cover"
            />
            <div className="p-5">
              <h3 className="font-bold">🚢 Ocean Freight</h3>
              <p>Free Insurance Available</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=800"
              alt="Road Transport"
              className="w-full h-48 object-cover"
            />
            <div className="p-5">
              <h3 className="font-bold">🚛 Road Express</h3>
              <p>Free Pickup Service</p>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}

export default SpecialOffers;