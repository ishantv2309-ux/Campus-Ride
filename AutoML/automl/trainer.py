"""
Stage 3: Multi-Model AutoML Training & Ensembling (FR-03)
Implements K-Fold / Stratified K-Fold CV, model benchmarking across 5 architectures,
weighted stacking ensembling, compute budgeting, and leaderboard generation.
"""

from __future__ import annotations
import time
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Tuple, Optional
from sklearn.model_selection import StratifiedKFold, KFold
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    log_loss,
    confusion_matrix,
    mean_squared_error,
    mean_absolute_error,
    r2_score,
    mean_absolute_percentage_error,
)
from sklearn.inspection import permutation_importance
from scipy.optimize import minimize
from .models import get_model_candidates, get_dummy_baseline

class WeightedEnsemble:
    """Combines predictions from multiple top models with optimal weights."""

    def __init__(self, models: Dict[str, Any], weights: Dict[str, float], task_type: str):
        self.models = models
        self.weights = weights
        self.task_type = task_type
        self.is_classification = "classification" in task_type

    def predict(self, X: pd.DataFrame | np.ndarray) -> np.ndarray:
        if self.is_classification:
            proba = self.predict_proba(X)
            if self.task_type == "binary_classification":
                return (proba[:, 1] >= 0.5).astype(int)
            return np.argmax(proba, axis=1)
        else:
            total_weight = sum(self.weights.values())
            preds = np.zeros(len(X))
            for name, model in self.models.items():
                w = self.weights[name] / total_weight
                preds += w * model.predict(X)
            return preds

    def predict_proba(self, X: pd.DataFrame | np.ndarray) -> np.ndarray:
        if not self.is_classification:
            raise ValueError("predict_proba is only available for classification.")
        total_weight = sum(self.weights.values())
        accum_proba = None
        for name, model in self.models.items():
            w = self.weights[name] / total_weight
            if hasattr(model, "predict_proba"):
                p = model.predict_proba(X)
            else:
                raw_pred = model.predict(X)
                # Fallback one-hot
                p = np.zeros((len(X), 2))
                p[np.arange(len(X)), raw_pred] = 1.0
            if accum_proba is None:
                accum_proba = w * p
            else:
                accum_proba += w * p
        if accum_proba is not None:
            # Normalize to sum to 1 across rows
            row_sums = accum_proba.sum(axis=1, keepdims=True)
            row_sums[row_sums == 0] = 1.0
            accum_proba = accum_proba / row_sums
        return accum_proba

