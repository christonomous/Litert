#!/bin/bash

# Project LiteRT-Gemma Runner

echo "🔍 Checking System Dependencies..."

# Function to check if a command exists
has_cmd() {
    command -v "$1" &> /dev/null
}

# 1. Base Tools Installation
MISSING_DEPS=()
! has_cmd python3 && MISSING_DEPS+=("python3")
! has_cmd pip && ! has_cmd pip3 && ! python3 -m pip --version &> /dev/null && MISSING_DEPS+=("python3-pip")
! has_cmd node && MISSING_DEPS+=("nodejs")
! has_cmd npm && MISSING_DEPS+=("npm")
! has_cmd curl && MISSING_DEPS+=("curl")

if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
    echo "⚠️  Missing dependencies: ${MISSING_DEPS[*]}"
    if has_cmd apt-get; then
        echo "🔧 Attempting to install missing dependencies via apt..."
        sudo apt-get update
        sudo apt-get install -y "${MISSING_DEPS[@]}"
    else
        echo "❌ Dependencies missing and apt-get not found. Please install manually: ${MISSING_DEPS[*]}"
        exit 1
    fi
fi

# 2. Python Specialized Checks (vEnv)
if ! python3 -m venv --help &> /dev/null; then
    echo "⚠️  python3-venv is missing."
    if has_cmd apt-get; then
        echo "🔧 Installing python3-venv..."
        sudo apt-get install -y python3-venv
    else
        echo "❌ Please install python3-venv manually (e.g., sudo apt install python3-venv)."
        exit 1
    fi
fi

# 3. Node.js Version Check (Modern Vite requires Node 18+)
NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️  Node.js version is too old (v$NODE_VERSION) or not found. Node 18+ is required."
    if has_cmd apt-get; then
        echo "🔧 Upgrading Node.js to v20 via NodeSource..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        echo "❌ Please upgrade Node.js to v18 or higher."
        exit 1
    fi
fi

echo "✅ All system dependencies verified."

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
