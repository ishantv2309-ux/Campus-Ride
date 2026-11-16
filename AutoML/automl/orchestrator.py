"""
Modular Five-Stage State Machine Orchestrator
Coordinates Ingestion -> Preprocessing -> Multi-Model Training -> Guardrails -> Packaging.
Implements self-correcting feedback loops (leakage removal, autonomous traceback recovery).
"""

from __future__ import annotations
import os
import time
import uuid
import logging
from typing import Dict, Any, Optional, Callable
import pandas as pd
import numpy as np

from .ingestion import DataIngestionEngine
from .preprocessing import LeakFreePreprocessor, partition_dataset
from .trainer import AutoMLTrainer
from .guardrails import (
    GuardrailsManager,
    GuardrailViolation,
    TargetLeakageDetected,
)
from .packaging import ModelPackagingEngine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("AutoMLOrchestrator")

class PipelineStage:
    INGESTION = "Stage 1 - Ingestion & Schema Profiler"
    PREPROCESSING = "Stage 2 - Leak-Free Preprocessing"
    TRAINING = "Stage 3 - Multi-Model AutoML Training"
    GUARDRAILS = "Stage 4 - Validation Guardrails & Self-Correction"
    PACKAGING = "Stage 5 - Structured Packaging & Export"
    COMPLETED = "Completed"
    FAILED = "Failed"

