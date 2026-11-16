"""
CampusRide FastAPI Backend Application.
Implements the Strict Wiring Contract:
- Verified Student Auth (@college.edu.in)
- SQLite Database via SQLAlchemy
- Real-time Connected AutoML Route & ETA Predictor
- Seat Bookings with atomic state sync
- Continuous Learning Loop trip exporter
"""

import os
import csv
import io
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, status, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.orm import Session

from .database import engine, get_db, SessionLocal, Base
from .models import User, SavedRoute, Ride, Booking
from .auth import (
    validate_college_email,
    hash_password,
    verify_password,
    create_access_token,
    get_current_user
)
from .ml_bundle.inference import ModelPredictor, CORRIDOR_DISTANCES
from .supabase_client import (
    get_supabase_client,
    register_user_with_supabase,
    HARDCODED_COLLEGE_NAME
)

# Connect AutoML model located in AutoML/
try:
    from AutoML.kcc_predictor import get_kcc_route_predictor
except (ImportError, ModuleNotFoundError):
    import sys
    _automl_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "AutoML")
    if _automl_dir not in sys.path:
        sys.path.insert(0, _automl_dir)
    from kcc_predictor import get_kcc_route_predictor

from .hybrid_router import HybridRoutingEngine
hybrid_router = HybridRoutingEngine()

# Ensure database tables exist
Base.metadata.create_all(bind=engine)

# Initialize standalone AutoML Predictor
predictor = ModelPredictor()

