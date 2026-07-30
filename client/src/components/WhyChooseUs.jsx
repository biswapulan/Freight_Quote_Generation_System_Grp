import {
  FaRobot,
  FaGlobe,
  FaShippingFast,
  FaShieldAlt,
} from "react-icons/fa";

export default function WhyChooseUs() {
  const features = [
    {
      icon: <FaRobot />,
      title: "AI Powered Quotes",
      desc: "Generate intelligent freight quotations instantly using AI.",
    },
    {
      icon: <FaShippingFast />,
      title: "Fast Delivery",
      desc: "Quick and reliable shipping across multiple transport modes.",
    },
    {
      icon: <FaGlobe />,
      title: "Global Network",
      desc: "Worldwide logistics services with trusted partners.",
    },
    {
      icon: <FaShieldAlt />,
      title: "Secure Logistics",
      desc: "Safe cargo handling with complete shipment protection.",
    },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">

        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold text-gray-800">
            Why Choose Us
          </h2>

          <p className="text-gray-500 mt-3">
            Smart logistics solutions designed for modern businesses.
          </p>
        </div>

        <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-8">

          {features.map((item, index) => (
            <div
              key={index}
              className="bg-gray-50 rounded-2xl p-8 text-center shadow-lg hover:shadow-2xl hover:-translate-y-2 transition"
            >
              <div className="text-5xl text-blue-600 mb-5 flex justify-center">
                {item.icon}
              </div>

              <h3 className="text-xl font-bold mb-3">
                {item.title}
              </h3>

              <p className="text-gray-500 leading-7">
                {item.desc}
              </p>
            </div>
          ))}

        </div>
      </div>
    </section>
  );
}