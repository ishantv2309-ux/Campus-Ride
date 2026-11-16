"""
SQLAlchemy Models for CampusRide.
Defines:
- User (students with verified @college.edu.in identity)
- SavedRoute (one-click commute autofill)
- Ride (driver-posted commute rides with AutoML ETA)
- Booking (rider reservations with atomic seat decrements)
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from .database import Base

def utc_now():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    full_name = Column(String(120), nullable=False)
    college_email = Column(String(150), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="rider")  # rider, driver, both
    vehicle_type = Column(String(50), nullable=True)  # Car, Motorcycle, Scooty, None / Rider Only
    vehicle_brand = Column(String(100), nullable=True)  # e.g., Honda, Yamaha, Maruti
    student_id = Column(String(50), nullable=True)  # Student Roll/ID
    phone = Column(String(30), nullable=True)  # Contact Handle for ride coordination
    created_at = Column(DateTime, default=utc_now)

    # Relationships
    saved_routes = relationship("SavedRoute", back_populates="user", cascade="all, delete-orphan")
    posted_rides = relationship("Ride", back_populates="driver", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="rider", cascade="all, delete-orphan")


class SavedRoute(Base):
    __tablename__ = "saved_routes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    route_label = Column(String(100), nullable=False)
    origin_zone = Column(String(150), nullable=False)
    campus_gate = Column(String(150), nullable=False)
    preferred_time = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=utc_now)

    user = relationship("User", back_populates="saved_routes")


class Ride(Base):
    __tablename__ = "rides"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    driver_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    origin_zone = Column(String(150), nullable=False)
    destination_gate = Column(String(150), nullable=False)
    departure_time = Column(String(50), nullable=False)
    seats_total = Column(Integer, nullable=False)
    seats_available = Column(Integer, nullable=False)
    predicted_eta_mins = Column(Float, nullable=False)
    status = Column(String(30), default="active")  # active, completed, cancelled
    vehicle_type = Column(String(50), nullable=False, default="car")
    distance_km = Column(Float, default=10.0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    driver = relationship("User", back_populates="posted_rides")
    bookings = relationship("Booking", back_populates="ride", cascade="all, delete-orphan")


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ride_id = Column(Integer, ForeignKey("rides.id", ondelete="CASCADE"), nullable=False)
    rider_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    booking_status = Column(String(30), default="confirmed")  # confirmed, cancelled
    created_at = Column(DateTime, default=utc_now)

    ride = relationship("Ride", back_populates="bookings")
    rider = relationship("User", back_populates="bookings")
