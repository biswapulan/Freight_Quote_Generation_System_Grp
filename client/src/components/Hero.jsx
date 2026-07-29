function Hero() {
  return (
    <section className="bg-black text-white py-20">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between">

        <div className="md:w-1/2">
          <p className="text-orange-500 font-semibold uppercase">
            AI Powered Enterprise Logistics Platform
          </p>

          <h1 className="text-4xl font-bold mt-3 leading-tight">
            Intelligent Logistics
            <br />
            Management System
          </h1>

          <p className="mt-5 text-gray-300">
            Smart freight management solution for fast and reliable cargo
            transportation.
          </p>

          <button className="mt-8 bg-orange-500 hover:bg-orange-600 px-8 py-3 rounded-lg">
            Generate Quotation
          </button>
        </div>

        <div className="md:w-1/2 flex justify-center mt-10 md:mt-0">
          <img
            src="https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=800"
            alt="Cargo"
            className="rounded-xl shadow-2xl w-full max-w-lg"
          />
        </div>

      </div>
    </section>
  );
}

export default Hero;