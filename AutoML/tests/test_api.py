import io
import time
import pytest
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from automl.api import app, JOBS_DB

@pytest.fixture
def client():
    return TestClient(app)

def test_api_train_and_predict_flow(client):
    # 1. Prepare sample dataset
    np.random.seed(42)
    n = 100
    feat1 = np.random.randn(n)
    feat2 = np.random.choice(["A", "B", "C"], size=n)
    target = (feat1 > 0).astype(int)
    df = pd.DataFrame({
        "feature1": feat1,
        "feature2": feat2,
        "target": target,
    })
    csv_bytes = df.to_csv(index=False).encode("utf-8")

    # 2. POST /api/v1/train
    response = client.post(
        "/api/v1/train",
        files={"file": ("dataset.csv", csv_bytes, "text/csv")},
        data={"target_col": "target", "time_budget": "30"},
    )
    assert response.status_code == 202
    data = response.json()
    job_id = data["job_id"]
    assert "status_url" in data

    # 3. Poll GET /api/v1/jobs/{id} until completed (background task runs)
    max_wait = 60
    start = time.time()
    status = "PENDING"
    job_data = {}
    while time.time() - start < max_wait:
        resp = client.get(f"/api/v1/jobs/{job_id}")
        assert resp.status_code == 200
        job_data = resp.json()
        status = job_data["status"]
        if status in ("COMPLETED", "FAILED"):
            break
        time.sleep(1)

    assert status == "COMPLETED", f"Job failed or timed out: {job_data.get('error')}"
    assert job_data["download_url"] is not None
    assert job_data["validation_metrics"] is not None

    # 4. GET /api/v1/jobs/{id}/bundle
    bundle_resp = client.get(f"/api/v1/jobs/{job_id}/bundle")
    assert bundle_resp.status_code == 200
    assert bundle_resp.headers["content-type"] == "application/zip"

    # 5. POST /api/v1/predict
    pred_payload = {
        "model_id": job_id,
        "records": [
            {"feature1": 0.5, "feature2": "A"},
            {"feature1": -1.2, "feature2": "B"},
        ],
    }
    pred_resp = client.post("/api/v1/predict", json=pred_payload)
    assert pred_resp.status_code == 200
    pred_data = pred_resp.json()
    assert len(pred_data["predictions"]) == 2
    assert pred_data["probabilities"] is not None
