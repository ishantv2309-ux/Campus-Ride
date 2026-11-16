import time
import os
import pytest
import numpy as np
import pandas as pd

from automl.orchestrator import AutonomousAutoMLOrchestrator

def test_inference_latency_benchmarks(tmp_path):
    np.random.seed(42)
    n = 200
    num1 = np.random.randn(n)
    num2 = np.random.rand(n) * 100
    cat1 = np.random.choice(["type_A", "type_B", "type_C"], size=n)
    target = (num1 + 0.01 * num2 > 0).astype(int)
    df = pd.DataFrame({
        "num1": num1,
        "num2": num2,
        "cat1": cat1,
        "target": target,
    })
    csv_file = tmp_path / "latency_data.csv"
    df.to_csv(csv_file, index=False)

    out_dir = tmp_path / "artifacts"
    orchestrator = AutonomousAutoMLOrchestrator(output_base_dir=str(out_dir))
    res = orchestrator.run_pipeline(
        dataset_source=str(csv_file),
        target_col="target",
        compute_preset="fast_prototype",
        time_budget_secs=30,
    )

    bundle_path = res["bundle_path"]
    import importlib.util
    inf_py = os.path.join(bundle_path, "inference.py")
    spec = importlib.util.spec_from_file_location("test_latency_inference", inf_py)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    predictor = mod.Predictor.load(bundle_path)

    # Warmup
    warmup_df = pd.DataFrame([{"num1": 0.5, "num2": 10.0, "cat1": "type_A"}])
    _ = predictor.predict(warmup_df)

    # Benchmark single-row prediction (target: < 15 ms)
    single_record = {"num1": 1.2, "num2": 45.0, "cat1": "type_B"}
    durations = []
    for _ in range(50):
        t0 = time.perf_counter()
        _ = predictor.predict(single_record)
        t1 = time.perf_counter()
        durations.append((t1 - t0) * 1000)  # ms

    median_single_ms = float(np.median(durations))
    print(f"\n[LATENCY BENCHMARK] Single-row prediction median: {median_single_ms:.2f} ms")
    assert median_single_ms < 15.0, f"Single-row inference too slow: {median_single_ms} ms >= 15 ms"

    # Benchmark 10,000-row batch prediction (target: < 500 ms)
    batch_size = 10000
    batch_df = pd.DataFrame({
        "num1": np.random.randn(batch_size),
        "num2": np.random.rand(batch_size) * 100,
        "cat1": np.random.choice(["type_A", "type_B", "type_C"], size=batch_size),
    })

    t0 = time.perf_counter()
    batch_preds = predictor.predict(batch_df)
    t1 = time.perf_counter()
    batch_duration_ms = (t1 - t0) * 1000

    print(f"[LATENCY BENCHMARK] 10,000-row batch prediction: {batch_duration_ms:.2f} ms")
    assert len(batch_preds) == batch_size
    assert batch_duration_ms < 500.0, f"Batch inference too slow: {batch_duration_ms} ms >= 500 ms"
