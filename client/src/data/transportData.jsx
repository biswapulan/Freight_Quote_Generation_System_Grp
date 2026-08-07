import React from "react";
import {
  FaPlane,
  FaShip,
  FaTruck,
  FaTrain,
  FaCheckCircle,
} from "react-icons/fa";

const transportData = {
  air: {
    label: "Air Freight",
    icon: <FaPlane />,
    tag: "Fastest Transit",
    tagline: "When speed matters more than anything else.",
    description:
      "Air freight is the fastest way to move cargo across the globe, ideal for time-critical, high-value, or perishable shipments. Our AI pricing engine compares live carrier capacity to give you the sharpest possible rate in seconds.",
    stats: [
      { value: "1–3 days", label: "Typical transit time" },
      { value: "200+", label: "Airport partners" },
      { value: "99.5%", label: "On-time performance" },
    ],
    features: [
      "Real-time flight and capacity tracking",
      "Priority handling for time-critical cargo",
      "Temperature-controlled options for perishables",
      "Customs pre-clearance support",
      "Door-to-airport and door-to-door service",
      "Dedicated charter options for oversized freight",
    ],
    useCases: [
      "Pharmaceuticals & medical supplies",
      "High-value electronics",
      "Fashion & seasonal retail",
      "Perishable goods & fresh produce",
    ],
  },
  ocean: {
    label: "Ocean Freight",
    icon: <FaShip />,
    tag: "Best Value at Scale",
    tagline: "The most cost-effective way to move bulk cargo worldwide.",
    description:
      "Ocean freight is built for volume — full container loads (FCL) and less-than-container loads (LCL) moving between any of our 120+ served countries. It's the backbone of global trade for businesses that plan ahead and ship in scale.",
    stats: [
      { value: "15–35 days", label: "Typical transit time" },
      { value: "180+", label: "Port partners" },
      { value: "40%", label: "Avg. cost savings vs air" },
    ],
    features: [
      "FCL and LCL container options",
      "Port-to-port and door-to-door service",
      "Reefer containers for temperature-sensitive cargo",
      "Consolidated LCL for smaller shipments",
      "Real-time vessel tracking",
      "Bulk and breakbulk cargo support",
    ],
    useCases: [
      "Raw materials & industrial goods",
      "Furniture & heavy machinery",
      "Retail inventory restocking",
      "Automotive parts & vehicles",
    ],
  },
  road: {
    label: "Road Transport",
    icon: <FaTruck />,
    tag: "Flexible & Regional",
    tagline: "Door-to-door coverage for domestic and cross-border freight.",
    description:
      "Road transport gives you the flexibility to move freight directly between warehouses, distribution centers, and retail locations — with live GPS tracking the entire way. Perfect for regional distribution and last-mile delivery.",
    stats: [
      { value: "1–7 days", label: "Typical transit time" },
      { value: "45K+", label: "Vetted carrier fleet" },
      { value: "24/7", label: "Live GPS tracking" },
    ],
    features: [
      "Full truckload (FTL) and less-than-truckload (LTL)",
      "Live GPS tracking on every shipment",
      "Cross-border customs coordination",
      "Refrigerated and temperature-controlled trucks",
      "Flexible pickup and delivery windows",
      "Last-mile distribution network",
    ],
    useCases: [
      "Retail & e-commerce distribution",
      "Regional warehouse transfers",
      "Time-sensitive local delivery",
      "Oversized and heavy equipment",
    ],
  },
  rail: {
    label: "Rail Freight",
    icon: <FaTrain />,
    tag: "Reliable & Sustainable",
    tagline: "A dependable, lower-carbon option for heavy inland cargo.",
    description:
      "Rail freight offers a reliable, cost-efficient, and more sustainable way to move heavy or bulk cargo across long inland distances, with predictable schedules and lower emissions than road transport.",
    stats: [
      { value: "5–12 days", label: "Typical transit time" },
      { value: "60%", label: "Lower carbon footprint" },
      { value: "99%", label: "Schedule reliability" },
    ],
    features: [
      "Scheduled, predictable departure windows",
      "Bulk and containerized cargo options",
      "Lower emissions than road freight",
      "Ideal for heavy industrial cargo",
      "Intermodal rail-to-road connections",
      "Cost-efficient for long inland routes",
    ],
    useCases: [
      "Heavy industrial equipment",
      "Bulk commodities & minerals",
      "Long-haul inland distribution",
      "Sustainability-focused supply chains",
    ],
  },
};

export { transportData };
export const CheckIcon = FaCheckCircle;