class AutoMLTrainer:
    """Orchestrates multi-model training, cross-validation, and ensembling."""

    def __init__(
        self,
        task_type: str,
        compute_preset: str = "fast_prototype",
        time_budget_secs: Optional[int] = None,
        random_state: int = 42,
    ):
        self.task_type = task_type
        self.compute_preset = compute_preset
        self.random_state = random_state

        preset_budgets = {
            "fast_prototype": 120,   # 2 mins
            "balanced": 600,         # 10 mins
            "high_accuracy": 3600,   # 60 mins
        }
        self.time_budget_secs = time_budget_secs or preset_budgets.get(compute_preset, 120)

    def _determine_cv_folds(self, n_rows: int) -> int:
        """FR-03.2: 5-fold (or 10-fold for <5,000 rows)."""
        if n_rows < 5000:
            return 10
        return 5

    def compute_metrics(
        self, y_true: np.ndarray, y_pred: np.ndarray, y_proba: Optional[np.ndarray] = None
    ) -> Dict[str, Any]:
        """Compute standard metrics according to task type."""
        metrics: Dict[str, Any] = {}

        if "classification" in self.task_type:
            metrics["accuracy"] = float(accuracy_score(y_true, y_pred))
            is_binary = self.task_type == "binary_classification"
            avg_mode = "binary" if is_binary else "weighted"

            metrics["f1"] = float(f1_score(y_true, y_pred, average=avg_mode, zero_division=0))
            metrics["precision"] = float(precision_score(y_true, y_pred, average=avg_mode, zero_division=0))
            metrics["recall"] = float(recall_score(y_true, y_pred, average=avg_mode, zero_division=0))

            if y_proba is not None:
                try:
                    if is_binary:
                        p1 = y_proba[:, 1] if y_proba.ndim == 2 else y_proba
                        metrics["roc_auc"] = float(roc_auc_score(y_true, p1))
                        metrics["log_loss"] = float(log_loss(y_true, y_proba))
                    else:
                        metrics["roc_auc"] = float(roc_auc_score(y_true, y_proba, multi_class="ovr"))
                        metrics["log_loss"] = float(log_loss(y_true, y_proba))
                except Exception:
                    metrics["roc_auc"] = None
                    metrics["log_loss"] = None
            else:
                metrics["roc_auc"] = None
                metrics["log_loss"] = None

            cm = confusion_matrix(y_true, y_pred).tolist()
            metrics["confusion_matrix"] = cm

        else:
            # Regression
            mse = float(mean_squared_error(y_true, y_pred))
            rmse = float(np.sqrt(mse))
            mae = float(mean_absolute_error(y_true, y_pred))
            r2 = float(r2_score(y_true, y_pred))
            try:
                mape = float(mean_absolute_percentage_error(y_true, y_pred))
            except Exception:
                mape = None

            residuals = (y_true - y_pred).tolist()
            res_arr = np.array(residuals)

            metrics["rmse"] = rmse
            metrics["mae"] = mae
            metrics["r2"] = r2
            metrics["mape"] = mape
            metrics["residual_mean"] = float(np.mean(res_arr))
            metrics["residual_std"] = float(np.std(res_arr))

        return metrics

    def train_and_evaluate(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_test: pd.DataFrame,
        y_test: pd.Series,
        class_weights: Optional[Dict[Any, float]] = None,
    ) -> Dict[str, Any]:
        """Runs baseline benchmark, K-Fold CV for all 5 model candidates,
        builds weighted stack ensemble, and generates leaderboard and audit metrics.
        """
        start_time = time.time()
        n_rows = len(X_train)
        n_folds = self._determine_cv_folds(n_rows)

        # Baseline evaluation (Gate 1 comparison)
        dummy_model = get_dummy_baseline(self.task_type)
        dummy_model.fit(X_train, y_train)
        dummy_preds = dummy_model.predict(X_test)
        dummy_proba = dummy_model.predict_proba(X_test) if hasattr(dummy_model, "predict_proba") else None
        baseline_metrics = self.compute_metrics(y_test.to_numpy(), dummy_preds, dummy_proba)

        # Model candidates (5 distinct architectures)
        candidate_models = get_model_candidates(
            self.task_type, class_weights=class_weights, preset=self.compute_preset, random_state=self.random_state
        )

        # Setup K-Fold
        if "classification" in self.task_type:
            cv = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=self.random_state)
        else:
            cv = KFold(n_splits=n_folds, shuffle=True, random_state=self.random_state)

        leaderboard_records = []
        oof_predictions: Dict[str, np.ndarray] = {}
        fitted_models: Dict[str, Any] = {}
        test_metrics_by_model: Dict[str, Dict[str, Any]] = {}

        for model_name, model in candidate_models.items():
            # Check elapsed time budget
            elapsed = time.time() - start_time
            if elapsed > self.time_budget_secs:
                # Graceful early stopping
                break

            oof_preds = np.zeros(n_rows)
            fold_scores = []

            try:
                for fold, (train_idx, val_idx) in enumerate(cv.split(X_train, y_train)):
                    X_tr, y_tr = X_train.iloc[train_idx], y_train.iloc[train_idx]
                    X_va, y_va = X_train.iloc[val_idx], y_train.iloc[val_idx]

                    # Clone and fit
                    from sklearn.base import clone
                    fold_model = clone(model)
                    fold_model.fit(X_tr, y_tr)
                    val_pred = fold_model.predict(X_va)
                    oof_preds[val_idx] = val_pred

                    if "classification" in self.task_type:
                        score = accuracy_score(y_va, val_pred)
                    else:
                        score = r2_score(y_va, val_pred)
                    fold_scores.append(score)

                # Fit full model on all training data
                full_model = clone(model)
                full_model.fit(X_train, y_train)
                fitted_models[model_name] = full_model
                oof_predictions[model_name] = oof_preds

                # Holdout test metrics
                test_pred = full_model.predict(X_test)
                test_proba = full_model.predict_proba(X_test) if hasattr(full_model, "predict_proba") else None
                test_metrics = self.compute_metrics(y_test.to_numpy(), test_pred, test_proba)
                test_metrics_by_model[model_name] = test_metrics

                mean_cv = float(np.mean(fold_scores))
                std_cv = float(np.std(fold_scores))

                rec = {
                    "model": model_name,
                    "cv_mean_score": round(mean_cv, 4),
                    "cv_std_score": round(std_cv, 4),
                    "folds": n_folds,
                }
                if "classification" in self.task_type:
                    rec["holdout_accuracy"] = round(test_metrics.get("accuracy", 0.0), 4)
                    rec["holdout_f1"] = round(test_metrics.get("f1", 0.0), 4)
                    rec["holdout_roc_auc"] = round(test_metrics.get("roc_auc") or 0.0, 4)
                else:
                    rec["holdout_r2"] = round(test_metrics.get("r2", 0.0), 4)
                    rec["holdout_rmse"] = round(test_metrics.get("rmse", 0.0), 4)
                    rec["holdout_mae"] = round(test_metrics.get("mae", 0.0), 4)

                leaderboard_records.append(rec)

            except Exception as e:
                # Capture model error and continue
                leaderboard_records.append({
                    "model": model_name,
                    "error": str(e),
                    "cv_mean_score": -999.0,
                    "cv_std_score": 0.0,
                    "folds": n_folds,
                })

        # Rank models
        sort_key = "cv_mean_score"
        leaderboard_df = pd.DataFrame(leaderboard_records).sort_values(by=sort_key, ascending=False).reset_index(drop=True)

        # Select top performing models for multi-layer weighted ensembling
        valid_models = [r["model"] for r in leaderboard_records if r.get("cv_mean_score", -999) > -990]
        if not valid_models:
            raise RuntimeError("All candidate models failed during cross-validation.")

        top_k = min(3, len(valid_models))
        top_model_names = valid_models[:top_k]
        top_models = {name: fitted_models[name] for name in top_model_names}

        # Determine weights based on normalized CV score
        scores = [max(next(r["cv_mean_score"] for r in leaderboard_records if r["model"] == m), 0.01) for m in top_model_names]
        total_score = sum(scores)
        weights = {name: score / total_score for name, score in zip(top_model_names, scores)}

        ensemble = WeightedEnsemble(top_models, weights, self.task_type)

        # Holdout test metrics on final ensemble
        final_test_pred = ensemble.predict(X_test)
        final_test_proba = ensemble.predict_proba(X_test) if "classification" in self.task_type else None
        final_metrics = self.compute_metrics(y_test.to_numpy(), final_test_pred, final_test_proba)

        # Permutation Feature Importance on holdout test set
        perm_importance = {}
        try:
            primary_top_model = fitted_models[top_model_names[0]]
            r = permutation_importance(
                primary_top_model, X_test, y_test, n_repeats=5, random_state=self.random_state
            )
            for idx, col in enumerate(X_test.columns):
                perm_importance[col] = float(np.round(r.importances_mean[idx], 5))
            # Sort descending
            perm_importance = dict(sorted(perm_importance.items(), key=lambda item: item[1], reverse=True))
        except Exception:
            perm_importance = {col: 0.0 for col in X_test.columns}

        return {
            "baseline_metrics": baseline_metrics,
            "final_metrics": final_metrics,
            "leaderboard": leaderboard_df,
            "fitted_models": fitted_models,
            "ensemble": ensemble,
            "top_model_names": top_model_names,
            "weights": weights,
            "feature_importance": perm_importance,
            "cv_folds": n_folds,
            "time_elapsed": time.time() - start_time,
        }
