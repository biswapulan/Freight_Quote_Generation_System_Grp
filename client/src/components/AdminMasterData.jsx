import { useState } from "react";
import {
  FaGlobe,
  FaShip,
  FaBoxes,
  FaFileContract,
  FaSearch,
  FaPlus,
  FaEdit,
  FaToggleOn,
  FaToggleOff,
  FaCode,
  FaCheckCircle,
  FaTrash,
} from "react-icons/fa";
import "./AdminMasterData.css";

// 100% Comprehensive Seed Datasets matching the 19 PDF Collections
const MASTER_COLLECTIONS_SEED = {
  countries: [
    { countryCode: "IN", countryName: "India", iso3: "IND", region: "Asia", currencyCode: "INR", dialCode: "+91", customsUnion: null, isActive: true },
    { countryCode: "AE", countryName: "United Arab Emirates", iso3: "ARE", region: "MEA", currencyCode: "AED", dialCode: "+971", customsUnion: "GCC", isActive: true },
    { countryCode: "SG", countryName: "Singapore", iso3: "SGP", region: "Asia", currencyCode: "SGD", dialCode: "+65", customsUnion: null, isActive: true },
    { countryCode: "NL", countryName: "Netherlands", iso3: "NLD", region: "Europe", currencyCode: "EUR", dialCode: "+31", customsUnion: "EU", isActive: true },
    { countryCode: "US", countryName: "United States", iso3: "USA", region: "NAM", currencyCode: "USD", dialCode: "+1", customsUnion: "USMCA", isActive: true },
  ],
  ports: [
    { unlocode: "INMAA", portName: "Chennai Port", portType: "SEAPORT", city: "Chennai", countryCode: "IN", location: { type: "Point", coordinates: [80.2924, 13.0975] }, timezone: "Asia/Kolkata", maxVesselDraftM: 16.5, terminals: ["CCTL", "CITPL"], customsOffice: "INMAA1", avgDwellTimeHrs: 62, congestionIndex: 0.42, isActive: true },
    { unlocode: "INNSA", portName: "Jawaharlal Nehru Port (Nhava Sheva)", portType: "SEAPORT", city: "Navi Mumbai", countryCode: "IN", location: { type: "Point", coordinates: [72.9490, 18.9490] }, timezone: "Asia/Kolkata", maxVesselDraftM: 15.0, terminals: ["NSICT", "BMCT", "GTI"], customsOffice: "INNSA1", avgDwellTimeHrs: 48, congestionIndex: 0.55, isActive: true },
    { unlocode: "AEJEA", portName: "Jebel Ali", portType: "SEAPORT", city: "Dubai", countryCode: "AE", location: { type: "Point", coordinates: [55.0272, 25.0110] }, timezone: "Asia/Dubai", maxVesselDraftM: 17.0, terminals: ["T1", "T2", "T3"], customsOffice: "AEJEA1", avgDwellTimeHrs: 30, congestionIndex: 0.21, isActive: true },
    { unlocode: "SGSIN", portName: "Port of Singapore", portType: "SEAPORT", city: "Singapore", countryCode: "SG", location: { type: "Point", coordinates: [103.8198, 1.2644] }, timezone: "Asia/Singapore", maxVesselDraftM: 18.0, terminals: ["Tuas", "Pasir Panjang"], customsOffice: "SGSIN1", avgDwellTimeHrs: 24, congestionIndex: 0.18, isActive: true },
    { unlocode: "NLRTM", portName: "Port of Rotterdam", portType: "SEAPORT", city: "Rotterdam", countryCode: "NL", location: { type: "Point", coordinates: [4.1420, 51.9490] }, timezone: "Europe/Amsterdam", maxVesselDraftM: 24.0, terminals: ["Maasvlakte II", "Euromax"], customsOffice: "NLRTM1", avgDwellTimeHrs: 36, congestionIndex: 0.33, isActive: true },
    { unlocode: "INMAA-AIR", portName: "Chennai Intl Airport", portType: "AIRPORT", iataCode: "MAA", city: "Chennai", countryCode: "IN", location: { type: "Point", coordinates: [80.1709, 12.9941] }, timezone: "Asia/Kolkata", terminals: ["Cargo Terminal 1"], customsOffice: "INMAA4", avgDwellTimeHrs: 8, congestionIndex: 0.15, isActive: true },
    { unlocode: "AEDXB-AIR", portName: "Dubai Intl Airport", portType: "AIRPORT", iataCode: "DXB", city: "Dubai", countryCode: "AE", location: { type: "Point", coordinates: [55.3644, 25.2532] }, timezone: "Asia/Dubai", terminals: ["Cargo Mega Terminal"], customsOffice: "AEDXB4", avgDwellTimeHrs: 6, congestionIndex: 0.12, isActive: true },
  ],
  tradeLanes: [
    { laneCode: "INNSA-AEJEA-OCEAN", mode: "OCEAN", distanceNm: 1080, baseTransitDays: 5, transhipmentPorts: [], canalsCrossed: [], riskZones: [], isActive: true },
    { laneCode: "INMAA-SGSIN-OCEAN", mode: "OCEAN", distanceNm: 1560, baseTransitDays: 7, transhipmentPorts: ["MYPKG"], canalsCrossed: [], riskZones: [], isActive: true },
    { laneCode: "INNSA-NLRTM-OCEAN", mode: "OCEAN", distanceNm: 6350, baseTransitDays: 22, transhipmentPorts: ["AEJEA"], canalsCrossed: ["SUEZ"], riskZones: ["RED_SEA"], isActive: true },
    { laneCode: "MAA-DXB-AIR", mode: "AIR", distanceNm: 1670, baseTransitDays: 2, transhipmentPorts: [], canalsCrossed: [], riskZones: [], isActive: true },
  ],
  carriers: [
    { carrierCode: "MAEU", carrierName: "Maersk Line", mode: "OCEAN", serviceTypes: ["FCL", "LCL"], reliabilityScore: 88, contractTier: "CONTRACT", apiEnabled: true, contactEmail: "booking@maersk.example", isActive: true },
    { carrierCode: "MSCU", carrierName: "MSC", mode: "OCEAN", serviceTypes: ["FCL", "LCL", "REEFER"], reliabilityScore: 82, contractTier: "CONTRACT", apiEnabled: true, contactEmail: "ops@msc.example", isActive: true },
    { carrierCode: "CMDU", carrierName: "CMA CGM", mode: "OCEAN", serviceTypes: ["FCL", "REEFER"], reliabilityScore: 79, contractTier: "SPOT", apiEnabled: false, contactEmail: "quotes@cmacgm.example", isActive: true },
    { carrierCode: "EK", carrierName: "Emirates SkyCargo", mode: "AIR", serviceTypes: ["AIR_GEN", "AIR_EXPRESS"], reliabilityScore: 91, contractTier: "CONTRACT", apiEnabled: true, contactEmail: "cargo@ek.example", isActive: true },
    { carrierCode: "AI", carrierName: "Air India Cargo", mode: "AIR", serviceTypes: ["AIR_GEN"], reliabilityScore: 74, contractTier: "SPOT", apiEnabled: false, contactEmail: "cargo@ai.example", isActive: true },
  ],
  serviceTypes: [
    { code: "FCL", label: "Ocean Freight - FCL", mode: "OCEAN", volumetricDivisor: 1000, minChargeableKg: 0, defaultTransitDays: 22, sortOrder: 1, isActive: true },
    { code: "LCL", label: "Ocean Freight - LCL", mode: "OCEAN", volumetricDivisor: 1000, minChargeableKg: 100, defaultTransitDays: 26, sortOrder: 2, isActive: true },
    { code: "AIR_GEN", label: "Air Freight", mode: "AIR", volumetricDivisor: 6000, minChargeableKg: 45, defaultTransitDays: 5, sortOrder: 3, isActive: true },
    { code: "AIR_EXPRESS", label: "Express Air", mode: "AIR", volumetricDivisor: 5000, minChargeableKg: 1, defaultTransitDays: 2, sortOrder: 4, isActive: true },
    { code: "GROUND", label: "Ground & Rail", mode: "GROUND", volumetricDivisor: 4000, minChargeableKg: 50, defaultTransitDays: 6, sortOrder: 5, isActive: true },
  ],
  containerTypes: [
    { code: "20GP", description: "20ft General Purpose", teu: 1, internalLengthM: 5.9, internalWidthM: 2.35, internalHeightM: 2.39, maxPayloadKg: 28200, capacityCbm: 33.2, isReefer: false, isActive: true },
    { code: "40GP", description: "40ft General Purpose", teu: 2, internalLengthM: 12.03, internalWidthM: 2.35, internalHeightM: 2.39, maxPayloadKg: 26680, capacityCbm: 67.7, isReefer: false, isActive: true },
    { code: "40HC", description: "40ft High Cube", teu: 2, internalLengthM: 12.03, internalWidthM: 2.35, internalHeightM: 2.69, maxPayloadKg: 26460, capacityCbm: 76.3, isReefer: false, isActive: true },
    { code: "20RF", description: "20ft Reefer", teu: 1, internalLengthM: 5.44, internalWidthM: 2.29, internalHeightM: 2.27, maxPayloadKg: 27400, capacityCbm: 28.3, isReefer: true, isActive: true },
    { code: "45HC", description: "45ft High Cube", teu: 2.25, internalLengthM: 13.56, internalWidthM: 2.35, internalHeightM: 2.69, maxPayloadKg: 27700, capacityCbm: 86.0, isReefer: false, isActive: true },
  ],
  cargoTypes: [
    { code: "GEN", label: "General Cargo", isHazardous: false, imoClass: null, requiresTempControl: false, handlingSurchargePct: 0, restrictedCountries: [], isActive: true },
    { code: "PERISH", label: "Perishable / Food", isHazardous: false, imoClass: null, requiresTempControl: true, tempRangeC: { min: 2, max: 8 }, handlingSurchargePct: 12, restrictedCountries: [], isActive: true },
    { code: "PHARMA", label: "Pharmaceuticals", isHazardous: false, imoClass: null, requiresTempControl: true, tempRangeC: { min: -20, max: 8 }, handlingSurchargePct: 18, restrictedCountries: [], isActive: true },
    { code: "DG3", label: "Flammable Liquids", isHazardous: true, imoClass: "3", requiresTempControl: false, handlingSurchargePct: 25, restrictedCountries: ["SG"], isActive: true },
    { code: "LIION", label: "Lithium Batteries", isHazardous: true, imoClass: "9", requiresTempControl: false, handlingSurchargePct: 30, restrictedCountries: [], isActive: true },
    { code: "AUTO", label: "Automotive Parts", isHazardous: false, imoClass: null, requiresTempControl: false, handlingSurchargePct: 5, restrictedCountries: [], isActive: true },
  ],
  commodities: [
    { hsCode: "620342", description: "Men's cotton trousers", cargoTypeCode: "GEN", defaultDutyPct: 12.0, requiresLicense: false, isActive: true },
    { hsCode: "870899", description: "Motor vehicle parts, other", cargoTypeCode: "AUTO", defaultDutyPct: 10.0, requiresLicense: false, isActive: true },
    { hsCode: "300490", description: "Medicaments, packaged doses", cargoTypeCode: "PHARMA", defaultDutyPct: 5.0, requiresLicense: true, isActive: true },
    { hsCode: "850760", description: "Lithium-ion accumulators", cargoTypeCode: "LIION", defaultDutyPct: 15.0, requiresLicense: true, isActive: true },
    { hsCode: "080450", description: "Mangoes, fresh or dried", cargoTypeCode: "PERISH", defaultDutyPct: 30.0, requiresLicense: false, isActive: true },
  ],
  packagingTypes: [
    { code: "PLT_EUR", label: "Euro Pallet (1200x800)", defaultTareKg: 25, stackable: true, isActive: true },
    { code: "PLT_STD", label: "Standard Pallet (1200x1000)", defaultTareKg: 30, stackable: true, isActive: true },
    { code: "CTN", label: "Carton Box", defaultTareKg: 0.5, stackable: true, isActive: true },
    { code: "CRATE", label: "Wooden Crate", defaultTareKg: 40, stackable: false, isActive: true },
    { code: "DRUM", label: "Steel Drum (200L)", defaultTareKg: 18, stackable: false, isActive: true },
  ],
  incoterms: [
    { code: "EXW", label: "Ex Works", version: "2020", freightPaidBy: "CONSIGNEE", insurancePaidBy: "CONSIGNEE", originChargesIncluded: false, destChargesIncluded: false, isActive: true },
    { code: "FOB", label: "Free On Board", version: "2020", freightPaidBy: "CONSIGNEE", insurancePaidBy: "CONSIGNEE", originChargesIncluded: true, destChargesIncluded: false, isActive: true },
    { code: "CIF", label: "Cost, Insurance and Freight", version: "2020", freightPaidBy: "SHIPPER", insurancePaidBy: "SHIPPER", originChargesIncluded: true, destChargesIncluded: false, isActive: true },
    { code: "DAP", label: "Delivered At Place", version: "2020", freightPaidBy: "SHIPPER", insurancePaidBy: "SHIPPER", originChargesIncluded: true, destChargesIncluded: true, isActive: true },
    { code: "DDP", label: "Delivered Duty Paid", version: "2020", freightPaidBy: "SHIPPER", insurancePaidBy: "SHIPPER", originChargesIncluded: true, destChargesIncluded: true, isActive: true },
  ],
  chargeHeads: [
    { code: "OFR", label: "Ocean Freight", category: "FREIGHT", calcBasis: "PER_CONTAINER", defaultValue: 950, currency: "USD", taxable: false, isActive: true },
    { code: "BAF", label: "Bunker Adjustment Factor", category: "FREIGHT", calcBasis: "PER_CONTAINER", defaultValue: 180, currency: "USD", taxable: false, isActive: true },
    { code: "THC_O", label: "Terminal Handling - Origin", category: "ORIGIN", calcBasis: "PER_CONTAINER", defaultValue: 8500, currency: "INR", taxable: true, isActive: true },
    { code: "THC_D", label: "Terminal Handling - Destination", category: "DEST", calcBasis: "PER_CONTAINER", defaultValue: 210, currency: "USD", taxable: true, isActive: true },
    { code: "DOC", label: "Documentation Fee", category: "ORIGIN", calcBasis: "PER_SHIPMENT", defaultValue: 3500, currency: "INR", taxable: true, isActive: true },
    { code: "CUSTCL", label: "Customs Clearance", category: "CUSTOMS", calcBasis: "PER_SHIPMENT", defaultValue: 5000, currency: "INR", taxable: true, isActive: true },
    { code: "INS", label: "Cargo Insurance", category: "FREIGHT", calcBasis: "PERCENT", defaultValue: 0.35, currency: "USD", taxable: false, isActive: true },
  ],
  currencies: [
    { code: "USD", name: "US Dollar", symbol: "$", decimalPlaces: 2, isBaseCurrency: true, isActive: true },
    { code: "INR", name: "Indian Rupee", symbol: "₹", decimalPlaces: 2, isBaseCurrency: false, isActive: true },
    { code: "EUR", name: "Euro", symbol: "€", decimalPlaces: 2, isBaseCurrency: false, isActive: true },
    { code: "AED", name: "UAE Dirham", symbol: "AED", decimalPlaces: 2, isBaseCurrency: false, isActive: true },
    { code: "SGD", name: "Singapore Dollar", symbol: "S$", decimalPlaces: 2, isBaseCurrency: false, isActive: true },
  ],
  exchangeRates: [
    { baseCurrency: "USD", quoteCurrency: "INR", rate: 87.42, effectiveFrom: "2026-08-01", effectiveTo: "2026-08-31", source: "ADMIN" },
    { baseCurrency: "USD", quoteCurrency: "EUR", rate: 0.91, effectiveFrom: "2026-08-01", effectiveTo: "2026-08-31", source: "ADMIN" },
    { baseCurrency: "USD", quoteCurrency: "AED", rate: 3.67, effectiveFrom: "2026-08-01", effectiveTo: "2026-08-31", source: "ADMIN" },
    { baseCurrency: "USD", quoteCurrency: "SGD", rate: 1.29, effectiveFrom: "2026-08-01", effectiveTo: "2026-08-31", source: "ADMIN" },
  ],
  rateCards: [
    { rateCardId: "RC-2026-0001", laneCode: "INNSA-AEJEA-OCEAN", carrierCode: "MAEU", serviceTypeCode: "FCL", containerTypeCode: "40HC", baseRate: 1150, currency: "USD", rateUnit: "PER_CONTAINER", charges: [{ chargeCode: "BAF", value: 180 }, { chargeCode: "THC_O", value: 8500 }], validFrom: "2026-08-01", validTo: "2026-10-31", isActive: true },
    { rateCardId: "RC-2026-0002", laneCode: "INNSA-NLRTM-OCEAN", carrierCode: "MSCU", serviceTypeCode: "FCL", containerTypeCode: "20GP", baseRate: 1780, currency: "USD", rateUnit: "PER_CONTAINER", charges: [{ chargeCode: "BAF", value: 240 }, { chargeCode: "THC_D", value: 210 }], validFrom: "2026-08-01", validTo: "2026-09-30", isActive: true },
    { rateCardId: "RC-2026-0003", laneCode: "INMAA-SGSIN-OCEAN", carrierCode: "CMDU", serviceTypeCode: "LCL", containerTypeCode: null, baseRate: 48, currency: "USD", rateUnit: "PER_CBM", charges: [{ chargeCode: "DOC", value: 3500 }], validFrom: "2026-07-15", validTo: "2026-12-31", isActive: true },
    { rateCardId: "RC-2026-0004", laneCode: "MAA-DXB-AIR", carrierCode: "EK", serviceTypeCode: "AIR_GEN", containerTypeCode: null, baseRate: 2.85, currency: "USD", rateUnit: "PER_KG", charges: [{ chargeCode: "DOC", value: 3500 }], validFrom: "2026-08-01", validTo: "2026-09-30", isActive: true },
  ],
  surchargeRules: [
    { ruleCode: "SUR-PEAK", label: "Peak Season Surcharge", appliesTo: { mode: "OCEAN", laneCode: null, cargoTypeCode: null }, triggerCondition: "month IN [8,9,10]", valueType: "FLAT", value: 300, currency: "USD", priority: 10, isActive: true },
    { ruleCode: "SUR-WAR", label: "War Risk / Red Sea Surcharge", appliesTo: { mode: "OCEAN", laneCode: "INNSA-NLRTM-OCEAN" }, triggerCondition: "riskZones CONTAINS 'RED_SEA'", valueType: "FLAT", value: 550, currency: "USD", priority: 5, isActive: true },
    { ruleCode: "SUR-DG", label: "Dangerous Goods Surcharge", appliesTo: { mode: null, cargoTypeCode: "DG3" }, triggerCondition: "cargo.isHazardous == true", valueType: "PERCENT", value: 25, currency: null, priority: 3, isActive: true },
    { ruleCode: "SUR-CONG", label: "Port Congestion Surcharge", appliesTo: { mode: "OCEAN", portCode: "INNSA" }, triggerCondition: "port.congestionIndex > 0.5", valueType: "FLAT", value: 120, currency: "USD", priority: 8, isActive: true },
  ],
  marginRules: [
    { ruleCode: "MR-STD-OCEAN", customerTier: "STANDARD", mode: "OCEAN", laneCode: null, marginType: "PERCENT", marginValue: 18, minMarginUsd: 120, maxDiscountPct: 5, isActive: true },
    { ruleCode: "MR-GOLD-OCEAN", customerTier: "GOLD", mode: "OCEAN", laneCode: null, marginType: "PERCENT", marginValue: 11, minMarginUsd: 90, maxDiscountPct: 12, isActive: true },
    { ruleCode: "MR-STD-AIR", customerTier: "STANDARD", mode: "AIR", laneCode: null, marginType: "PERCENT", marginValue: 22, minMarginUsd: 60, maxDiscountPct: 6, isActive: true },
    { ruleCode: "MR-ENT-ALL", customerTier: "ENTERPRISE", mode: null, laneCode: null, marginType: "PERCENT", marginValue: 8, minMarginUsd: 75, maxDiscountPct: 15, isActive: true },
  ],
  customsTariffs: [
    { countryCode: "AE", hsCode: "620342", dutyPct: 5.0, vatPct: 5.0, otherLevies: [], requiredDocs: ["COMMERCIAL_INVOICE", "PACKING_LIST", "COO"], effectiveFrom: "2026-01-01", isActive: true },
    { countryCode: "NL", hsCode: "870899", dutyPct: 4.5, vatPct: 21.0, otherLevies: [{ name: "EU Handling", pct: 0.5 }], requiredDocs: ["COMMERCIAL_INVOICE", "PACKING_LIST", "EUR1"], effectiveFrom: "2026-01-01", isActive: true },
    { countryCode: "IN", hsCode: "850760", dutyPct: 15.0, vatPct: 18.0, otherLevies: [{ name: "Social Welfare Surcharge", pct: 10 }], requiredDocs: ["COMMERCIAL_INVOICE", "BIS_CERT", "MSDS"], effectiveFrom: "2026-04-01", isActive: true },
    { countryCode: "SG", hsCode: "080450", dutyPct: 0.0, vatPct: 9.0, otherLevies: [], requiredDocs: ["PHYTOSANITARY", "COMMERCIAL_INVOICE"], effectiveFrom: "2026-01-01", isActive: true },
  ],
  documentTypes: [
    { code: "COMMERCIAL_INVOICE", label: "Commercial Invoice", issuedBy: "SHIPPER", mandatoryFor: ["OCEAN", "AIR", "GROUND"], isActive: true },
    { code: "PACKING_LIST", label: "Packing List", issuedBy: "SHIPPER", mandatoryFor: ["OCEAN", "AIR", "GROUND"], isActive: true },
    { code: "BL", label: "Bill of Lading", issuedBy: "CARRIER", mandatoryFor: ["OCEAN"], isActive: true },
    { code: "AWB", label: "Air Waybill", issuedBy: "CARRIER", mandatoryFor: ["AIR"], isActive: true },
    { code: "COO", label: "Certificate of Origin", issuedBy: "AUTHORITY", mandatoryFor: [], isActive: true },
    { code: "MSDS", label: "Material Safety Data Sheet", issuedBy: "SHIPPER", mandatoryFor: ["DG3", "LIION"], isActive: true },
    { code: "PHYTOSANITARY", label: "Phytosanitary Certificate", issuedBy: "AUTHORITY", mandatoryFor: ["PERISH"], isActive: true },
  ],
  customerTiers: [
    { code: "STANDARD", label: "Standard", minAnnualVolumeTeu: 0, discountPct: 0, creditDays: 0, slaResponseHrs: 24, isActive: true },
    { code: "SILVER", label: "Silver", minAnnualVolumeTeu: 50, discountPct: 3, creditDays: 15, slaResponseHrs: 12, isActive: true },
    { code: "GOLD", label: "Gold", minAnnualVolumeTeu: 250, discountPct: 7, creditDays: 30, slaResponseHrs: 6, isActive: true },
    { code: "ENTERPRISE", label: "Enterprise", minAnnualVolumeTeu: 1000, discountPct: 12, creditDays: 60, slaResponseHrs: 2, isActive: true },
  ],
  masterDataAudit: [
    { collectionName: "rateCards", recordId: "RC-2026-0001", action: "UPDATE", changedFields: { baseRate: { old: 1090, new: 1150 } }, performedBy: "adm_001", performedAt: "2026-08-04T09:12:00Z", ipAddress: "10.4.2.18" },
    { collectionName: "ports", recordId: "INNSA", action: "UPDATE", changedFields: { congestionIndex: { old: 0.38, new: 0.55 } }, performedBy: "adm_002", performedAt: "2026-08-06T14:30:00Z", ipAddress: "10.4.2.21" },
    { collectionName: "surchargeRules", recordId: "SUR-WAR", action: "CREATE", changedFields: {}, performedBy: "adm_001", performedAt: "2026-07-28T11:05:00Z", ipAddress: "10.4.2.18" },
  ],
};