class AutonomousAutoMLOrchestrator:
    """End-to-End Five-Stage Self-Correcting Orchestrator."""

    def __init__(
        self,
        output_base_dir: str = "artifacts",
        progress_callback: Optional[Callable[[str, float, str], None]] = None,
    ):
        self.output_base_dir = output_base_dir
        self.progress_callback = progress_callback
        os.makedirs(output_base_dir, exist_ok=True)

    def _notify(self, stage: str, progress: float, message: str):
        logger.info(f"[{stage}] ({progress*100:.0f}%) {message}")
        if self.progress_callback:
            try:
                self.progress_callback(stage, progress, message)
            except Exception:
                pass

    def run_pipeline(
        self,
        dataset_source: str | bytes,
        target_col: str,
        file_ext: Optional[str] = None,
        compute_preset: str = "fast_prototype",
        time_budget_secs: Optional[int] = None,
        bundle_version: str = "v1.0.0",
        max_leakage_retries: int = 2,
    ) -> Dict[str, Any]:
        """Executes full autonomous AutoML pipeline with self-correcting guardrails."""
        job_id = f"job_{uuid.uuid4().hex[:8]}"
        bundle_name = f"model_bundle_{bundle_version}_{job_id}"
        guardrail_reports = []
        recovery_attempts = []

        # ================= STAGE 1: INGESTION & PROFILING =================
        self._notify(PipelineStage.INGESTION, 0.10, "Parsing dataset and inferring schema...")
        df, sha256_hash = DataIngestionEngine.load_data(dataset_source, file_ext=file_ext)

        profile = DataIngestionEngine.profile_schema(df, target_col, sha256_hash)
        task_type = profile["dataset_fingerprint"]["detected_task_type"]
        dataset_fingerprint = profile["dataset_fingerprint"]
        dropped_ids = profile["dropped_id_columns"]

        self._notify(
            PipelineStage.INGESTION,
            0.20,
            f"Schema profiled: {df.shape[0]} rows, {df.shape[1]} cols. Task: {task_type}. Dropped ID/leakage columns: {dropped_ids}",
        )

        # Working copy after ID drop
        working_df = df.drop(columns=dropped_ids)
        current_features = [c for c in working_df.columns if c != target_col]

        # Self-correction loop for Gate 2 (Target Leakage)
        retraining_cycle = 0
        final_trainer_results = None
        final_preprocessor = None
        final_X_test = None
        final_y_test = None

        while retraining_cycle <= max_leakage_retries:
            retraining_cycle += 1

            # ================= STAGE 2: LEAK-FREE PREPROCESSING =================
            self._notify(
                PipelineStage.PREPROCESSING,
                0.30,
                f"Partitioning 80/20 train/holdout pool and fitting transformers (Cycle {retraining_cycle})...",
            )

            # Enforce Gate 3 recovery during preprocessing & training
            def _preprocess_and_train():
                X_train, X_test, y_train, y_test, train_idx, test_idx = partition_dataset(
                    working_df, target_col=target_col, task_type=task_type
                )

                preprocessor = LeakFreePreprocessor()
                preprocessor.fit(X_train, y_train, task_type=task_type)

                X_train_trans = preprocessor.transform(X_train)
                X_test_trans = preprocessor.transform(X_test)
                y_train_enc = preprocessor.encode_target(y_train)
                y_test_enc = preprocessor.encode_target(y_test)

                # ================= STAGE 3: MULTI-MODEL AUTOML TRAINING =================
                self._notify(
                    PipelineStage.TRAINING,
                    0.50,
                    f"Benchmarking 5 model architectures with K-Fold CV under '{compute_preset}' preset...",
                )

                trainer = AutoMLTrainer(
                    task_type=task_type,
                    compute_preset=compute_preset,
                    time_budget_secs=time_budget_secs,
                )

                trainer_res = trainer.train_and_evaluate(
                    X_train=X_train_trans,
                    y_train=y_train_enc,
                    X_test=X_test_trans,
                    y_test=y_test_enc,
                    class_weights=preprocessor.class_weights_,
                )

                trans_log = preprocessor.get_transformation_log(train_idx, test_idx)
                return preprocessor, trainer_res, trans_log, X_test, y_test, y_test_enc

            # Gate 3: Autonomous Traceback Recovery
            (
                (preprocessor, trainer_res, trans_log, X_test_raw, y_test_raw, y_test_enc),
                g3_logs,
            ) = GuardrailsManager.execute_gate3_recovery(_preprocess_and_train, max_retries=3)

            guardrail_reports.append({
                "gate": "Gate 3 - Autonomous Traceback Recovery",
                "passed": True,
                "recovery_attempts": len(g3_logs),
                "diagnostic": f"Stage 2 & 3 executed cleanly with {len(g3_logs)} recovery retries.",
            })

            # ================= STAGE 4: VALIDATION GUARDRAILS =================
            self._notify(PipelineStage.GUARDRAILS, 0.75, "Enforcing validation guardrails (Gates 1, 2, 4)...")

            # Gate 1: Naive Baseline Verification
            g1_report = GuardrailsManager.verify_gate1_baseline(
                task_type=task_type,
                ensemble_metrics=trainer_res["final_metrics"],
                baseline_metrics=trainer_res["baseline_metrics"],
            )
            guardrail_reports.append(g1_report)

            # Gate 2: Overfitting & Leakage Audit
            val_score = float(trainer_res["leaderboard"].iloc[0]["cv_mean_score"])
            if "classification" in task_type:
                holdout_score = float(trainer_res["final_metrics"]["accuracy"])
            else:
                holdout_score = float(trainer_res["final_metrics"]["r2"])

            has_leakage, leaking_feat, g2_report = GuardrailsManager.audit_gate2_overfitting_and_leakage(
                task_type=task_type,
                val_score=val_score,
                holdout_score=holdout_score,
                feature_importance=trainer_res["feature_importance"],
            )
            guardrail_reports.append(g2_report)

            if has_leakage and leaking_feat and retraining_cycle <= max_leakage_retries:
                self._notify(
                    PipelineStage.GUARDRAILS,
                    0.80,
                    f"TARGET LEAKAGE DETECTED on '{leaking_feat}'. Dropping leaking feature and auto-retraining...",
                )
                # Map transformed feature back to original column if needed
                orig_col = leaking_feat.split("_")[0] if leaking_feat.endswith(("_is_missing", "_year", "_month")) else leaking_feat
                if orig_col in working_df.columns:
                    working_df = working_df.drop(columns=[orig_col])
                elif leaking_feat in working_df.columns:
                    working_df = working_df.drop(columns=[leaking_feat])
                continue  # Retrain loop

            # Gate 4: Inference Sanity Checks
            # Construct temporary pipeline wrapper to test synthetic edge cases
            class _TempWrapper:
                def __init__(self, prep, ens):
                    self.prep = prep
                    self.ens = ens
                def predict(self, df):
                    return self.ens.predict(self.prep.transform(df))

            temp_pipeline = _TempWrapper(preprocessor, trainer_res["ensemble"])
            g4_report = GuardrailsManager.verify_gate4_inference_sanity(
                inference_pipeline=temp_pipeline,
                raw_schema=profile["column_types"],
                n_synthetic_rows=100,
            )
            guardrail_reports.append(g4_report)

            final_trainer_results = trainer_res
            final_preprocessor = preprocessor
            final_transformation_log = trans_log
            break

        # ================= STAGE 5: PACKAGING & EXPORT =================
        self._notify(PipelineStage.PACKAGING, 0.90, "Packaging production model bundle and generating audit trail...")

        bundle_path = ModelPackagingEngine.package_bundle(
            output_dir=self.output_base_dir,
            bundle_name=bundle_name,
            preprocessor=final_preprocessor,
            ensemble_model=final_trainer_results["ensemble"],
            task_type=task_type,
            target_col=target_col,
            raw_schema=profile["column_types"],
            dataset_fingerprint=dataset_fingerprint,
            transformation_log=final_transformation_log,
            validation_metrics=final_trainer_results["final_metrics"],
            leaderboard_df=final_trainer_results["leaderboard"],
            feature_importance=final_trainer_results["feature_importance"],
            guardrail_reports=guardrail_reports,
        )

        zip_path = os.path.join(self.output_base_dir, f"{bundle_name}.zip")

        self._notify(PipelineStage.COMPLETED, 1.0, f"Model bundle created successfully at {bundle_path}")

        return {
            "job_id": job_id,
            "status": "COMPLETED",
            "task_type": task_type,
            "target_col": target_col,
            "bundle_name": bundle_name,
            "bundle_path": bundle_path,
            "bundle_zip_path": zip_path,
            "validation_metrics": final_trainer_results["final_metrics"],
            "leaderboard": final_trainer_results["leaderboard"].to_dict(orient="records"),
            "guardrails": guardrail_reports,
            "feature_importance": final_trainer_results["feature_importance"],
            "dataset_fingerprint": dataset_fingerprint,
        }
