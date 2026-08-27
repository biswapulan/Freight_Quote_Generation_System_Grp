"""Seeded International Trade Regulations and HS Code Reference Database.

Contains realistic regulatory corpus and commodity rules across major global trade corridors
(EU, USA, India, Singapore, UAE, China, UK) for hybrid RAG indexing and compliance verification.
"""

from typing import List, Dict, Any


SEED_HS_CODES = [
    {
        "hs_code": "850440",
        "description": "Static converters (e.g. rectifiers, inverters, power supplies for automatic data processing machines)",
        "chapter": "85",
        "heading": "04",
        "subheading": "40",
        "commodity_type": "Electronics",
        "restricted": False,
        "prohibited": False,
        "country": "GLOBAL",
    },
    {
        "hs_code": "847130",
        "description": "Portable automatic data processing machines, weighing not more than 10 kg (Laptops, Tablets)",
        "chapter": "84",
        "heading": "71",
        "subheading": "30",
        "commodity_type": "Electronics",
        "restricted": False,
        "prohibited": False,
        "country": "GLOBAL",
    },
    {
        "hs_code": "290511",
        "description": "Methanol (methyl alcohol) - Industrial solvent & fuel feedstock",
        "chapter": "29",
        "heading": "05",
        "subheading": "11",
        "commodity_type": "Chemicals / Hazardous",
        "restricted": True,
        "prohibited": False,
        "country": "GLOBAL",
    },
    {
        "hs_code": "300490",
        "description": "Medicaments consisting of mixed or unmixed products for therapeutic or prophylactic uses",
        "chapter": "30",
        "heading": "04",
        "subheading": "90",
        "commodity_type": "Pharmaceuticals",
        "restricted": True,
        "prohibited": False,
        "country": "GLOBAL",
    },
    {
        "hs_code": "090111",
        "description": "Coffee, not roasted, not decaffeinated (Green Coffee Beans)",
        "chapter": "09",
        "heading": "01",
        "subheading": "11",
        "commodity_type": "Agricultural / Perishables",
        "restricted": False,
        "prohibited": False,
        "country": "GLOBAL",
    },
    {
        "hs_code": "870829",
        "description": "Other parts and accessories of bodies for motor vehicles",
        "chapter": "87",
        "heading": "08",
        "subheading": "29",
        "commodity_type": "Automotive Parts",
        "restricted": False,
        "prohibited": False,
        "country": "GLOBAL",
    },
    {
        "hs_code": "610910",
        "description": "T-shirts, singlets and other vests, knitted or crocheted, of cotton",
        "chapter": "61",
        "heading": "09",
        "subheading": "10",
        "commodity_type": "Textiles & Apparel",
        "restricted": False,
        "prohibited": False,
        "country": "GLOBAL",
    },
    {
        "hs_code": "930200",
        "description": "Revolvers and pistols, other than those of heading 93.03 or 93.04 (Firearms)",
        "chapter": "93",
        "heading": "02",
        "subheading": "00",
        "commodity_type": "Weapons & Munitions",
        "restricted": True,
        "prohibited": True,
        "country": "GLOBAL",
    },
]


