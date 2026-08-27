# Phase 4 Completion & Architecture Review Report
## Multi-Factor Shipment Risk Engine & Policy Gating

---

## 1. What is the Purpose?
The purpose of Phase 4 is to build the **Multi-Factor Shipment Risk Engine & Policy Gating Orchestrator**. It aggregates disparate, multi-source telemetry signals—marine weather, customs readiness, corridor navigation complexity, port dwell bottlenecks, and cargo commodity sensitivities—into an explainable, 0–100 composite risk score that automatically gates quote issuance and protects carrier operating margins.

---

## 2. What It Solves
- **Fragmented Risk Visibility**: Previously, weather risks, customs bottlenecks, and port delays operated as unlinked silos, preventing underwriters and freight brokers from assessing total shipment liability.
- **Uncontrolled Quote Issuance**: Prevents quotes from being automatically issued for sanctioned goods (arms embargoes), severe storm-threatened routes, or port strikes without senior broker review.
- **"Black-Box" AI Ambiguity**: Solves the opacity of automated scoring by decomposing the composite score into exact mathematical percentage contributions and human-readable operational root causes.

---

## 3. How It Solves It
- **Multi-Dimensional Weighted Formulation**: Evaluates 5 discrete risk dimensions:
  $$\text{Composite Risk Score} = (W \cdot 0.30) + (C \cdot 0.25) + (R \cdot 0.20) + (P \cdot 0.15) + (\text{Cargo} \cdot 0.10)$$
- **Policy Gating State Machine**:
  - **`LOW` ($0 - 30$)**: Auto-approved for instant binding quote issuance.
  - **`MEDIUM` ($31 - 60$)**: Approved with cautionary maritime advisory disclaimer attached.
  - **`HIGH` ($61 - 80$)**: Flagged for Senior Freight Broker review and contingency buffer calculation.
  - **`CRITICAL` ($81 - 100$) or Customs `REJECTED`**: Hard blocked from quote generation (embargo/safety hold).
- **Factor Explainability Framework**: Generates itemized `RiskFactor` records detailing the raw score, configured weight, point contribution, severity, and plain-English operational reasoning.
- **Automated Risk Alerting**: Emits high-priority `RiskAlert` records for critical threshold breaches with broker acknowledgement workflows.

---

## 4. What is Used to Solve That?
- **Domain Engine Service (`MultiFactorRiskEngine`)**: Encapsulates scoring weights, commodity sensitivity matrices, chokepoint risks, and policy gating rules.
- **Relational Persistence Layer**: `ShipmentRiskAssessment`, `RiskFactor`, and `RiskAlert` SQLite/Django tables.
- **Reactive UI Card (`RiskExplainabilityCard.jsx`)**: Interactive React dashboard displaying composite gauge, contribution bars, root-cause table, and policy gating banners.

---

## 5. What Stack is Used for That?
- **Backend**: Python 3.14, Django 5.0.6, Django REST Framework.
- **Frontend**: React 18, Vite 6, `lucide-react`, Custom CSS Design System.
- **Testing & Verification**: `pytest`, `pytest-django` running automated regression and mathematical assertion tests.

---

## 6. What Concepts & Design Patterns are Used?
- **Weighted Multi-Criteria Decision Analysis (MCDA)**: Synthesizing heterogeneous numerical and categorical risk indicators into a normalized composite index.
- **Policy Gating Pattern**: Decoupling risk assessment from quotation issuance so business compliance rules can halt or route transactions dynamically.
- **Explainable AI (XAI) Attribution**: Decomposing aggregate scores into additive factor-level attributions ($+pts$) and identifying the dominant risk driver.
- **Human-in-the-Loop (HITL) Alert Escalation**: Escalating high-risk quotes to Senior Freight Brokers with audit timestamps and user attribution.

---

## 7. Why This Choice and Why Not Others?
- **Deterministic Multi-Factor MCDA vs. Pure ML Black-Box Scoring**: Freight operations and maritime insurance require deterministic auditability. Pure neural network classifiers cannot explain to a customer why a quote was surcharged or blocked. Our MCDA approach gives exact mathematical and regulatory accountability.
- **Decoupled Engine vs. Hardcoded Controller Rules**: Placing logic in `MultiFactorRiskEngine` enables dynamic weight recalibration and independent unit testability without touching HTTP controllers.

---

