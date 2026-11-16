import os
import pytest
import numpy as np
import pandas as pd

from automl.orchestrator import AutonomousAutoMLOrchestrator

def test_regression_end_to_end(tmp_path):
    np.random.seed(42)
    n = 150
    x1 = np.random.uniform(1.0, 10.0, size=n)
    x2 = np.random.normal(5.0, 2.0, size=n)
    category = np.random.choice(["type_A", "type_B", "type_C"], size=n)
    cat_offset = {"type_A": 2.0, "type_B": 5.0, "type_C": 10.0}
    y = 3.5 * x1 - 1.2 * x2 + np.array([cat_offset[c] for c in category]) + np.random.normal(0, 0.5, size=n)

    df = pd.DataFrame({
        "x1": x1,
        "x2": x2,
        "category": category,
        "target_price": y,
    })
    csv_file = tmp_path / "regression_data.csv"
    df.to_csv(csv_file, index=False)

    out_dir = tmp_path / "artifacts"
    orchestrator = AutonomousAutoMLOrchestrator(output_base_dir=str(out_dir))
    res = orchestrator.run_pipeline(
        dataset_source=str(csv_file),
        target_col="target_price",
        compute_preset="fast_prototype",
        time_budget_secs=30,
    )

    assert res["status"] == "COMPLETED"
    assert res["task_type"] == "regression"
    assert res["validation_metrics"]["r2"] > 0.80
    assert "rmse" in res["validation_metrics"]
    assert "mae" in res["validation_metrics"]

    # Test predictor load and predict
    import importlib.util
    inf_py = os.path.join(res["bundle_path"], "inference.py")
    spec = importlib.util.spec_from_file_location("regression_predictor", inf_py)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    predictor = mod.Predictor.load(res["bundle_path"])

    preds = predictor.predict(pd.DataFrame({
        "x1": [2.0, 8.0],
        "x2": [4.0, 6.0],
        "category": ["type_A", "type_C"],
    }))
    assert len(preds) == 2
    assert isinstance(preds[0], (float, np.floating))
