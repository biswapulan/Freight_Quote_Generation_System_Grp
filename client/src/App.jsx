import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import TransportModes from "./components/TransportModes";
import RouteSelection from "./components/RouteSelection";
import CargoClass from "./components/CargoClass";
import ShipmentForm from "./components/ShipmentForm";
import QuoteResult from "./components/QuoteResult";
import SpecialOffers from "./components/SpecialOffers";
import CustomerPortal from "./components/CustomerPortal";
import Footer from "./components/Footer";

function App() {
  return (
    <>
      <Navbar />
      <Hero />
      <TransportModes />
      <RouteSelection />
      <CargoClass />
      <ShipmentForm />
      <QuoteResult />
      <SpecialOffers />
      <CustomerPortal />
      <Footer />
    </>
  );
}

export default App;