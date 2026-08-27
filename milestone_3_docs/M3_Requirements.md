# Milestone 3: Requirements Specification Document
## Intelligence, Compliance & Advanced Analytics Engine

---

## 1. Executive Summary
Milestone 3 equips the Freight Quote Generation System with advanced domain intelligence across four core pillars:
1. **Marine Weather & Routing Intelligence**: Live Open-Meteo telemetry integration for wave height, wind gusts, and severe storm risk forecasting.
2. **Customs & Regulatory Intelligence**: Hybrid RAG compliance engine validating HS tariff classifications, generating cited document checklists, and enforcing international embargoes.
3. **Multi-Factor Shipment Risk Engine**: Explainable 5-factor composite risk scoring ($0-100$) with automated policy gating.
4. **Machine Learning Freight Pricing**: Gradient Boosting regression model trained on 5,000 historical shipment records for real-time spot market rate prediction and rule-based benchmarking.

---

## 2. Functional Requirements (FR)

### FR-1: Weather Intelligence Agent
- **FR-1.1**: The system must automatically sample geometric evaluation waypoints (minimum 2, maximum 10) along any origin-destination pair.
- **FR-1.2**: The system must fetch real-time atmospheric and oceanographic observations (wave height, wind speed, precipitation, visibility, barometric pressure) from Open-Meteo APIs.
- **FR-1.3**: The system must compute a weighted marine risk score ($0-100$) and forecast transit delay probability ($0.0-1.0$).
- **FR-1.4**: If the Open-Meteo API is unreachable, the system must gracefully fall back to deterministic marine simulation with zero client errors.

### FR-2: Customs & Regulatory Hybrid RAG Engine
- **FR-2.1**: The system must validate 6-digit Harmonized System (HS) tariff codes against official WCO chapters.
- **FR-2.2**: The system must index official regulatory texts (e.g. EU Dual-Use Regulation 2021/821, US Export Control ITAR, CBIC India Circulars) into a vector retrieval knowledge base.
- **FR-2.3**: The system must generate itemized document checklists with legally binding citations for any commodity, corridor, and Incoterm.
- **FR-2.4**: The system must provide instant AI readiness validation upon document upload and support formal Customs Compliance Officer approval/rejection.
- **FR-2.5**: Prohibited cargo (military arms, sanctioned munitions) must be hard-blocked with status `REJECTED` and `0%` readiness.

### FR-3: Multi-Factor Shipment Risk & Policy Gating
- **FR-3.1**: The system must calculate a composite risk score using the mathematical formulation:
  $$\text{Score} = (W \cdot 0.30) + (C \cdot 0.25) + (R \cdot 0.20) + (P \cdot 0.15) + (\text{Cargo} \cdot 0.10)$$
- **FR-3.2**: The system must enforce automated policy gating:
  - `LOW` ($0-30$): Auto-approved for instant binding quote.
  - `MEDIUM` ($31-60$): Approved with maritime risk advisory.
  - `HIGH` ($61-80$): Requires Senior Freight Broker review.
  - `CRITICAL` ($81-100$) / Customs `REJECTED`: Hard blocked.
- **FR-3.3**: The system must produce itemized `RiskFactor` records explaining the point contribution ($+pts$) and root cause of every factor.

### FR-4: Machine Learning Freight Pricing & Benchmarking
- **FR-4.1**: The system must train on the mentor's 5,000-row historical freight dataset (`freight_pricing_training_dataset_5000.xlsx`).
- **FR-4.2**: The model must achieve a test $R^2 \ge 0.95$ and $\text{MAPE} \le 8\%$.
- **FR-4.3**: The system must predict spot market freight rates in dual currency (**₹ INR** and **$ USD**).
- **FR-4.4**: The system must compute variance ($\Delta\%$) against static rule pricing, $95\%$ confidence bounds, and commercial pricing strategies (`INCREASE_MARGIN`, `DISCOUNT_TO_WIN`, `OPTIMAL_MARKET_PARITY`).

---

## 3. Non-Functional Requirements (NFR)
- **NFR-1 (Performance)**: End-to-end multi-agent evaluation must respond in $< 800\text{ms}$ when cached and $< 2.5\text{s}$ during cold live weather fetch.
- **NFR-2 (Reliability & Uptime)**: 99.9% availability guaranteed via circuit-breaker fallback mechanisms.
- **NFR-3 (Explainability)**: Zero "black-box" decisions; all risk scores and customs requirements must include legal/operational citations.
- **NFR-4 (Security & RBAC)**: Strict role-based access control isolating customer quotes and reserving approval rights for verified admins/officers.
- **NFR-5 (Design System Compliance)**: User interfaces must strictly conform to corporate platform styling tokens (`#0b132b` header banner, `#0f172a` text, `#cbd5e1` input borders, `.agent-table`, `.badge-status`).
