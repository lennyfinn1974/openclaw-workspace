#!/bin/bash
# Platform Services Startup Script
# Ensures Kanban, Nexus, and TraderPro run persistently

WORKSPACE="$HOME/.openclaw/workspace"
LOG_DIR="$WORKSPACE/logs/platform-services"

# Create log directory
mkdir -p "$LOG_DIR"

echo "🚀 Starting Persistent Platform Services..."

# Function to start service in background with logging
start_service() {
    local name=$1
    local dir=$2
    local command=$3
    local port=$4
    
    echo "Starting $name on port $port..."
    cd "$dir" || exit 1
    
    # Kill existing process on port if exists
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
    
    # Start service with logging
    nohup bash -c "$command" > "$LOG_DIR/$name.log" 2>&1 &
    local pid=$!
    echo "$pid" > "$LOG_DIR/$name.pid"
    
    echo "✅ $name started (PID: $pid)"
}

# 1. Start Kanban Platform (Project Management)
if [ -d "$WORKSPACE/hybrid-kanban-platform" ]; then
    start_service "kanban" "$WORKSPACE/hybrid-kanban-platform" "npm run dev:full" "5174"
else
    echo "⚠️ Kanban platform directory not found"
fi

# 2. Start Nexus Agent (AI Coordination Hub)  
NEXUS_DIR="/Users/lennyfinn/Desktop/Aries/openclaw-20260204-113707/workspace/nexus"
if [ -d "$NEXUS_DIR" ]; then
    start_service "nexus" "$NEXUS_DIR" "./start-nexus.sh" "8081"
else
    echo "⚠️ Nexus agent directory not found at $NEXUS_DIR"
fi

# 3. Start Trading Platform (TraderPro)
if [ -d "$WORKSPACE/trading-platform" ]; then
    # Kill existing trading platform process first
    pkill -f "trading-platform" 2>/dev/null || true
    start_service "trading" "$WORKSPACE/trading-platform" "npm run dev" "3000"
else
    echo "⚠️ Trading platform directory not found"
fi

echo ""
echo "🎯 Platform Services Status:"
echo "- Kanban: http://localhost:5174"
echo "- Nexus: http://localhost:8081" 
echo "- Trading: http://localhost:3000"
echo ""
echo "📋 Management Commands:"
echo "- Check status: ./platform-services-status.sh"
echo "- Stop all: ./platform-services-stop.sh"
echo "- Logs: tail -f $LOG_DIR/*.log"