"""
Automated End-to-End Integration Tests for CampusRide.
Verifies the Strict Wiring Contract:
Auth Security -> Relational DB Persistence -> AutoML Route & ETA Inference -> Seat Booking State Sync
"""

import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base, get_db
from backend.main import app

# Use isolated test database in memory / file
TEST_DB_FILE = "./test_campus_ride.db"
TEST_DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"

test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="session", autouse=True)
def setup_and_teardown():
    # Setup test tables
    Base.metadata.create_all(bind=test_engine)
    yield
    # Teardown
    Base.metadata.drop_all(bind=test_engine)
    if os.path.exists(TEST_DB_FILE):
        os.remove(TEST_DB_FILE)

client = TestClient(app)

# ==================== STEP 1: AUTH & IDENTITY GATE ====================

def test_auth_domain_restriction_blocks_personal_email():
    """FR-AUTH.1: Domain Restriction rejects personal non-college emails."""
    invalid_payload = {
        "full_name": "Intruder User",
        "college_email": "intruder@gmail.com",
        "password": "Password123!",
        "role": "rider"
    }
    response = client.post("/api/auth/register", json=invalid_payload)
    assert response.status_code == 400
    assert "Only verified college email addresses ending with '@college.edu.in' are permitted" in response.json()["detail"]

