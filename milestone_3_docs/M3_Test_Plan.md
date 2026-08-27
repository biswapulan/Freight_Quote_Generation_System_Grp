# Milestone 3: Master Test Plan & Quality Strategy

---

## 1. Testing Scope & Objectives
The Milestone 3 Test Plan establishes comprehensive automated verification across unit, integration, benchmark, and regression tiers to guarantee zero regressions in freight quoting, compliance accuracy, and prediction reliability.

---

## 2. Test Pyramid & Execution Levels

```
               /\
              /  \      E2E Resiliency & State Gating (3 tests)
             /----\
            /      \    Customs Benchmark Matrix (50 scenarios)
           /--------\
          /          \  Subsystem Unit & Integration (44 tests)
         /------------\
        /              \ Legacy Pricing & Mentor Tests (16 tests)
       /----------------\
```

---

## 3. Test Suites Inventory
1. **`test_50_customs_scenarios.py`**: Validates 50 curated international trade lanes across 10 global jurisdictions.
2. **`test_m3_phase1_database_and_contracts.py`**: Validates database schema migrations, indexes, and serialization contracts.
3. **`test_m3_phase2_weather_intelligence.py`**: Validates waypoint sampling, Open-Meteo telemetry parsing, and delay modeling.
4. **`test_m3_phase3_customs_rag.py`**: Validates TF-IDF vector retrieval, document uploads, and compliance officer sign-offs.
5. **`test_m3_phase4_shipment_risk.py`**: Validates MCDA 5-factor composite risk formula and policy gating.
6. **`test_m3_phase5_ml_pricing.py`**: Validates ML spot pricing, dual currency conversion (INR/USD), and confidence interval calculation.
7. **`test_m3_phase6_e2e_resiliency.py`**: Validates Open-Meteo API timeout fallback, prohibited cargo blocking, and multi-agent pipeline orchestration.
8. **`test_mentor_freight_system.py`**: Validates mentor customer/admin workflows and RBAC security rules.
