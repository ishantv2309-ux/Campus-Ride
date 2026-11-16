"""
Kaggle Tutorial Benchmark: Melbourne Housing Dataset (Dan Becker)
Tests the Autonomous AutoML Training Agent against Dan Becker's Kaggle tutorial model.
"""

import time
import os
import pandas as pd
import numpy as np
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score, mean_squared_error

from automl.orchestrator import AutonomousAutoMLOrchestrator

def run_dan_becker_tutorial_model(csv_path: str):
    """Replicates Dan Becker's Kaggle Tutorial Workflow."""
    print("\n" + "=" * 70)
    print("  1. REPLICATING DAN BECKER'S KAGGLE TUTORIAL BASELINE  ")
    print("=" * 70)

    # Step 1: Load data
    melbourne_data = pd.read_csv(csv_path)
    total_raw_rows = len(melbourne_data)

    # Step 2: Handle missing values (Dan Becker drops all rows with ANY null)
    melbourne_data_clean = melbourne_data.dropna(axis=0)
    rows_retained = len(melbourne_data_clean)
    print(f"Original dataset rows: {total_raw_rows}")
    print(f"Rows retained after Dan Becker's dropna(): {rows_retained} (lost {total_raw_rows - rows_retained} rows, ~{(1 - rows_retained/total_raw_rows):.1%})")

    # Step 3: Target and Features
    y = melbourne_data_clean["Price"]
    features = ['Rooms', 'Bathroom', 'Landsize', 'BuildingArea', 'YearBuilt', 'Lattitude', 'Longtitude']
    X = melbourne_data_clean[features]

    # Split (Model Validation tutorial step)
    train_X, val_X, train_y, val_y = train_test_split(X, y, test_size=0.2, random_state=1)

    # Model 1: Decision Tree Regressor (Your First Machine Learning Model tutorial)
    tree_model = DecisionTreeRegressor(random_state=1)
    tree_model.fit(train_X, train_y)
    tree_val_preds = tree_model.predict(val_X)
    tree_mae = mean_absolute_error(val_y, tree_val_preds)
    tree_r2 = r2_score(val_y, tree_val_preds)

    # Model 2: Random Forest Regressor (Random Forests tutorial)
    forest_model = RandomForestRegressor(n_estimators=100, random_state=1)
    forest_model.fit(train_X, train_y)
    forest_val_preds = forest_model.predict(val_X)
    forest_mae = mean_absolute_error(val_y, forest_val_preds)
    forest_r2 = r2_score(val_y, forest_val_preds)

    print(f"\n[Tutorial Model 1 - DecisionTree]  MAE: ${tree_mae:,.2f} | R²: {tree_r2:.4f}")
    print(f"[Tutorial Model 2 - RandomForest]  MAE: ${forest_mae:,.2f} | R²: {forest_r2:.4f}")

    return {
        "tree_mae": tree_mae,
        "tree_r2": tree_r2,
        "forest_mae": forest_mae,
        "forest_r2": forest_r2,
        "rows_retained": rows_retained,
        "features_used": features,
    }

def run_automl_agent(csv_path: str):
    """Runs the Autonomous AutoML Training Agent on the entire Melbourne dataset."""
    print("\n" + "=" * 70)
    print("  2. RUNNING AUTONOMOUS AUTOML TRAINING AGENT ON MELBOURNE HOUSING  ")
    print("=" * 70)

    orchestrator = AutonomousAutoMLOrchestrator(output_base_dir="artifacts")

    start_time = time.time()
    result = orchestrator.run_pipeline(
        dataset_source=csv_path,
        target_col="Price",
        compute_preset="fast_prototype",
        time_budget_secs=180,
        bundle_version="v1.0.0_melb",
    )
    elapsed = time.time() - start_time

    print("\n" + "=" * 70)
    print(f"  AUTOML COMPLETED IN {elapsed:.2f}s  ")
    print("=" * 70)

    print(f"- Task: {result['task_type']}")
    print(f"- Packaged Bundle: {result['bundle_path']}")

    print("\n--- Model Leaderboard across 5 Architectures ---")
    leaderboard_df = pd.DataFrame(result["leaderboard"])
    print(leaderboard_df.to_string(index=False))

    print("\n--- Holdout Validation Metrics ---")
    val_metrics = result["validation_metrics"]
    for k, v in val_metrics.items():
        if isinstance(v, float):
            print(f"  {k}: {v:,.4f}" if abs(v) > 10 else f"  {k}: {v:.4f}")

    print("\n--- Top 10 Feature Importances ---")
    for feat, imp in list(result["feature_importance"].items())[:10]:
        print(f"  {feat}: {imp:.5f}")

    print("\n--- Guardrails Summary ---")
    for g in result["guardrails"]:
        gate_name = g.get("gate", "Gate")
        passed = g.get("passed", False)
        print(f"  [{'PASSED' if passed else 'FAILED'}] {gate_name}: {g.get('diagnostic', '')}")

    # Test the packaged Predictor inference wrapper
    print("\n" + "=" * 70)
    print("  3. TESTING PRODUCTION PREDICTOR INFERENCE  ")
    print("=" * 70)

    bundle_path = result["bundle_path"]
    import importlib.util
    inf_py = os.path.join(bundle_path, "inference.py")
    spec = importlib.util.spec_from_file_location("melb_inference", inf_py)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    predictor = mod.Predictor.load(bundle_path)

    # Test single-row prediction with a realistic house
    sample_house = {
        "Suburb": "Abbotsford",
        "Rooms": 3,
        "Type": "h",
        "Method": "S",
        "Distance": 2.5,
        "Bathroom": 2.0,
        "Car": 1.0,
        "Landsize": 250.0,
        "BuildingArea": 130.0,
        "YearBuilt": 1920.0,
        "CouncilArea": "Yarra",
        "Regionname": "Northern Metropolitan",
        "Propertycount": 4019.0,
    }

    t0 = time.perf_counter()
    pred_price = predictor.predict(sample_house)
    single_ms = (time.perf_counter() - t0) * 1000

    print(f"Predicted price for Abbotsford 3-room house: ${float(pred_price[0]):,.2f}")
    print(f"Inference latency: {single_ms:.2f} ms")

    # Test batch prediction on 500 rows with some missing values
    test_df = pd.read_csv(csv_path).head(500).drop(columns=["Price"])
    t0 = time.perf_counter()
    batch_preds = predictor.predict(test_df)
    batch_ms = (time.perf_counter() - t0) * 1000

    print(f"500-house batch prediction latency: {batch_ms:.2f} ms")

    return result

if __name__ == "__main__":
    csv_file = "melb_data.csv"
    tutorial_results = run_dan_becker_tutorial_model(csv_file)
    automl_results = run_automl_agent(csv_file)
