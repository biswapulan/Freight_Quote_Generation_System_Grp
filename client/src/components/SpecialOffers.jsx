import React from "react";
import "./SpecialOffers.css";

import {
  FaBolt,
  FaGlobe,
  FaDollarSign
} from "react-icons/fa";


function SpecialOffers(){

return(

<section className="offers-section">


<div className="offers-header">

<p>
SPECIAL OFFERS
</p>

<h2>
Exclusive Logistics Benefits
</h2>

<span>
Save time and cost with our intelligent freight solutions.
</span>

</div>




<div className="offers-container">



<div className="offer-card">


<div className="offer-icon">

<FaBolt/>

</div>


<h3>
Fast Delivery
</h3>


<p>
Priority shipment handling with
optimized delivery routes.
</p>


<h4>
Up to 40% Faster
</h4>


</div>






<div className="offer-card">


<div className="offer-icon">

<FaGlobe/>

</div>


<h3>
Global Coverage
</h3>


<p>
Connect your business with
international logistics networks.
</p>


<h4>
120+ Countries
</h4>


</div>







<div className="offer-card">


<div className="offer-icon">

<FaDollarSign/>

</div>


<h3>
Cost Optimization
</h3>


<p>
AI based pricing helps reduce
unnecessary transportation costs.
</p>


<h4>
Smart Pricing
</h4>


</div>




</div>




<div className="offer-banner">


<div>

<h2>
Ready to Optimize Your Shipment?
</h2>


<p>
Generate your AI-powered freight quote today.
</p>

</div>



<button>
Get Started →
</button>


</div>



</section>

)

}


export default SpecialOffers;