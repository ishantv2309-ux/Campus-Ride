"""
Standalone ModelPredictor for CampusRide AutoML Route & ETA Engine.
Provides deterministic input schema validation, missing/unseen field imputation,
and model inference for trip duration (ETA) and route match scoring.
"""

import os
import json
from typing import Dict, Any, Tuple
import pandas as pd
import joblib

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_PIPELINE_PATH = os.path.join(CURRENT_DIR, "pipeline.joblib")
DEFAULT_SCHEMA_PATH = os.path.join(CURRENT_DIR, "input_schema.json")

# Known default corridor distances (in km) to campus
CORRIDOR_DISTANCES = {
    "North Campus Hostel Cluster": 4.2,
    "South Extension Ring Road": 14.5,
    "Dwarka Sector 10 Hub": 22.0,
    "Rohini Sector 14 Metro": 11.8,
    "Indirapuram Shipra Mall": 26.5,
    "Noida Sector 62 IT Corridor": 24.0,
    "Cyber City Phase 2": 28.5,
    "Janakpuri West Metro": 17.2,
    "Saket Community Center": 18.0,
    "Kashmere Gate Interchange": 7.5,
    "Karol Bagh Metro Gate 2": 9.0,
    "Laxmi Nagar Vikas Marg": 12.5,
}

