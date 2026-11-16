"""
Autonomous AutoML Model Trainer for CampusRide.
Trains a leak-free scikit-learn ensemble pipeline predicting trip ETA (in minutes).
Saves the serialized model bundle to pipeline.joblib.
"""

import os
import json
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score
import joblib

def generate_synthetic_historical_trips(num_samples: int = 4000, seed: int = 42) -> pd.DataFrame:
    np.random.seed(seed)
    
    corridors = [
        ("North Campus Hostel Cluster", 4.2),
        ("South Extension Ring Road", 14.5),
        ("Dwarka Sector 10 Hub", 22.0),
        ("Rohini Sector 14 Metro", 11.8),
        ("Indirapuram Shipra Mall", 26.5),
        ("Noida Sector 62 IT Corridor", 24.0),
        ("Cyber City Phase 2", 28.5),
        ("Janakpuri West Metro", 17.2),
        ("Saket Community Center", 18.0),
        ("Kashmere Gate Interchange", 7.5),
        ("Karol Bagh Metro Gate 2", 9.0),
        ("Laxmi Nagar Vikas Marg", 12.5),
    ]
    
    gates = [
        "Main Campus Gate (Admin Block)",
        "North Engineering Gate",
        "South Science & Research Gate",
        "Hostel Complex Entry Gate"
    ]
    
    records = []
    for _ in range(num_samples):
        corr_idx = np.random.randint(0, len(corridors))
        origin_zone, base_dist = corridors[corr_idx]
        dest_gate = np.random.choice(gates)
        
        # slight variation in route distance (+/- 10%)
        distance_km = round(base_dist * np.random.uniform(0.92, 1.15), 1)
        
        # Campus commute peak distributions: 7-10 AM and 15-18 PM have highest student traffic
        hour = np.random.choice(
            list(range(6, 23)),
            p=[0.02, 0.14, 0.22, 0.12, 0.05, 0.04, 0.04, 0.04, 0.05, 0.08, 0.10, 0.05, 0.03, 0.01, 0.005, 0.003, 0.002]
        )
        day_of_week = np.random.choice(range(7), p=[0.2, 0.2, 0.2, 0.18, 0.16, 0.04, 0.02])
        vehicle_type = np.random.choice(["two_wheeler", "car"], p=[0.55, 0.45])
        
        # Speed calculations based on corridor, hour, and vehicle
        # Base speed in km/h: 30-40 km/h open road
        base_speed = 35.0
        
        # Peak congestion penalty
        if 8 <= hour <= 10 or 17 <= hour <= 19:
            congestion_factor = 0.52 if vehicle_type == "car" else 0.72 # two wheelers cut through traffic
        elif 11 <= hour <= 16:
            congestion_factor = 0.80 if vehicle_type == "car" else 0.88
        else:
            congestion_factor = 1.05
            
        # Weekend speed boost
        if day_of_week >= 5:
            congestion_factor *= 1.2
            
        effective_speed = max(10.0, base_speed * congestion_factor + np.random.normal(0, 2.5))
        
        # Base duration in minutes
        duration_mins = (distance_km / effective_speed) * 60.0
        
        # Add campus gate bottleneck (1-3 minutes waiting at gate)
        gate_delay = np.random.uniform(1.0, 3.5)
        total_eta = round(duration_mins + gate_delay + np.random.normal(0, 1.2), 1)
        total_eta = max(4.0, total_eta)
        
        records.append({
            "origin_zone": origin_zone,
            "destination_gate": dest_gate,
            "distance_km": distance_km,
            "hour_of_day": int(hour),
            "day_of_week": int(day_of_week),
            "vehicle_type": vehicle_type,
            "actual_eta_mins": total_eta
        })
        
    return pd.DataFrame(records)

def train_and_save_pipeline(output_dir: str = None):
    if output_dir is None:
        output_dir = os.path.dirname(os.path.abspath(__file__))
        
    df = generate_synthetic_historical_trips(num_samples=5000)
    
    # Save a sample training dataset for inspection
    csv_path = os.path.join(output_dir, "training_trips.csv")
    df.to_csv(csv_path, index=False)
    print(f"Generated {len(df)} historical campus trip records -> {csv_path}")
    
    features = ["origin_zone", "destination_gate", "distance_km", "hour_of_day", "day_of_week", "vehicle_type"]
    target = "actual_eta_mins"
    
    X = df[features]
    y = df[target]
    
    categorical_cols = ["origin_zone", "destination_gate", "vehicle_type"]
    numeric_cols = ["distance_km", "hour_of_day", "day_of_week"]
    
    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), categorical_cols),
            ("num", StandardScaler(), numeric_cols)
        ]
    )
    
    model = GradientBoostingRegressor(
        n_estimators=120,
        learning_rate=0.08,
        max_depth=4,
        random_state=42
    )
    
    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("regressor", model)
    ])
    
    # Fit pipeline
    pipeline.fit(X, y)
    
    preds = pipeline.predict(X)
    mae = mean_absolute_error(y, preds)
    r2 = r2_score(y, preds)
    print(f"Model Trained Successfully. In-sample MAE: {mae:.2f} mins | R^2 Score: {r2:.3f}")
    
    # Serialize pipeline
    bundle_path = os.path.join(output_dir, "pipeline.joblib")
    joblib.dump(pipeline, bundle_path)
    print(f"Serialized leak-free pipeline saved to: {bundle_path}")

if __name__ == "__main__":
    train_and_save_pipeline()
