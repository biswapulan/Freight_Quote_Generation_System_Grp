# Shipment Risk Scoring & Policy Gating Specification

---

## 1. Multi-Criteria Decision Analysis (MCDA) Formulation

The Shipment Risk Engine (`server/risk/engine.py`) evaluates 5 distinct risk pillars:

$$\text{Composite Risk Score} = (W \cdot 0.30) + (C \cdot 0.25) + (R \cdot 0.20) + (P \cdot 0.15) + (\text{Cargo} \cdot 0.10)$$

| Risk Factor | Weight | Source | Core Evaluated Indicators |
|---|:---:|---|---|
| **Weather ($W$)** | $30\%$ | Open-Meteo Telemetry | Significant wave height, sustained gale winds, storm proximity |
| **Customs ($C$)** | $25\%$ | Customs RAG Engine | Regulatory document completeness, tariff restrictions, embargoes |
| **Route ($R$)** | $20\%$ | Route Graph Engine | Chokepoints (Red Sea / Bab-el-Mandeb, Suez), geopolitical piracy risk |
| **Port Congestion ($P$)** | $15\%$ | Port Dwell Monitor | Terminal berth utilization, average dwell days (e.g. US West Coast peak) |
| **Cargo Sensitivity ($\text{Cargo}$)** | $10\%$ | HS Tariff Classification | Dangerous goods (DG Class 3), perishable spoilage, high-value electronics |

---

## 2. Policy Gating Matrix & Automated Quote Actions

| Score Range | Risk Tier | Quotation Eligibility | Policy Gating Action | Operational Description |
|:---:|:---:|:---:|---|---|
| **$0 - 30$** | `LOW` | ✅ Eligible | `AUTO_APPROVED` | Instant quote generation unlocked. Standard operational conditions. |
| **$31 - 60$** | `MEDIUM` | ✅ Eligible | `AUTO_APPROVED_WITH_ADVISORY` | Quote issued with weather/customs advisory disclaimer attached. |
| **$61 - 80$** | `HIGH` | ⚠️ Pending | `REQUIRES_SENIOR_BROKER_REVIEW` | Quote held for manual sign-off and contingency buffer calculation. |
| **$81 - 100$** | `CRITICAL` | ⛔ Blocked | `BLOCK_QUOTE_ISSUANCE` | Quote hard-blocked due to prohibited goods, severe storm, or embargo. |

---

## 3. Explainability Attribution Decomposition
For every assessment, the engine breaks down overall points:
$$\text{OverallScore} = \sum_{i=1}^5 \text{Contribution}_i = \sum_{i=1}^5 (\text{RawScore}_i \times \text{Weight}_i)$$
The dominant risk driver ($\max \text{Contribution}_i$) is surfaced prominently on the frontend for immediate operational insight.
