import React from "react";
import "./Services.css";

import {
  FaPlane,
  FaShip,
  FaTruck,
  FaTrain
} from "react-icons/fa";


function Services(){

return(

<section className="services-section">


<div className="services-header">


<p>
OUR SERVICES
</p>


<h2>
Smart Logistics Solutions
</h2>


<span>
Reliable transportation solutions powered by
AI technology and intelligent management.
</span>


</div>




<div className="services-container">



<div className="service-card">


<div className="service-icon">
<FaPlane/>
</div>


<h3>
Air Freight
</h3>


<p>
Fast and secure air cargo transportation
with accurate AI based freight estimation.
</p>


<button>
Explore More →
</button>


</div>





<div className="service-card">


<div className="service-icon">
<FaShip/>
</div>


<h3>
Ocean Freight
</h3>


<p>
Cost effective global shipping solutions
for large scale cargo movement.
</p>


<button>
Explore More →
</button>


</div>






<div className="service-card">


<div className="service-icon">
<FaTruck/>
</div>


<h3>
Road Transport
</h3>


<p>
Flexible road logistics with
real-time tracking and delivery updates.
</p>


<button>
Explore More →
</button>


</div>






<div className="service-card">


<div className="service-icon">
<FaTrain/>
</div>


<h3>
Rail Freight
</h3>


<p>
Reliable railway cargo solutions
for efficient supply chain operations.
</p>


<button>
Explore More →
</button>


</div>




</div>



</section>

)

}


export default Services;