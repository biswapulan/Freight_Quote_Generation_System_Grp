import "./Navbar.css";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { FaBars, FaTimes, FaShip } from "react-icons/fa";

function Navbar() {

const [menu,setMenu]=useState(false);

return(

<nav className="navbar">

<Link to="/" className="logo">

<FaShip className="ship"/>

<h2>
Freight<span>AI</span>
</h2>

</Link>

<ul className={menu?"nav-links active":"nav-links"}>

<li><Link to="/">Home</Link></li>

<li><Link to="/services">Services</Link></li>

<li><a href="#">Tracking</a></li>

<li><a href="#">Shipment</a></li>

<li><a href="#">Contact</a></li>

<li className="mobile-login-item">
<Link to="/login" className="mobile-login-link">Login</Link>
</li>

</ul>

<div className="nav-right">

<select>

<option>USD</option>
<option>INR</option>
<option>EUR</option>

</select>

<Link to="/login">

<button>

Login

</button>

</Link>

</div>

<div
className="menu"

onClick={()=>setMenu(!menu)}
>

{
menu?<FaTimes/>:<FaBars/>
}

</div>

</nav>

)

}

export default Navbar;
