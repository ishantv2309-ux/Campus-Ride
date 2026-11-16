"""
Top-level interface for KCC Institute of Technology and Management AutoML Predictor.
Exposes get_kcc_route_predictor() to the CampusRide FastAPI backend.
"""

import os
from .kcc_route_bundle.inference import KCCRoutePredictor

_instance = None

def get_kcc_route_predictor():
    global _instance
    if _instance is None:
        model_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "kcc_route_bundle",
            "model_artifact",
            "pipeline.joblib"
        )
        _instance = KCCRoutePredictor(model_bundle_path=model_path)
    return _instance
