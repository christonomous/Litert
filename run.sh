#!/bin/bash

# Project LiteRT-Gemma Runner

# 1. Setup Backend
echo "🚀 Starting Backend Setup..."
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
    source .venv/bin/activate
    pip install fastapi uvicorn requests litert-lm python-multipart
else
    source .venv/bin/activate
fi

# 2. Setup Frontend
echo "📦 Checking Frontend Dependencies..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
fi
cd ..

# 3. Launch Services
echo "✨ Launching Application Services..."

# Run Backend in background
source .venv/bin/activate
python3 app.py &
BACKEND_PID=$!

# Run Frontend
cd frontend
npm run dev &
FRONTEND_PID=$!

cd ..

echo "------------------------------------------------"
echo "✅ Application is starting!"
echo "📡 Backend: http://127.0.0.1:8000"
echo "🌐 Frontend: http://localhost:5173"
echo "------------------------------------------------"
echo "Press Ctrl+C to stop both services."

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM
wait