## 8. What are the Alternatives to That Stack?
| Alternative Stack | Pros | Cons / Why Not Chosen |
|---|---|---|
| **Commercial Cargo Insurance APIs (Munich Re / Lloyd's List Intelligence)** | Massive historical claims database | High per-quote API fee ($5 - $15/quote) and restrictive enterprise contracts. |
| **Pure LLM Risk Summarization** | Flexible unstructured text synthesis | Non-deterministic, hallucination-prone, and cannot enforce strict numerical threshold gates. |
| **Static Excel Matrix Lookups** | Simple to maintain | Lacks real-time weather integration, audit logging, and automated state machine transitions. |

---

## 9. Phase 4 Verification Results
- **Pytest Test Suite**: 54/54 tests passed in backend test suite (`test_m3_phase4_shipment_risk.py` + `test_m3_phase3_customs_rag.py` + `test_m3_phase2_weather_intelligence.py` + `test_m3_phase1_database_and_contracts.py` + `test_mentor_freight_system.py` + `pricing/tests.py`).
- **Mathematical & Policy Assertions**:
  - Validated composite score equals sum of factor contributions ($W \cdot 0.30 + C \cdot 0.25 + R \cdot 0.20 + P \cdot 0.15 + Cargo \cdot 0.10$).
  - Verified `AUTO_APPROVED` state for low-risk routes.
  - Verified `BLOCK_QUOTE_ISSUANCE` and `CRITICAL` alert creation for arms munitions (`HS 930200`).
- **Frontend Build Status**: Vite production bundle compiled in `815ms` with zero errors.

---

## 10. Added Files & Project Structure Changes

```
client/src/
├── api/
│   └── risk.js                            # [NEW FILE] Client API helpers for risk assessment & alerts
└── components/
    ├── RiskExplainabilityCard.css         # [NEW FILE] Platform styling for risk gauges, contribution bars & banners
    ├── RiskExplainabilityCard.jsx         # [NEW FILE] Interactive React component for 5-factor risk & policy gating
    └── M3IntelligenceDashboard.jsx        # [MODIFIED] Wired Module 3 (Risk Assessment) with reactive sub-scores

server/
├── risk/
│   ├── engine.py                          # [NEW FILE] MultiFactorRiskEngine domain service & policy gating
│   ├── serializers.py                     # [MODIFIED] Added RiskAssessRequestSerializer & expanded models
│   ├── urls.py                            # [MODIFIED] Added routes for assess, alerts, and acknowledgement
│   └── views.py                           # [MODIFIED] Wired MultiFactorRiskEngine into REST endpoints
└── tests/
    └── test_m3_phase4_shipment_risk.py    # [NEW TEST] 5 unit & integration tests for risk scoring & policy gating
```

### Detailed File Functionality Table:

| File Path | Status | Main Function / Core Responsibility |
|---|---|---|
| `server/risk/engine.py` | **NEW** | Implements `MultiFactorRiskEngine` domain service calculating weighted composite risk (Weather 30%, Customs 25%, Route 20%, Port 15%, Cargo 10%), factor explainability, and policy gating rules. |
| `server/risk/serializers.py` | **MODIFIED** | Defines DRF serializers for `ShipmentRiskAssessment`, `RiskFactor`, `RiskAlert`, and incoming assessment requests. |
| `server/risk/views.py` | **MODIFIED** | Exposes REST endpoints for composite assessment (`/api/v1/risk/assess/`), alerts listing (`/api/v1/risk/alerts/`), and alert acknowledgement. |
| `server/risk/urls.py` | **MODIFIED** | URL routing for assessment, shipment risk details, and broker alert acknowledgement. |
| `client/src/api/risk.js` | **NEW** | Client API wrapper for invoking risk assessments and acknowledging alerts. |
| `client/src/components/RiskExplainabilityCard.jsx` | **NEW** | Interactive React component rendering composite risk gauge, 5-dimensional breakdown bars, factor details table, and policy gating decisions. |
| `client/src/components/RiskExplainabilityCard.css` | **NEW** | Clean enterprise styling aligned with platform design tokens for progress tracks, tables, and alert cards. |
| `client/src/components/M3IntelligenceDashboard.jsx` | **MODIFIED** | Integrates all 3 Milestone 3 modules (Weather + Customs + Risk) with live reactive state synchronization. |
| `server/tests/test_m3_phase4_shipment_risk.py` | **NEW** | Pytest test suite covering formula mathematics, auto-approval, hard blocking of prohibited goods, and alert acknowledgements. |