class ModelPredictor:
    def __init__(self, model_path: str = DEFAULT_PIPELINE_PATH, schema_path: str = DEFAULT_SCHEMA_PATH):
        self.model_path = model_path
        self.schema_path = schema_path
        self.schema = self._load_schema()
        self.model = self._load_model()

    def _load_schema(self) -> Dict[str, Any]:
        if os.path.exists(self.schema_path):
            try:
                with open(self.schema_path, "r") as f:
                    return json.load(f)
            except Exception:
                pass
        return {}

    def _load_model(self):
        if os.path.exists(self.model_path):
            try:
                return joblib.load(self.model_path)
            except Exception as e:
                print(f"[ModelPredictor] Warning: could not load model from {self.model_path}: {e}")
        return None

    def _impute_and_validate(self, raw_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        Fallback Safety Contract:
        Guarantees that unseen route zones or missing time/distance fields are
        imputed deterministically without throwing server errors.
        """
        origin_zone = str(raw_input.get("origin_zone", "")).strip()
        if not origin_zone:
            origin_zone = "North Campus Hostel Cluster"

        destination_gate = str(raw_input.get("destination_gate", "")).strip()
        if not destination_gate:
            destination_gate = "Main Campus Gate (Admin Block)"

        # Impute distance if missing or non-positive
        distance = raw_input.get("distance_km")
        if distance is None or float(distance) <= 0:
            distance = CORRIDOR_DISTANCES.get(origin_zone, 10.0)
        else:
            distance = float(distance)

        # Impute hour of day (0-23)
        hour = raw_input.get("hour_of_day")
        if hour is None or hour == "":
            hour = 8  # typical morning college arrival
        else:
            try:
                hour = int(hour) % 24
            except (ValueError, TypeError):
                hour = 8

        # Impute day of week (0-6)
        dow = raw_input.get("day_of_week")
        if dow is None or dow == "":
            dow = 0  # Monday default
        else:
            try:
                dow = int(dow) % 7
            except (ValueError, TypeError):
                dow = 0

        vehicle_type = str(raw_input.get("vehicle_type", "car")).lower().strip()
        if vehicle_type not in ["two_wheeler", "car"]:
            vehicle_type = "car"

        return {
            "origin_zone": origin_zone,
            "destination_gate": destination_gate,
            "distance_km": round(distance, 1),
            "hour_of_day": hour,
            "day_of_week": dow,
            "vehicle_type": vehicle_type,
        }

    def _compute_fallback_eta(self, clean_input: Dict[str, Any]) -> float:
        """Deterministic physics-informed backup calculation if model file is unavailable."""
        dist = clean_input["distance_km"]
        hour = clean_input["hour_of_day"]
        v_type = clean_input["vehicle_type"]

        base_speed = 32.0
        if 8 <= hour <= 10 or 17 <= hour <= 19:
            speed = 18.0 if v_type == "car" else 25.0
        elif 11 <= hour <= 16:
            speed = 26.0 if v_type == "car" else 30.0
        else:
            speed = 36.0

        eta = (dist / speed) * 60.0 + 2.5
        return round(max(5.0, eta), 1)

    def _calculate_route_match_score(
        self,
        predicted_eta: float,
        clean_input: Dict[str, Any],
        rider_origin: str = None,
        rider_dest: str = None,
        rider_pref_hour: int = None
    ) -> float:
        """
        Calculates dynamic Route Match Score (0 - 100%) between a ride route and commuter needs.
        Factors:
        - Zone alignment (100% if exact match, partial if adjacent/distance aligned)
        - Gate alignment
        - Time compatibility
        - Vehicle efficiency
        """
        score = 85.0

        if rider_origin:
            if clean_input["origin_zone"].lower() == rider_origin.lower():
                score += 10.0
            else:
                score -= 15.0

        if rider_dest:
            if clean_input["destination_gate"].lower() == rider_dest.lower():
                score += 5.0
            else:
                score -= 10.0

        if rider_pref_hour is not None:
            time_diff = abs(clean_input["hour_of_day"] - rider_pref_hour)
            score -= (time_diff * 4.0)

        # Bonus for two-wheeler during rush hour (filters through traffic)
        if (8 <= clean_input["hour_of_day"] <= 10) and clean_input["vehicle_type"] == "two_wheeler":
            score += 3.0

        # Cap between 10.0 and 99.0
        return round(max(10.0, min(99.0, score)), 1)

    def _determine_congestion_index(self, hour: int) -> str:
        if (8 <= hour <= 10) or (17 <= hour <= 19):
            return "Peak Rush Hour"
        elif (11 <= hour <= 16):
            return "Moderate"
        elif (7 <= hour < 8) or (19 < hour <= 21):
            return "High"
        else:
            return "Low"

    def predict(
        self,
        features: Dict[str, Any],
        rider_origin: str = None,
        rider_dest: str = None,
        rider_pref_hour: int = None
    ) -> Dict[str, Any]:
        """
        Full prediction pipeline.
        Returns:
            - predicted_eta_mins: predicted travel duration in minutes
            - route_match_score: 0-100 score indicating compatibility
            - corridor_congestion_index: Low / Moderate / High / Peak Rush Hour
            - sanitized_features: deterministic imputed inputs
            - inference_engine: 'AutoML GradientBoosting' or 'Deterministic Fallback'
        """
        clean_features = self._impute_and_validate(features)

        if self.model is not None:
            try:
                df = pd.DataFrame([clean_features])
                raw_pred = self.model.predict(df)[0]
                eta = round(max(3.0, float(raw_pred)), 1)
                engine = "AutoML GradientBoosting Ensemble"
            except Exception as ex:
                print(f"[ModelPredictor] Warning: inference error {ex}, using fallback.")
                eta = self._compute_fallback_eta(clean_features)
                engine = "Deterministic Fallback"
        else:
            eta = self._compute_fallback_eta(clean_features)
            engine = "Deterministic Fallback"

        match_score = self._calculate_route_match_score(
            predicted_eta=eta,
            clean_input=clean_features,
            rider_origin=rider_origin,
            rider_dest=rider_dest,
            rider_pref_hour=rider_pref_hour
        )

        congestion = self._determine_congestion_index(clean_features["hour_of_day"])

        return {
            "predicted_eta_mins": eta,
            "route_match_score": match_score,
            "corridor_congestion_index": congestion,
            "sanitized_features": clean_features,
            "inference_engine": engine
        }
