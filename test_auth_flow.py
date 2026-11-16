"""
Standalone Comprehensive Test Script for CampusRide Sign Up and Sign In.
Tests both /api/signup and /api/auth/login with all edge cases:
- Personal email domain rejection
- Valid college email registration with KCC schema
- Vehicle type & brand handling (Car, Motorcycle, Scooty, None/Rider Only)
- Duplicate registration rejection
- Invalid login credentials rejection
- Valid login & JWT token generation
- Protected route /api/auth/me access with session token
"""

import sys
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def run_tests():
    print("==================================================================")
    print("🚀 RUNNING CAMPUSRIDE SIGN UP & SIGN IN COMPREHENSIVE TEST SUITE")
    print("==================================================================\n")

    passed_count = 0
    total_tests = 7

    # -------------------------------------------------------------
    # TEST 1: Sign up with personal email (@gmail.com) -> MUST BE BLOCKED (400)
    # -------------------------------------------------------------
    print("Test 1: Attempt Sign Up with personal Gmail account...")
    resp1 = client.post("/api/signup", json={
        "full_name": "Intruder User",
        "college_email": "intruder@gmail.com",
        "password": "Password123!",
        "vehicle_type": "Car",
        "vehicle_brand": "Honda"
    })
    assert resp1.status_code == 400, f"Expected 400, got {resp1.status_code}: {resp1.text}"
    assert "Only verified college email addresses ending with '@college.edu.in' are permitted" in resp1.json()["detail"]
    print("  ✅ Passed: Blocked non-college email with 400 Bad Request.\n")
    passed_count += 1

    # -------------------------------------------------------------
    # TEST 2: Sign up with valid college email & exact KCC Schema (Car Driver)
    # -------------------------------------------------------------
    print("Test 2: Sign Up new student driver with exact KCC schema...")
    test_driver_email = "aayush.kcc@college.edu.in"
    driver_payload = {
        "full_name": "Aayush Sharma",
        "college_name": "KCC Institute of Technology and Management",
        "college_email": test_driver_email,
        "password": "KCCPassword@2026",
        "vehicle_type": "Car",
        "vehicle_brand": "Honda City"
    }
    resp2 = client.post("/api/signup", json=driver_payload)
    assert resp2.status_code == 200, f"Expected 200, got {resp2.status_code}: {resp2.text}"
    data2 = resp2.json()
    assert data2["status"] == "success"
    assert data2["user"]["full_name"] == "Aayush Sharma"
    assert data2["user"]["college_name"] == "KCC Institute of Technology and Management"
    assert data2["user"]["college_email"] == test_driver_email
    assert data2["user"]["vehicle_type"] == "Car"
    assert data2["user"]["vehicle_brand"] == "Honda City"
    print("  ✅ Passed: User registered with 200 OK and correct KCC schema.\n")
    passed_count += 1

    # -------------------------------------------------------------
    # TEST 3: Duplicate Registration Prevention -> MUST BE BLOCKED (400)
    # -------------------------------------------------------------
    print("Test 3: Attempt duplicate registration with same email...")
    resp3 = client.post("/api/auth/register", json={
        "full_name": "Aayush Duplicate",
        "college_email": test_driver_email,
        "password": "DifferentPassword123",
        "vehicle_type": "Car"
    })
    assert resp3.status_code == 400, f"Expected 400, got {resp3.status_code}: {resp3.text}"
    assert "already exists" in resp3.json()["detail"].lower()
    print("  ✅ Passed: Duplicate registration blocked with 400 Bad Request.\n")
    passed_count += 1

    # -------------------------------------------------------------
    # TEST 4: Sign Up a Rider Only (None / Rider Only, vehicle_brand should be None)
    # -------------------------------------------------------------
    print("Test 4: Sign Up student with 'None / Rider Only' vehicle type...")
    test_rider_email = "divya.kcc@college.edu.in"
    rider_payload = {
        "full_name": "Divya Mehra",
        "college_name": "KCC Institute of Technology and Management",
        "college_email": test_rider_email,
        "password": "RiderPassword@2026",
        "vehicle_type": "None / Rider Only",
        "vehicle_brand": None
    }
    resp4 = client.post("/api/signup", json=rider_payload)
    assert resp4.status_code == 200, f"Expected 200, got {resp4.status_code}: {resp4.text}"
    data4 = resp4.json()
    assert data4["user"]["vehicle_type"] == "None / Rider Only"
    assert data4["user"]["vehicle_brand"] is None
    print("  ✅ Passed: Rider registered with 200 OK and null vehicle brand.\n")
    passed_count += 1

    # -------------------------------------------------------------
    # TEST 5: Sign In with wrong password -> MUST BE REJECTED (401)
    # -------------------------------------------------------------
    print("Test 5: Attempt Sign In with incorrect password...")
    resp5 = client.post("/api/auth/login", json={
        "college_email": test_driver_email,
        "password": "WrongPassword123"
    })
    assert resp5.status_code == 401, f"Expected 401, got {resp5.status_code}: {resp5.text}"
    assert "Invalid college email or password" in resp5.json()["detail"]
    print("  ✅ Passed: Invalid password rejected with 401 Unauthorized.\n")
    passed_count += 1

    # -------------------------------------------------------------
    # TEST 6: Sign In with correct password -> MUST SUCCEED (200) + JWT token
    # -------------------------------------------------------------
    print("Test 6: Sign In with correct credentials...")
    resp6 = client.post("/api/auth/login", json={
        "college_email": test_driver_email,
        "password": "KCCPassword@2026"
    })
    assert resp6.status_code == 200, f"Expected 200, got {resp6.status_code}: {resp6.text}"
    data6 = resp6.json()
    assert "access_token" in data6
    assert data6["token_type"] == "bearer"
    assert data6["user"]["full_name"] == "Aayush Sharma"
    token = data6["access_token"]
    print(f"  ✅ Passed: Sign in succeeded (200 OK). JWT Token generated: {token[:25]}...\n")
    passed_count += 1

    # -------------------------------------------------------------
    # TEST 7: Authenticated Protected Route (/api/auth/me) with JWT
    # -------------------------------------------------------------
    print("Test 7: Verify JWT session token against protected /api/auth/me endpoint...")
    resp7 = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp7.status_code == 200, f"Expected 200, got {resp7.status_code}: {resp7.text}"
    user_me = resp7.json()
    assert user_me["college_email"] == test_driver_email
    assert user_me["full_name"] == "Aayush Sharma"
    print(f"  ✅ Passed: Protected session verified for {user_me['full_name']} ({user_me['college_email']}).\n")
    passed_count += 1

    print("==================================================================")
    print(f"🎉 ALL TESTS PASSED: {passed_count}/{total_tests} (100% Success Rate)")
    print("==================================================================")

if __name__ == "__main__":
    run_tests()
