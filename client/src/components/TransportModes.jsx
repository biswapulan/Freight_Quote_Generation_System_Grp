import {
  FaPlane,
  FaShip,
  FaTruck,
  FaTrain,
} from "react-icons/fa";

const transportModes = [
  {
    title: "Air Freight",
    icon: <FaPlane />,
    description: "Fast and secure international air cargo services.",
  },
  {
    title: "Ocean Freight",
    icon: <FaShip />,
    description: "Reliable global sea freight for bulk shipments.",
  },
  {
    title: "Road Transport",
    icon: <FaTruck />,
    description: "Efficient domestic and regional transportation.",
  },
  {
    title: "Rail Freight",
    icon: <FaTrain />,
    description: "Cost-effective rail logistics for heavy cargo.",
  },
];

function TransportModes() {
  return (
    <section className="py-20 bg-gray-100">

      <div className="max-w-7xl mx-auto px-8">

        <div className="text-center mb-12">

          <h2 className="text-4xl font-bold text-gray-800">
            Choose Transport Mode
          </h2>

          <p className="text-gray-500 mt-3">
            Select the transportation method that best fits your shipment.
          </p>

        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">

          {transportModes.map((mode, index) => (

            <div
              key={index}
              className="bg-white rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 p-8 text-center cursor-pointer border border-gray-100"
            >

              <div className="text-5xl text-blue-600 flex justify-center mb-5">
                {mode.icon}
              </div>

              <h3 className="text-xl font-bold text-gray-800 mb-3">
                {mode.title}
              </h3>

              <p className="text-gray-500 leading-7">
                {mode.description}
              </p>

              <button className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition">
                Select
              </button>

            </div>

          ))}

        </div>

      </div>

    </section>
  );
}

export default TransportModes;