def seed_demo_data():
    db = SessionLocal()
    try:
        user_count = db.query(User).count()
        if user_count == 0:
            print("[Startup] Database is empty. Seeding verified student accounts and active rides...")
            
            # Create Driver 1 (Aarav - Car)
            driver1 = User(
                full_name="Aarav Sharma",
                college_email="aarav.sharma@college.edu.in",
                password_hash=hash_password("Campus@2026"),
                role="driver",
                vehicle_type="Car",
                vehicle_brand="Honda City (UP-16-AX-8910)",
                student_id="2023-CS-042",
                phone="+91 98101 23456"
            )
            # Create Driver 2 (Priya - Two Wheeler)
            driver2 = User(
                full_name="Priya Patel",
                college_email="priya.patel@college.edu.in",
                password_hash=hash_password("Campus@2026"),
                role="driver",
                vehicle_type="Motorcycle",
                vehicle_brand="Royal Enfield Classic 350 (UP-14-BT-4421)",
                student_id="2024-ECE-018",
                phone="+91 98202 34567"
            )
            # Create Driver 3 (Kabir - Car)
            driver3 = User(
                full_name="Kabir Mehta",
                college_email="kabir.mehta@college.edu.in",
                password_hash=hash_password("Campus@2026"),
                role="driver",
                vehicle_type="Car",
                vehicle_brand="Maruti Suzuki Brezza (DL-3C-NY-1902)",
                student_id="2023-IT-077",
                phone="+91 98404 56789"
            )
            # Create Driver 4 (Ananya - Car)
            driver4 = User(
                full_name="Ananya Singh",
                college_email="ananya.singh@college.edu.in",
                password_hash=hash_password("Campus@2026"),
                role="driver",
                vehicle_type="Car",
                vehicle_brand="Hyundai i20 (UP-16-CP-7711)",
                student_id="2024-AI-031",
                phone="+91 98505 67890"
            )
            # Create Rider 1 (Rohan - Rider)
            rider1 = User(
                full_name="Rohan Verma",
                college_email="rohan.verma@college.edu.in",
                password_hash=hash_password("Campus@2026"),
                role="rider",
                vehicle_type="None / Rider Only",
                vehicle_brand=None,
                student_id="2024-MECH-099",
                phone="+91 98303 45678"
            )
            db.add_all([driver1, driver2, driver3, driver4, rider1])
            db.commit()
            db.refresh(driver1)
            db.refresh(driver2)
            db.refresh(driver3)
            db.refresh(driver4)
            db.refresh(rider1)

            # Saved routes for KCC Corridors
            saved1 = SavedRoute(
                user_id=driver1.id,
                route_label="Noida 62 Expressway Commute",
                origin_zone="Noida 62",
                campus_gate="KCC Institute of Technology and Management",
                preferred_time="08:30 AM"
            )
            saved2 = SavedRoute(
                user_id=rider1.id,
                route_label="NH-3 Crossings to KCC Campus",
                origin_zone="NH-3",
                campus_gate="KCC Institute of Technology and Management",
                preferred_time="08:15 AM"
            )
            saved3 = SavedRoute(
                user_id=driver2.id,
                route_label="Lal Kuan EPE Bypass Express",
                origin_zone="Lal Kuan",
                campus_gate="KCC Institute of Technology and Management",
                preferred_time="08:45 AM"
            )
            db.add_all([saved1, saved2, saved3])

            # Seed Real KCC Commuter Corridor Rides
            # 1. Noida 62 -> KCC Institute
            ride1 = Ride(
                driver_id=driver1.id,
                origin_zone="Noida 62",
                destination_gate="KCC Institute of Technology and Management",
                departure_time="08:30 AM",
                seats_total=4,
                seats_available=3,
                predicted_eta_mins=34.0,
                status="active",
                vehicle_type="car",
                distance_km=28.5,
                notes="White Honda City. Route: Noida 62 -> FNG -> Noida Expressway -> Pari Chowk -> KCC. Leaving sharp 8:30 AM from Metro Gate 2."
            )

            # 2. Lal Kuan -> KCC Institute (Rerouted around GT Road bottleneck)
            ride2 = Ride(
                driver_id=rider1.id,  # Rohan Verma
                origin_zone="Lal Kuan",
                destination_gate="KCC Institute of Technology and Management",
                departure_time="08:45 AM",
                seats_total=1,
                seats_available=1,
                predicted_eta_mins=49.5,
                status="active",
                vehicle_type="two_wheeler",
                distance_km=35.3,
                notes="Royal Enfield Classic 350. Taking EPE Bypass route around GT Road bottleneck. Fast door-to-gate commute, spare helmet ready."
            )

            # 3. NH-3 -> KCC Institute
            ride3 = Ride(
                driver_id=driver3.id,
                origin_zone="NH-3",
                destination_gate="KCC Institute of Technology and Management",
                departure_time="08:15 AM",
                seats_total=4,
                seats_available=3,
                predicted_eta_mins=31.2,
                status="active",
                vehicle_type="car",
                distance_km=24.2,
                notes="Maruti Brezza. Pickup near Crossings Republik roundabout. Direct via 130m Expressway."
            )

            # 4. Chapraula -> KCC Institute
            ride4 = Ride(
                driver_id=driver2.id,  # Priya Patel
                origin_zone="Chapraula",
                destination_gate="KCC Institute of Technology and Management",
                departure_time="09:00 AM",
                seats_total=3,
                seats_available=2,
                predicted_eta_mins=26.5,
                status="active",
                vehicle_type="car",
                distance_km=19.8,
                notes="Hyundai i20. Smooth bypass run to Knowledge Park II gate. AC on."
            )

            db.add_all([ride1, ride2, ride3, ride4])
            db.commit()
            print("[Startup] Seeded realistic KCC commuter corridor rides successfully!")
        else:
            # Re-align existing rides and drivers to unique names & calibrated telemetry
            d_aarav = db.query(User).filter(User.college_email == "aarav.sharma@college.edu.in").first()
            d_priya = db.query(User).filter(User.college_email == "priya.patel@college.edu.in").first()
            d_rohan = db.query(User).filter(User.college_email == "rohan.verma@college.edu.in").first()
            d_kabir = db.query(User).filter(User.college_email == "kabir.mehta@college.edu.in").first()

            # Ensure Kabir Mehta exists
            if not d_kabir:
                d_kabir = User(
                    full_name="Kabir Mehta",
                    college_email="kabir.mehta@college.edu.in",
                    password_hash=hash_password("Campus@2026"),
                    role="driver",
                    vehicle_type="Car",
                    vehicle_brand="Maruti Suzuki Brezza (DL-3C-NY-1902)",
                    student_id="2023-IT-077",
                    phone="+91 98404 56789"
                )
                db.add(d_kabir)
                db.commit()
                db.refresh(d_kabir)

            # Ensure Rohan Verma has vehicle info for Lal Kuan dispatch
            if d_rohan:
                d_rohan.role = "driver"
                d_rohan.vehicle_type = "Motorcycle"
                d_rohan.vehicle_brand = "Royal Enfield Classic 350 (UP-14-BT-4421)"
                db.commit()

            if d_aarav:
                d_aarav.vehicle_type = "Car"
                d_aarav.vehicle_brand = "Honda City (UP-16-AX-8910)"
            if d_priya:
                d_priya.vehicle_type = "Car"
                d_priya.vehicle_brand = "Hyundai i20 (UP-16-CP-7711)"
            db.commit()
            r_noida = db.query(Ride).filter(Ride.origin_zone == "Noida 62").first()
            if r_noida and d_aarav:
                r_noida.driver_id = d_aarav.id
                r_noida.predicted_eta_mins = 34.0
                r_noida.distance_km = 28.5

            r_lal_kuan = db.query(Ride).filter(Ride.origin_zone == "Lal Kuan").first()
            if r_lal_kuan and d_rohan:
                r_lal_kuan.driver_id = d_rohan.id
                r_lal_kuan.predicted_eta_mins = 49.5
                r_lal_kuan.distance_km = 35.3
                r_lal_kuan.vehicle_type = "two_wheeler"
                r_lal_kuan.notes = "Royal Enfield Classic 350. Taking EPE Bypass route around GT Road bottleneck. Fast door-to-gate commute, spare helmet ready."

            r_nh3 = db.query(Ride).filter(Ride.origin_zone == "NH-3").first()
            if r_nh3 and d_kabir:
                r_nh3.driver_id = d_kabir.id
                r_nh3.predicted_eta_mins = 31.2
                r_nh3.distance_km = 24.2

            r_chapraula = db.query(Ride).filter(Ride.origin_zone == "Chapraula").first()
            if r_chapraula and d_priya:
                r_chapraula.driver_id = d_priya.id
                r_chapraula.predicted_eta_mins = 26.5
                r_chapraula.distance_km = 19.8
                r_chapraula.vehicle_type = "car"

            db.commit()
            print("[Startup] Re-aligned database rides to unique drivers and calibrated telemetry!")
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_demo_data()
    yield

