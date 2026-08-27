# Machine Learning Model Evaluation & Benchmark Report
### Dataset: Official Mentor Dataset (`freight_pricing_training_dataset_5000.xlsx`)

---

## 1. Executive Summary
We trained, cross-validated, and benchmarked 5 candidate regression algorithms to predict container and multimodal freight rates. The **Gradient Boosting Regressor** emerged as the champion model with an **$R^2$ score of $0.9792$** and a **Mean Absolute Error (MAE) of ₹5,306.97 ($\$63.56$)**, delivering high accuracy and low percentage error ($5.54\%$).

---

## 2. Multi-Algorithm Benchmark Comparison

Evaluation conducted on an **80/20 train/test holdout split** (4,000 train samples, 1,000 test samples) using 5-Fold Cross-Validation:

| Model Candidate | $R^2$ Score | MAE (INR) | MAE (USD) | RMSE (INR) | RMSE (USD) | MAPE (%) | Ranking |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **OLS Linear Regression** | `0.8488` | ₹18,897.95 | $226.32 | ₹30,008.08 | $359.38 | 22.90% | Baseline |
| **Ridge Regression ($\alpha=1.5$)** | `0.8488` | ₹18,887.70 | $226.20 | ₹30,005.91 | $359.35 | 22.87% | Baseline |
| **Random Forest Regressor** | `0.9649` | ₹7,662.60 | $91.77 | ₹14,451.47 | $173.07 | 7.71% | Candidate |
| **Extra Trees Regressor** | `0.9693` | ₹7,072.96 | $84.71 | ₹13,520.83 | $161.93 | 7.31% | Candidate |
| 🏆 **Gradient Boosting Regressor** | **`0.9792`** | **₹5,306.97** | **$63.56** | **₹11,133.29** | **$133.33** | **5.54%** | **Champion** |

---

## 3. Champion Model Hyperparameters & Architecture
- **Pipeline Structure**: Scikit-Learn `Pipeline`
- **Preprocessor**: `ColumnTransformer`
  - Numeric Scaler: `StandardScaler()` (`Weight_KG`, `Volume_CBM`, `Distance_KM`, `Fuel_Price`, `Transit_Days`)
  - Categorical Encoder: `OneHotEncoder(handle_unknown='ignore', sparse_output=False)` (`Origin`, `Destination`, `Transport_Mode`, `Cargo_Type`, `Container_Type`, `Season`, `Carrier`)
- **Regressor**: `GradientBoostingRegressor`
  - `n_estimators = 200`
  - `learning_rate = 0.08`
  - `max_depth = 6`
  - `loss = 'squared_error'`
  - `random_state = 42`

---

## 4. Confidence Bounds & Strategic Recommendation Engine
- **95% Confidence Interval**:
  $$\text{CI}_{95\%} = [\text{Pred} - (1.96 \times 5306.97), \text{Pred} + (1.96 \times 5306.97)] = [\text{Pred} - ₹10,401.66, \text{Pred} + ₹10,401.66]$$
- **Variance Delta Formula**:
  $$\Delta\% = \frac{\text{ML}_{\text{Spot}} - \text{Rule}_{\text{Cost}}}{\text{Rule}_{\text{Cost}}} \times 100$$
- **Commercial Action**:
  - $\Delta\% \ge +8\% \rightarrow$ `INCREASE_MARGIN`
  - $\Delta\% \le -8\% \rightarrow$ `DISCOUNT_TO_WIN`
  - $-8\% < \Delta\% < +8\% \rightarrow$ `OPTIMAL_MARKET_PARITY`