def test_auth_domain_restriction_allows_college_email():
    """FR-AUTH.1 & FR-AUTH.2: Valid college email succeeds and issues JWT token."""
    driver_payload = {
        "full_name": "Dev Sharma",
        "college_email": "dev.sharma@college.edu.in",
        "password": "SecurePassword123",
        "role": "driver",
        "vehicle_type": "car",
        "student_id": "2024-CS-001",
        "phone": "+91 98765 00001"
    }
    response = client.post("/api/auth/register", json=driver_payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["user"]["college_email"] == "dev.sharma@college.edu.in"
    assert data["user"]["vehicle_type"] == "car"

def test_login_and_token_authentication():
    """Verifies login with valid and invalid credentials, and /me endpoint."""
    # Invalid password
    bad_login = client.post("/api/auth/login", json={
        "college_email": "dev.sharma@college.edu.in",
        "password": "WrongPassword"
    })
    assert bad_login.status_code == 401

    # Valid password
    good_login = client.post("/api/auth/login", json={
        "college_email": "dev.sharma@college.edu.in",
        "password": "SecurePassword123"
    })
    assert good_login.status_code == 200
    token = good_login.json()["access_token"]

    # Access protected /me
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["full_name"] == "Dev Sharma"

# ==================== STEP 2: DATA PERSISTENCE & ROUTES ====================

def test_saved_route_persistence():
    """FR-DB: Saved routes persist in database for one-click autofill."""
    login_resp = client.post("/api/auth/login", json={
        "college_email": "dev.sharma@college.edu.in",
        "password": "SecurePassword123"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    create_resp = client.post("/api/routes/saved", headers=headers, json={
        "route_label": "Daily Morning Highway Commute",
        "origin_zone": "Rohini Sector 14 Metro",
        "campus_gate": "North Engineering Gate",
        "preferred_time": "08:30 AM"
    })
    assert create_resp.status_code == 201
    route_id = create_resp.json()["id"]

    # Verify retrieval
    get_resp = client.get("/api/routes/saved", headers=headers)
    assert get_resp.status_code == 200
    routes = get_resp.json()
    assert any(r["id"] == route_id and r["origin_zone"] == "Rohini Sector 14 Metro" for r in routes)

# ==================== STEP 3: LIVE AUTOML INFERENCE ====================

def test_automl_eta_prediction_pipeline():
    """FR-ML: Connected AutoML model returns live ETA and match score."""
    pred_resp = client.post("/api/predict/eta", json={
        "origin_zone": "South Extension Ring Road",
        "destination_gate": "Main Campus Gate (Admin Block)",
        "distance_km": 14.5,
        "hour_of_day": 9,
        "day_of_week": 1,
        "vehicle_type": "car"
    })
    assert pred_resp.status_code == 200
    data = pred_resp.json()
    assert "predicted_eta_mins" in data
    assert data["predicted_eta_mins"] > 0
    assert "route_match_score" in data
    assert 0 <= data["route_match_score"] <= 100
    assert data["corridor_congestion_index"] == "Peak Rush Hour"

def test_automl_fallback_safety():
    """FR-ML Fallback Safety: Unseen or missing parameters are imputed deterministically."""
    pred_resp = client.post("/api/predict/eta", json={
        "origin_zone": "Unknown Random Colony XYZ",
        "destination_gate": "Hostel Complex Entry Gate",
        "vehicle_type": "invalid_type"
    })
    assert pred_resp.status_code == 200
    data = pred_resp.json()
    assert data["predicted_eta_mins"] > 0
    assert data["sanitized_features"]["vehicle_type"] == "car"

# ==================== STEP 4: RIDE POSTING & STATE SYNC ====================

def test_ride_posting_and_live_seat_decrement():
    """
    Step 4 of PRD Walkthrough:
    Driver posts a ride -> Rider books a seat -> Driver's seats_available decrements in real time.
    """
    # 1. Driver logs in and posts a ride
    driver_login = client.post("/api/auth/login", json={
        "college_email": "dev.sharma@college.edu.in",
        "password": "SecurePassword123"
    })
    driver_token = driver_login.json()["access_token"]

    post_resp = client.post("/api/rides", headers={"Authorization": f"Bearer {driver_token}"}, json={
        "origin_zone": "Dwarka Sector 10 Hub",
        "destination_gate": "Main Campus Gate (Admin Block)",
        "departure_time": "08:15 AM",
        "seats_total": 3,
        "vehicle_type": "car",
        "notes": "Fast express ride via airport flyover."
    })
    assert post_resp.status_code == 201
    ride_id = post_resp.json()["ride"]["id"]
    assert post_resp.json()["ride"]["seats_available"] == 3
    assert post_resp.json()["ride"]["predicted_eta_mins"] > 0

    # 2. Register a new verified Rider
    rider_register = client.post("/api/auth/register", json={
        "full_name": "Ananya Sen",
        "college_email": "ananya.sen@college.edu.in",
        "password": "PasswordRider123",
        "role": "rider",
        "student_id": "2024-BIO-044",
        "phone": "+91 98765 00002"
    })
    assert rider_register.status_code == 201
    rider_token = rider_register.json()["access_token"]

    # 3. Rider books a seat
    book_resp = client.post("/api/bookings", headers={"Authorization": f"Bearer {rider_token}"}, json={
        "ride_id": ride_id
    })
    assert book_resp.status_code == 201
    book_data = book_resp.json()
    assert book_data["booking_status"] == "confirmed"
    assert book_data["seats_remaining"] == 2  # State sync: 3 - 1 = 2!

    # 4. Verify search feed reflects decremented seats
    search_resp = client.get("/api/rides?origin_zone=Dwarka Sector 10 Hub")
    assert search_resp.status_code == 200
    matched_rides = search_resp.json()
    found_ride = next(r for r in matched_rides if r["id"] == ride_id)
    assert found_ride["seats_available"] == 2

    # 5. Prevent double booking
    double_book = client.post("/api/bookings", headers={"Authorization": f"Bearer {rider_token}"}, json={
        "ride_id": ride_id
    })
    assert double_book.status_code == 400
    assert "already have an active seat booking" in double_book.json()["detail"]

    # 6. Check Rider's bookings list
    my_bookings = client.get("/api/bookings/my-bookings", headers={"Authorization": f"Bearer {rider_token}"})
    assert my_bookings.status_code == 200
    assert len(my_bookings.json()) == 1
    assert my_bookings.json()[0]["ride"]["driver"]["full_name"] == "Dev Sharma"

    # 7. Check Driver's posted rides passenger list
    my_posted = client.get("/api/rides/my-posted", headers={"Authorization": f"Bearer {driver_token}"})
    assert my_posted.status_code == 200
    posted_ride = next(r for r in my_posted.json() if r["id"] == ride_id)
    assert len(posted_ride["passenger_bookings"]) == 1
    assert posted_ride["passenger_bookings"][0]["rider_name"] == "Ananya Sen"

def test_continuous_learning_export():
    """FR-DB / FR-ML: Trip data exports to CSV for continuous retraining."""
    export_resp = client.get("/api/admin/export-trips")
    assert export_resp.status_code == 200
    assert "text/csv" in export_resp.headers["content-type"]
    assert "ride_id,driver_id,origin_zone,destination_gate" in export_resp.text

# ==================== SUPABASE SCHEMA & SIGNUP ENDPOINT ====================

def test_signup_endpoint_exact_schema():
    """
    Verifies /api/signup endpoint handles exact user data schema:
    1. Full Name (Text)
    2. College Name (Preset to: 'KCC Institute of Technology and Management')
    3. College Email (@college.edu.in)
    4. Password
    5. Vehicle Type ('Car', 'Motorcycle', 'Scooty', 'None / Rider Only')
    6. Vehicle Brand (Text string, e.g. Honda, Hyundai)
    """
    # 1. Rejects invalid email
    bad_resp = client.post("/api/signup", json={
        "full_name": "KCC Student",
        "college_email": "student@gmail.com",
        "password": "Password@123",
        "vehicle_type": "Car",
        "vehicle_brand": "Honda"
    })
    assert bad_resp.status_code == 400

    # 2. Accepts valid exact schema
    good_resp = client.post("/api/signup", json={
        "full_name": "Arjun Singh",
        "college_name": "KCC Institute of Technology and Management",
        "college_email": "arjun.singh@college.edu.in",
        "password": "KCCPassword@2026",
        "vehicle_type": "Car",
        "vehicle_brand": "Hyundai"
    })
    assert good_resp.status_code == 200
    data = good_resp.json()
    assert data["status"] == "success"
    assert data["user"]["full_name"] == "Arjun Singh"
    assert data["user"]["college_name"] == "KCC Institute of Technology and Management"
    assert data["user"]["college_email"] == "arjun.singh@college.edu.in"
    assert data["user"]["vehicle_type"] == "Car"
    assert data["user"]["vehicle_brand"] == "Hyundai"

# ==================== KCC HYBRID AUTOML ROUTE & PATHFINDING ENDPOINT ====================

def test_predict_route_kcc_automl():
    """
    Verifies /api/predict-route hybrid routing endpoint:
    1. Destination is fixed to 'KCC Institute of Technology and Management'.
    2. Dynamic pickups (Noida 62, Lal Kuan, Chapraula, NH-3).
    3. Combines graph-based Dijkstra shortest-path with protected read-only AutoML inference.
    4. Reroutes around bottlenecks (e.g. Lal Kuan GT Road gridlock -> EPE bypass).
    5. Returns exact sequence of nodes, distances, shortest physical path, ETA and confidence.
    """
    # 1. Validation error on empty pickup
    err_resp = client.post("/api/predict-route", json={"pickup_location": ""})
    assert err_resp.status_code == 400

    # 2. Lal Kuan pickup test: Dijkstra + AutoML must reroute via EPE bypass
    lal_resp = client.post("/api/predict-route", json={
        "pickup_location": "Lal Kuan",
        "ride_time": "08:30 AM",
        "vehicle_type": "Car"
    })
    assert lal_resp.status_code == 200
    lal_data = lal_resp.json()
    assert lal_data["destination"] == "KCC Institute of Technology and Management"
    assert lal_data["pickup_location"] == "Lal Kuan"
    assert lal_data["optimal_route_recommendation"] == "Eastern Peripheral Expressway (EPE) Bypass"
    assert lal_data["predicted_eta_mins"] > 0
    assert 60 <= lal_data["confidence_score"] <= 100

    # Hybrid pathfinding checks
    assert "optimal_path_nodes" in lal_data
    assert "physical_shortest_path_nodes" in lal_data
    assert lal_data["optimal_path_nodes"][0] == "Lal Kuan"
    assert lal_data["optimal_path_nodes"][-1] == "KCC Institute of Technology and Management"
    assert "Eastern Peripheral Expressway" in lal_data["optimal_path_nodes"]
    assert lal_data["rerouted_around_bottlenecks"] is True
    assert lal_data["total_distance_km"] > 0
    assert lal_data["physical_shortest_distance_km"] > 0
    assert "Dijkstra" in lal_data["algorithm"]

    # 3. Noida 62 pickup test: Dijkstra + AutoML path
    noida_resp = client.post("/api/predict-route", json={
        "pickup_location": "Noida 62",
        "ride_time": "08:30 AM",
        "vehicle_type": "Car"
    })
    assert noida_resp.status_code == 200
    noida_data = noida_resp.json()
    assert noida_data["destination"] == "KCC Institute of Technology and Management"
    assert noida_data["optimal_path_nodes"][0] == "Noida 62"
    assert noida_data["optimal_path_nodes"][-1] == "KCC Institute of Technology and Management"
    assert "Noida Expressway (Sec 128-142)" in noida_data["optimal_path_nodes"]
    assert noida_data["predicted_eta_mins"] > 0

def test_ride_publishing_flexible_fields_and_two_wheeler_normalization():
    """Verifies ride publishing accepts flexible field names and vehicle_type string values."""
    driver_login = client.post("/api/auth/login", json={
        "college_email": "dev.sharma@college.edu.in",
        "password": "SecurePassword123"
    })
    token = driver_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Publish ride using frontend alias fields and complex vehicle_type string
    post_resp = client.post("/api/rides", headers=headers, json={
        "origin": "Noida 62",
        "destination": "Main Campus Gate (Admin Block)",
        "departure_time": "08:45 AM",
        "seats_available": 2,
        "vehicle_type": "Two-Wheeler (Motorcycle / Scooty)",
        "pickup_notes": "Leaving sharp at 8:45 from Sector 62."
    })
    assert post_resp.status_code == 201
    ride_data = post_resp.json()["ride"]
    assert ride_data["origin_zone"] == "Noida 62"
    assert ride_data["destination_gate"] == "Main Campus Gate (Admin Block)"
    assert ride_data["seats_total"] == 2
    assert ride_data["seats_available"] == 2
    assert ride_data["vehicle_type"] == "two_wheeler"
    assert ride_data["notes"] == "Leaving sharp at 8:45 from Sector 62."
    assert post_resp.json()["ml_inference"]["predicted_eta_mins"] > 0

def test_ride_publishing_validation_error_json():
    """Verifies that missing required fields return proper JSON HTTPException rather than plain text."""
    driver_login = client.post("/api/auth/login", json={
        "college_email": "dev.sharma@college.edu.in",
        "password": "SecurePassword123"
    })
    token = driver_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Empty origin should return 422 with JSON detail
    err_resp = client.post("/api/rides", headers=headers, json={
        "origin": "",
        "origin_zone": "",
        "destination": "Main Campus Gate"
    })
    assert err_resp.status_code == 422
    assert "detail" in err_resp.json()




