# Phase 5 Completion & Architecture Review Report
## Machine Learning Freight Pricing Model & Market Benchmarking
### (Trained on Mentor 5,000-Row Dataset: `freight_pricing_training_dataset_5000.xlsx`)

---

## 1. What is the Purpose?
The purpose of Phase 5 is to design, train, benchmark, and deploy an enterprise **Machine Learning Freight Pricing Engine** that predicts spot market container and multimodal freight rates from the mentor's historical shipment dataset ([`freight_pricing_training_dataset_5000.xlsx`](file:///Users/nareshramavath/Desktop/01%20Projects/Infosys_project/team%20folder/Freight_Quote_Generation_System_Grp/freight_pricing_training_dataset_5000.xlsx)). It benchmarks ML spot market rates directly against the conventional rule-based cost-plus formula, calculating price spread variance ($\Delta\%$), statistical confidence intervals, and automated commercial pricing recommendations.

---

## 2. What It Solves
- **Rigid Static Cost-Plus Vulnerability**: Static formulas (e.g. $\text{Distance} \times \text{Rate} + \text{Weight}$) fail to capture sudden spot market rate swings driven by holiday peak surges, regional port congestion, transport mode variations, or fuel price spikes.
- **Revenue Leakage / Margin Erosion**: When market spot rates surge, freight forwarders using static pricing undercharge customers, leaking margin. Conversely, during off-peak slumps, static prices overcharge customers, causing lost deals.
- **Uncertainty & Lack of Confidence Bounds**: Freight underwriters need statistical confidence intervals ($95\%$ CI) to evaluate pricing risk and set appropriate bid margins.

---

