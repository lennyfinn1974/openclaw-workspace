#!/bin/bash
# Nexus Enhanced - Startup Script

echo "🚀 Starting Nexus Enhanced..."

# Activate Python virtual environment
source venv/bin/activate

# Start backend server
echo "🔧 Starting backend on port 8082..."
python backend/main.py --host 127.0.0.1 --port 8082

