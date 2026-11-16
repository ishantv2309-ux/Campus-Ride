# Model Card: model_bundle_v1.0.0_job_62f78fa9

## 1. Executive Summary
- **Task Type**: binary_classification
- **Target Column**: `target`
- **Training Timestamp**: 2026-11-13T00:50:08.857502
- **Framework**: Autonomous AutoML Training Agent (Scikit-Learn, LightGBM, XGBoost, CatBoost)

## 2. Dataset Fingerprint
- **Dataset SHA-256**: `24a7e8e692d2744b8feb41a4516e0819ee0cbcffdd6dc45b100078ec102b3835`
- **Total Rows**: 100
- **Total Columns**: 3
- **Task Detection**: binary_classification

## 3. Holdout Test Set Performance
- **accuracy**: 0.55
- **f1**: 0.0
- **precision**: 0.0
- **recall**: 0.0
- **roc_auc**: 0.702020202020202
- **log_loss**: 0.666559018512702

## 4. Model Architecture & Leaderboard
Top models evaluated across 5 distinct model families with Stratified K-Fold cross-validation:

| model        |   cv_mean_score |   cv_std_score |   folds |   holdout_accuracy |   holdout_f1 |   holdout_roc_auc |
|:-------------|----------------:|---------------:|--------:|-------------------:|-------------:|------------------:|
| TabularNN    |          0.5    |         0.1479 |      10 |               0.55 |       0.4    |            0.4192 |
| LightGBM     |          0.45   |         0.1275 |      10 |               0.55 |       0      |            0.702  |
| XGBoost      |          0.45   |         0.1275 |      10 |               0.55 |       0      |            0.702  |
| CatBoost     |          0.45   |         0.1275 |      10 |               0.55 |       0      |            0.702  |
| ExtraTrees   |          0.45   |         0.1275 |      10 |               0.55 |       0      |            0.702  |
| RandomForest |          0.4125 |         0.1375 |      10 |               0.65 |       0.5882 |            0.702  |

## 5. Permutation Feature Importance (Top Features)
- **feature2**: 0.00000

## 6. Error Prevention & Validation Guardrails
- **Gate 3 - Autonomous Traceback Recovery**: PASSED — Stage 2 & 3 executed cleanly with 0 recovery retries.
- **Gate 1 - Naive Baseline Verification**: PASSED — Ensemble successfully outperformed naive baseline.
- **Gate 2 - Overfitting & Leakage Audit**: FAILED — Suspected target leakage: Near-perfect score (1.0000) dominated by feature 'feature1' (100.0%).
- **Gate 3 - Autonomous Traceback Recovery**: PASSED — Stage 2 & 3 executed cleanly with 0 recovery retries.
- **Gate 1 - Naive Baseline Verification**: PASSED — Ensemble successfully outperformed naive baseline.
- **Gate 2 - Overfitting & Leakage Audit**: PASSED — Validation and holdout generalization within expected tolerances.
- **Gate 4 - Inference Sanity Checks**: PASSED — Successfully tested 100 synthetic edge-case rows (all-null, outliers, unseen categories). Predictions are 100% valid and non-NaN.

## 7. Operational Guidelines & Limitations
- **Inference Latency Target**: Single-row predictions in <15ms; batch in <500ms.
- **Handling Missing Values**: Preprocessing pipeline automatically executes deterministic median and `__MISSING__` token substitution.
- **Out of Scope**: Non-tabular inputs (unstructured raw images or continuous audio streams).
