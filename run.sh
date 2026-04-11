#!/bin/bash

# Project LiteRT-Gemma Runner

# --- OS Detection ---
OS_TYPE="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS_TYPE="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS_TYPE="macos"
fi

echo "🔍 Checking System Dependencies ($OS_TYPE)..."

# Function to check if a command exists
has_cmd() {
    command -v "$1" &> /dev/null
}

# 1. Base Tools Installation
MISSING_LINUX=()
MISSING_MAC=()

# Python Check
if ! has_cmd python3; then
    MISSING_LINUX+=("python3")
    MISSING_MAC+=("python3")
fi

# Pip Check
if ! has_cmd pip && ! has_cmd pip3 && ! python3 -m pip --version &> /dev/null; then
    MISSING_LINUX+=("python3-pip")
    # pip3 is usually part of brew python3
fi

# Node/npm Check
if ! has_cmd node || ! has_cmd npm; then
    MISSING_LINUX+=("nodejs npm")
    MISSING_MAC+=("node")
fi

# Curl Check (required for both)
if ! has_cmd curl; then
    MISSING_LINUX+=("curl")
    MISSING_MAC+=("curl")
fi

# Install missing base tools
if [ ${#MISSING_LINUX[@]} -gt 0 ] && [ "$OS_TYPE" == "linux" ]; then
    echo "⚠️  Missing dependencies: ${MISSING_LINUX[*]}"
    if has_cmd apt-get; then
        echo "🔧 Installing via apt..."
        sudo apt-get update && sudo apt-get install -y ${MISSING_LINUX[*]}
    else
        echo "❌ apt-get not found. Please install manually: ${MISSING_LINUX[*]}"
        exit 1
    fi
elif [ ${#MISSING_MAC[@]} -gt 0 ] && [ "$OS_TYPE" == "macos" ]; then
    echo "⚠️  Missing dependencies: ${MISSING_MAC[*]}"
    if ! has_cmd brew; then
        echo "🔧 Homebrew not found. Installing..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    brew install ${MISSING_MAC[*]}
fi

# 2. Python Specialized Checks (vEnv)
if ! python3 -m venv --help &> /dev/null; then
    echo "⚠️  python3-venv is missing."
    if [ "$OS_TYPE" == "linux" ] && has_cmd apt-get; then
        echo "🔧 Installing python3-venv..."
        sudo apt-get install -y python3-venv
    elif [ "$OS_TYPE" == "macos" ]; then
        echo "🔧 Re-installing python via brew to ensure venv..."
        brew install python
    else
        echo "❌ Please install python3-venv manually."
        exit 1
    fi
fi

# 3. Node.js Version Check (Modern Vite requires Node 18+)
NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️  Node.js version is too old (v$NODE_VERSION) or not found. Node 18+ is required."
    if [ "$OS_TYPE" == "linux" ] && has_cmd apt-get; then
        echo "🔧 Upgrading Node.js to v20 via NodeSource..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif [ "$OS_TYPE" == "macos" ]; then
        echo "🔧 Upgrading Node.js via brew..."
        brew install node
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
