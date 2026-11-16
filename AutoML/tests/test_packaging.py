import os
import shutil
import pytest
import numpy as np
import pandas as pd

from automl.orchestrator import AutonomousAutoMLOrchestrator

def test_packaging_and_predictor(tmp_path):
    np.random.seed(42)
    n = 150
    num_vals = np.random.randn(n)
    cat_vals = np.random.choice(["tier1", "tier2", "tier3"], size=n)
    target_vals = (num_vals > 0).astype(int)
    df = pd.DataFrame({
        "num_val": num_vals,
        "cat_val": cat_vals,
        "target": target_vals,
    })
    csv_file = tmp_path / "train_data.csv"
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
    assert os.path.exists(bundle_path)
    assert os.path.exists(os.path.join(bundle_path, "model_artifact", "pipeline.joblib"))
    assert os.path.exists(os.path.join(bundle_path, "inference.py"))
    assert os.path.exists(os.path.join(bundle_path, "input_schema.json"))
    assert os.path.exists(os.path.join(bundle_path, "training_trail.json"))
    assert os.path.exists(os.path.join(bundle_path, "leaderboard.csv"))
    assert os.path.exists(os.path.join(bundle_path, "model_card.md"))
    assert os.path.exists(res["bundle_zip_path"])

    # Load Predictor via dynamic import of the bundled inference.py
    import importlib.util
    inf_py = os.path.join(bundle_path, "inference.py")
    spec = importlib.util.spec_from_file_location("test_bundled_inference", inf_py)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    predictor = mod.Predictor.load(bundle_path)

    # Test single-row prediction
    single_row = {"num_val": 1.25, "cat_val": "tier2"}
    pred_single = predictor.predict(single_row)
    assert len(pred_single) == 1

    # Test batch prediction
    batch_df = pd.DataFrame({
        "num_val": [0.5, -1.2, None],
        "cat_val": ["tier1", "unknown_category", None],
    })
    pred_batch = predictor.predict(batch_df)
    assert len(pred_batch) == 3

    proba = predictor.predict_proba(batch_df)
    assert proba.shape == (3, 2)
