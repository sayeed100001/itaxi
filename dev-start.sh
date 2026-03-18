#!/bin/bash

echo "Starting iTaxi Development Environment..."

if [ ! -f ".env" ]; then
  echo ".env not found - creating from .env.example ..."
  cp .env.example .env
  echo "Please edit .env with your MySQL credentials if needed."
fi

# Kill any existing processes on ports 5000 and 5173
echo "Cleaning up existing processes..."
lsof -ti:5000 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# Initialize database
echo "Initializing database..."
npm run init-db

# Start both server and client
echo "Starting server (port 5000) and client (port 5173)..."
npm run dev

echo "Development environment ready!"
echo "Frontend: http://localhost:5173"
echo "API:      http://localhost:5000"
