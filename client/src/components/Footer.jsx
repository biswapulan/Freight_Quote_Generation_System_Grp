import React from "react";
import "./Footer.css";

import {
  FaShip,
  FaFacebook,
  FaTwitter,
  FaLinkedin,
  FaInstagram
} from "react-icons/fa";


function Footer(){

return(

<footer className="footer">


<div className="footer-container">



<div className="footer-brand">


<div className="footer-logo">

<FaShip/>

<h2>
Freight<span>AI</span>
</h2>

</div>



<p>

AI powered logistics platform providing
smart freight solutions, real-time tracking
and intelligent shipment management.

</p>



<div className="social-icons">

<FaFacebook/>
<FaTwitter/>
<FaLinkedin/>
<FaInstagram/>

</div>


</div>





<div className="footer-links">


<h3>
Company
</h3>


<a href="#">
About Us
</a>


<a href="#">
Services
</a>


<a href="#">
Tracking
</a>


<a href="#">
Contact
</a>


</div>







<div className="footer-links">


<h3>
Services
</h3>


<a href="#">
Air Freight
</a>


<a href="#">
Ocean Freight
</a>


<a href="#">
Road Transport
</a>


<a href="#">
Rail Freight
</a>


</div>







<div className="footer-links">


<h3>
Contact
</h3>


<p>
support@freightai.com
</p>


<p>
+1 800 123 4567
</p>


<p>
Global Logistics Center
</p>


</div>




</div>





<div className="footer-bottom">

<p>
© 2026 FreightAI. All Rights Reserved.
</p>

</div>



</footer>

)

}


export default Footer;