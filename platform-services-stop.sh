#!/bin/bash
# Platform Services Stop Script

WORKSPACE="$HOME/.openclaw/workspace"
LOG_DIR="$WORKSPACE/logs/platform-services"

echo "🛑 Stopping Platform Services..."

stop_service() {
    local name=$1
    local port=$2
    local pid_file="$LOG_DIR/$name.pid"
    
    echo "Stopping $name..."
    
    # Stop by PID if available
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            kill "$pid" 2>/dev/null
            sleep 2
            if ps -p "$pid" > /dev/null 2>&1; then
                echo "  Force killing $name (PID: $pid)"
                kill -9 "$pid" 2>/dev/null
            fi
        fi
        rm -f "$pid_file"
    fi
    
    # Kill any remaining processes on the port
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
    
    echo "✅ $name stopped"
}

# Stop all services
stop_service "kanban" "5174"
stop_service "nexus" "8081"
stop_service "trading" "3000"

echo ""
echo "🔍 Verifying shutdown..."
sleep 2

# Check if any processes are still running
remaining=$(netstat -an | grep -E ":(3000|5174|8081)" | grep LISTEN | wc -l)
if [ "$remaining" -eq 0 ]; then
    echo "✅ All platform services stopped successfully"
else
    echo "⚠️  Some services may still be running:"
    netstat -an | grep -E ":(3000|5174|8081)" | grep LISTEN
fi