"""
Stage 3 Model Definitions: 5 Distinct Model Families (FR-03.1)
1. LightGBM
2. XGBoost
3. CatBoost
4. ExtraTrees / Random Forest
5. Tabular Neural Networks (MLP)
"""

from __future__ import annotations
from typing import Dict, Any, List, Optional
import numpy as np

# Model families
from lightgbm import LGBMClassifier, LGBMRegressor
from xgboost import XGBClassifier, XGBRegressor
from catboost import CatBoostClassifier, CatBoostRegressor
from sklearn.ensemble import (
    ExtraTreesClassifier,
    ExtraTreesRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.neural_network import MLPClassifier, MLPRegressor
from sklearn.dummy import DummyClassifier, DummyRegressor

def get_model_candidates(
    task_type: str,
    class_weights: Optional[Dict[Any, float]] = None,
    preset: str = "fast_prototype",
    random_state: int = 42,
) -> Dict[str, Any]:
    """Instantiate the 5 required model architectures according to task type and compute preset."""
    is_classification = "classification" in task_type
    is_binary = task_type == "binary_classification"

    # Hyperparameter tuning based on preset
    if preset == "fast_prototype":
        n_estimators = 50
        max_iter = 100
        n_jobs = -1
    elif preset == "balanced":
        n_estimators = 150
        max_iter = 250
        n_jobs = -1
    else:  # high_accuracy
        n_estimators = 300
        max_iter = 500
        n_jobs = -1

    models: Dict[str, Any] = {}

    # Weight balancing parameters
    scale_pos_weight = 1.0
    cb_class_weights = None
    sk_class_weight = None
    if class_weights and is_binary:
        # For binary, ratio of negative to positive
        keys = list(class_weights.keys())
        if len(keys) == 2:
            scale_pos_weight = class_weights[keys[1]] / max(class_weights[keys[0]], 1e-6)
    if class_weights and is_classification:
        sk_class_weight = class_weights
        cb_class_weights = [class_weights.get(i, 1.0) for i in range(len(class_weights))]

    if is_classification:
        # 1. LightGBM
        models["LightGBM"] = LGBMClassifier(
            n_estimators=n_estimators,
            random_state=random_state,
            n_jobs=n_jobs,
            verbose=-1,
            class_weight="balanced" if class_weights else None,
        )

        # 2. XGBoost
        models["XGBoost"] = XGBClassifier(
            n_estimators=n_estimators,
            random_state=random_state,
            n_jobs=n_jobs,
            eval_metric="logloss" if is_binary else "mlogloss",
            scale_pos_weight=scale_pos_weight if is_binary else 1.0,
        )

        # 3. CatBoost
        models["CatBoost"] = CatBoostClassifier(
            iterations=n_estimators,
            random_seed=random_state,
            verbose=0,
            thread_count=4,
            class_weights=cb_class_weights,
        )

        # 4. ExtraTrees / Random Forest
        models["ExtraTrees"] = ExtraTreesClassifier(
            n_estimators=n_estimators,
            random_state=random_state,
            n_jobs=n_jobs,
            class_weight=sk_class_weight,
        )
        models["RandomForest"] = RandomForestClassifier(
            n_estimators=n_estimators,
            random_state=random_state,
            n_jobs=n_jobs,
            class_weight=sk_class_weight,
        )

        # 5. Tabular Neural Network (MLP)
        models["TabularNN"] = MLPClassifier(
            hidden_layer_sizes=(64, 32),
            max_iter=max_iter,
            random_state=random_state,
            early_stopping=True,
        )

    else:
        # Regression
        # 1. LightGBM
        models["LightGBM"] = LGBMRegressor(
            n_estimators=n_estimators,
            random_state=random_state,
            n_jobs=n_jobs,
            verbose=-1,
        )

        # 2. XGBoost
        models["XGBoost"] = XGBRegressor(
            n_estimators=n_estimators,
            random_state=random_state,
            n_jobs=n_jobs,
        )

        # 3. CatBoost
        models["CatBoost"] = CatBoostRegressor(
            iterations=n_estimators,
            random_seed=random_state,
            verbose=0,
            thread_count=4,
        )

        # 4. ExtraTrees / Random Forest
        models["ExtraTrees"] = ExtraTreesRegressor(
            n_estimators=n_estimators,
            random_state=random_state,
            n_jobs=n_jobs,
        )
        models["RandomForest"] = RandomForestRegressor(
            n_estimators=n_estimators,
            random_state=random_state,
            n_jobs=n_jobs,
        )

        # 5. Tabular Neural Network (MLP)
        models["TabularNN"] = MLPRegressor(
            hidden_layer_sizes=(64, 32),
            max_iter=max_iter,
            random_state=random_state,
            early_stopping=True,
        )

    return models

def get_dummy_baseline(task_type: str) -> Any:
    """Returns a naive dummy baseline predictor (Gate 1)."""
    if "classification" in task_type:
        return DummyClassifier(strategy="most_frequent")
    return DummyRegressor(strategy="median")
