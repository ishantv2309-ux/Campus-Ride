# Model Card: model_bundle_v1.0.0_melb_job_5431d08e

## 1. Executive Summary
- **Task Type**: regression
- **Target Column**: `Price`
- **Training Timestamp**: 2026-11-13T01:14:01.236411
- **Framework**: Autonomous AutoML Training Agent (Scikit-Learn, LightGBM, XGBoost, CatBoost)

## 2. Dataset Fingerprint
- **Dataset SHA-256**: `3e449c3e95088da8a3a6b10331a5703f2c951d0740f317f97ed9baf0db1fd9f8`
- **Total Rows**: 13580
- **Total Columns**: 21
- **Task Detection**: regression

## 3. Holdout Test Set Performance
- **rmse**: 254555.325075516
- **mae**: 160190.02334937296
- **r2**: 0.8368676901280957
- **mape**: 0.14924781321689543
- **residual_mean**: 19935.46614908179
- **residual_std**: 253773.50278096498

## 4. Model Architecture & Leaderboard
Top models evaluated across 5 distinct model families with Stratified K-Fold cross-validation:

| model        |   cv_mean_score |   cv_std_score |   folds |   holdout_r2 |   holdout_rmse |   holdout_mae |
|:-------------|----------------:|---------------:|--------:|-------------:|---------------:|--------------:|
| LightGBM     |          0.8001 |         0.0304 |       5 |       0.8288 |         260769 |        168560 |
| XGBoost      |          0.7965 |         0.0264 |       5 |       0.8171 |         269513 |        169060 |
| CatBoost     |          0.7934 |         0.0281 |       5 |       0.8156 |         270610 |        176981 |
| ExtraTrees   |          0.7819 |         0.0267 |       5 |       0.81   |         274739 |        172202 |
| RandomForest |          0.7817 |         0.03   |       5 |       0.7827 |         293810 |        189857 |
| TabularNN    |         -0.1358 |         0.3923 |       5 |       0.0642 |         609677 |        433889 |

## 5. Permutation Feature Importance (Top Features)
- **Distance**: 0.34236
- **Type**: 0.14728
- **Postcode**: 0.14566
- **Landsize**: 0.13388
- **Rooms**: 0.11211
- **Lattitude**: 0.06303
- **Bathroom**: 0.05932
- **Longtitude**: 0.05369
- **BuildingArea**: 0.03596
- **YearBuilt**: 0.01584

## 6. Error Prevention & Validation Guardrails
- **Gate 3 - Autonomous Traceback Recovery**: PASSED — Stage 2 & 3 executed cleanly with 0 recovery retries.
- **Gate 1 - Naive Baseline Verification**: PASSED — Ensemble successfully outperformed naive baseline.
- **Gate 2 - Overfitting & Leakage Audit**: PASSED — Validation and holdout generalization within expected tolerances.
- **Gate 4 - Inference Sanity Checks**: PASSED — Successfully tested 100 synthetic edge-case rows (all-null, outliers, unseen categories). Predictions are 100% valid and non-NaN.

## 7. Operational Guidelines & Limitations
- **Inference Latency Target**: Single-row predictions in <15ms; batch in <500ms.
- **Handling Missing Values**: Preprocessing pipeline automatically executes deterministic median and `__MISSING__` token substitution.
- **Out of Scope**: Non-tabular inputs (unstructured raw images or continuous audio streams).
