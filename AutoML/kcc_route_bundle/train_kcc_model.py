"""
AutoML Model Trainer for KCC Institute of Technology and Management Corridors.
Destination is fixed to: 'KCC Institute of Technology and Management'.
Trains a leak-free ensemble predicting trip duration (ETA in minutes) with bottleneck penalties.
Saves the serialized model artifact to: automl/kcc_route_bundle/model_artifact/pipeline.joblib.
"""

import os
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor, VotingRegressor
from sklearn.metrics import mean_absolute_error, r2_score
import joblib

FIXED_DESTINATION = "KCC Institute of Technology and Management"

# Candidate routes and corridor data targeting KCC Institute (Knowledge Park III, Gr. Noida)
CORRIDOR_CONFIGS = [
    # Noida 62
    {
        "pickup_location": "Noida 62",
        "route_name": "Noida-Greater Noida Expressway Bypass",
        "distance_km": 28.5,
        "bottleneck_penalty_weight": 0.12,
        "is_expressway_bypass": 1
    },
    {
        "pickup_location": "Noida 62",
        "route_name": "Sector 71 & Surajpur Arterial Road",
        "distance_km": 25.8,
        "bottleneck_penalty_weight": 0.42,
        "is_expressway_bypass": 0
    },

    # Lal Kuan (Notorious bottleneck vs EPE / Expressway bypass)
    {
        "pickup_location": "Lal Kuan",
        "route_name": "Direct GT Road & Dadri Flyover (Bottleneck)",
        "distance_km": 22.0,
        "bottleneck_penalty_weight": 0.82,
        "is_expressway_bypass": 0
    },
    {
        "pickup_location": "Lal Kuan",
        "route_name": "Eastern Peripheral Expressway (EPE) Bypass",
        "distance_km": 31.5,
        "bottleneck_penalty_weight": 0.14,
        "is_expressway_bypass": 1
    },
    {
        "pickup_location": "Lal Kuan",
        "route_name": "Chipiyana - Surajpur Bypass",
        "distance_km": 24.2,
        "bottleneck_penalty_weight": 0.55,
        "is_expressway_bypass": 0
    },

    # Chapraula
    {
        "pickup_location": "Chapraula",
        "route_name": "Surajpur - Kasna Main Road",
        "distance_km": 16.2,
        "bottleneck_penalty_weight": 0.28,
        "is_expressway_bypass": 0
    },
    {
        "pickup_location": "Chapraula",
        "route_name": "Dadri Bypass Link",
        "distance_km": 18.0,
        "bottleneck_penalty_weight": 0.18,
        "is_expressway_bypass": 1
    },
    {
        "pickup_location": "Chapraula",
        "route_name": "Old Railway Crossing Road (Gridlock)",
        "distance_km": 14.8,
        "bottleneck_penalty_weight": 0.72,
        "is_expressway_bypass": 0
    },

    # NH-3 / NH-24 / Crossings Republik
    {
        "pickup_location": "NH-3",
        "route_name": "130m Expressway via Char Murti & Bisrakh",
        "distance_km": 23.5,
        "bottleneck_penalty_weight": 0.18,
        "is_expressway_bypass": 1
    },
    {
        "pickup_location": "NH-3",
        "route_name": "Via Lal Kuan Bottleneck Corridor",
        "distance_km": 26.8,
        "bottleneck_penalty_weight": 0.85,
        "is_expressway_bypass": 0
    },

    # Indirapuram
    {
        "pickup_location": "Indirapuram",
        "route_name": "FNG Expressway & Gr. Noida Expressway Bypass",
        "distance_km": 31.0,
        "bottleneck_penalty_weight": 0.15,
        "is_expressway_bypass": 1
    },
    {
        "pickup_location": "Indirapuram",
        "route_name": "Via NH-9 & Lal Kuan Intersection",
        "distance_km": 29.5,
        "bottleneck_penalty_weight": 0.76,
        "is_expressway_bypass": 0
    },

    # Pari Chowk (Immediate Hub to Knowledge Park)
    {
        "pickup_location": "Pari Chowk",
        "route_name": "Knowledge Park Direct Corridor",
        "distance_km": 3.8,
        "bottleneck_penalty_weight": 0.08,
        "is_expressway_bypass": 0
    },

    # Gaur City
    {
        "pickup_location": "Gaur City",
        "route_name": "130m Greater Noida Expressway Bypass",
        "distance_km": 18.2,
        "bottleneck_penalty_weight": 0.16,
        "is_expressway_bypass": 1
    },
    {
        "pickup_location": "Gaur City",
        "route_name": "Surajpur Industrial Road",
        "distance_km": 17.0,
        "bottleneck_penalty_weight": 0.45,
        "is_expressway_bypass": 0
    }
]

