"""
Stage 5: Structured Artifact & Audit Trail Packaging (Section 5 & 5.1)
Exports production-ready versioned model bundles with unified inference pipeline,
standalone Predictor wrapper, input_schema.json, training_trail.json,
leaderboard.csv, and model_card.md.
"""

from __future__ import annotations
import json
import os
import shutil
import zipfile
from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np
import joblib

INFERENCE_PY_TEMPLATE = '''"""
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
'''

class ModelPackagingEngine:
    """Packages training artifacts into production bundles with strict schemas and audit trails."""

    @classmethod
    def package_bundle(
        cls,
        output_dir: str,
        bundle_name: str,
        preprocessor: Any,
        ensemble_model: Any,
        task_type: str,
        target_col: str,
        raw_schema: Dict[str, str],
        dataset_fingerprint: Dict[str, Any],
        transformation_log: Dict[str, Any],
        validation_metrics: Dict[str, Any],
        leaderboard_df: pd.DataFrame,
        feature_importance: Dict[str, float],
        guardrail_reports: List[Dict[str, Any]],
    ) -> str:
        """Generates self-contained versioned model bundle."""
        bundle_path = os.path.join(output_dir, bundle_name)
        if os.path.exists(bundle_path):
            shutil.rmtree(bundle_path)
        os.makedirs(bundle_path, exist_ok=True)

        # 1. model_artifact/
        artifact_dir = os.path.join(bundle_path, "model_artifact")
        os.makedirs(artifact_dir, exist_ok=True)
        pipeline_file = os.path.join(artifact_dir, "pipeline.joblib")

        pipeline_bundle = {
            "preprocessor": preprocessor,
            "model": ensemble_model,
            "task_type": task_type,
            "target_col": target_col,
            "packaged_at": pd.Timestamp.now().isoformat(),
        }
        joblib.dump(pipeline_bundle, pipeline_file, compress=3)

        # 2. inference.py
        inference_py_path = os.path.join(bundle_path, "inference.py")
        with open(inference_py_path, "w", encoding="utf-8") as f:
            f.write(INFERENCE_PY_TEMPLATE.strip() + "\n")

        # 3. input_schema.json
        input_schema = {
            "task_type": task_type,
            "target_column": target_col,
            "features": {},
            "fallback_rules": {
                "numeric": "median imputation with missing indicator",
                "categorical": "explicit __MISSING__ token mapped to index 0",
                "datetime": "cyclical decomposition (month, dow, hour) with NaT defaults",
            },
        }

        for feat, ftype in raw_schema.items():
            if feat == target_col or feat in transformation_log.get("dropped_columns", []):
                continue
            input_schema["features"][feat] = {
                "type": ftype,
                "fallback_value": (
                    transformation_log.get("imputation_values", {}).get(feat, 0.0)
                    if ftype == "numeric"
                    else "__MISSING__"
                ),
            }

        schema_file = os.path.join(bundle_path, "input_schema.json")
        with open(schema_file, "w", encoding="utf-8") as f:
            json.dump(input_schema, f, indent=2)

        # 4. training_trail.json
        trail = {
            "dataset_fingerprint": dataset_fingerprint,
            "transformation_log": transformation_log,
            "validation_metrics": validation_metrics,
            "feature_importance_ranking": feature_importance,
            "guardrail_reports": guardrail_reports,
        }
        trail_file = os.path.join(bundle_path, "training_trail.json")
        with open(trail_file, "w", encoding="utf-8") as f:
            json.dump(trail, f, indent=2)

        # 5. leaderboard.csv
        leaderboard_file = os.path.join(bundle_path, "leaderboard.csv")
        leaderboard_df.to_csv(leaderboard_file, index=False)

        # 6. model_card.md
        model_card_content = cls._generate_model_card(
            bundle_name=bundle_name,
            task_type=task_type,
            target_col=target_col,
            dataset_fingerprint=dataset_fingerprint,
            validation_metrics=validation_metrics,
            leaderboard_df=leaderboard_df,
            feature_importance=feature_importance,
            guardrail_reports=guardrail_reports,
        )
        card_file = os.path.join(bundle_path, "model_card.md")
        with open(card_file, "w", encoding="utf-8") as f:
            f.write(model_card_content)

        # 7. Create model_bundle.zip in output_dir
        zip_path = os.path.join(output_dir, f"{bundle_name}.zip")
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zip_f:
            for root, _, files in os.walk(bundle_path):
                for file in files:
                    full_file = os.path.join(root, file)
                    rel_path = os.path.relpath(full_file, bundle_path)
                    zip_f.write(full_file, arcname=rel_path)

        return bundle_path

    @staticmethod
    def _generate_model_card(
        bundle_name: str,
        task_type: str,
        target_col: str,
        dataset_fingerprint: Dict[str, Any],
        validation_metrics: Dict[str, Any],
        leaderboard_df: pd.DataFrame,
        feature_importance: Dict[str, float],
        guardrail_reports: List[Dict[str, Any]],
    ) -> str:
        """Generates comprehensive human-readable model card."""
        top_features_list = list(feature_importance.items())[:10]
        top_features_str = "\n".join(
            [f"- **{feat}**: {score:.5f}" for feat, score in top_features_list]
        ) or "- None"

        try:
            leaderboard_table = leaderboard_df.to_markdown(index=False)
        except Exception:
            leaderboard_table = leaderboard_df.to_string(index=False)

        guardrails_summary = "\n".join(
            [f"- **{g.get('gate', 'Gate')}**: {'PASSED' if g.get('passed') else 'FAILED'} — {g.get('diagnostic', '')}"
             for g in guardrail_reports]
        )

        metrics_summary = "\n".join([f"- **{k}**: {v}" for k, v in validation_metrics.items() if not isinstance(v, (list, dict))])

        return f"""# Model Card: {bundle_name}

## 1. Executive Summary
- **Task Type**: {task_type}
- **Target Column**: `{target_col}`
- **Training Timestamp**: {pd.Timestamp.now().isoformat()}
- **Framework**: Autonomous AutoML Training Agent (Scikit-Learn, LightGBM, XGBoost, CatBoost)

## 2. Dataset Fingerprint
- **Dataset SHA-256**: `{dataset_fingerprint.get('sha256', 'N/A')}`
- **Total Rows**: {dataset_fingerprint.get('row_count', 0)}
- **Total Columns**: {dataset_fingerprint.get('column_count', 0)}
- **Task Detection**: {dataset_fingerprint.get('detected_task_type', task_type)}

## 3. Holdout Test Set Performance
{metrics_summary}

## 4. Model Architecture & Leaderboard
Top models evaluated across 5 distinct model families with Stratified K-Fold cross-validation:

{leaderboard_table}

## 5. Permutation Feature Importance (Top Features)
{top_features_str}

## 6. Error Prevention & Validation Guardrails
{guardrails_summary}

## 7. Operational Guidelines & Limitations
- **Inference Latency Target**: Single-row predictions in <15ms; batch in <500ms.
- **Handling Missing Values**: Preprocessing pipeline automatically executes deterministic median and `__MISSING__` token substitution.
- **Out of Scope**: Non-tabular inputs (unstructured raw images or continuous audio streams).
"""
