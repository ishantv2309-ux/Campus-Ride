import os
import io
import uuid
import pytest
import pandas as pd
import numpy as np

from automl.ingestion import DataIngestionEngine

def test_multi_format_loading(tmp_path):
    df_orig = pd.DataFrame({
        "feature_a": [1.0, 2.0, 3.0, 4.0, 5.0],
        "feature_b": ["cat", "dog", "bird", "cat", "dog"],
        "target": [0, 1, 0, 1, 0],
    })

    # 1. CSV
    csv_file = tmp_path / "test.csv"
    df_orig.to_csv(csv_file, index=False)
    df_loaded, sha_csv = DataIngestionEngine.load_data(str(csv_file))
    assert len(df_loaded) == 5
    assert len(sha_csv) == 64

    # 2. Parquet
    parquet_file = tmp_path / "test.parquet"
    df_orig.to_parquet(parquet_file, index=False)
    df_loaded, sha_p = DataIngestionEngine.load_data(str(parquet_file))
    assert len(df_loaded) == 5

    # 3. JSON
    json_file = tmp_path / "test.json"
    df_orig.to_json(json_file)
    df_loaded, sha_j = DataIngestionEngine.load_data(str(json_file))
    assert len(df_loaded) == 5

    # 4. Excel
    xlsx_file = tmp_path / "test.xlsx"
    df_orig.to_excel(xlsx_file, index=False)
    df_loaded, sha_x = DataIngestionEngine.load_data(str(xlsx_file))
    assert len(df_loaded) == 5

def test_task_detection():
    # Binary classification (2 unique)
    s_binary = pd.Series([0, 1, 0, 1, 1, 0])
    assert DataIngestionEngine.detect_task_type(s_binary) == "binary_classification"

    # Multi-class classification (3 to 100 unique)
    s_multi = pd.Series(["red", "green", "blue", "yellow", "red"])
    assert DataIngestionEngine.detect_task_type(s_multi) == "multi_class_classification"

    # Regression (>20 continuous unique values)
    s_reg = pd.Series(np.linspace(10.0, 50.0, 30))
    assert DataIngestionEngine.detect_task_type(s_reg) == "regression"

def test_id_and_leakage_filtering():
    n = 100
    df = pd.DataFrame({
        "id": list(range(n)),                                  # Monotonic increasing sequential index
        "user_uuid": [str(uuid.uuid4()) for _ in range(n)],    # UUID string
        "unique_token": [f"token_{i}" for i in range(n)],       # 100% unique string
        "feature_num": np.random.randn(n),
        "target": np.random.randint(0, 2, n),
    })

    filtered_df, dropped_cols = DataIngestionEngine.filter_id_and_leakage_columns(df, target_col="target")
    assert "id" in dropped_cols
    assert "user_uuid" in dropped_cols
    assert "unique_token" in dropped_cols
    assert "feature_num" in filtered_df.columns
    assert "target" in filtered_df.columns
