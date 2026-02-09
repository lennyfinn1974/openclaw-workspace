#!/bin/bash

# Nexus Agent Startup Script
# Starts the Nexus service on port 8081

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
PID_FILE="$LOG_DIR/nexus-agent.pid"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_DIR/nexus-startup.log"
}

log "Starting Nexus Agent..."

# Check if already running
if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
    log "Nexus Agent is already running (PID: $(cat $PID_FILE))"
    exit 0
fi

# Find and start the Nexus main.py
if [ -f "main.py" ]; then
    log "Starting Nexus from main.py"
    python main.py &
    echo $! > "$PID_FILE"
elif [ -f "nexus-agent/main.py" ]; then
    log "Starting Nexus from nexus-agent/main.py" 
    cd nexus-agent && python main.py &
    echo $! > "$PID_FILE"
elif [ -f "nexus/main.py" ]; then
    log "Starting Nexus from nexus/main.py"
    cd nexus && python main.py &
    echo $! > "$PID_FILE"
else
    log "ERROR: Could not find main.py for Nexus Agent"
    log "Please update start-nexus.sh with the correct path"
    exit 1
fi

log "Nexus Agent started with PID: $(cat $PID_FILE)"
log "Admin interface should be available at: http://localhost:8081/admin"

# Wait for the service to be ready
sleep 5

# Check if service is responding
if curl -s http://localhost:8081/admin > /dev/null; then
    log "Nexus Agent is responding on port 8081"
else
    log "WARNING: Nexus Agent may not be responding on port 8081"
fi