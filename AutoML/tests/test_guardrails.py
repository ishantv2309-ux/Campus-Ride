import pytest
import pandas as pd
import numpy as np

from automl.guardrails import (
    GuardrailsManager,
    GuardrailViolation,
)

def test_gate1_baseline_verification():
    # Case 1: Pass
    res = GuardrailsManager.verify_gate1_baseline(
        task_type="binary_classification",
        ensemble_metrics={"accuracy": 0.88},
        baseline_metrics={"accuracy": 0.50},
    )
    assert res["passed"] is True

    # Case 2: Fail (ensemble worse than naive baseline)
    with pytest.raises(GuardrailViolation):
        GuardrailsManager.verify_gate1_baseline(
            task_type="binary_classification",
            ensemble_metrics={"accuracy": 0.40},
            baseline_metrics={"accuracy": 0.65},
        )

def test_gate2_leakage_audit():
    # Case 1: Normal generalization -> no leakage
    has_leakage, feat, rep = GuardrailsManager.audit_gate2_overfitting_and_leakage(
        task_type="binary_classification",
        val_score=0.85,
        holdout_score=0.83,
        feature_importance={"f1": 0.4, "f2": 0.3},
    )
    assert not has_leakage
    assert rep["passed"] is True

    # Case 2: Target leakage where one feature accounts for >80% and val score = 1.0
    has_leakage, feat, rep = GuardrailsManager.audit_gate2_overfitting_and_leakage(
        task_type="binary_classification",
        val_score=0.999,
        holdout_score=0.998,
        feature_importance={"leaking_label_copy": 0.95, "f2": 0.02},
    )
    assert has_leakage is True
    assert feat == "leaking_label_copy"

    # Case 3: Divergence > 15% between val and holdout
    has_leakage, feat, rep = GuardrailsManager.audit_gate2_overfitting_and_leakage(
        task_type="regression",
        val_score=0.95,
        holdout_score=0.70,
        feature_importance={"colA": 0.6, "colB": 0.2},
    )
    assert has_leakage is True
    assert feat == "colA"

def test_gate3_recovery():
    counter = {"attempts": 0}

    def flaky_task():
        counter["attempts"] += 1
        if counter["attempts"] < 2:
            raise ValueError("Temporary simulated memory or dtype glitch!")
        return "SUCCESS"

    result, logs = GuardrailsManager.execute_gate3_recovery(flaky_task, max_retries=3)
    assert result == "SUCCESS"
    assert len(logs) == 1

def test_gate4_inference_sanity():
    class DummyPipeline:
        def predict(self, df):
            # Safe non-crashing prediction
            return np.ones(len(df))

    schema = {
        "num_feature": "numeric",
        "cat_feature": "categorical",
        "dt_feature": "datetime",
        "target": "target (binary_classification)",
    }

    report = GuardrailsManager.verify_gate4_inference_sanity(
        inference_pipeline=DummyPipeline(),
        raw_schema=schema,
        n_synthetic_rows=100,
    )
    assert report["passed"] is True
    assert report["synthetic_rows_evaluated"] == 100
