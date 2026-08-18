import {
  FaMapMarkerAlt,
  FaExchangeAlt,
  FaCalendarAlt,
  FaWeightHanging,
  FaBoxes,
  FaArrowRight,
} from "react-icons/fa";

const OriginDestination = () => {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">

        <div className="text-center mb-10">
          <h2 className="text-4xl font-bold text-gray-800">
            Shipment Details
          </h2>

          <p className="text-gray-500 mt-3">
            Enter shipment information to generate an accurate freight quotation.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-10">

          <div className="grid lg:grid-cols-2 gap-6">

            {/* Origin */}
            <div>
              <label className="font-semibold flex items-center gap-2 mb-2">
                <FaMapMarkerAlt className="text-blue-600" />
                Origin
              </label>

              <input
                type="text"
                placeholder="Enter Origin City"
                className="w-full border rounded-xl p-4 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Destination */}
            <div>
              <label className="font-semibold flex items-center gap-2 mb-2">
                <FaExchangeAlt className="text-blue-600" />
                Destination
              </label>

              <input
                type="text"
                placeholder="Enter Destination City"
                className="w-full border rounded-xl p-4 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Pickup Date */}
            <div>
              <label className="font-semibold flex items-center gap-2 mb-2">
                <FaCalendarAlt className="text-blue-600" />
                Pickup Date
              </label>

              <input
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                className="w-full border rounded-xl p-4 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Delivery Type */}
            <div>
              <label className="font-semibold mb-2 block">
                Delivery Type
              </label>

              <select className="w-full border rounded-xl p-4 focus:ring-2 focus:ring-blue-500 outline-none">
                <option>Standard Delivery</option>
                <option>Express Delivery</option>
                <option>Priority Delivery</option>
              </select>
            </div>

            {/* Weight */}
            <div>
              <label className="font-semibold flex items-center gap-2 mb-2">
                <FaWeightHanging className="text-blue-600" />
                Weight (KG)
              </label>

              <input
                type="number"
                placeholder="Enter Weight"
                className="w-full border rounded-xl p-4 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Quantity */}
            <div>
              <label className="font-semibold flex items-center gap-2 mb-2">
                <FaBoxes className="text-blue-600" />
                Quantity
              </label>

              <input
                type="number"
                placeholder="Enter Quantity"
                className="w-full border rounded-xl p-4 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

          </div>

          <div className="text-center mt-10">
            <button className="bg-blue-600 hover:bg-blue-700 transition text-white px-10 py-4 rounded-xl text-lg font-semibold flex items-center gap-3 mx-auto">
              Generate Freight Quote
              <FaArrowRight />
            </button>
          </div>

        </div>

      </div>
    </section>
  );
};

export default OriginDestination;