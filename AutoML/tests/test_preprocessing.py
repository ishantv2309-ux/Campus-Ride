import pytest
import pandas as pd
import numpy as np

from automl.preprocessing import LeakFreePreprocessor, partition_dataset

def test_train_test_isolation_and_preprocessing():
    np.random.seed(42)
    n = 100
    df = pd.DataFrame({
        "num_with_nulls": [None if i % 5 == 0 else float(i) for i in range(n)],
        "high_sparsity_col": [None if i > 10 else 1.0 for i in range(n)],  # ~90% nulls -> should drop
        "cat_col": ["alpha", "beta", "gamma", None] * 25,
        "dt_col": pd.date_range("2026-01-01", periods=n, freq="D").astype(str),
        "target": [0 if i < 90 else 1 for i in range(n)],  # Imbalanced: 10% minority
    })

    X_train, X_test, y_train, y_test, tr_idx, te_idx = partition_dataset(
        df, target_col="target", task_type="binary_classification", test_size=0.2
    )

    assert len(X_train) == 80
    assert len(X_test) == 20
    assert len(set(tr_idx).intersection(set(te_idx))) == 0

    preprocessor = LeakFreePreprocessor(sparsity_threshold=0.6, minority_threshold=0.15)
    preprocessor.fit(X_train, y_train, task_type="binary_classification")

    # High sparsity column dropped
    assert "high_sparsity_col" in preprocessor.dropped_high_sparsity_cols_

    # Imbalance detected
    assert preprocessor.imbalance_detected_ is True

    # Transform train and test
    X_train_trans = preprocessor.transform(X_train)
    X_test_trans = preprocessor.transform(X_test)

    # Check missing indicator and imputation
    assert "num_with_nulls_is_missing" in X_train_trans.columns
    assert X_train_trans["num_with_nulls"].isnull().sum() == 0
    assert X_test_trans["num_with_nulls"].isnull().sum() == 0

    # Check datetime decomposition features
    assert "dt_col_year" in X_train_trans.columns
    assert "dt_col_sin_month" in X_train_trans.columns
    assert "dt_col_is_weekend" in X_train_trans.columns

    # Check categorical missing token encoding
    assert "cat_col" in X_train_trans.columns
    assert X_train_trans["cat_col"].isnull().sum() == 0
    assert X_test_trans["cat_col"].isnull().sum() == 0