## 3. How It Solves It
- **Mentor Training Dataset (5,000 Verified Records)**: Ingested [`freight_pricing_training_dataset_5000.xlsx`](file:///Users/nareshramavath/Desktop/01%20Projects/Infosys_project/team%20folder/Freight_Quote_Generation_System_Grp/freight_pricing_training_dataset_5000.xlsx) encompassing:
  - **Categorical Attributes**: `Origin` (8 hubs: Bengaluru, Mumbai, Kolkata, Chennai, Hyderabad, Ahmedabad, Pune, Delhi), `Destination` (10 global ports: Rotterdam, Los Angeles, Dubai, Hamburg, London, Singapore, Colombo, New York, Jebel Ali, Shanghai), `Transport_Mode` (Sea, Road, Air), `Cargo_Type` (8 categories), `Container_Type` (20FT, 40FT, 40FT_HC, LCL, AIR_CARGO), `Season` (Off_Peak, Normal, Peak), `Carrier` (Carrier_A to Carrier_E).
  - **Numerical Attributes**: `Weight_KG`, `Volume_CBM`, `Distance_KM`, `Fuel_Price`, `Transit_Days`.
  - **Target Variable**: `Actual_Freight_Price_INR`.
- **Machine Learning Training & Cross-Model Benchmarking**:
  - Implemented feature preprocessing pipeline with `StandardScaler` for numerical attributes and `OneHotEncoder(handle_unknown='ignore')` for categorical attributes (`ColumnTransformer`).
  - Benchmarked 5 candidate regression algorithms:
    1. **Ordinary Least Squares (OLS) Linear Regression**: MAE ₹$18,897.95$ ($\$226.32$), $R^2 = 0.8488$, MAPE $22.90\%$.
    2. **Ridge Regression ($\alpha=1.5$)**: MAE ₹$18,887.70$ ($\$226.20$), $R^2 = 0.8488$, MAPE $22.87\%$.
    3. **Random Forest Regressor ($120$ trees, max depth $16$)**: MAE ₹$7,662.60$ ($\$91.77$), $R^2 = 0.9649$, MAPE $7.71\%$.
    4. **Extra Trees Regressor ($100$ trees, max depth $16$)**: MAE ₹$7,072.96$ ($\$84.71$), $R^2 = 0.9693$, MAPE $7.31\%$.
    5. 🏆 **Gradient Boosting Regressor ($200$ estimators, learning rate $0.08$, max depth $6$)**: **MAE ₹$5,306.97$ ($\$63.56$), RMSE ₹$11,133.29$, $R^2 = 0.9792$, MAPE $5.54\%$**.
- **Champion Artifact Serialization**: Packaged winning Gradient Boosting pipeline into [`ml/models/freight_pricing_model.joblib`](file:///Users/nareshramavath/Desktop/01%20Projects/Infosys_project/team%20folder/Freight_Quote_Generation_System_Grp/ml/models/freight_pricing_model.joblib) and benchmark logs into [`ml/reports/model_benchmarks.json`](file:///Users/nareshramavath/Desktop/01%20Projects/Infosys_project/team%20folder/Freight_Quote_Generation_System_Grp/ml/reports/model_benchmarks.json).
- **Inference & Comparison Service (`MLPricingService`)**:
  - Predicts ML Spot Rate in both **INR (₹)** and **USD ($)**.
  - Computes Variance: $\Delta\% = \frac{\text{ML} - \text{Rule}}{\text{Rule}} \times 100$.
  - Computes $95\%$ Confidence Interval: $[\text{Pred} - 1.96 \times \text{MAE}, \text{Pred} + 1.96 \times \text{MAE}]$.
  - Issues Commercial Sales Strategy:
    - $\Delta\% \ge +8\% \rightarrow$ `INCREASE_MARGIN` (*Capture spot market upside*)
    - $\Delta\% \le -8\% \rightarrow$ `DISCOUNT_TO_WIN` (*Spot discount to secure volume*)
    - $-8\% < \Delta\% < +8\% \rightarrow$ `OPTIMAL_MARKET_PARITY` (*Standard rate card pricing*)

---

## 4. What is Used to Solve That?
- **Model Training Pipeline**: Python 3.14, `scikit-learn 1.9.0`, `numpy 2.5.2`, `pandas 3.0.5`, `openpyxl 3.1.5`, `joblib 1.5.3`.
- **Backend Service**: [`server/pricing/ml_service.py`](file:///Users/nareshramavath/Desktop/01%20Projects/Infosys_project/team%20folder/Freight_Quote_Generation_System_Grp/server/pricing/ml_service.py) exposing `POST /api/v1/pricing/ml-predict/` and `GET /api/v1/pricing/benchmarks/`.
- **Frontend Dual Comparison UI**: [`client/src/components/MLPricingComparisonCard.jsx`](file:///Users/nareshramavath/Desktop/01%20Projects/Infosys_project/team%20folder/Freight_Quote_Generation_System_Grp/client/src/components/MLPricingComparisonCard.jsx) with INR/USD currency toggle, mentor parameter selectors, variance indicator, confidence interval banner, and commercial strategy badge.

---

## 5. What Stack is Used for That?
- **Machine Learning Core**: Scikit-Learn (Gradient Boosting Regressor, Extra Trees, Random Forest, ColumnTransformer Pipeline).
- **Backend**: Django 5.0.6, Django REST Framework, Joblib Model Serialization.
- **Frontend**: React 18, Vite 6, `lucide-react`, Custom CSS Design System.
- **Testing & Verification**: Pytest, Pytest-Django (59/59 passing).

---

## 6. What Concepts & Design Patterns are Used?
- **Ensemble Gradient Boosting (GBDT)**: Sequential tree fitting optimizing mean squared error to capture non-linear interactions between fuel price, seasonality surges, and container dimensions.
- **Dual-Engine Benchmarking (ML vs Rule)**: Running the predictive model in tandem with the deterministic cost-plus engine to provide explainable price variance.
- **Confidence Interval Estimation**: Deriving empirical 95% uncertainty bounds ($\pm 1.96 \times \text{MAE}$) to provide freight brokers with statistical safety margins.
- **Champion-Challenger Model Selection**: Automated cross-validation scoring on holdout test splits before selecting the serialized production artifact.

---

## 7. Why This Choice and Why Not Others?
- **Gradient Boosting Regressor vs. Deep Neural Networks**: Tabular freight datasets with mixed categorical/numerical features (ports, container types, bunker indices) are consistently outperformed by tree-based gradient boosting models (XGBoost / Scikit-Learn GBDT) without the training overhead, cold-start latency, or GPU dependency of deep learning frameworks.
- **Pipeline Serialization (`joblib`) vs. Raw Weights Export**: Using Scikit-Learn `Pipeline` bundles the `ColumnTransformer` (encoders and scalers) alongside the regressor into a single atomic artifact, completely eliminating feature preprocessing discrepancies between training and real-time production inference.

---

## 8. What are the Alternatives to That Stack?
| Alternative Approach | Pros | Cons / Why Not Chosen |
|---|---|---|
| **Freightos / Xeneta Commercial Market APIs** | Real-time live carrier contract feeds | Heavy per-call API cost, vendor lock-in, and lack of internal customization for private fleet cost structures. |
| **Deep Learning (PyTorch / TensorFlow MLP)** | Can ingest multimodal unstructured text notes | Unnecessary latency, high inference compute requirement, and lower tabular accuracy on smaller feature spaces. |
| **Pure Linear Regression** | Highly interpretable coefficients | Low accuracy ($R^2 = 0.8488$, MAE $₹18,897$) due to inability to model non-linear interaction terms (e.g. peak season & hazardous cargo surge). |

---

## 9. Phase 5 Verification Results
- **Model Training Benchmarks (Mentor 5,000-Row Dataset)**:
  - Candidate 1 (OLS Linear Regression): $R^2 = 0.8488$, MAE = ₹$18,897.95$ ($\$226.32$)
  - Candidate 2 (Ridge Regression): $R^2 = 0.8488$, MAE = ₹$18,887.70$ ($\$226.20$)
  - Candidate 3 (Random Forest Regressor): $R^2 = 0.9649$, MAE = ₹$7,662.60$ ($\$91.77$)
  - Candidate 4 (Extra Trees Regressor): $R^2 = 0.9693$, MAE = ₹$7,072.96$ ($\$84.71$)
  - 🏆 **Candidate 5 (Gradient Boosting Champion)**: **$R^2 = 0.9792$, MAE = ₹$5,306.97$ ($\$63.56$), RMSE = ₹$11,133.29$, MAPE = $5.54\%$**
- **Automated Backend Pytest Suite**: 59/59 tests passing across all suites (`test_m3_phase5_ml_pricing.py` + `test_m3_phase4_shipment_risk.py` + `test_m3_phase3_customs_rag.py` + `test_m3_phase2_weather_intelligence.py` + `test_m3_phase1_database_and_contracts.py` + `test_mentor_freight_system.py` + `pricing/tests.py`).
- **Frontend Vite Production Build**: Compiled in `4.39s` with zero errors.

---

## 10. Added Files & Project Structure Changes

```
ml/
├── data/
│   └── mentor_freight_pricing_dataset.csv # [NEW] 5,000 records from mentor dataset
├── models/
│   └── freight_pricing_model.joblib       # [NEW] Champion Gradient Boosting artifact (R² = 0.9792, MAE = ₹5,306)
├── reports/
│   └── model_benchmarks.json              # [NEW] Benchmark metrics across all 5 candidate models
└── src/
    └── train.py                           # [MODIFIED] Ingests mentor Excel dataset & serializes champion model

client/src/
├── api/
│   └── mlPricing.js                       # [NEW] API client for ML prediction & benchmark retrieval
└── components/
    ├── MLPricingComparisonCard.css        # [NEW] Platform styling for dual price hero, variance & strategy cards
    ├── MLPricingComparisonCard.jsx        # [MODIFIED] Dual currency (₹/$) & mentor parameter controls
    └── M3IntelligenceDashboard.jsx        # [MODIFIED] Added Module 4 (ML Pricing Comparison) to live dashboard

server/
├── pricing/
│   ├── ml_service.py                      # [MODIFIED] Dual currency INR/USD & mentor dataset schema mapping
│   ├── urls.py                            # [MODIFIED] Added routes for /api/v1/pricing/ml-predict/ & benchmarks
│   └── views.py                           # [MODIFIED] Added MLPricingPredictView & MLPricingBenchmarkReportView
└── tests/
    └── test_m3_phase5_ml_pricing.py       # [MODIFIED] 5 unit & integration tests verifying mentor model inference
```

### Detailed File Functionality Table:

| File Path | Status | Main Function / Core Responsibility |
|---|---|---|
| `freight_pricing_training_dataset_5000.xlsx` | **NEW (User Provided)** | Official mentor dataset containing 5,000 historical shipment records across 8 origins, 10 destinations, 3 transport modes, 8 cargo types, 5 container types, and 3 season modes. |
| `ml/src/train.py` | **MODIFIED** | Ingests mentor Excel dataset, builds Scikit-Learn `ColumnTransformer`, trains 5 regression candidates with 5-Fold Cross-Validation, and serializes the champion model. |
| `ml/models/freight_pricing_model.joblib` | **MODIFIED** | Serialized Scikit-Learn Pipeline combining `ColumnTransformer` (StandardScaler + OneHotEncoder) with `GradientBoostingRegressor` ($R^2 = 0.9792$, $\text{MAE} = ₹5,306.97$). |
| `ml/reports/model_benchmarks.json` | **MODIFIED** | JSON log containing empirical performance metrics (MAE, RMSE, $R^2$, MAPE) across all 5 candidate models trained on the mentor dataset. |
| `server/pricing/ml_service.py` | **MODIFIED** | Domain service executing model inference in dual currency (INR and USD), deterministic rule calculation, variance analysis ($\Delta\%$), $95\%$ confidence bounds, and commercial pricing strategies. |
| `server/pricing/views.py` | **MODIFIED** | Exposes `MLPricingPredictView` (`POST /api/v1/pricing/ml-predict/`) and `MLPricingBenchmarkReportView` (`GET /api/v1/pricing/benchmarks/`). |
| `server/pricing/urls.py` | **MODIFIED** | URL dispatcher for ML pricing and benchmark endpoints. |
| `client/src/api/mlPricing.js` | **NEW** | Client API wrapper for invoking ML rate predictions and fetching model benchmarks. |
| `client/src/components/MLPricingComparisonCard.jsx` | **MODIFIED** | React component displaying dual price hero boxes (Rule vs ML), price spread variance, currency toggle (₹/$), market modifiers, confidence interval, and strategy recommendations. |
| `client/src/components/MLPricingComparisonCard.css` | **NEW** | Clean enterprise styling aligned with platform design tokens for comparison boxes and strategy badges. |
| `client/src/components/M3IntelligenceDashboard.jsx` | **MODIFIED** | Renders Module 4 (ML Pricing Comparison) alongside Weather, Customs, and Risk engines. |
| `server/tests/test_m3_phase5_ml_pricing.py` | **MODIFIED** | Automated Pytest suite verifying prediction inference, rule calculation, surge strategy, and API endpoints on mentor-trained model. |
