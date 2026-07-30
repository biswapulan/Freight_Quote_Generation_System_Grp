import {
  FaMoneyBillWave,
  FaClock,
  FaRoute,
  FaShieldAlt,
  FaFilePdf,
  FaCheckCircle,
} from "react-icons/fa";

export default function QuoteResult() {
  return (
    <section className="py-20 bg-gray-50">

      <div className="max-w-7xl mx-auto px-6">

        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-800">
            AI Freight Quote Result
          </h2>

          <p className="text-gray-500 mt-3">
            Your estimated quotation based on shipment details.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-10">

          <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-8">

            <div className="bg-blue-50 rounded-2xl p-6 text-center">
              <FaMoneyBillWave className="text-4xl text-blue-600 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-700">
                Estimated Price
              </h3>
              <p className="text-3xl font-bold mt-2 text-blue-700">
                ₹24,850
              </p>
            </div>

            <div className="bg-green-50 rounded-2xl p-6 text-center">
              <FaClock className="text-4xl text-green-600 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-700">
                Transit Time
              </h3>
              <p className="text-3xl font-bold mt-2 text-green-700">
                4 Days
              </p>
            </div>

            <div className="bg-orange-50 rounded-2xl p-6 text-center">
              <FaRoute className="text-4xl text-orange-500 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-700">
                Distance
              </h3>
              <p className="text-3xl font-bold mt-2 text-orange-600">
                1,245 KM
              </p>
            </div>

            <div className="bg-purple-50 rounded-2xl p-6 text-center">
              <FaShieldAlt className="text-4xl text-purple-600 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-700">
                Insurance
              </h3>
              <p className="text-3xl font-bold mt-2 text-purple-700">
                Included
              </p>
            </div>

          </div>

          <div className="mt-10 border-t pt-8">

            <h3 className="text-2xl font-bold mb-6">
              Shipment Summary
            </h3>

            <div className="grid md:grid-cols-2 gap-6">

              <div className="flex items-center gap-3">
                <FaCheckCircle className="text-green-600" />
                Origin : Mumbai
              </div>

              <div className="flex items-center gap-3">
                <FaCheckCircle className="text-green-600" />
                Destination : Delhi
              </div>

              <div className="flex items-center gap-3">
                <FaCheckCircle className="text-green-600" />
                Transport : Air Freight
              </div>

              <div className="flex items-center gap-3">
                <FaCheckCircle className="text-green-600" />
                Cargo : General Cargo
              </div>

            </div>

          </div>

          <div className="flex flex-wrap justify-center gap-6 mt-12">

            <button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl">
              Book Shipment
            </button>

            <button className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl flex items-center gap-2">
              <FaFilePdf />
              Download PDF
            </button>

          </div>

        </div>

      </div>

    </section>
  );
}