const CATEGORIES = [
  {
    id: "network",
    label: "Geography & Network",
    icon: FaGlobe,
    collections: [
      { id: "countries", label: "Countries" },
      { id: "ports", label: "Ports & Airports" },
      { id: "tradeLanes", label: "Trade Lanes" },
    ],
  },
  {
    id: "cargo",
    label: "Carriers & Freight",
    icon: FaShip,
    collections: [
      { id: "carriers", label: "Carriers" },
      { id: "serviceTypes", label: "Service Types" },
      { id: "containerTypes", label: "Container Types" },
      { id: "cargoTypes", label: "Cargo Types" },
      { id: "packagingTypes", label: "Packaging Types" },
      { id: "commodities", label: "Commodities (HS)" },
    ],
  },
  {
    id: "pricing",
    label: "Tariffs & Pricing Engine",
    icon: FaBoxes,
    collections: [
      { id: "rateCards", label: "Base Tariff Rate Cards" },
      { id: "chargeHeads", label: "Charge Heads" },
      { id: "currencies", label: "Currencies" },
      { id: "exchangeRates", label: "FX Exchange Rates" },
      { id: "surchargeRules", label: "Surcharge Rules" },
      { id: "marginRules", label: "Margin Rules" },
      { id: "customsTariffs", label: "Customs Tariffs" },
      { id: "incoterms", label: "Incoterms 2020" },
    ],
  },
  {
    id: "governance",
    label: "Governance & Audit",
    icon: FaFileContract,
    collections: [
      { id: "documentTypes", label: "Document Types" },
      { id: "customerTiers", label: "Customer Tiers" },
      { id: "masterDataAudit", label: "Master Data Change Log" },
    ],
  },
];

