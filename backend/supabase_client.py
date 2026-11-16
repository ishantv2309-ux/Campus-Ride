"""
Supabase Backend Client & Service for CampusRide.
Handles direct integration with Supabase Auth and database operations (public.profiles).
"""

import os
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from dotenv import load_dotenv

# Load local .env if present
load_dotenv()

# Constants
DEFAULT_SUPABASE_URL = "https://qplmtaskrkbienpgcokk.supabase.co"
HARDCODED_COLLEGE_NAME = "KCC Institute of Technology and Management"

SUPABASE_URL = os.environ.get("SUPABASE_URL", DEFAULT_SUPABASE_URL)
SUPABASE_KEY = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")

_supabase_client = None

def get_supabase_client():
    """
    Initializes and returns the Supabase client.
    Uses SUPABASE_URL and SUPABASE_KEY / SUPABASE_SERVICE_ROLE_KEY.
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    if not SUPABASE_KEY:
        return None

    try:
        from supabase import create_client, Client
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        return _supabase_client
    except Exception as e:
        print(f"[Supabase] Initialization error: {e}")
        return None


def register_user_with_supabase(
    full_name: str,
    college_email: str,
    password: str,
    vehicle_type: str = "None / Rider Only",
    vehicle_brand: Optional[str] = None
) -> Dict[str, Any]:
    """
    Registers a new user in Supabase Auth and inserts their extended profile into public.profiles.
    Schema handled:
    - id: UUID (from auth.users)
    - full_name: Text
    - college_name: "KCC Institute of Technology and Management"
    - college_email: Text
    - vehicle_type: Text ("Car", "Motorcycle", "Scooty", "None / Rider Only")
    - vehicle_brand: Text (e.g. Honda, Yamaha, Hyundai - optional if None / Rider Only)
    """
    client = get_supabase_client()
    if not client:
        raise ValueError(
            "Supabase client not initialized. Please set SUPABASE_KEY (or SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY) in your environment or .env file."
        )

    # Clean brand if rider
    cleaned_brand = vehicle_brand.strip() if (vehicle_brand and vehicle_type != "None / Rider Only") else None

    # 1. Register with Supabase Auth
    try:
        auth_response = client.auth.sign_up({
            "email": college_email,
            "password": password,
            "options": {
                "data": {
                    "full_name": full_name,
                    "college_name": HARDCODED_COLLEGE_NAME,
                    "vehicle_type": vehicle_type,
                    "vehicle_brand": cleaned_brand
                }
            }
        })
    except Exception as auth_err:
        raise ValueError(f"Supabase Auth error: {str(auth_err)}")

    if not auth_response or not auth_response.user:
        raise ValueError("Supabase Auth failed to return a user object.")

    user = auth_response.user
    user_id = user.id

    # 2. Save extended profile into public.profiles table
    profile_data = {
        "id": user_id,
        "full_name": full_name,
        "college_name": HARDCODED_COLLEGE_NAME,
        "college_email": college_email,
        "vehicle_type": vehicle_type,
        "vehicle_brand": cleaned_brand,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    try:
        profile_res = client.table("profiles").upsert(profile_data).execute()
    except Exception as db_err:
        # If table insertion fails, surface a descriptive error
        raise RuntimeError(f"Failed to save profile into public.profiles: {str(db_err)}")

    session_data = None
    if auth_response.session:
        session_data = {
            "access_token": auth_response.session.access_token,
            "refresh_token": auth_response.session.refresh_token,
            "token_type": auth_response.session.token_type or "bearer",
            "expires_in": auth_response.session.expires_in
        }

    return {
        "user_id": user_id,
        "full_name": full_name,
        "college_name": HARDCODED_COLLEGE_NAME,
        "college_email": college_email,
        "vehicle_type": vehicle_type,
        "vehicle_brand": cleaned_brand,
        "session": session_data,
        "profile": profile_res.data if hasattr(profile_res, "data") else profile_data
    }
