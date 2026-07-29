import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import RouteSelection from "./components/RouteSelection";
import TransportModes from "./components/TransportModes";
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
      <RouteSelection />
      <TransportModes />
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