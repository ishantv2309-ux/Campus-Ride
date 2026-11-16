#!/usr/bin/env python3
"""
Autonomous AutoML Training Agent - Quickstart & Demo Script
Demonstrates end-to-end ingestion, leak-free preprocessing, multi-model training,
validation guardrails, model packaging, and low-latency production inference.
"""

import os
import sys
import time
import numpy as np
import pandas as pd

from automl.orchestrator import AutonomousAutoMLOrchestrator
from automl.packaging import INFERENCE_PY_TEMPLATE

def generate_sample_dataset(n_samples: int = 500, filename: str = "sample_churn_dataset.csv"):
    """Generates synthetic customer dataset with numeric, categorical, datetime, and leakage columns."""
    np.random.seed(42)

    # 1. Monotonic ID & UUID to demonstrate automatic FR-01.3 leakage dropping
    ids = list(range(1000, 1000 + n_samples))
    import uuid
    uuids = [str(uuid.uuid4()) for _ in range(n_samples)]

    # 2. Datetime feature to demonstrate ISO datetime cyclical decomposition
    dates = pd.date_range("2024-01-01", periods=n_samples, freq="12h").astype(str)

    # 3. Numeric features
    age_clean = np.random.randint(18, 70, size=n_samples).astype(float)
    monthly_spend = np.random.uniform(20.0, 500.0, size=n_samples)
    tenure_months = np.random.randint(1, 60, size=n_samples).astype(float)

    # 4. High-sparsity column (>60% nulls -> will be automatically dropped)
    sparse_col = [None if i > 50 else 1.0 for i in range(n_samples)]

    # 5. Categorical features
    contract_type = np.random.choice(["month-to-month", "one-year", "two-year"], size=n_samples)
    payment_method = np.random.choice(["credit_card", "bank_transfer", "electronic_check", None], size=n_samples)

    # 6. Target with realistic relationship
    churn_logits = (
        0.03 * age_clean
        + 0.005 * monthly_spend
        - 0.08 * tenure_months
        + (contract_type == "month-to-month") * 1.2
        + np.random.normal(0, 0.5, size=n_samples)
    )
    churn = (churn_logits > np.median(churn_logits)).astype(int)

    # Introduce intentional nulls into age for preprocessing test
    age = age_clean.copy()
    age[::10] = np.nan  # 10% nulls -> will be imputed with median + indicator

    df = pd.DataFrame({
        "customer_id": ids,                  # Leakage ID
        "session_uuid": uuids,               # Leakage UUID
        "signup_date": dates,                # Datetime decomposition
        "age": age,                          # Numeric with nulls
        "monthly_spend": monthly_spend,      # Continuous numeric
        "tenure_months": tenure_months,      # Numeric
        "sparse_notes": sparse_col,          # High sparsity (>60% nulls)
        "contract_type": contract_type,      # Categorical
        "payment_method": payment_method,    # Categorical with nulls
        "churn": churn,                      # Target
    })

    df.to_csv(filename, index=False)
    print(f"Generated sample dataset: '{filename}' ({df.shape[0]} rows, {df.shape[1]} cols)")
    return filename

def main():
    print("=" * 70)
    print("  AUTONOMOUS AUTOML TRAINING AGENT - END-TO-END DEMO  ")
    print("=" * 70)

    # 1. Generate sample data
    csv_path = generate_sample_dataset()

    # 2. Run Autonomous Pipeline
    output_dir = "artifacts"
    orchestrator = AutonomousAutoMLOrchestrator(output_base_dir=output_dir)

    print("\n[INFO] Starting 5-Stage Autonomous AutoML Execution...")
    start_time = time.time()
    result = orchestrator.run_pipeline(
        dataset_source=csv_path,
        target_col="churn",
        compute_preset="fast_prototype",
        time_budget_secs=60,
    )
    elapsed = time.time() - start_time

    print("\n" + "=" * 70)
    print(f"  PIPELINE FINISHED IN {elapsed:.2f}s - STATUS: {result['status']}  ")
    print("=" * 70)

    print(f"\n- Detected Task Type: {result['task_type']}")
    print(f"- Packaged Model Bundle: {result['bundle_path']}")
    print(f"- Bundle Zip Archive: {result['bundle_zip_path']}")

    print("\n--- Model Leaderboard ---")
    leaderboard_df = pd.DataFrame(result["leaderboard"])
    print(leaderboard_df.to_string(index=False))

    print("\n--- Holdout Validation Metrics ---")
    for k, v in result["validation_metrics"].items():
        if k != "confusion_matrix":
            print(f"  {k}: {v}")

    print("\n--- Top Feature Importances ---")
    for feat, imp in list(result["feature_importance"].items())[:5]:
        print(f"  {feat}: {imp:.5f}")

    print("\n--- Validation Guardrails Summary ---")
    for g in result["guardrails"]:
        gate_name = g.get("gate", "Gate")
        passed = g.get("passed", False)
        print(f"  [{'PASSED' if passed else 'FAILED'}] {gate_name}: {g.get('diagnostic', '')}")

    # 3. Test Production Inference via the bundled inference.py Predictor
    print("\n" + "=" * 70)
    print("  TESTING PRODUCTION INFERENCE WRAPPER (Predictor.load)  ")
    print("=" * 70)

    bundle_path = result["bundle_path"]
    import importlib.util
    inf_py = os.path.join(bundle_path, "inference.py")
    spec = importlib.util.spec_from_file_location("demo_inference", inf_py)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    predictor = mod.Predictor.load(bundle_path)
    print(f"Predictor successfully loaded in-memory from '{bundle_path}'.")

    # Single-row test
    single_record = {
        "signup_date": "2024-06-15 14:30:00",
        "age": 42.0,
        "monthly_spend": 120.5,
        "tenure_months": 8.0,
        "contract_type": "month-to-month",
        "payment_method": "credit_card",
    }
    t0 = time.perf_counter()
    pred = predictor.predict(single_record)
    proba = predictor.predict_proba(single_record)
    single_latency_ms = (time.perf_counter() - t0) * 1000

    print(f"\nSingle-row inference result:")
    print(f"  Prediction: {pred[0]}")
    print(f"  Probabilities: {np.round(proba[0], 4)}")
    print(f"  Latency: {single_latency_ms:.2f} ms (PRD target: <15 ms)")

    # Batch test (10,000 synthetic rows)
    print("\nRunning 10,000-row batch latency benchmark...")
    batch_size = 10000
    batch_df = pd.DataFrame({
        "signup_date": ["2024-03-01 10:00:00"] * batch_size,
        "age": np.random.randint(18, 70, size=batch_size),
        "monthly_spend": np.random.uniform(20.0, 500.0, size=batch_size),
        "tenure_months": np.random.randint(1, 60, size=batch_size),
        "contract_type": np.random.choice(["month-to-month", "one-year", "two-year"], size=batch_size),
        "payment_method": np.random.choice(["credit_card", "bank_transfer", None], size=batch_size),
    })

    t0 = time.perf_counter()
    batch_preds = predictor.predict(batch_df)
    batch_latency_ms = (time.perf_counter() - t0) * 1000

    print(f"10,000-row batch inference result:")
    print(f"  Output rows: {len(batch_preds)}")
    print(f"  Latency: {batch_latency_ms:.2f} ms (PRD target: <500 ms)")

    print("\n" + "=" * 70)
    print("  DEMO COMPLETED WITH 100% SUCCESS!  ")
    print("=" * 70)

if __name__ == "__main__":
    main()
