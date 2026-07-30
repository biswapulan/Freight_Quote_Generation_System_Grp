import { useState } from "react";
import {
  FaPlane,
  FaShip,
  FaTruck,
  FaTrain,
} from "react-icons/fa";

export default function ShipmentForm() {
  const [mode, setMode] = useState("Air");

  const transportModes = [
    { name: "Air", icon: <FaPlane /> },
    { name: "Ocean", icon: <FaShip /> },
    { name: "Road", icon: <FaTruck /> },
    { name: "Rail", icon: <FaTrain /> },
  ];

  return (
    <section className="bg-gray-100 py-16 -mt-20 relative z-20">
      <div className="max-w-7xl mx-auto px-6">

        <div className="bg-[#0B1E3F] rounded-3xl shadow-2xl p-10">

          <h2 className="text-3xl text-white font-bold mb-8">
            Get Instant Freight Quote
          </h2>

          {/* Transport Tabs */}

          <div className="flex flex-wrap gap-4 mb-8">

            {transportModes.map((item) => (

              <button
                key={item.name}
                onClick={() => setMode(item.name)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl transition ${
                  mode === item.name
                    ? "bg-orange-500 text-white"
                    : "bg-white text-gray-700"
                }`}
              >
                {item.icon}
                {item.name}
              </button>

            ))}

          </div>

          {/* Form */}

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">

            <input
              type="text"
              placeholder="Origin"
              className="p-4 rounded-xl outline-none"
            />

            <input
              type="text"
              placeholder="Destination"
              className="p-4 rounded-xl outline-none"
            />

            <select className="p-4 rounded-xl outline-none">
              <option>General Cargo</option>
              <option>Express Cargo</option>
              <option>Cold Chain</option>
              <option>Hazardous Cargo</option>
            </select>

            <input
              type="number"
              placeholder="Weight (KG)"
              className="p-4 rounded-xl outline-none"
            />

            <input
              type="number"
              placeholder="Quantity"
              className="p-4 rounded-xl outline-none"
            />

            <input
              type="date"
              className="p-4 rounded-xl outline-none"
            />

            <select className="p-4 rounded-xl outline-none">
              <option>Standard Delivery</option>
              <option>Express Delivery</option>
            </select>

            <button className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-lg">
              Generate Quote
            </button>

          </div>

        </div>

      </div>
    </section>
  );
}