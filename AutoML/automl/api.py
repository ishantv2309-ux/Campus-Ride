"""
FastAPI Server Implementing the Application Integration Contract (Section 6 & Page 5)
Endpoints:
- POST /api/v1/train: Multipart dataset upload + async background training
- GET /api/v1/jobs/{id}: Polling status, stage, validation metrics, download URL
- GET /api/v1/jobs/{id}/bundle: Download model_bundle.zip
- POST /api/v1/predict: model_id + JSON array of raw feature records -> predictions & probabilities
- WebSocket /api/v1/ws/{id}: Live WebSocket status stream
"""

from __future__ import annotations
import os
import asyncio
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import pandas as pd

from .orchestrator import AutonomousAutoMLOrchestrator
from .packaging import INFERENCE_PY_TEMPLATE

app = FastAPI(
    title="Autonomous AutoML Training Agent API",
    description="Production-grade API for automated ML training, self-correcting validation, and inference",
    version="1.0.0",
)

# In-memory storage for jobs, websockets, and cached loaded predictors
JOBS_DB: Dict[str, Dict[str, Any]] = {}
ACTIVE_WEBSOCKETS: Dict[str, List[WebSocket]] = {}
LOADED_PREDICTORS: Dict[str, Any] = {}

class PredictRequest(BaseModel):
    model_id: str
    records: List[Dict[str, Any]]

class PredictResponse(BaseModel):
    model_id: str
    predictions: List[Any]
    probabilities: Optional[List[List[float]]] = None
    warnings: List[str]

async def broadcast_status(job_id: str, stage: str, progress: float, message: str):
    data = {
        "job_id": job_id,
        "stage": stage,
        "progress": progress,
        "message": message,
    }
    if job_id in JOBS_DB:
        JOBS_DB[job_id]["current_stage"] = stage
        JOBS_DB[job_id]["progress"] = progress
        JOBS_DB[job_id]["logs"].append(message)

    if job_id in ACTIVE_WEBSOCKETS:
        for ws in list(ACTIVE_WEBSOCKETS[job_id]):
            try:
                await ws.send_json(data)
            except Exception:
                ACTIVE_WEBSOCKETS[job_id].remove(ws)

def run_training_job_sync(job_id: str, file_bytes: bytes, filename: str, target_col: str, time_budget: int):
    JOBS_DB[job_id]["status"] = "RUNNING"
    JOBS_DB[job_id]["current_stage"] = "Stage 1 - Ingestion & Schema Profiler"

    ext = os.path.splitext(filename)[1].lower() or ".csv"

    def progress_callback(stage: str, progress: float, message: str):
        JOBS_DB[job_id]["current_stage"] = stage
        JOBS_DB[job_id]["progress"] = progress
        JOBS_DB[job_id]["logs"].append(message)

    try:
        orchestrator = AutonomousAutoMLOrchestrator(
            output_base_dir="artifacts",
            progress_callback=progress_callback,
        )

        res = orchestrator.run_pipeline(
            dataset_source=file_bytes,
            target_col=target_col,
            file_ext=ext,
            compute_preset="fast_prototype",
            time_budget_secs=time_budget,
            bundle_version="v1.0.0",
        )

        JOBS_DB[job_id]["status"] = "COMPLETED"
        JOBS_DB[job_id]["current_stage"] = "Completed"
        JOBS_DB[job_id]["progress"] = 1.0
        JOBS_DB[job_id]["validation_metrics"] = res["validation_metrics"]
        JOBS_DB[job_id]["bundle_name"] = res["bundle_name"]
        JOBS_DB[job_id]["bundle_path"] = res["bundle_path"]
        JOBS_DB[job_id]["bundle_zip_path"] = res["bundle_zip_path"]
        JOBS_DB[job_id]["download_url"] = f"/api/v1/jobs/{job_id}/bundle"
        JOBS_DB[job_id]["leaderboard"] = res["leaderboard"]
        JOBS_DB[job_id]["guardrails"] = res["guardrails"]

    except Exception as e:
        JOBS_DB[job_id]["status"] = "FAILED"
        JOBS_DB[job_id]["current_stage"] = "Failed"
        JOBS_DB[job_id]["error"] = str(e)
        JOBS_DB[job_id]["logs"].append(f"FATAL ERROR: {str(e)}")

