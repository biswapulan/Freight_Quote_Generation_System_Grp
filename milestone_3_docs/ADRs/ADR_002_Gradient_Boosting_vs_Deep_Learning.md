# ADR 002: Gradient Boosting Regressor vs. Deep Learning for Freight Pricing Prediction

## Status: ACCEPTED

## Context
Accurate freight pricing prediction across 5,000 tabular shipment records requires modeling complex non-linear interactions between container sizes, carrier surcharges, fuel index movements, seasonal demand shifts, and route distances.

## Decision
We selected **Gradient Boosting Regression** (`scikit-learn.ensemble.GradientBoostingRegressor`) bundled with a Scikit-Learn `ColumnTransformer` pipeline.

## Consequences
### Positive:
- **Highest Tabular Accuracy**: Achieved test $R^2 = 0.9792$ and MAE = ₹5,306.97, outperforming Random Forest ($R^2 = 0.9649$) and Linear models ($R^2 = 0.8488$).
- **Zero Drift Risk**: Encapsulates scaling and one-hot encoding in a single `.joblib` artifact.
- **Low Compute Footprint**: Fast CPU training ($< 15\text{s}$) and instantaneous sub-5ms inference.

### Negative:
- Does not natively handle unstructured multimodal inputs (e.g. raw bills of lading PDFs), which are handled separately by the customs subsystem.