export default function AdminMasterData() {
  const [activeCategory, setActiveCategory] = useState("network");
  const [activeCollection, setActiveCollection] = useState("countries");
  const [collections, setCollections] = useState(MASTER_COLLECTIONS_SEED);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [formDataJson, setFormDataJson] = useState("");
  const [toastMsg, setToastMsg] = useState("");

  const currentCategoryObj = CATEGORIES.find((c) => c.id === activeCategory);
  const rawList = collections[activeCollection] || [];

  const filteredList = rawList.filter((item) => {
    const jsonStr = JSON.stringify(item).toLowerCase();
    return jsonStr.includes(searchTerm.toLowerCase());
  });

  function toggleRecordActive(index) {
    setCollections((prev) => {
      const list = [...prev[activeCollection]];
      list[index] = { ...list[index], isActive: !list[index].isActive };
      return { ...prev, [activeCollection]: list };
    });
    setToastMsg(`Status toggled for record #${index + 1}`);
    setTimeout(() => setToastMsg(""), 3000);
  }

  function handleCategorySelect(catId) {
    setActiveCategory(catId);
    const catObj = CATEGORIES.find((c) => c.id === catId);
    if (catObj && catObj.collections.length > 0) {
      setActiveCollection(catObj.collections[0].id);
    }
  }

  function openJsonInspector(record) {
    setSelectedRecord(record);
    setShowJsonModal(true);
  }

  function openAddModal() {
    setEditingIndex(null);
    const sample = rawList[0] ? { ...rawList[0] } : { isActive: true };
    setFormDataJson(JSON.stringify(sample, null, 2));
    setShowFormModal(true);
  }

  function openEditModal(record, index) {
    setEditingIndex(index);
    setFormDataJson(JSON.stringify(record, null, 2));
    setShowFormModal(true);
  }

  function handleSaveRecord() {
    try {
      const parsed = JSON.parse(formDataJson);
      setCollections((prev) => {
        const list = [...prev[activeCollection]];
        if (editingIndex !== null) {
          list[editingIndex] = parsed;
        } else {
          list.unshift(parsed);
        }
        return { ...prev, [activeCollection]: list };
      });
      setShowFormModal(false);
      setToastMsg(editingIndex !== null ? "Record updated successfully" : "New record added successfully");
      setTimeout(() => setToastMsg(""), 3000);
    } catch (err) {
      alert("Invalid JSON format. Please format your record correctly.");
    }
  }

  function handleDeleteRecord(index) {
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    setCollections((prev) => {
      const list = prev[activeCollection].filter((_, i) => i !== index);
      return { ...prev, [activeCollection]: list };
    });
    setToastMsg("Record deleted successfully");
    setTimeout(() => setToastMsg(""), 3000);
  }

  return (
    <div className="admin-masterdata">
      {/* Header Banner */}
      <div className="agent-header-banner">
        <div className="agent-title-block">
          <h1>Master Data Collections — MongoDB</h1>
          <p>Admin-managed reference schemas consumed by the FreightQuote AI Engine</p>
        </div>
        <div className="agent-badge-tag">
          <span className="agent-badge-dot" />
          19 Active Master Collections
        </div>
      </div>

      {/* Main Category Sub-Navbar */}
      <div className="md-category-bar">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              className={`md-category-btn ${activeCategory === cat.id ? "active" : ""}`}
              onClick={() => handleCategorySelect(cat.id)}
            >
              <Icon /> {cat.label}
            </button>
          );
        })}
      </div>

      {/* Sub-Collection Selector Tabs */}
      <div className="md-subnav-bar">
        {currentCategoryObj?.collections.map((sub) => (
          <button
            key={sub.id}
            className={`md-subnav-tab ${activeCollection === sub.id ? "active" : ""}`}
            onClick={() => setActiveCollection(sub.id)}
          >
            {sub.label}
            <span className="md-badge-count">{collections[sub.id]?.length || 0}</span>
          </button>
        ))}
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="md-toast-banner">
          <FaCheckCircle /> {toastMsg}
        </div>
      )}

      {/* Main Workspace Card */}
      <div className="agent-panel-card">
        <div className="agent-panel-header md-workspace-header">
          <div className="md-header-left">
            <h2 className="agent-panel-title">
              Collection: <code className="md-collection-name">db.{activeCollection}</code>
            </h2>
            <span className="md-total-text">{filteredList.length} records</span>
          </div>

          <div className="md-header-actions">
            <div className="md-search-box">
              <FaSearch />
              <input
                type="text"
                placeholder="Search collection..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="agent-action-btn md-add-btn"
              onClick={openAddModal}
            >
              <FaPlus /> Add Record
            </button>
          </div>
        </div>

        {/* Dynamic Schema Table Component */}
        <div className="agent-table-wrap">
          <RenderSchemaTable
            collectionKey={activeCollection}
            data={filteredList}
            onToggleActive={toggleRecordActive}
            onInspect={openJsonInspector}
            onEdit={openEditModal}
            onDelete={handleDeleteRecord}
          />
        </div>
      </div>

      {/* Add / Edit Record Form Modal */}
      {showFormModal && (
        <div className="md-modal-backdrop" onClick={() => setShowFormModal(false)}>
          <div className="md-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="md-modal-header">
              <h3>{editingIndex !== null ? `Edit Record (db.${activeCollection})` : `Add Record to db.${activeCollection}`}</h3>
              <button className="md-close-btn" onClick={() => setShowFormModal(false)}>&times;</button>
            </div>
            <div className="md-modal-body">
              <label style={{ color: "#94a3b8", fontSize: "12px", display: "block", marginBottom: "8px" }}>
                JSON Record Payload:
              </label>
              <textarea
                className="md-json-textarea"
                rows={12}
                value={formDataJson}
                onChange={(e) => setFormDataJson(e.target.value)}
              />
              <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" className="agent-btn-sm" style={{ background: "#475569" }} onClick={() => setShowFormModal(false)}>
                  Cancel
                </button>
                <button type="button" className="agent-action-btn" onClick={handleSaveRecord}>
                  Save Document
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* JSON Record Inspector Modal */}
      {showJsonModal && selectedRecord && (
        <div className="md-modal-backdrop" onClick={() => setShowJsonModal(false)}>
          <div className="md-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="md-modal-header">
              <h3>JSON Document Spec — db.{activeCollection}</h3>
              <button className="md-close-btn" onClick={() => setShowJsonModal(false)}>&times;</button>
            </div>
            <div className="md-modal-body">
              <pre className="md-json-block">{JSON.stringify(selectedRecord, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-component to format specific MongoDB schemas dynamically
function RenderSchemaTable({ collectionKey, data, onToggleActive, onInspect, onEdit, onDelete }) {
  if (!data || data.length === 0) {
    return <div className="md-empty-state">No records found matching your search.</div>;
  }

  // Helper to extract table columns dynamically
  const sampleKeys = Object.keys(data[0]);

  return (
    <table className="agent-table md-data-table">
      <thead>
        <tr>
          {sampleKeys.slice(0, 6).map((k) => (
            <th key={k}>{formatHeaderKey(k)}</th>
          ))}
          <th>Status</th>
          <th>JSON Spec</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row, idx) => (
          <tr key={idx}>
            {sampleKeys.slice(0, 6).map((k) => (
              <td key={k}>{renderTableCellValue(row[k])}</td>
            ))}
            <td>
              <span className={`badge-status ${row.isActive !== false ? "status-approved" : "status-pending"}`}>
                {row.isActive !== false ? "Active" : "Inactive"}
              </span>
            </td>
            <td>
              <button type="button" className="md-btn-icon" onClick={() => onInspect(row)}>
                <FaCode /> Inspect
              </button>
            </td>
            <td>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  className="md-btn-icon"
                  onClick={() => onEdit(row, idx)}
                  title="Edit Record"
                >
                  <FaEdit />
                </button>
                <button
                  type="button"
                  className="md-btn-toggle"
                  onClick={() => onToggleActive(idx)}
                  title="Toggle Active"
                >
                  {row.isActive !== false ? <FaToggleOn className="toggle-on" /> : <FaToggleOff className="toggle-off" />}
                </button>
                <button
                  type="button"
                  className="md-btn-icon"
                  style={{ color: "#ef4444", borderColor: "#fca5a5" }}
                  onClick={() => onDelete(idx)}
                  title="Delete Record"
                >
                  <FaTrash />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatHeaderKey(key) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
}

function renderTableCellValue(val) {
  if (val === null || val === undefined) return <span className="md-null-val">null</span>;
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "object") return <code className="md-code-inline">{JSON.stringify(val)}</code>;
  return String(val);
}