app = FastAPI(
    title="CampusRide API",
    description="Verified Student Carpooling & Connected AutoML Route Engine",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend integration (Render live domain & local dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins including your Render domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# ==================== SCHEMAS ====================

class SignUpRequest(BaseModel):
    full_name: str = Field(..., min_length=2)
    college_name: str = Field(default=HARDCODED_COLLEGE_NAME)
    college_email: str
    password: str = Field(..., min_length=6)
    vehicle_type: str = Field(default="None / Rider Only")  # "Car", "Motorcycle", "Scooty", "None / Rider Only"
    vehicle_brand: Optional[str] = None

class SignUpResponse(BaseModel):
    status: str
    message: str
    user: Dict[str, Any]
    session: Optional[Dict[str, Any]] = None

class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2)
    college_name: Optional[str] = HARDCODED_COLLEGE_NAME
    college_email: str
    password: str = Field(..., min_length=6)
    role: str = Field(default="rider")  # rider, driver, both
    vehicle_type: Optional[str] = "None / Rider Only"
    vehicle_brand: Optional[str] = None
    student_id: Optional[str] = "2024-CS-101"
    phone: Optional[str] = "+91 98765 43210"

class LoginRequest(BaseModel):
    college_email: str
    password: str

class UserResponse(BaseModel):
    id: int
    full_name: str
    college_email: str
    role: str
    vehicle_type: Optional[str]
    vehicle_brand: Optional[str] = None
    student_id: Optional[str]
    phone: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class SavedRouteCreate(BaseModel):
    route_label: str
    origin_zone: str
    campus_gate: str
    preferred_time: str

class SavedRouteResponse(BaseModel):
    id: int
    user_id: int
    route_label: str
    origin_zone: str
    campus_gate: str
    preferred_time: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class PredictRouteRequest(BaseModel):
    pickup_location: str = Field(..., description="Starting pickup point (e.g. Noida 62, Chapraula, NH-3, Lal Kuan)")
    ride_time: Optional[str] = Field(default=None, description="Departure time (e.g. 08:30 AM or ISO format)")
    vehicle_type: Optional[str] = Field(default="Car", description="Car, Motorcycle, Scooty")

class PredictETARequest(BaseModel):
    origin_zone: str
    destination_gate: str
    distance_km: Optional[float] = None
    hour_of_day: Optional[int] = None
    day_of_week: Optional[int] = None
    vehicle_type: Optional[str] = "car"
    preferred_hour: Optional[int] = None

class RideCreateRequest(BaseModel):
    origin_zone: str
    destination_gate: str
    departure_time: str
    seats_total: int = Field(..., ge=1, le=8)
    vehicle_type: str = "car"
    notes: Optional[str] = None
    distance_km: Optional[float] = None

class BookingCreateRequest(BaseModel):
    ride_id: int

# ==================== AUTH & SUPABASE ROUTES ====================

@app.post("/api/signup", response_model=SignUpResponse, status_code=status.HTTP_200_OK)
def signup(req: SignUpRequest, db: Session = Depends(get_db)):
    """
    Direct Supabase Authentication & Profile Setup Endpoint.
    Exact Schema Handled:
    1. Full Name (Text)
    2. College Name (Hardcoded/Preset to: "KCC Institute of Technology and Management")
    3. College Email (Email string used for Supabase Auth verification)
    4. Password (Securely handled via Supabase Auth)
    5. Vehicle Type ("Car", "Motorcycle", "Scooty", "None / Rider Only")
    6. Vehicle Brand (Text string, e.g., Honda, Yamaha, Hyundai)
    """
    # 1. Enforce Domain Restriction
    validated_email = validate_college_email(req.college_email)

    # 2. Preset / Hardcode College Name
    college_name = HARDCODED_COLLEGE_NAME

    # 3. Clean Vehicle details
    v_type = req.vehicle_type or "None / Rider Only"
    v_brand = req.vehicle_brand.strip() if (req.vehicle_brand and v_type != "None / Rider Only") else None

    supabase_client = get_supabase_client()
    supabase_data = None

    if supabase_client:
        try:
            # Register with Supabase Auth & insert into public.profiles
            supabase_data = register_user_with_supabase(
                full_name=req.full_name.strip(),
                college_email=validated_email,
                password=req.password,
                vehicle_type=v_type,
                vehicle_brand=v_brand
            )
        except ValueError as ve:
            # Auth or validation error
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(ve)
            )
        except RuntimeError as re:
            # Database insertion error in public.profiles
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(re)
            )
        except Exception as ex:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Supabase operation failed: {str(ex)}"
            )

    # 4. Also synchronize with local relational database for offline/local continuity
    existing_user = db.query(User).filter(User.college_email == validated_email).first()
    if not existing_user:
        hashed_pwd = hash_password(req.password)
        new_user = User(
            full_name=req.full_name.strip(),
            college_email=validated_email,
            password_hash=hashed_pwd,
            role="rider" if v_type == "None / Rider Only" else "driver",
            vehicle_type=v_type,
            vehicle_brand=v_brand,
            student_id="KCC-2026",
            phone="+91 98765 43210"
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        local_user_id = new_user.id
    else:
        local_user_id = existing_user.id

    user_payload = {
        "id": supabase_data["user_id"] if supabase_data else str(local_user_id),
        "full_name": req.full_name.strip(),
        "college_name": college_name,
        "college_email": validated_email,
        "vehicle_type": v_type,
        "vehicle_brand": v_brand
    }

    session_payload = supabase_data.get("session") if supabase_data else {
        "access_token": create_access_token({"sub": str(local_user_id)}),
        "token_type": "bearer"
    }

    return {
        "status": "success",
        "message": f"Successfully registered {req.full_name.strip()} at {college_name}.",
        "user": user_payload,
        "session": session_payload
    }

@app.post("/api/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    # 1. Enforce FR-AUTH.1: Domain Restriction
    validated_email = validate_college_email(req.college_email)

    # 2. Check uniqueness
    existing_user = db.query(User).filter(User.college_email == validated_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A student account with this college email already exists."
        )

    # 3. If Supabase is configured, also register with Supabase
    supabase_client = get_supabase_client()
    if supabase_client:
        try:
            register_user_with_supabase(
                full_name=req.full_name.strip(),
                college_email=validated_email,
                password=req.password,
                vehicle_type=req.vehicle_type or "None / Rider Only",
                vehicle_brand=req.vehicle_brand
            )
        except ValueError as ve:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
        except RuntimeError as re:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(re))
        except Exception:
            pass  # continue with local persistence if network issue

    # 4. Hash password via bcrypt for local persistence
    hashed_pwd = hash_password(req.password)

    new_user = User(
        full_name=req.full_name.strip(),
        college_email=validated_email,
        password_hash=hashed_pwd,
        role=req.role,
        vehicle_type=req.vehicle_type,
        vehicle_brand=req.vehicle_brand,
        student_id=req.student_id,
        phone=req.phone
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token({"sub": str(new_user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": new_user
    }

@app.post("/api/auth/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    validated_email = req.college_email.strip().lower()
    user = db.query(User).filter(User.college_email == validated_email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid college email or password."
        )

    token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }

@app.get("/api/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# ==================== METADATA & PREDICTION ====================

@app.get("/api/meta/locations")
def get_locations():
    return {
        "corridors": [
            {"zone": "Noida 62", "default_dist_km": 28.5},
            {"zone": "NH-3", "default_dist_km": 24.2},
            {"zone": "Chapraula", "default_dist_km": 19.8},
            {"zone": "Lal Kuan", "default_dist_km": 25.8},
            {"zone": "Sector 71 Noida", "default_dist_km": 24.0},
            {"zone": "Char Murti / Gaur City", "default_dist_km": 18.5},
            {"zone": "Indirapuram", "default_dist_km": 30.2},
            {"zone": "Pari Chowk", "default_dist_km": 4.5},
            {"zone": "Rohini Sector 14 Metro", "default_dist_km": 11.8},
            {"zone": "Dwarka Sector 10 Hub", "default_dist_km": 22.0},
        ],
        "campus_gates": [
            "KCC Institute of Technology and Management",
            "Main Campus Gate (Admin Block)",
            "North Engineering Gate",
            "South Science & Research Gate",
            "Hostel Complex Entry Gate"
        ],
        "vehicle_types": [
            {"id": "two_wheeler", "label": "Two-Wheeler (Motorcycle / Scooty)", "icon": "Bike"},
            {"id": "car", "label": "Car (Sedan / Hatchback / SUV)", "icon": "Car"}
        ]
    }

@app.post("/api/predict/eta")
def predict_eta(req: PredictETARequest):
    """
    Connected AutoML Route & ETA Engine.
    Executes live inference through the trained serialized scikit-learn bundle.
    """
    now = datetime.now()
    hour = req.hour_of_day if req.hour_of_day is not None else now.hour
    dow = req.day_of_week if req.day_of_week is not None else now.weekday()
    dist = req.distance_km if req.distance_km is not None else CORRIDOR_DISTANCES.get(req.origin_zone, 10.0)

    prediction = predictor.predict(
        features={
            "origin_zone": req.origin_zone,
            "destination_gate": req.destination_gate,
            "distance_km": dist,
            "hour_of_day": hour,
            "day_of_week": dow,
            "vehicle_type": req.vehicle_type
        },
        rider_origin=req.origin_zone,
        rider_dest=req.destination_gate,
        rider_pref_hour=req.preferred_hour or hour
    )
    return prediction

@app.post("/api/predict-route")
def predict_route(req: PredictRouteRequest):
    """
    Hybrid Routing Engine combining Graph-Based Pathfinding (Dijkstra)
    with Protected Black-Box AutoML Inference from automl/.
    - Destination is fixed: 'KCC Institute of Technology and Management'
    - Starting pickup points vary dynamically (e.g., 'Noida 62', 'Chapraula', 'NH-3', 'Lal Kuan')
    - Treats all files inside automl/ as strictly read-only black-box artifacts.
    - Pathfinding computes shortest physical path and dynamically reroutes around bottlenecks.
    - Returns exact sequence of nodes, total distance, calculated shortest physical path,
      AutoML-adjusted ETA, and confidence score.
    """
    if not req.pickup_location or not req.pickup_location.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="pickup_location is required (e.g., 'Noida 62', 'Chapraula', 'NH-3', 'Lal Kuan')."
        )

    try:
        return hybrid_router.predict_hybrid_route(
            pickup_location=req.pickup_location.strip(),
            ride_time=req.ride_time,
            vehicle_type=req.vehicle_type or "Car"
        )
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Hybrid routing failed: {str(ex)}"
        )

# ==================== SAVED ROUTES ====================

@app.get("/api/routes/saved", response_model=List[SavedRouteResponse])
def get_saved_routes(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(SavedRoute).filter(SavedRoute.user_id == current_user.id).all()

@app.post("/api/routes/saved", response_model=SavedRouteResponse, status_code=status.HTTP_201_CREATED)
def create_saved_route(
    req: SavedRouteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    saved_route = SavedRoute(
        user_id=current_user.id,
        route_label=req.route_label.strip(),
        origin_zone=req.origin_zone.strip(),
        campus_gate=req.campus_gate.strip(),
        preferred_time=req.preferred_time.strip()
    )
    db.add(saved_route)
    db.commit()
    db.refresh(saved_route)
    return saved_route

@app.delete("/api/routes/saved/{route_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_route(
    route_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    route = db.query(SavedRoute).filter(
        SavedRoute.id == route_id,
        SavedRoute.user_id == current_user.id
    ).first()
    if not route:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved route not found.")
    db.delete(route)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

# ==================== RIDES ====================

@app.post("/api/rides", status_code=status.HTTP_201_CREATED)
def post_ride(
    req: RideCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    distance_km = req.distance_km or CORRIDOR_DISTANCES.get(req.origin_zone, 12.0)

    now = datetime.now()
    dep_hour = now.hour
    try:
        time_part = req.departure_time.split()[0]
        dep_hour = int(time_part.split(":")[0])
        if "PM" in req.departure_time.upper() and dep_hour < 12:
            dep_hour += 12
    except Exception:
        dep_hour = now.hour

    # Live AutoML Inference for ETA
    ml_output = predictor.predict(
        features={
            "origin_zone": req.origin_zone,
            "destination_gate": req.destination_gate,
            "distance_km": distance_km,
            "hour_of_day": dep_hour,
            "day_of_week": now.weekday(),
            "vehicle_type": req.vehicle_type or current_user.vehicle_type or "car"
        }
    )

    new_ride = Ride(
        driver_id=current_user.id,
        origin_zone=req.origin_zone,
        destination_gate=req.destination_gate,
        departure_time=req.departure_time,
        seats_total=req.seats_total,
        seats_available=req.seats_total,
        predicted_eta_mins=ml_output["predicted_eta_mins"],
        status="active",
        vehicle_type=req.vehicle_type or current_user.vehicle_type or "car",
        distance_km=distance_km,
        notes=req.notes
    )
    db.add(new_ride)
    db.commit()
    db.refresh(new_ride)

    return {
        "ride": {
            "id": new_ride.id,
            "driver_id": new_ride.driver_id,
            "origin_zone": new_ride.origin_zone,
            "destination_gate": new_ride.destination_gate,
            "departure_time": new_ride.departure_time,
            "seats_total": new_ride.seats_total,
            "seats_available": new_ride.seats_available,
            "predicted_eta_mins": new_ride.predicted_eta_mins,
            "status": new_ride.status,
            "vehicle_type": new_ride.vehicle_type,
            "distance_km": new_ride.distance_km,
            "notes": new_ride.notes,
            "created_at": new_ride.created_at
        },
        "ml_inference": ml_output
    }

@app.get("/api/rides")
def search_rides(
    origin_zone: Optional[str] = Query(None),
    destination_gate: Optional[str] = Query(None),
    vehicle_type: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Ride).filter(Ride.status == "active", Ride.seats_available > 0)

    if origin_zone:
        query = query.filter(Ride.origin_zone == origin_zone)
    if destination_gate:
        query = query.filter(Ride.destination_gate == destination_gate)
    if vehicle_type:
        query = query.filter(Ride.vehicle_type == vehicle_type)

    rides = query.order_by(Ride.created_at.desc()).all()

    # Enrich each ride with Driver profile and dynamic AutoML Route Match Score
    results = []
    now = datetime.now()
    for r in rides:
        driver = r.driver
        match_pred = predictor.predict(
            features={
                "origin_zone": r.origin_zone,
                "destination_gate": r.destination_gate,
                "distance_km": r.distance_km,
                "hour_of_day": now.hour,
                "day_of_week": now.weekday(),
                "vehicle_type": r.vehicle_type
            },
            rider_origin=origin_zone,
            rider_dest=destination_gate,
            rider_pref_hour=now.hour
        )

        results.append({
            "id": r.id,
            "driver": {
                "id": driver.id,
                "full_name": driver.full_name,
                "college_email": driver.college_email,
                "student_id": driver.student_id,
                "phone": driver.phone,
                "vehicle_type": driver.vehicle_type
            },
            "origin_zone": r.origin_zone,
            "destination_gate": r.destination_gate,
            "departure_time": r.departure_time,
            "seats_total": r.seats_total,
            "seats_available": r.seats_available,
            "predicted_eta_mins": r.predicted_eta_mins,
            "status": r.status,
            "vehicle_type": r.vehicle_type,
            "distance_km": r.distance_km,
            "notes": r.notes,
            "created_at": r.created_at,
            "route_match_score": match_pred["route_match_score"],
            "corridor_congestion_index": match_pred["corridor_congestion_index"],
            "inference_engine": match_pred["inference_engine"]
        })

    results.sort(key=lambda x: x["route_match_score"], reverse=True)
    return results

@app.get("/api/rides/my-posted")
def get_my_posted_rides(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rides = db.query(Ride).filter(Ride.driver_id == current_user.id).order_by(Ride.created_at.desc()).all()
    out = []
    for r in rides:
        bookings = db.query(Booking).filter(Booking.ride_id == r.id).all()
        booking_list = []
        for b in bookings:
            rider = b.rider
            booking_list.append({
                "booking_id": b.id,
                "status": b.booking_status,
                "rider_name": rider.full_name,
                "rider_email": rider.college_email,
                "rider_phone": rider.phone,
                "created_at": b.created_at
            })
        out.append({
            "id": r.id,
            "origin_zone": r.origin_zone,
            "destination_gate": r.destination_gate,
            "departure_time": r.departure_time,
            "seats_total": r.seats_total,
            "seats_available": r.seats_available,
            "predicted_eta_mins": r.predicted_eta_mins,
            "status": r.status,
            "vehicle_type": r.vehicle_type,
            "distance_km": r.distance_km,
            "notes": r.notes,
            "created_at": r.created_at,
            "passenger_bookings": booking_list
        })
    return out

@app.post("/api/rides/{ride_id}/complete")
def complete_ride(
    ride_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ride = db.query(Ride).filter(Ride.id == ride_id, Ride.driver_id == current_user.id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found or unauthorized.")
    ride.status = "completed"
    db.commit()
    return {"message": "Ride marked as completed.", "status": "completed"}

# ==================== BOOKINGS & STATE SYNC ====================

@app.post("/api/bookings", status_code=status.HTTP_201_CREATED)
def book_seat(
    req: BookingCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Enforces Step 4: Booking & State Sync Contract.
    Books a seat as a rider and automatically decrements driver's available seat count in real time.
    """
    ride = db.query(Ride).filter(Ride.id == req.ride_id).with_for_update().first()
    if not ride:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ride not found.")

    if ride.status != "active":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Ride is {ride.status}.")

    if ride.driver_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot book a seat on your own posted ride.")

    existing = db.query(Booking).filter(
        Booking.ride_id == ride.id,
        Booking.rider_id == current_user.id,
        Booking.booking_status == "confirmed"
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You already have an active seat booking on this ride.")

    if ride.seats_available <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No seats remaining on this ride.")

    ride.seats_available -= 1

    booking = Booking(
        ride_id=ride.id,
        rider_id=current_user.id,
        booking_status="confirmed"
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    db.refresh(ride)

    return {
        "message": "Seat successfully confirmed!",
        "booking_id": booking.id,
        "booking_status": booking.booking_status,
        "ride_id": ride.id,
        "driver_name": ride.driver.full_name,
        "driver_phone": ride.driver.phone,
        "seats_remaining": ride.seats_available,
        "origin_zone": ride.origin_zone,
        "destination_gate": ride.destination_gate,
        "departure_time": ride.departure_time,
        "predicted_eta_mins": ride.predicted_eta_mins
    }

@app.get("/api/bookings/my-bookings")
def get_my_bookings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    bookings = db.query(Booking).filter(Booking.rider_id == current_user.id).order_by(Booking.created_at.desc()).all()
    results = []
    for b in bookings:
        ride = b.ride
        results.append({
            "booking_id": b.id,
            "booking_status": b.booking_status,
            "created_at": b.created_at,
            "ride": {
                "id": ride.id,
                "origin_zone": ride.origin_zone,
                "destination_gate": ride.destination_gate,
                "departure_time": ride.departure_time,
                "seats_total": ride.seats_total,
                "seats_available": ride.seats_available,
                "predicted_eta_mins": ride.predicted_eta_mins,
                "vehicle_type": ride.vehicle_type,
                "status": ride.status,
                "driver": {
                    "full_name": ride.driver.full_name,
                    "college_email": ride.driver.college_email,
                    "phone": ride.driver.phone,
                    "student_id": ride.driver.student_id
                }
            }
        })
    return results

@app.post("/api/bookings/{booking_id}/cancel")
def cancel_booking(
    booking_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    booking = db.query(Booking).filter(Booking.id == booking_id, Booking.rider_id == current_user.id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    if booking.booking_status == "cancelled":
        return {"message": "Booking is already cancelled."}

    booking.booking_status = "cancelled"
    ride = booking.ride
    if ride and ride.seats_available < ride.seats_total:
        ride.seats_available += 1

    db.commit()
    return {"message": "Booking cancelled and seat returned.", "seats_available": ride.seats_available}

# ==================== CONTINUOUS LEARNING & EXPORT ====================

@app.get("/api/admin/export-trips")
def export_historical_trips(db: Session = Depends(get_db)):
    """
    Enforces FR-DB & FR-ML Continuous Learning Loop:
    Exports completed and active ride trips as CSV for AutoML model retraining.
    """
    rides = db.query(Ride).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ride_id", "driver_id", "origin_zone", "destination_gate",
        "distance_km", "hour_of_day", "day_of_week", "vehicle_type",
        "seats_total", "seats_booked", "predicted_eta_mins", "status", "created_at"
    ])

    for r in rides:
        booked = r.seats_total - r.seats_available
        created = r.created_at or datetime.now()
        writer.writerow([
            r.id, r.driver_id, r.origin_zone, r.destination_gate,
            r.distance_km, created.hour, created.weekday(), r.vehicle_type,
            r.seats_total, booked, r.predicted_eta_mins, r.status, created.isoformat()
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=campus_trips_export.csv"}
    )

@app.get("/api/health", tags=["System"])
def health_check():
    """System health check endpoint for monitoring & deployment validation."""
    return {"status": "healthy", "service": "CampusRide API"}

# ==================== STATIC FRONTEND SERVING & SPA ROUTING ====================
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIST = os.path.join(BASE_DIR, "frontend", "dist")
if not os.path.exists(FRONTEND_DIST):
    alt_dist = os.path.join(BASE_DIR, "dist")
    if os.path.exists(alt_dist):
        FRONTEND_DIST = alt_dist

# Mount compiled static assets folder if available
assets_dir = os.path.join(FRONTEND_DIST, "assets")
if os.path.exists(assets_dir):
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

def _get_index_html():
    """Locate index.html from available dist folders."""
    for dist_dir in [FRONTEND_DIST, os.path.join(BASE_DIR, "frontend", "dist"), os.path.join(BASE_DIR, "dist")]:
        candidate = os.path.join(dist_dir, "index.html")
        if os.path.isfile(candidate):
            return candidate
    return None

@app.get("/", tags=["Frontend"])
def serve_root():
    """Serves the compiled SPA frontend at the root URL."""
    index_file = _get_index_html()
    if index_file:
        return FileResponse(index_file)
    return {
        "message": "CampusRide API is running.",
        "status": "online",
        "detail": "Frontend UI build not found. Run 'npm --prefix frontend install && npm --prefix frontend run build' to compile static assets."
    }

@app.get("/{full_path:path}", tags=["Frontend"])
def serve_spa(full_path: str):
    """
    Catch-all route for Single Page Application client-side navigation.
    Serves matching static files if present, else falls back to index.html.
    Preserves all /api endpoints, /docs, /redoc, and /openapi.json.
    """
    if full_path.startswith("api") or full_path.startswith("docs") or full_path.startswith("redoc") or full_path == "openapi.json":
        raise HTTPException(status_code=404, detail="API route not found")

    # If the request matches a physical static file (e.g., favicon, icons, manifest), serve it
    for dist_dir in [FRONTEND_DIST, os.path.join(BASE_DIR, "frontend", "dist"), os.path.join(BASE_DIR, "dist")]:
        target_file = os.path.join(dist_dir, full_path)
        if os.path.isfile(target_file):
            return FileResponse(target_file)

    # Otherwise fallback to index.html for client-side HTML5 history routing
    index_file = _get_index_html()
    if index_file:
        return FileResponse(index_file)

    return {
        "message": "CampusRide API is running.",
        "status": "online",
        "detail": f"Path '/{full_path}' requested but frontend UI build not found."
    }


