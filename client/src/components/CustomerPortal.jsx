import React from "react";
import "./CustomerPortal.css";

import {
  FaUserShield,
  FaChartLine,
  FaMapMarkedAlt,
  FaFileInvoiceDollar
} from "react-icons/fa";


function CustomerPortal(){

return(

<section className="portal-section">


<div className="portal-container">



<div className="portal-content">


<p>
CUSTOMER PORTAL
</p>


<h2>
Manage Your Shipments Easily
</h2>


<span>

Access shipment tracking, invoices,
analytics and complete logistics information
from one smart platform.

</span>



<div className="portal-buttons">

<button>
Login Portal
</button>


<button className="outline-btn">
Create Account
</button>


</div>


</div>





<div className="portal-dashboard">



<div className="dashboard-card">

<FaMapMarkedAlt/>

<div>

<h3>
Live Tracking
</h3>

<p>
Real-time shipment updates
</p>

</div>

</div>





<div className="dashboard-card">

<FaChartLine/>

<div>

<h3>
Analytics
</h3>

<p>
Performance insights
</p>

</div>

</div>





<div className="dashboard-card">

<FaFileInvoiceDollar/>

<div>

<h3>
Invoices
</h3>

<p>
Digital billing management
</p>

</div>

</div>




<div className="dashboard-card">

<FaUserShield/>

<div>

<h3>
Secure Access
</h3>

<p>
Protected customer account
</p>

</div>

</div>



</div>



</div>


</section>

)

}


export default CustomerPortal;