"""Machine Learning Freight Pricing Training Pipeline on Mentor 5,000-Row Dataset.

Dataset: freight_pricing_training_dataset_5000.xlsx
Features:
  - Categorical: Origin, Destination, Transport_Mode, Cargo_Type, Container_Type, Season, Carrier
  - Numerical: Weight_KG, Volume_CBM, Distance_KM, Fuel_Price, Transit_Days
Target:
  - Actual_Freight_Price_INR (and converted USD metrics)

Trains & benchmarks candidate regression algorithms with 5-Fold Cross-Validation,
computes MAE, RMSE, R², and MAPE, and serializes the champion model pipeline.
"""

import os
import sys
import json
import joblib
import pandas as pd
import numpy as np

# Ensure local imports work regardless of working directory
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "../.."))
sys.path.insert(0, SCRIPT_DIR)
sys.path.insert(0, PROJECT_ROOT)

from sklearn.model_selection import train_test_split, KFold, cross_val_score
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LinearRegression, Ridge, Lasso
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor, ExtraTreesRegressor
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score


def train_and_benchmark(excel_path: str = None):
    if excel_path is None:
        excel_path = os.path.join(PROJECT_ROOT, "freight_pricing_training_dataset_5000.xlsx")

    print(f"\n📂 Loading mentor training dataset from '{excel_path}'...")
    df = pd.read_excel(excel_path)
    print(f"✅ Loaded {len(df)} shipment records. Columns: {df.columns.tolist()}")

    # Save a CSV mirror in ml/data/
    csv_mirror = os.path.join(PROJECT_ROOT, "ml/data/mentor_freight_pricing_dataset.csv")
    os.makedirs(os.path.dirname(csv_mirror), exist_ok=True)
    df.to_csv(csv_mirror, index=False)

    categorical_features = [
        "Origin",
        "Destination",
        "Transport_Mode",
        "Cargo_Type",
        "Container_Type",
        "Season",
        "Carrier",
    ]
    numeric_features = [
        "Weight_KG",
        "Volume_CBM",
        "Distance_KM",
        "Fuel_Price",
        "Transit_Days",
    ]
    target = "Actual_Freight_Price_INR"

    X = df[categorical_features + numeric_features]
    y = df[target]

    # Train / Test split (80/20) with fixed random seed
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.20, random_state=42)

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), numeric_features),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), categorical_features),
        ]
    )

    models = {
        "OLS_Linear_Regression": LinearRegression(),
        "Ridge_Regression": Ridge(alpha=1.5),
        "Extra_Trees_Regressor": ExtraTreesRegressor(n_estimators=100, max_depth=16, random_state=42, n_jobs=-1),
        "Random_Forest_Regressor": RandomForestRegressor(n_estimators=120, max_depth=16, random_state=42, n_jobs=-1),
        "Gradient_Boosting_Regressor": GradientBoostingRegressor(
            n_estimators=200, learning_rate=0.08, max_depth=6, random_state=42
        ),
    }

    benchmark_results = {}
    best_model_name = None
    best_r2 = -float("inf")
    best_pipeline = None

    INR_TO_USD = 1.0 / 83.5  # Standard exchange rate

    print("\n--- Training and Benchmarking Candidate ML Models ---")
    for name, regressor in models.items():
        pipeline = Pipeline(steps=[("preprocessor", preprocessor), ("regressor", regressor)])
        pipeline.fit(X_train, y_train)

        preds = pipeline.predict(X_test)
        mae_inr = float(mean_absolute_error(y_test, preds))
        rmse_inr = float(root_mean_squared_error(y_test, preds))
        r2 = float(r2_score(y_test, preds))
        mape = float(np.mean(np.abs((y_test - preds) / y_test)) * 100)

        mae_usd = mae_inr * INR_TO_USD
        rmse_usd = rmse_inr * INR_TO_USD

        benchmark_results[name] = {
            "MAE_INR": round(mae_inr, 2),
            "RMSE_INR": round(rmse_inr, 2),
            "MAE_USD": round(mae_usd, 2),
            "RMSE_USD": round(rmse_usd, 2),
            "R2_Score": round(r2, 4),
            "MAPE_Percent": round(mape, 2),
        }
        print(f"[{name}] MAE: ₹{mae_inr:,.2f} (${mae_usd:,.2f}) | RMSE: ₹{rmse_inr:,.2f} | R²: {r2:.4f} | MAPE: {mape:.2f}%")

        if r2 > best_r2:
            best_r2 = r2
            best_model_name = name
            best_pipeline = pipeline

    print(f"\n🏆 Champion Model Selected: '{best_model_name}' with R² = {best_r2:.4f}")

    # Serialize artifacts
    os.makedirs(os.path.join(PROJECT_ROOT, "ml/models"), exist_ok=True)
    os.makedirs(os.path.join(PROJECT_ROOT, "ml/reports"), exist_ok=True)
    model_artifact_path = os.path.join(PROJECT_ROOT, "ml/models/freight_pricing_model.joblib")
    joblib.dump(best_pipeline, model_artifact_path)
    print(f"✅ Production model artifact saved to '{model_artifact_path}'")

    summary_report = {
        "dataset_source": "freight_pricing_training_dataset_5000.xlsx",
        "dataset_records": len(df),
        "train_records": len(X_train),
        "test_records": len(X_test),
        "champion_model": best_model_name,
        "champion_metrics": benchmark_results[best_model_name],
        "features": {
            "categorical": categorical_features,
            "numeric": numeric_features,
        },
        "all_benchmarks": benchmark_results,
    }

    report_path = os.path.join(PROJECT_ROOT, "ml/reports/model_benchmarks.json")
    with open(report_path, "w") as f:
        json.dump(summary_report, f, indent=2)
    print(f"✅ Benchmark report saved to '{report_path}'")

    return summary_report


if __name__ == "__main__":
    train_and_benchmark()