@app.post("/api/v1/train", status_code=202)
async def train_endpoint(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    target_col: str = Form(...),
    time_budget: int = Form(120),
):
    """Multipart dataset file + target_col + time_budget -> Async job_id."""
    import uuid
    job_id = f"job_{uuid.uuid4().hex[:8]}"
    file_bytes = await file.read()

    JOBS_DB[job_id] = {
        "job_id": job_id,
        "filename": file.filename,
        "target_col": target_col,
        "time_budget": time_budget,
        "status": "PENDING",
        "current_stage": "Queued",
        "progress": 0.0,
        "logs": ["Job queued."],
        "validation_metrics": None,
        "download_url": None,
    }

    background_tasks.add_task(
        run_training_job_sync,
        job_id=job_id,
        file_bytes=file_bytes,
        filename=file.filename,
        target_col=target_col,
        time_budget=time_budget,
    )

    return {
        "job_id": job_id,
        "status": "PENDING",
        "status_url": f"/api/v1/jobs/{job_id}",
        "websocket_url": f"/api/v1/ws/{job_id}",
        "message": "Model training initiated successfully.",
    }

@app.get("/api/v1/jobs/{id}")
async def get_job_status(id: str):
    """Poll current pipeline stage, validation metrics, and download URL."""
    if id not in JOBS_DB:
        raise HTTPException(status_code=404, detail=f"Job '{id}' not found.")
    job = JOBS_DB[id]
    return {
        "job_id": job["job_id"],
        "status": job["status"],
        "current_stage": job.get("current_stage"),
        "progress": job.get("progress", 0.0),
        "validation_metrics": job.get("validation_metrics"),
        "download_url": job.get("download_url"),
        "error": job.get("error"),
        "recent_logs": job.get("logs", [])[-10:],
    }

@app.get("/api/v1/jobs/{id}/bundle")
async def download_bundle(id: str):
    """Download packaged model_bundle.zip."""
    if id not in JOBS_DB:
        raise HTTPException(status_code=404, detail=f"Job '{id}' not found.")
    job = JOBS_DB[id]
    zip_path = job.get("bundle_zip_path")
    if not zip_path or not os.path.exists(zip_path):
        raise HTTPException(status_code=404, detail="Model bundle archive not ready or not found.")
    return FileResponse(zip_path, filename=os.path.basename(zip_path), media_type="application/zip")

@app.post("/api/v1/predict", response_model=PredictResponse)
async def predict_endpoint(req: PredictRequest):
    """model_id + JSON array of raw feature records -> predictions & probabilities."""
    model_id = req.model_id

    # Check if loaded or find bundle
    predictor = LOADED_PREDICTORS.get(model_id)
    if predictor is None:
        # Check jobs
        bundle_path = None
        if model_id in JOBS_DB and JOBS_DB[model_id].get("bundle_path"):
            bundle_path = JOBS_DB[model_id]["bundle_path"]
        else:
            # Check directory under artifacts/
            possible_path = os.path.join("artifacts", model_id)
            if os.path.exists(possible_path):
                bundle_path = possible_path

        if not bundle_path or not os.path.exists(bundle_path):
            raise HTTPException(status_code=404, detail=f"Model bundle '{model_id}' not found.")

        # Load Predictor dynamically from bundle's inference.py
        import importlib.util
        inf_py = os.path.join(bundle_path, "inference.py")
        spec = importlib.util.spec_from_file_location(f"bundle_{model_id}", inf_py)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        predictor = mod.Predictor.load(bundle_path)
        LOADED_PREDICTORS[model_id] = predictor

    df = pd.DataFrame(req.records)
    df_aligned, warnings = predictor.validate_and_align_input(df)
    preds = predictor.predict(df_aligned)

    probabilities = None
    if predictor.is_classification:
        try:
            proba_arr = predictor.predict_proba(df_aligned)
            probabilities = proba_arr.tolist()
        except Exception:
            probabilities = None

    # Cast preds to python native types
    pred_list = [p.item() if hasattr(p, "item") else p for p in preds]

    return PredictResponse(
        model_id=model_id,
        predictions=pred_list,
        probabilities=probabilities,
        warnings=warnings,
    )

@app.websocket("/api/v1/ws/{id}")
async def websocket_status_stream(websocket: WebSocket, id: str):
    await websocket.accept()
    if id not in ACTIVE_WEBSOCKETS:
        ACTIVE_WEBSOCKETS[id] = []
    ACTIVE_WEBSOCKETS[id].append(websocket)
    try:
        # Send current status immediately
        if id in JOBS_DB:
            job = JOBS_DB[id]
            await websocket.send_json({
                "job_id": id,
                "stage": job.get("current_stage"),
                "progress": job.get("progress", 0.0),
                "status": job.get("status"),
            })
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if id in ACTIVE_WEBSOCKETS and websocket in ACTIVE_WEBSOCKETS[id]:
            ACTIVE_WEBSOCKETS[id].remove(websocket)
