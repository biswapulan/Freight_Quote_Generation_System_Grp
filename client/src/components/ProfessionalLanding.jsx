import React from "react";

import Navbar from "./Navbar";
import Hero from "./Hero";
import TrustBar from "./TrustBar";
import ShipmentProcess from "./ShipmentProcess";
import Services from "./Services";
import SpecialOffers from "./SpecialOffers";
import Customers from "./Customers";
import CustomerPortal from "./CustomerPortal";
import Newsletter from "./Newsletter";
import Footer from "./Footer";

function ProfessionalLanding() {
  return (
    <div className="landing-page">
      <Navbar />
      <Hero />
      <TrustBar />
      <ShipmentProcess />
      <Services />
      <SpecialOffers />
      <Customers />
      <CustomerPortal />
      <Newsletter />
      <Footer />
    </div>
  );
}

export default ProfessionalLanding;
