#!/bin/bash
# Platform Watchdog - Ensures services stay running
# Add to cron: */5 * * * * /path/to/platform-watchdog.sh

WORKSPACE="$HOME/.openclaw/workspace"
LOG_DIR="$WORKSPACE/logs/platform-services"

# Function to check and restart service if needed
check_and_restart() {
    local name=$1
    local port=$2
    local restart_command=$3
    
    # Check if process is running and port is active
    if ! pgrep -f "$name" > /dev/null || ! nc -z localhost $port; then
        echo "$(date): $name service down - restarting..." >> "$LOG_DIR/watchdog.log"
        
        # Kill any stale processes
        pkill -f "$name" 2>/dev/null || true
        sleep 2
        
        # Restart service
        cd "$WORKSPACE" && $restart_command
        
        echo "$(date): $name service restarted" >> "$LOG_DIR/watchdog.log"
    fi
}

# Create log directory if needed
mkdir -p "$LOG_DIR"

# Check each platform service
check_and_restart "kanban" 5174 "./platform-services-startup.sh > /dev/null 2>&1 &"
check_and_restart "nexus" 8080 "./platform-services-startup.sh > /dev/null 2>&1 &"  
check_and_restart "trading" 3000 "./platform-services-startup.sh > /dev/null 2>&1 &"