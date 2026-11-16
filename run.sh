#!/usr/bin/env bash
set -e

# Activate Python virtual environment
source venv/bin/activate

echo "=========================================================="
echo " Starting CampusRide Full-Stack Server on http://localhost:8000"
echo "=========================================================="
PYTHONPATH=. uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