SEED_REGULATIONS = [
    {
        "title": "European Union Union Customs Code (UCC) - Regulation (EU) No 952/2013",
        "country": "Netherlands",
        "authority": "EU_TAXUD",
        "document_type": "IMPORT_TARIFF_REGULATION",
        "source_url": "https://taxation-customs.ec.europa.eu/customs-4/union-customs-code_en",
        "source_name": "Official Journal of the European Union",
        "version": "2024.1",
        "chunks": [
            {
                "section_name": "Article 127 - Entry Summary Declaration (ENS)",
                "content": "Goods brought into the customs territory of the Union must be covered by an Entry Summary Declaration (ENS) lodged electronically at the customs office of first entry at least 24 hours prior to container loading at the port of departure.",
                "page_number": 42,
            },
            {
                "section_name": "TARIC Chapter 85 - Electronic Equipment Conformity & CE Marking",
                "content": "Static power converters (HS 850440) and electronic apparatus entering EU member states (e.g. Port of Rotterdam) require a valid CE Declaration of Conformity and RoHS compliance statement under EU Directive 2014/30/EU. Lack of documentation subjects goods to immediate customs impoundment.",
                "page_number": 118,
            },
            {
                "section_name": "Article 166 - Simplified Declarations & Preferential Origin",
                "content": "Importers claiming preferential tariff rates from trade agreements must submit a certified Certificate of Origin (Form A or Registered Exporter REX statement).",
                "page_number": 75,
            },
        ],
    },
    {
        "title": "United States Customs and Border Protection (19 CFR Part 141) Import Regulations",
        "country": "USA",
        "authority": "US_CBP",
        "document_type": "TARIFF_SCHEDULE",
        "source_url": "https://www.cbp.gov/trade/basic-import-export",
        "source_name": "US Code of Federal Regulations",
        "version": "2024.2",
        "chunks": [
            {
                "section_name": "19 CFR § 141.68 - Importer Security Filing (ISF 10+2)",
                "content": "For ocean cargo arriving into US ports (e.g., New York, Los Angeles), the ISF 10+2 elements must be transmitted to CBP no later than 24 hours before cargo is laden aboard the vessel at the foreign port.",
                "page_number": 28,
            },
            {
                "section_name": "19 CFR § 142.3 - Mandatory Entry Documentation",
                "content": "Customs Form 3461 (Entry/Immediate Delivery), commercial invoice, packing list, and bill of lading must be presented within 15 working days of cargo arrival.",
                "page_number": 33,
            },
            {
                "section_name": "HTS Section VI - Dangerous Goods & Chemical Substances (TSCA)",
                "content": "Chemical importations under Chapter 29 (including Methanol HS 290511) require TSCA (Toxic Substances Control Act) Section 13 certification and standard 16-point Material Safety Data Sheets (MSDS).",
                "page_number": 90,
            },
        ],
    },
    {
        "title": "Indian Customs Tariff Act 1975 & Central Board of Indirect Taxes & Customs (CBIC)",
        "country": "India",
        "authority": "CBIC_INDIA",
        "document_type": "TARIFF_SCHEDULE",
        "source_url": "https://www.cbic.gov.in/",
        "source_name": "Ministry of Finance India",
        "version": "2024.1",
        "chunks": [
            {
                "section_name": "Section 46 - Bill of Entry Regulations",
                "content": "Importers must submit Bill of Entry electronically through ICEGATE prior to or upon arrival of vessel at Indian ports (Chennai, Nhava Sheva). Late submission incurs demurrage penalties.",
                "page_number": 15,
            },
            {
                "section_name": "Plant Quarantine (Regulation of Import into India) Order",
                "content": "Agricultural commodities including coffee beans (HS 090111) and perishable spices require an official Phytosanitary Certificate issued by the National Plant Protection Organization of the exporting country.",
                "page_number": 64,
            },
        ],
    },
    {
        "title": "Singapore Customs Import & Export TradeNet Regulatory Framework",
        "country": "Singapore",
        "authority": "SINGAPORE_CUSTOMS",
        "document_type": "TRADE_GUIDELINES",
        "source_url": "https://www.customs.gov.sg/",
        "source_name": "Singapore Customs Authority",
        "version": "2024.1",
        "chunks": [
            {
                "section_name": "Chapter 4 - Inward Customs Permits for Transshipment",
                "content": "All goods transshipping through the Port of Singapore require an Inward TradeNet transshipment declaration within 48 hours of vessel discharge.",
                "page_number": 22,
            },
            {
                "section_name": "Strategic Goods (Control) Act (SGCA)",
                "content": "Dual-use technology, advanced electronics, and munitions (HS Chapter 93) require Strategic Goods Individual Permits prior to berthing or cargo transfer.",
                "page_number": 88,
            },
        ],
    },
    {
        "title": "Dubai Customs & UAE Federal Customs Authority (FCA) Import Directives",
        "country": "UAE",
        "authority": "DUBAI_CUSTOMS",
        "document_type": "IMPORT_TARIFF_REGULATION",
        "source_url": "https://www.dubaicustoms.gov.ae/",
        "source_name": "Dubai Customs Trade Portal",
        "version": "2024.1",
        "chunks": [
            {
                "section_name": "Customs Notice No. 5/2022 - Mirsal 2 Declaration Requirements",
                "content": "All imports into Jebel Ali Free Zone and mainland Dubai must submit Mirsal 2 customs clearance declarations with commercial invoice authenticated by Chamber of Commerce and legalized Certificate of Origin.",
                "page_number": 12,
            },
        ],
    },
]
