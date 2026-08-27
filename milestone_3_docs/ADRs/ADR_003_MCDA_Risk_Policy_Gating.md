# ADR 003: Multi-Criteria Decision Analysis (MCDA) for Shipment Risk & Policy Gating

## Status: ACCEPTED

## Context
Commercial freight quotation requires balancing multiple disparate risk factors (ocean weather, regulatory export laws, geopolitical route chokepoints, port congestion, cargo hazard sensitivity). Black-box neural network risk scores fail to provide compliance officers and customers with actionable, explainable justifications.

## Decision
We implemented a weighted Multi-Criteria Decision Analysis (MCDA) model:
$$\text{Score} = (W \cdot 0.30) + (C \cdot 0.25) + (R \cdot 0.20) + (P \cdot 0.15) + (\text{Cargo} \cdot 0.10)$$
combined with an automated policy state machine (`AUTO_APPROVED`, `REQUIRES_SENIOR_BROKER_REVIEW`, `BLOCK_QUOTE_ISSUANCE`).

## Consequences
### Positive:
- **Full Explainability**: Operators receive precise point attributions ($+pts$) for each dimension.
- **Deterministic Compliance**: Hard policy gating guarantees prohibited munitions or embargoed shipments cannot be issued quotes automatically.
- **Auditable**: Every assessment is recorded with dominant risk driver metadata for compliance audits.

### Negative:
- Weights must be periodically recalibrated as global trade conditions evolve.
