# Model Card: model_bundle_v1.0.0_job_3503c8e9

## 1. Executive Summary
- **Task Type**: binary_classification
- **Target Column**: `churn`
- **Training Timestamp**: 2026-11-13T00:51:30.628667
- **Framework**: Autonomous AutoML Training Agent (Scikit-Learn, LightGBM, XGBoost, CatBoost)

## 2. Dataset Fingerprint
- **Dataset SHA-256**: `e992accd02878e4f2a9d2d28d0ad83f4ef308c9ed2649abba5c3f4cb002b322a`
- **Total Rows**: 500
- **Total Columns**: 10
- **Task Detection**: binary_classification

## 3. Holdout Test Set Performance
- **accuracy**: 0.87
- **f1**: 0.8712871287128713
- **precision**: 0.8627450980392157
- **recall**: 0.88
- **roc_auc**: 0.948
- **log_loss**: 0.298226986979035

## 4. Model Architecture & Leaderboard
Top models evaluated across 5 distinct model families with Stratified K-Fold cross-validation:

| model        |   cv_mean_score |   cv_std_score |   folds |   holdout_accuracy |   holdout_f1 |   holdout_roc_auc |
|:-------------|----------------:|---------------:|--------:|-------------------:|-------------:|------------------:|
| RandomForest |          0.8975 |         0.0439 |      10 |               0.86 |       0.86   |            0.9306 |
| CatBoost     |          0.895  |         0.0367 |      10 |               0.87 |       0.8687 |            0.95   |
| ExtraTrees   |          0.8875 |         0.0451 |      10 |               0.84 |       0.8367 |            0.9332 |
| LightGBM     |          0.8775 |         0.0361 |      10 |               0.88 |       0.8776 |            0.948  |
| XGBoost      |          0.8675 |         0.0354 |      10 |               0.88 |       0.88   |            0.936  |
| TabularNN    |          0.8475 |         0.0802 |      10 |               0.8  |       0.8039 |            0.9016 |

## 5. Permutation Feature Importance (Top Features)
- **tenure_months**: 0.26200
- **monthly_spend**: 0.11600
- **contract_type**: 0.09000
- **age**: 0.05400
- **monthly_spend_is_missing**: 0.00000
- **tenure_months_is_missing**: 0.00000
- **age_is_missing**: -0.00200
- **payment_method**: -0.00200

## 6. Error Prevention & Validation Guardrails
- **Gate 3 - Autonomous Traceback Recovery**: PASSED — Stage 2 & 3 executed cleanly with 0 recovery retries.
- **Gate 1 - Naive Baseline Verification**: PASSED — Ensemble successfully outperformed naive baseline.
- **Gate 2 - Overfitting & Leakage Audit**: PASSED — Validation and holdout generalization within expected tolerances.
- **Gate 4 - Inference Sanity Checks**: PASSED — Successfully tested 100 synthetic edge-case rows (all-null, outliers, unseen categories). Predictions are 100% valid and non-NaN.

## 7. Operational Guidelines & Limitations
- **Inference Latency Target**: Single-row predictions in <15ms; batch in <500ms.
- **Handling Missing Values**: Preprocessing pipeline automatically executes deterministic median and `__MISSING__` token substitution.
- **Out of Scope**: Non-tabular inputs (unstructured raw images or continuous audio streams).
