"""
Standalone Production Model Inference Wrapper
Zero external dependencies beyond standard scientific Python libraries (numpy, pandas, joblib, scikit-learn).
"""

from __future__ import annotations
import json
import os
import time
from typing import Union, List, Dict, Any, Tuple
import pandas as pd
import numpy as np
import joblib

class Predictor:
    """Production predictor encapsulating unified preprocessing and model ensemble."""

    def __init__(self, bundle_dir: str):
        self.bundle_dir = bundle_dir
        self.schema_path = os.path.join(bundle_dir, "input_schema.json")
        self.pipeline_path = os.path.join(bundle_dir, "model_artifact", "pipeline.joblib")

        with open(self.schema_path, "r", encoding="utf-8") as f:
            self.schema = json.load(f)

        self.pipeline_bundle = joblib.load(self.pipeline_path)
        self.preprocessor = self.pipeline_bundle["preprocessor"]
        self.model = self.pipeline_bundle["model"]
        self.task_type = self.pipeline_bundle["task_type"]
        self.is_classification = "classification" in self.task_type

    @classmethod
    def load(cls, path: str) -> "Predictor":
        """Load extracted bundle directory into an in-memory Predictor object."""
        return cls(bundle_dir=path)

    def validate_and_align_input(
        self, data: Union[pd.DataFrame, List[Dict[str, Any]], Dict[str, Any]]
    ) -> Tuple[pd.DataFrame, List[str]]:
        """Validates input against input_schema.json and generates warnings for missing/unexpected keys."""
        warnings: List[str] = []
        if isinstance(data, dict):
            df = pd.DataFrame([data])
        elif isinstance(data, list):
            df = pd.DataFrame(data)
        elif isinstance(data, pd.DataFrame):
            df = data.copy()
        else:
            raise TypeError(f"Unsupported input type {type(data)}. Expected DataFrame, list of dicts, or dict.")

        expected_features = self.schema.get("features", {})
        for feat, details in expected_features.items():
            if feat not in df.columns:
                fallback_val = details.get("fallback_value", None)
                df[feat] = fallback_val
                warnings.append(f"Missing expected feature '{feat}'; substituted with fallback value '{fallback_val}'.")

        # Cast expected types where possible
        for feat, details in expected_features.items():
            dtype = details.get("type", "numeric")
            if dtype == "numeric":
                df[feat] = pd.to_numeric(df[feat], errors="coerce")

        return df, warnings

    def predict(
        self, data: Union[pd.DataFrame, List[Dict[str, Any]], Dict[str, Any]]
    ) -> np.ndarray:
        """Serve low-latency predictions."""
        df, _ = self.validate_and_align_input(data)
        X_trans = self.preprocessor.transform(df)
        preds = self.model.predict(X_trans)
        if self.is_classification:
            return self.preprocessor.decode_target(preds)
        return np.asarray(preds)

    def predict_proba(
        self, data: Union[pd.DataFrame, List[Dict[str, Any]], Dict[str, Any]]
    ) -> np.ndarray:
        """Serve class probabilities for classification models."""
        if not self.is_classification:
            raise ValueError("predict_proba is not supported for regression models.")
        df, _ = self.validate_and_align_input(data)
        X_trans = self.preprocessor.transform(df)
        if hasattr(self.model, "predict_proba"):
            return self.model.predict_proba(X_trans)
        raise NotImplementedError("Underlying model does not support predict_proba.")