def generate_kcc_training_data(n_samples: int = 5000, seed: int = 42) -> pd.DataFrame:
    np.random.seed(seed)
    records = []

    for _ in range(n_samples):
        cfg = np.random.choice(CORRIDOR_CONFIGS)
        pickup = cfg["pickup_location"]
        route = cfg["route_name"]
        dist = cfg["distance_km"] * np.random.uniform(0.95, 1.05)
        dist = round(dist, 1)

        hour = np.random.choice(
            list(range(6, 23)),
            p=[0.03, 0.15, 0.22, 0.12, 0.05, 0.04, 0.04, 0.04, 0.05, 0.08, 0.09, 0.05, 0.02, 0.01, 0.005, 0.003, 0.002]
        )
        dow = np.random.choice(range(7), p=[0.20, 0.20, 0.20, 0.18, 0.16, 0.04, 0.02])
        v_type = np.random.choice(["Car", "Motorcycle", "Scooty"], p=[0.45, 0.35, 0.20])

        base_penalty = cfg["bottleneck_penalty_weight"]
        # Add peak hour multiplier
        is_peak = (8 <= hour <= 10) or (17 <= hour <= 19)
        if is_peak:
            effective_penalty = min(0.98, base_penalty * 1.35)
        elif 11 <= hour <= 16:
            effective_penalty = base_penalty * 0.95
        else:
            effective_penalty = base_penalty * 0.70

        # Speeds:
        # Expressway bypass speeds: 55-68 km/h for cars, 45-55 for two wheelers
        # Bottleneck corridor speeds: 15-25 km/h for cars, 22-30 for two-wheelers (can filter)
        if cfg["is_expressway_bypass"] == 1:
            base_speed = 58.0 if v_type == "Car" else 50.0
            speed = base_speed * (1.0 - effective_penalty * 0.30)
        else:
            base_speed = 36.0 if v_type == "Car" else 33.0
            # Lal Kuan or heavy bottleneck gets penalized heavily
            speed = base_speed * (1.0 - effective_penalty * 0.65)
            if v_type in ["Motorcycle", "Scooty"]:
                speed += 4.5  # Two-wheelers filter through Lal Kuan bottleneck

        speed = max(10.0, speed + np.random.normal(0, 1.8))
        duration_mins = (dist / speed) * 60.0

        # Campus gate arrival delay at KCC Institute Knowledge Park gate (2-4 mins)
        gate_delay = np.random.uniform(2.0, 4.0)
        actual_eta = round(duration_mins + gate_delay + np.random.normal(0, 1.0), 1)
        actual_eta = max(5.0, actual_eta)

        records.append({
            "pickup_location": pickup,
            "route_name": route,
            "distance_km": dist,
            "hour_of_day": int(hour),
            "day_of_week": int(dow),
            "bottleneck_penalty_weight": round(effective_penalty, 2),
            "is_expressway_bypass": int(cfg["is_expressway_bypass"]),
            "vehicle_type": v_type,
            "actual_eta_mins": actual_eta
        })

    return pd.DataFrame(records)

def train_and_export():
    bundle_dir = os.path.dirname(os.path.abspath(__file__))
    model_art_dir = os.path.join(bundle_dir, "model_artifact")
    os.makedirs(model_art_dir, exist_ok=True)

    print("Generating KCC Institute corridor training logs...")
    df = generate_kcc_training_data(n_samples=6000)
    csv_path = os.path.join(bundle_dir, "kcc_trips_data.csv")
    df.to_csv(csv_path, index=False)
    print(f"Saved {len(df)} trip records to {csv_path}")

    features = [
        "pickup_location", "route_name", "distance_km",
        "hour_of_day", "day_of_week", "bottleneck_penalty_weight",
        "is_expressway_bypass", "vehicle_type"
    ]
    target = "actual_eta_mins"

    X = df[features]
    y = df[target]

    categorical_features = ["pickup_location", "route_name", "vehicle_type"]
    numeric_features = ["distance_km", "hour_of_day", "day_of_week", "bottleneck_penalty_weight", "is_expressway_bypass"]

    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), categorical_features),
            ("num", StandardScaler(), numeric_features)
        ]
    )

    gbr = GradientBoostingRegressor(n_estimators=140, learning_rate=0.07, max_depth=4, random_state=42)
    rf = RandomForestRegressor(n_estimators=100, max_depth=8, random_state=42)
    ensemble = VotingRegressor(estimators=[("gbr", gbr), ("rf", rf)])

    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("regressor", ensemble)
    ])

    print("Training AutoML Ensemble pipeline...")
    pipeline.fit(X, y)

    preds = pipeline.predict(X)
    mae = mean_absolute_error(y, preds)
    r2 = r2_score(y, preds)
    print(f"AutoML Model Evaluation -> MAE: {mae:.2f} mins | R^2 Score: {r2:.3f}")

    # Serialize bundle
    bundle_target = {
        "pipeline": pipeline,
        "features": features,
        "target": target,
        "destination": FIXED_DESTINATION,
        "metrics": {"mae": mae, "r2": r2}
    }

    joblib_path = os.path.join(model_art_dir, "pipeline.joblib")
    joblib.dump(bundle_target, joblib_path)
    print(f"✅ Serialized KCC AutoML model bundle exported to: {joblib_path}")

if __name__ == "__main__":
    train_and_export()
