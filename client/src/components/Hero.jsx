function Hero() {
  return (
    <section className="bg-blue-900 text-white py-20">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between">

        {/* Left */}
        <div className="md:w-1/2">
          <p className="text-orange-400 font-semibold mb-2">
            AI Powered Enterprise Logistics Platform
          </p>

          <h1 className="text-5xl font-bold leading-tight">
            Intelligent Freight Quote
            <br />
            Generation System
          </h1>

          <p className="mt-5 text-gray-300">
            Flight-ticket style instant pricing for worldwide cargo logistics.
          </p>

          <div className="mt-8 flex gap-4">
            <button className="bg-orange-500 px-6 py-3 rounded-lg">
              Book Cargo
            </button>

            <button className="border border-white px-6 py-3 rounded-lg">
              Get Quote
            </button>
          </div>
        </div>

        {/* Right */}
        <div className="md:w-1/2 flex justify-center mt-10 md:mt-0">
          <img
            src="https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=800"
            alt="Cargo"
            className="w-full max-w-lg rounded-xl"
          />
        </div>

      </div>
    </section>
  );
}

export default Hero;