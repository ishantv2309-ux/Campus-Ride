"""
Stage 1: Ingestion & Schema Profiler (FR-01)
Parses multi-format datasets, profiles schema, detects task type,
and filters out high-cardinality IDs and trivial index/UUID leakage columns.
"""

from __future__ import annotations
import hashlib
import io
import re
import os
from typing import Dict, Any, List, Tuple, Optional
import pandas as pd
import numpy as np

UUID_REGEX = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)

class DataIngestionEngine:
    """Handles ingestion of multi-format datasets and semantic profiling."""

    SUPPORTED_EXTENSIONS = {".csv", ".parquet", ".json", ".xlsx"}

    @staticmethod
    def compute_sha256(file_path_or_bytes: str | bytes) -> str:
        """Compute SHA-256 hash of raw input data."""
        hasher = hashlib.sha256()
        if isinstance(file_path_or_bytes, bytes):
            hasher.update(file_path_or_bytes)
        else:
            with open(file_path_or_bytes, "rb") as f:
                for chunk in iter(lambda: f.read(65536), b""):
                    hasher.update(chunk)
        return hasher.hexdigest()

    @classmethod
    def load_data(
        cls,
        source: str | io.BytesIO | bytes,
        file_ext: Optional[str] = None,
        chunksize: Optional[int] = None,
    ) -> Tuple[pd.DataFrame, str]:
        """Load tabular data from CSV, Parquet, JSON, or Excel.
        
        Returns (DataFrame, sha256_hash).
        """
        raw_bytes = None
        ext = file_ext

        if isinstance(source, bytes):
            raw_bytes = source
            sha256_hash = hashlib.sha256(raw_bytes).hexdigest()
            stream = io.BytesIO(source)
        elif isinstance(source, io.BytesIO):
            raw_bytes = source.getvalue()
            sha256_hash = hashlib.sha256(raw_bytes).hexdigest()
            stream = source
        elif isinstance(source, str):
            if not os.path.exists(source):
                raise FileNotFoundError(f"File not found: {source}")
            ext = ext or os.path.splitext(source)[1].lower()
            sha256_hash = cls.compute_sha256(source)
            stream = source
        else:
            raise ValueError(f"Unsupported source type: {type(source)}")

        if not ext:
            raise ValueError("File extension must be specified when passing bytes/stream.")

        ext = ext.lower()
        if not ext.startswith("."):
            ext = "." + ext

        if ext not in cls.SUPPORTED_EXTENSIONS:
            raise ValueError(
                f"Unsupported file format '{ext}'. Must be one of {cls.SUPPORTED_EXTENSIONS}"
            )

        if ext == ".csv":
            df = pd.read_csv(stream, low_memory=False)
        elif ext == ".parquet":
            df = pd.read_parquet(stream)
        elif ext == ".json":
            df = pd.read_json(stream)
        elif ext == ".xlsx":
            df = pd.read_excel(stream)
        else:
            raise ValueError(f"Unhandled file extension: {ext}")

        return df, sha256_hash

    @staticmethod
    def detect_task_type(series: pd.Series) -> str:
        """Inspect target column cardinality and dtype:
        - continuous float/int with >20 unique values routes to 'regression'
        - 2 unique values routes to 'binary_classification'
        - 3-100 discrete classes routes to 'multi_class_classification'
        """
        clean_s = series.dropna()
        n_unique = clean_s.nunique()

        if n_unique <= 1:
            raise ValueError(f"Target column has only {n_unique} unique value. Training cannot proceed.")

        if n_unique == 2:
            return "binary_classification"

        if pd.api.types.is_float_dtype(clean_s):
            # Float with > 2 unique values
            if n_unique > 20:
                return "regression"
            # Floats with 3-20 unique values could be discrete if integer-like
            if (clean_s % 1 == 0).all() and n_unique <= 100:
                return "multi_class_classification"
            return "regression"

        if pd.api.types.is_integer_dtype(clean_s):
            if n_unique > 20:
                return "regression"
            elif 3 <= n_unique <= 100:
                return "multi_class_classification"

        # Categorical or string target
        if 3 <= n_unique <= 100:
            return "multi_class_classification"

        if n_unique > 100:
            if pd.api.types.is_numeric_dtype(clean_s):
                return "regression"
            raise ValueError(
                f"Target column has {n_unique} unique non-numeric values, exceeding 100 classes threshold."
            )

        return "multi_class_classification"

    @classmethod
    def filter_id_and_leakage_columns(
        cls, df: pd.DataFrame, target_col: str
    ) -> Tuple[pd.DataFrame, List[str]]:
        """FR-01.3: Automatically detect and drop monotonically increasing index columns,
        UUIDs, and columns with 100% unique string identifiers prior to training.
        """
        dropped_cols: List[str] = []
        n_rows = len(df)
        if n_rows == 0:
            return df, dropped_cols

        for col in df.columns:
            if col == target_col:
                continue

            s = df[col]
            clean_s = s.dropna()
            if len(clean_s) == 0:
                dropped_cols.append(col)
                continue

            # 1. Monotonically increasing index column check
            if pd.api.types.is_integer_dtype(s) or pd.api.types.is_float_dtype(s):
                # Check strictly monotonic increasing
                if clean_s.is_monotonic_increasing and clean_s.nunique() == len(clean_s):
                    # Check if it resembles index or sequential ID
                    if (clean_s.iloc[-1] - clean_s.iloc[0] + 1) == len(clean_s):
                        dropped_cols.append(col)
                        continue
                    elif clean_s.nunique() > 0.95 * n_rows and col.lower() in {"id", "index", "unnamed: 0", "idx", "row_id"}:
                        dropped_cols.append(col)
                        continue

            # 2. String checks (UUIDs & 100% unique strings)
            if s.dtype == object or pd.api.types.is_string_dtype(s):
                sample = clean_s.astype(str).head(50)
                # UUID check
                if sample.apply(lambda x: bool(UUID_REGEX.match(str(x)))).mean() > 0.8:
                    dropped_cols.append(col)
                    continue

                # 100% unique strings (often user_id, email, hash, name identifiers)
                if clean_s.nunique() == n_rows and n_rows >= 20:
                    dropped_cols.append(col)
                    continue

                # Check if column name suggests identifier and unique ratio > 98%
                if any(k in col.lower() for k in ["_id", "id", "guid", "token", "uuid"]) and (clean_s.nunique() / n_rows) > 0.95:
                    dropped_cols.append(col)
                    continue

        filtered_df = df.drop(columns=dropped_cols)
        return filtered_df, dropped_cols

    @classmethod
    def profile_schema(
        cls, df: pd.DataFrame, target_col: str, sha256_hash: str
    ) -> Dict[str, Any]:
        """Profiles the dataset schema, detects column types, missingness, and task type."""
        if target_col not in df.columns:
            raise KeyError(f"Target column '{target_col}' not found in dataset columns: {list(df.columns)}")

        task_type = cls.detect_task_type(df[target_col])
        filtered_df, dropped_id_cols = cls.filter_id_and_leakage_columns(df, target_col)

        row_count, col_count = df.shape
        missing_ratios = (df.isnull().sum() / row_count).to_dict()

        column_types: Dict[str, str] = {}
        for col in filtered_df.columns:
            if col == target_col:
                column_types[col] = f"target ({task_type})"
                continue

            s = filtered_df[col]
            # Try parsing datetime if string/object
            if s.dtype == object or pd.api.types.is_string_dtype(s):
                # Sample non-null values to test datetime parsing
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
                    column_types[col] = "datetime"
                    continue

            if pd.api.types.is_datetime64_any_dtype(s):
                column_types[col] = "datetime"
            elif pd.api.types.is_numeric_dtype(s):
                column_types[col] = "numeric"
            elif pd.api.types.is_bool_dtype(s):
                column_types[col] = "categorical"
            else:
                column_types[col] = "categorical"

        return {
            "dataset_fingerprint": {
                "sha256": sha256_hash,
                "row_count": row_count,
                "column_count": col_count,
                "missing_value_ratios": {k: round(float(v), 4) for k, v in missing_ratios.items()},
                "detected_task_type": task_type,
            },
            "dropped_id_columns": dropped_id_cols,
            "column_types": column_types,
            "filtered_columns": list(filtered_df.columns),
            "target_col": target_col,
        }
