#!/bin/bash
set -e

echo "Building frontend..."
cd frontend
npm install
npm run build

echo "Setting up backend..."
cd ../backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

echo "Build complete."
