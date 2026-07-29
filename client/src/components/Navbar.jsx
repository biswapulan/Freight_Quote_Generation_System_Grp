import { FaTruck } from "react-icons/fa";

function Navbar() {
  return (
    <nav className="bg-black shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">

        <div className="flex items-center gap-2">
          <FaTruck className="text-orange-500 text-3xl" />
          <h1 className="text-2xl font-bold text-white">
            Freight System
          </h1>
        </div>

        <ul className="hidden md:flex gap-8 text-gray-300 font-medium">
          <li className="hover:text-orange-500 cursor-pointer">Home</li>
          <li className="hover:text-orange-500 cursor-pointer">Services</li>
          <li className="hover:text-orange-500 cursor-pointer">Tracking</li>
          <li className="hover:text-orange-500 cursor-pointer">Customer Portal</li>
          <li className="hover:text-orange-500 cursor-pointer">Contact</li>
        </ul>

        <button className="bg-orange-500 hover:bg-orange-600 px-5 py-2 rounded-lg text-white">
          Login
        </button>

      </div>
    </nav>
  );
}

export default Navbar;