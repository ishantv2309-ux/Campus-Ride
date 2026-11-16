import pytest
import pandas as pd
import numpy as np

from automl.trainer import AutoMLTrainer
from automl.models import get_model_candidates

def test_five_model_diversity():
    models_cls = get_model_candidates("binary_classification", preset="fast_prototype")
    expected_families = {"LightGBM", "XGBoost", "CatBoost", "ExtraTrees", "RandomForest", "TabularNN"}
    for fam in expected_families:
        assert fam in models_cls

    models_reg = get_model_candidates("regression", preset="fast_prototype")
    for fam in expected_families:
        assert fam in models_reg

def test_training_and_ensembling_flow():
    np.random.seed(42)
    n = 120
    X = pd.DataFrame({
        "feat1": np.random.randn(n),
        "feat2": np.random.rand(n) * 10,
        "feat3": np.random.choice([0, 1, 2], size=n),
    })
    y = pd.Series((X["feat1"] + 0.5 * X["feat2"] > 2.5).astype(int))

    X_train, X_test = X.iloc[:100], X.iloc[100:]
    y_train, y_test = y.iloc[:100], y.iloc[100:]

    trainer = AutoMLTrainer(task_type="binary_classification", compute_preset="fast_prototype", time_budget_secs=30)
    results = trainer.train_and_evaluate(X_train, y_train, X_test, y_test)

    assert "final_metrics" in results
    assert "leaderboard" in results
    assert len(results["leaderboard"]) >= 5
    assert "ensemble" in results

    preds = results["ensemble"].predict(X_test)
    assert len(preds) == len(X_test)
    proba = results["ensemble"].predict_proba(X_test)
    assert proba.shape == (len(X_test), 2)
