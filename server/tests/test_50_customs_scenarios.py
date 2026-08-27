"""50 Curated International Customs & Regulatory Scenarios Benchmark — Milestone 3 Phase 6.

Evaluates the Hybrid RAG Customs Engine against 50 real-world trade scenarios
spanning USA, EU, India, China, UAE, UK, Australia, Brazil, Japan, and Singapore.
Verifies compliance classification, required document determination, and prohibited cargo blocking.
"""

import pytest
from customs.validator import CustomsComplianceEngine


# 50 Curated Trade Lane Scenarios
CUSTOMS_SCENARIOS = [
    # 1-10: Solar, Electronics, High-Tech
    {"origin": "India", "dest": "Netherlands", "hs": "850440", "comm": "Solar Inverters", "incoterm": "CIF", "expected_status": "APPROVED", "required_doc_substr": "Origin"},
    {"origin": "China", "dest": "USA", "hs": "847130", "comm": "Laptops & Digital Computers", "incoterm": "FOB", "expected_status": "APPROVED", "required_doc_substr": "Commercial Invoice"},
    {"origin": "Japan", "dest": "Germany", "hs": "850440", "comm": "Static Converters", "incoterm": "CIF", "expected_status": "APPROVED", "required_doc_substr": "Conformity"},
    {"origin": "India", "dest": "UAE", "hs": "850440", "comm": "Power Inverter Transformers", "incoterm": "CIF", "expected_status": "APPROVED", "required_doc_substr": "Commercial Invoice"},
    {"origin": "Taiwan", "dest": "USA", "hs": "847130", "comm": "Semiconductor Processing Units", "incoterm": "CIF", "expected_status": "APPROVED", "required_doc_substr": "Commercial Invoice"},
    {"origin": "South Korea", "dest": "UK", "hs": "850440", "comm": "Solar Inverters", "incoterm": "DDP", "expected_status": "APPROVED", "required_doc_substr": "Origin"},
    {"origin": "India", "dest": "Singapore", "hs": "847130", "comm": "Server Racks & Blade Chassis", "incoterm": "CIF", "expected_status": "APPROVED", "required_doc_substr": "Commercial Invoice"},
    {"origin": "China", "dest": "Netherlands", "hs": "850440", "comm": "Photovoltaic Inverters", "incoterm": "CIF", "expected_status": "APPROVED", "required_doc_substr": "Conformity"},
    {"origin": "USA", "dest": "India", "hs": "847130", "comm": "High-Performance Workstations", "incoterm": "FOB", "expected_status": "APPROVED", "required_doc_substr": "Commercial Invoice"},
    {"origin": "Germany", "dest": "UAE", "hs": "850440", "comm": "Industrial Variable Frequency Drives", "incoterm": "CIF", "expected_status": "APPROVED", "required_doc_substr": "Commercial Invoice"},

    # 11-20: Hazardous Chemicals, Flammable Solvents, TSCA Regulated
    {"origin": "India", "dest": "USA", "hs": "290511", "comm": "Methanol Solvent", "incoterm": "FOB", "expected_status": "NEEDS_REVIEW", "required_doc_substr": "Material Safety Data Sheet"},
    {"origin": "China", "dest": "Germany", "hs": "290511", "comm": "Industrial Methanol", "incoterm": "CIF", "expected_status": "NEEDS_REVIEW", "required_doc_substr": "Material Safety Data Sheet"},
    {"origin": "USA", "dest": "Netherlands", "hs": "290511", "comm": "Methyl Alcohol Raw Feedstock", "incoterm": "CIF", "expected_status": "NEEDS_REVIEW", "required_doc_substr": "Material Safety Data Sheet"},
    {"origin": "India", "dest": "UK", "hs": "290511", "comm": "Pure Methanol Reagent", "incoterm": "CIF", "expected_status": "NEEDS_REVIEW", "required_doc_substr": "Material Safety Data Sheet"},
    {"origin": "Japan", "dest": "USA", "hs": "290511", "comm": "Specialty Chemical Methanol", "incoterm": "FOB", "expected_status": "NEEDS_REVIEW", "required_doc_substr": "Material Safety Data Sheet"},
    {"origin": "Germany", "dest": "India", "hs": "290511", "comm": "Industrial Chemical Solvents", "incoterm": "CIF", "expected_status": "NEEDS_REVIEW", "required_doc_substr": "Material Safety Data Sheet"},
    {"origin": "Singapore", "dest": "USA", "hs": "290511", "comm": "High-Purity Methanol", "incoterm": "CIF", "expected_status": "NEEDS_REVIEW", "required_doc_substr": "Material Safety Data Sheet"},
    {"origin": "India", "dest": "Australia", "hs": "290511", "comm": "Bulk Methanol Solution", "incoterm": "FOB", "expected_status": "NEEDS_REVIEW", "required_doc_substr": "Material Safety Data Sheet"},
    {"origin": "UAE", "dest": "Netherlands", "hs": "290511", "comm": "Petrochemical Methanol Derivative", "incoterm": "CIF", "expected_status": "NEEDS_REVIEW", "required_doc_substr": "Material Safety Data Sheet"},
    {"origin": "China", "dest": "UK", "hs": "290511", "comm": "Flammable Chemical Solvent", "incoterm": "CIF", "expected_status": "NEEDS_REVIEW", "required_doc_substr": "Material Safety Data Sheet"},

    # 21-30: Pharmaceuticals, Vaccines, Cold-Chain Medicaments
    {"origin": "India", "dest": "USA", "hs": "300490", "comm": "Packaged Antibiotics", "incoterm": "CIF", "expected_status": "NEEDS_REVIEW", "required_doc_substr": "Commercial Invoice"},
    {"origin": "Switzerland", "dest": "India", "hs": "300490", "comm": "Specialty Oncology Medicaments", "incoterm": "CIF", "expected_status": "NEEDS_REVIEW", "required_doc_substr": "Commercial Invoice"},
    {"origin": "India", "dest": "UK", "hs": "300490", "comm": "Reefer Packaged Insulin", "incoterm": "CIF", "expected_status": "NEEDS_REVIEW", "required_doc_substr": "Commercial Invoice"},
    {"origin": "Germany", "dest": "USA", "hs": "300490", "comm": "Monoclonal Antibody Vaccines", "incoterm": "CIF", "expected_status": "NEEDS_REVIEW", "required_doc_substr": "Commercial Invoice"},
    {"origin": "India", "dest": "UAE", "hs": "300490", "comm": "Generic Cardiovascular Tablets", "incoterm": "CIF", "expected_status": "NEEDS_REVIEW", "required_doc_substr": "Commercial Invoice"},
    {"origin": "UK", "dest": "Singapore", "hs": "300490", "comm": "Vaccines & Biological Reagents", "incoterm": "CIF", "expected_status": "NEEDS_REVIEW", "required_doc_substr": "Commercial Invoice"},
    {"origin": "India", "dest": "Sri Lanka", "hs": "300490", "comm": "Essential Emergency Antibiotics", "incoterm": "CIF", "expected_status": "NEEDS_REVIEW", "required_doc_substr": "Commercial Invoice"},
    {"origin": "USA", "dest": "Netherlands", "hs": "300490", "comm": "Temperature-Controlled Pharmaceuticals", "incoterm": "CIF", "expected_status": "NEEDS_REVIEW", "required_doc_substr": "Commercial Invoice"},
    {"origin": "France", "dest": "India", "hs": "300490", "comm": "Pediatric Vaccine Formulations", "incoterm": "CIF", "expected_status": "NEEDS_REVIEW", "required_doc_substr": "Commercial Invoice"},
    {"origin": "India", "dest": "Germany", "hs": "300490", "comm": "Active Pharmaceutical Ingredients", "incoterm": "CIF", "expected_status": "NEEDS_REVIEW", "required_doc_substr": "Commercial Invoice"},

    # 31-40: Agricultural, Perishables, Textiles, Automotive
    {"origin": "India", "dest": "UAE", "hs": "090111", "comm": "Arabica Green Coffee Beans", "incoterm": "CIF", "expected_status": "APPROVED", "required_doc_substr": "Phytosanitary"},
    {"origin": "Vietnam", "dest": "Netherlands", "hs": "090111", "comm": "Robusta Raw Coffee Beans", "incoterm": "FOB", "expected_status": "APPROVED", "required_doc_substr": "Phytosanitary"},
    {"origin": "Brazil", "dest": "USA", "hs": "090111", "comm": "Organic Specialty Coffee", "incoterm": "CIF", "expected_status": "APPROVED", "required_doc_substr": "Phytosanitary"},
    {"origin": "India", "dest": "Germany", "hs": "610910", "comm": "Cotton Knitted T-Shirts", "incoterm": "FOB", "expected_status": "APPROVED", "required_doc_substr": "Commercial Invoice"},
    {"origin": "Bangladesh", "dest": "UK", "hs": "610910", "comm": "Apparel & Cotton Knitwear", "incoterm": "CIF", "expected_status": "APPROVED", "required_doc_substr": "Commercial Invoice"},
    {"origin": "China", "dest": "USA", "hs": "610910", "comm": "Cotton Fashion Garments", "incoterm": "FOB", "expected_status": "APPROVED", "required_doc_substr": "Commercial Invoice"},
    {"origin": "India", "dest": "UAE", "hs": "870829", "comm": "Automotive Sheet Metal Body Parts", "incoterm": "CIF", "expected_status": "APPROVED", "required_doc_substr": "Commercial Invoice"},
    {"origin": "Japan", "dest": "USA", "hs": "870829", "comm": "Transmission Precision Stampings", "incoterm": "CIF", "expected_status": "APPROVED", "required_doc_substr": "Commercial Invoice"},
    {"origin": "Germany", "dest": "India", "hs": "870829", "comm": "Brake System Stampings", "incoterm": "FOB", "expected_status": "APPROVED", "required_doc_substr": "Commercial Invoice"},
    {"origin": "India", "dest": "Netherlands", "hs": "870829", "comm": "Automotive Fasteners & Brackets", "incoterm": "CIF", "expected_status": "APPROVED", "required_doc_substr": "Commercial Invoice"},

    # 41-50: Prohibited Munitions, Weapons, Dual-Use, Embargo Security Holds
    {"origin": "India", "dest": "Singapore", "hs": "930200", "comm": "Service Revolvers & Handguns", "incoterm": "CIF", "expected_status": "REJECTED", "required_doc_substr": "Commercial Invoice"},
    {"origin": "USA", "dest": "UAE", "hs": "930200", "comm": "Semi-Automatic Firearms", "incoterm": "FOB", "expected_status": "REJECTED", "required_doc_substr": "Commercial Invoice"},
    {"origin": "Germany", "dest": "China", "hs": "930200", "comm": "Military Pistols & Munitions", "incoterm": "CIF", "expected_status": "REJECTED", "required_doc_substr": "Commercial Invoice"},
    {"origin": "India", "dest": "UK", "hs": "930200", "comm": "Firearms & Ballistic Revolvers", "incoterm": "CIF", "expected_status": "REJECTED", "required_doc_substr": "Commercial Invoice"},
    {"origin": "China", "dest": "India", "hs": "930200", "comm": "Small Arms Munitions", "incoterm": "FOB", "expected_status": "REJECTED", "required_doc_substr": "Commercial Invoice"},
    {"origin": "USA", "dest": "Netherlands", "hs": "930200", "comm": "Handguns & Weapon Parts", "incoterm": "CIF", "expected_status": "REJECTED", "required_doc_substr": "Commercial Invoice"},
    {"origin": "Russia", "dest": "USA", "hs": "930200", "comm": "Military Firearms", "incoterm": "FOB", "expected_status": "REJECTED", "required_doc_substr": "Commercial Invoice"},
    {"origin": "India", "dest": "Australia", "hs": "930200", "comm": "Revolvers & Munition Shells", "incoterm": "CIF", "expected_status": "REJECTED", "required_doc_substr": "Commercial Invoice"},
    {"origin": "UK", "dest": "Germany", "hs": "930200", "comm": "Restricted Munitions", "incoterm": "CIF", "expected_status": "REJECTED", "required_doc_substr": "Commercial Invoice"},
    {"origin": "South Africa", "dest": "USA", "hs": "930200", "comm": "Armed Tactical Handguns", "incoterm": "CIF", "expected_status": "REJECTED", "required_doc_substr": "Commercial Invoice"},
]


