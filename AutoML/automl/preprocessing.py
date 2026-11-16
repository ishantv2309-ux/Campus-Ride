"""
Stage 2: Leak-Free Preprocessing & Feature Engineering (FR-02)
Guarantees strict train/holdout test isolation, median + indicator imputation,
categorical __MISSING__ imputation, ISO timestamp cyclical decomposition,
and deterministic serialization with zero data leakage.
"""

from __future__ import annotations
import math
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Tuple, Optional
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.model_selection import train_test_split

class LeakFreePreprocessor(BaseEstimator, TransformerMixin):
    """Deterministic, zero-leakage scikit-learn compatible preprocessor."""

    def __init__(
        self,
        sparsity_threshold: float = 0.60,
        minority_threshold: float = 0.10,
    ):
        self.sparsity_threshold = sparsity_threshold
        self.minority_threshold = minority_threshold

        # Learned parameters during fit
        self.dropped_high_sparsity_cols_: List[str] = []
        self.datetime_cols_: List[str] = []
        self.numeric_cols_: List[str] = []
        self.categorical_cols_: List[str] = []
        self.numeric_medians_: Dict[str, float] = {}
        self.category_encodings_: Dict[str, Dict[str, int]] = {}
        self.categorical_fallbacks_: Dict[str, int] = {}
        self.imbalance_detected_: bool = False
        self.class_weights_: Optional[Dict[Any, float]] = None
        self.final_feature_names_: List[str] = []
        self.raw_feature_types_: Dict[str, str] = {}
        self.target_encoder_: Optional[Dict[Any, int]] = None
        self.inverse_target_encoder_: Optional[Dict[int, Any]] = None

    def fit(self, X: pd.DataFrame, y: Optional[pd.Series] = None, task_type: str = "binary_classification"):
        X_df = X.copy()

        # Step 1: Detect high sparsity columns (>60% nulls)
        n_rows = len(X_df)
        null_ratios = X_df.isnull().sum() / max(n_rows, 1)
        self.dropped_high_sparsity_cols_ = [
            col for col, ratio in null_ratios.items() if ratio > self.sparsity_threshold
        ]
        active_df = X_df.drop(columns=self.dropped_high_sparsity_cols_)

        # Step 2: Classify column types (datetime, numeric, categorical)
        self.datetime_cols_ = []
        self.numeric_cols_ = []
        self.categorical_cols_ = []

        for col in active_df.columns:
            s = active_df[col]
            # Check datetime
            if pd.api.types.is_datetime64_any_dtype(s):
                self.datetime_cols_.append(col)
                self.raw_feature_types_[col] = "datetime"
                continue

            if s.dtype == object or pd.api.types.is_string_dtype(s):
                sample = s.dropna().head(20)
                is_dt = False
                if len(sample) > 0:
                    try:
                        pd.to_datetime(sample, format="ISO8601")
                        is_dt = True
                    except Exception:
                        try:
                            pd.to_datetime(sample, errors="raise")
                            is_dt = True
                        except Exception:
                            is_dt = False
                if is_dt:
                    self.datetime_cols_.append(col)
                    self.raw_feature_types_[col] = "datetime"
                    continue

            if pd.api.types.is_numeric_dtype(s):
                self.numeric_cols_.append(col)
                self.raw_feature_types_[col] = "numeric"
            else:
                self.categorical_cols_.append(col)
                self.raw_feature_types_[col] = "categorical"

        # Step 3: Compute numeric medians on train split
        self.numeric_medians_ = {}
        for col in self.numeric_cols_:
            median_val = float(active_df[col].median())
            if np.isnan(median_val):
                median_val = 0.0
            self.numeric_medians_[col] = median_val

        # Step 4: Fit categorical encodings (with __MISSING__ token)
        self.category_encodings_ = {}
        self.categorical_fallbacks_ = {}
        for col in self.categorical_cols_:
            s_clean = active_df[col].fillna("__MISSING__").astype(str)
            unique_cats = sorted(s_clean.unique())
            mapping = {"__MISSING__": 0}
            idx = 1
            for cat in unique_cats:
                if cat != "__MISSING__":
                    mapping[cat] = idx
                    idx += 1
            self.category_encodings_[col] = mapping
            self.categorical_fallbacks_[col] = 0  # Maps unseen / missing to 0

        # Step 5: Check class imbalance if classification
        if y is not None and "classification" in task_type:
            y_clean = y.dropna()
            val_counts = y_clean.value_counts(normalize=True)
            min_prop = val_counts.min() if len(val_counts) > 0 else 1.0
            if min_prop < self.minority_threshold:
                self.imbalance_detected_ = True
                # Compute balanced class weights: n_samples / (n_classes * np.bincount(y))
                classes = val_counts.index.tolist()
                total = len(y_clean)
                n_classes = len(classes)
                self.class_weights_ = {
                    cls: float(total / (n_classes * y_clean.value_counts()[cls]))
                    for cls in classes
                }
            else:
                self.imbalance_detected_ = False
                self.class_weights_ = None

            # Fit target encoder if string/categorical classes
            classes_sorted = sorted(y_clean.unique())
            self.target_encoder_ = {cls_val: i for i, cls_val in enumerate(classes_sorted)}
            self.inverse_target_encoder_ = {i: cls_val for i, cls_val in enumerate(classes_sorted)}

        # Transform train sample to record final feature names
        sample_transformed = self._transform_internal(active_df)
        self.final_feature_names_ = list(sample_transformed.columns)

        return self

    def _transform_internal(self, df: pd.DataFrame) -> pd.DataFrame:
        """Internal transformation logic."""
        res = pd.DataFrame(index=df.index)

        # 1. Datetime decomposition
        for col in self.datetime_cols_:
            if col in df.columns:
                try:
                    dt_series = pd.to_datetime(df[col], errors="coerce")
                except Exception:
                    dt_series = pd.Series([pd.NaT] * len(df), index=df.index)
            else:
                dt_series = pd.Series([pd.NaT] * len(df), index=df.index)

            dow_series = getattr(dt_series.dt, "day_of_week", getattr(dt_series.dt, "dayofweek", None))
            res[f"{col}_year"] = dt_series.dt.year.fillna(2000).astype(int)
            res[f"{col}_month"] = dt_series.dt.month.fillna(1).astype(int)
            res[f"{col}_day_of_week"] = dow_series.fillna(0).astype(int) if dow_series is not None else 0
            res[f"{col}_hour"] = dt_series.dt.hour.fillna(0).astype(int)
            res[f"{col}_is_weekend"] = (dow_series.isin([5, 6]).astype(int)) if dow_series is not None else 0

            # Cyclical sine & cosine
            month_norm = (res[f"{col}_month"] - 1) / 12.0 * 2 * math.pi
            hour_norm = res[f"{col}_hour"] / 24.0 * 2 * math.pi
            dow_norm = res[f"{col}_day_of_week"] / 7.0 * 2 * math.pi

            res[f"{col}_sin_month"] = np.sin(month_norm)
            res[f"{col}_cos_month"] = np.cos(month_norm)
            res[f"{col}_sin_hour"] = np.sin(hour_norm)
            res[f"{col}_cos_hour"] = np.cos(hour_norm)
            res[f"{col}_sin_dow"] = np.sin(dow_norm)
            res[f"{col}_cos_dow"] = np.cos(dow_norm)

        # 2. Numeric features: median impute + binary missing indicator
        for col in self.numeric_cols_:
            median_val = self.numeric_medians_.get(col, 0.0)
            if col in df.columns:
                s = pd.to_numeric(df[col], errors="coerce")
                res[f"{col}_is_missing"] = s.isnull().astype(int)
                res[col] = s.fillna(median_val).astype(float)
            else:
                # Missing completely from inference input
                res[f"{col}_is_missing"] = 1
                res[col] = float(median_val)

        # 3. Categoricals: __MISSING__ imputation + integer encoding
        for col in self.categorical_cols_:
            mapping = self.category_encodings_.get(col, {"__MISSING__": 0})
            if col in df.columns:
                s_clean = df[col].fillna("__MISSING__").astype(str)
                encoded = s_clean.map(lambda x: mapping.get(x, 0))
                res[col] = encoded.astype(int)
            else:
                res[col] = 0

        # Guarantee column order alignment
        if hasattr(self, "final_feature_names_") and self.final_feature_names_:
            for col_name in self.final_feature_names_:
                if col_name not in res.columns:
                    res[col_name] = 0.0
            res = res[self.final_feature_names_]

        return res

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        """Transforms input DataFrame deterministically without data leakage."""
        X_df = X.copy()
        # Drop high sparsity columns
        active_df = X_df.drop(
            columns=[c for c in self.dropped_high_sparsity_cols_ if c in X_df.columns]
        )
        return self._transform_internal(active_df)

    def encode_target(self, y: pd.Series) -> pd.Series:
        """Encode target labels for classification if needed."""
        if self.target_encoder_ is not None:
            return y.map(lambda v: self.target_encoder_.get(v, 0))
        return y

    def decode_target(self, y: np.ndarray | pd.Series) -> np.ndarray:
        """Decode predicted numeric labels back to original class representations."""
        if self.inverse_target_encoder_ is not None:
            if isinstance(y, (pd.Series, pd.Index)):
                return y.map(lambda v: self.inverse_target_encoder_.get(int(v), str(v))).to_numpy()
            return np.array([self.inverse_target_encoder_.get(int(v), v) for v in y])
        return np.asarray(y)

    def get_transformation_log(self, train_idx: List[int], test_idx: List[int]) -> Dict[str, Any]:
        """Provides exact audit trail of all transformations."""
        return {
            "dropped_columns": list(self.dropped_high_sparsity_cols_),
            "imputation_values": {k: float(v) for k, v in self.numeric_medians_.items()},
            "encoding_mappings": {
                k: {cat: int(code) for cat, code in enc.items() if code < 20}  # Truncate for size
                for k, enc in self.category_encodings_.items()
            },
            "categorical_fallbacks": {k: int(v) for k, v in self.categorical_fallbacks_.items()},
            "class_imbalance_detected": self.imbalance_detected_,
            "class_weights": {str(k): float(v) for k, v in self.class_weights_.items()} if self.class_weights_ else None,
            "train_indices_count": len(train_idx),
            "test_indices_count": len(test_idx),
            "final_feature_count": len(self.final_feature_names_),
            "final_feature_names": list(self.final_feature_names_),
        }

def partition_dataset(
    df: pd.DataFrame,
    target_col: str,
    task_type: str,
    test_size: float = 0.20,
    random_state: int = 42,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series, List[int], List[int]]:
    """Partitions dataset into 80% train/CV pool and 20% holdout test set before any preprocessing."""
    X = df.drop(columns=[target_col])
    y = df[target_col]

    stratify = None
    if "classification" in task_type:
        # Check if smallest class has >= 2 samples for stratified split
        class_counts = y.value_counts()
        if (class_counts >= 2).all():
            stratify = y

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=stratify
    )

    train_indices = list(X_train.index)
    test_indices = list(X_test.index)

    return X_train, X_test, y_train, y_test, train_indices, test_indices
