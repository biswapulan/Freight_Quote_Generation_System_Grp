function CustomerPortal() {
  return (
    <section className="py-12 bg-gray-100">
      <div className="max-w-6xl mx-auto px-6">

        <h2 className="text-3xl font-bold text-center mb-8">
          Customer Portal
        </h2>

        <div className="grid md:grid-cols-3 gap-6">

          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <h3 className="font-bold">🏢 Main Branch</h3>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <h3 className="font-bold">🌍 Other Branches</h3>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <h3 className="font-bold">👥 Team</h3>
          </div>

        </div>

        <div className="text-center mt-8">
          <button className="bg-black text-white px-8 py-3 rounded-lg">
            Login Portal
          </button>
        </div>

      </div>
    </section>
  );
}

export default CustomerPortal;