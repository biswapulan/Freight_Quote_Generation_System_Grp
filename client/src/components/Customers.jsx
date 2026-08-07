import React from "react";
import "./Customers.css";

// Import each logo file from src/assets/logos/
import amazonLogo from "../assets/logos/amazon.png";
import aliexpressLogo from "../assets/logos/aliexpress.png";
import shopifyLogo from "../assets/logos/shopify.png";
import tataLogo from "../assets/logos/tata.png";
import jswLogo from "../assets/logos/jsw.png";
import huaweiLogo from "../assets/logos/huawei.png";
import samsungLogo from "../assets/logos/samsung.png";
import walmartLogo from "../assets/logos/walmart.png";
import unileverLogo from "../assets/logos/unilever.png";
import nestleLogo from "../assets/logos/nestle.png";

const COMPANIES = [
  { name: "Amazon", logo: amazonLogo },
  { name: "AliExpress", logo: aliexpressLogo },
  { name: "Shopify", logo: shopifyLogo },
  { name: "Tata Group", logo: tataLogo },
  { name: "JSW Group", logo: jswLogo },
  { name: "Huawei", logo: huaweiLogo },
  { name: "Samsung", logo: samsungLogo },
  { name: "Walmart", logo: walmartLogo },
  { name: "Unilever", logo: unileverLogo },
  { name: "Nestlé", logo: nestleLogo },
];

// Duplicate the list so the CSS marquee loop is seamless.
const MARQUEE_ITEMS = [...COMPANIES, ...COMPANIES];

function Customers() {
  return (
    <section className="fa-customers">
      <div className="fa-section-header">
        <p className="fa-eyebrow">Trusted By</p>
        <h2>Our Customers</h2>
        <span>
          Enterprise teams around the world rely on FreightAI to move their
          freight, faster.
        </span>
      </div>

      <div className="fa-customers-marquee-mask">
        <div className="fa-customers-track">
          {MARQUEE_ITEMS.map((company, i) => (
            <div className="fa-customer-chip" key={`${company.name}-${i}`}>
              <img
                src={company.logo}
                alt={company.name}
                className="fa-customer-logo"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Customers;
