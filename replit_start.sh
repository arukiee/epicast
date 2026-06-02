#!/bin/bash

echo "Installing backend dependencies..."
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

echo "Starting FastAPI backend on port 8000..."
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

cd ../frontend
echo "Installing frontend dependencies..."
npm install

echo "Starting Vite frontend on port 3000..."
# Replit exposes port 5173 automatically for Vite apps
npm run dev -- --host 0.0.0.0

# Wait for frontend to exit, then kill backend
wait $BACKEND_PID
