#!/bin/bash
# Nexus Enhanced - Development Startup Script

echo "🚀 Starting Nexus Enhanced (Development Mode)..."

# Activate Python virtual environment
source venv/bin/activate

# Start backend with auto-reload
echo "🔧 Starting backend in development mode (auto-reload enabled)..."
python backend/main.py --host 127.0.0.1 --port 8082 --reload

