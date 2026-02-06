#!/bin/bash
# Platform Services Status Checker

WORKSPACE="$HOME/.openclaw/workspace"
LOG_DIR="$WORKSPACE/logs/platform-services"

echo "🔍 Platform Services Status Check"
echo "=================================="

check_service() {
    local name=$1
    local port=$2
    local pid_file="$LOG_DIR/$name.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            echo "✅ $name (PID: $pid) - RUNNING on port $port"
            # Check if port is actually listening
            if lsof -i:$port > /dev/null 2>&1; then
                echo "   🌐 Port $port is active"
            else
                echo "   ⚠️  Port $port not responding"
            fi
        else
            echo "❌ $name - STOPPED (stale PID file)"
            rm -f "$pid_file"
        fi
    else
        echo "❌ $name - NOT RUNNING (no PID file)"
    fi
    echo ""
}

# Check each service
check_service "kanban" "5174"
check_service "nexus" "8081" 
check_service "trading" "3000"

echo "📊 Port Usage Summary:"
echo "----------------------"
netstat -an | grep -E ":(3000|5174|8081)" | grep LISTEN || echo "No target ports listening"

echo ""
echo "📋 Log Files:"
echo "-------------"
if [ -d "$LOG_DIR" ]; then
    ls -la "$LOG_DIR"/*.log 2>/dev/null || echo "No log files found"
else
    echo "Log directory not found: $LOG_DIR"
fi