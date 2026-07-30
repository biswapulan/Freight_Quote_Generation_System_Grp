import {
  FaBoxOpen,
  FaShippingFast,
  FaSnowflake,
  FaExclamationTriangle,
} from "react-icons/fa";

const cargoClasses = [
  {
    title: "General Cargo",
    icon: <FaBoxOpen size={42} />,
    description:
      "Suitable for standard commercial goods and regular shipments.",
  },
  {
    title: "Express Cargo",
    icon: <FaShippingFast size={42} />,
    description:
      "Priority handling for urgent and time-sensitive deliveries.",
  },
  {
    title: "Cold Chain",
    icon: <FaSnowflake size={42} />,
    description:
      "Temperature-controlled transportation for sensitive products.",
  },
  {
    title: "Hazardous Cargo",
    icon: <FaExclamationTriangle size={42} />,
    description:
      "Special handling for dangerous and regulated materials.",
  },
];

const CargoClass = () => {
  return (
    <section className="bg-white py-20">
      <div className="max-w-7xl mx-auto px-6">

        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold text-gray-800">
            Cargo Class
          </h2>

          <p className="text-gray-500 mt-3">
            Choose the appropriate cargo class for safe and efficient transportation.
          </p>
        </div>

        <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-8">

          {cargoClasses.map((item, index) => (
            <div
              key={index}
              className="bg-gray-50 rounded-2xl shadow-md hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 p-8 border border-gray-200 text-center"
            >
              <div className="flex justify-center text-blue-600 mb-5">
                {item.icon}
              </div>

              <h3 className="text-xl font-bold text-gray-800 mb-3">
                {item.title}
              </h3>

              <p className="text-gray-500 text-sm leading-6">
                {item.description}
              </p>

              <button className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition duration-300">
                Select
              </button>
            </div>
          ))}

        </div>
      </div>
    </section>
  );
};

export default CargoClass;