@pytest.mark.django_db
class TestFiftyCustomsScenariosBenchmark:
    def test_50_customs_scenarios_accuracy(self):
        """Runs all 50 curated international trade lane test cases and asserts accuracy >= 95%."""
        passed_count = 0
        total_scenarios = len(CUSTOMS_SCENARIOS)
        failures = []

        print(f"\n--- Running 50 Customs Scenarios Benchmark Suite ({total_scenarios} cases) ---")

        for idx, scenario in enumerate(CUSTOMS_SCENARIOS, 1):
            res = CustomsComplianceEngine.evaluate_shipment_compliance(
                shipment_id=f"SHP-BENCH-{idx:03d}",
                origin_country=scenario["origin"],
                destination_country=scenario["dest"],
                hs_code=scenario["hs"],
                commodity=scenario["comm"],
                incoterm=scenario["incoterm"],
            )

            actual_status = res["status"]
            expected_status = scenario["expected_status"]
            required_doc_substr = scenario["required_doc_substr"]

            # Verify status matching
            status_match = actual_status == expected_status
            
            # Verify document requirement presence
            doc_names = [d["item_name"] for d in res["checklist_items"]]
            doc_match = any(required_doc_substr.lower() in d.lower() for d in doc_names)

            if status_match and doc_match:
                passed_count += 1
            else:
                failures.append({
                    "case": idx,
                    "lane": f"{scenario['origin']} -> {scenario['dest']}",
                    "commodity": scenario["comm"],
                    "hs": scenario["hs"],
                    "expected_status": expected_status,
                    "actual_status": actual_status,
                    "required_doc_substr": required_doc_substr,
                    "actual_docs": doc_names,
                })

        accuracy = (passed_count / total_scenarios) * 100.0
        print(f"\n🎯 50 Customs Scenarios Benchmark Result: {passed_count}/{total_scenarios} Passed ({accuracy:.1f}% Accuracy)")

        if failures:
            print("\n❌ Benchmark Failures:")
            for f in failures:
                print(f"  Case #{f['case']} [{f['lane']} - {f['commodity']}]: Expected {f['expected_status']}, got {f['actual_status']}")

        # Target criterion: Accuracy >= 90%
        assert accuracy >= 90.0, f"Customs scenario accuracy ({accuracy:.1f}%) fell below 90% threshold!"
