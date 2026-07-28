import { FaTruck } from "react-icons/fa";

function Navbar() {
  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <FaTruck className="text-blue-700 text-3xl" />
          <h1 className="text-xl font-bold text-blue-900">
            Freight System
          </h1>
        </div>

        {/* Menu */}
        <ul className="hidden md:flex gap-8 font-medium text-gray-700">
          <li className="hover:text-blue-700 cursor-pointer">Home</li>
          <li className="hover:text-blue-700 cursor-pointer">Services</li>
          <li className="hover:text-blue-700 cursor-pointer">Tracking</li>
          <li className="hover:text-blue-700 cursor-pointer">Customer Portal</li>
          <li className="hover:text-blue-700 cursor-pointer">Contact</li>
        </ul>

        {/* Right Side */}
        <div className="flex items-center gap-4">
          <select className="border rounded-md px-2 py-1">
            <option>USD</option>
            <option>EUR</option>
            <option>INR</option>
            <option>AED</option>
          </select>

          <button className="bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-800">
            Login
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;