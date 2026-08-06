import Navbar from "./Navbar";
import Footer from "./Footer";
import QuoteCalculator from "./QuoteCalculator";

// Standalone /services page: the site's Navbar/Footer wrapped around the
// bare QuoteCalculator UI. The Navbar is position:fixed, so this page
// needs its own top offset to clear it — that offset belongs here, not
// inside QuoteCalculator, since the dashboard's "New Quote" section
// embeds the same calculator without a fixed navbar above it.
export default function QuoteGenerator() {
  return (
    <div style={{ paddingTop: 80 }}>
      <Navbar />
      <QuoteCalculator />
      <Footer />
    </div>
  );
}
