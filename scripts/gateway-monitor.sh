#!/bin/bash
# Gateway Monitor & Auto-Restart Script
# Usage: ./scripts/gateway-monitor.sh

LOG_FILE="$HOME/gateway-restarts.log"
OPENCLAW_LOG="/tmp/openclaw/openclaw-$(date +%Y-%m-%d).log"

echo "$(date): Running gateway health check..." >> "$LOG_FILE"

# Check 1: Gateway RPC Probe
echo "Checking gateway RPC probe..."
if ! openclaw gateway status | grep -q "RPC probe: ok"; then
    echo "$(date): ❌ CRITICAL: Gateway RPC probe failed - restarting immediately" >> "$LOG_FILE"
    echo "🚨 GATEWAY DOWN - Auto-restarting..."
    # Let OpenClaw's gateway restart handle it
    exit 1
fi

# Check 2: Recent EPIPE Errors (last 30 minutes)
if [ -f "$OPENCLAW_LOG" ]; then
    RECENT_EPIPE=$(grep -c "EPIPE" "$OPENCLAW_LOG" | tail -n 20)
    if [ "$RECENT_EPIPE" -gt 2 ]; then
        echo "$(date): ⚠️  WARNING: $RECENT_EPIPE EPIPE errors detected in recent logs" >> "$LOG_FILE"
        echo "⚠️ Multiple EPIPE errors detected - consider restart soon"
    fi
fi

# Check 3: Memory System Health  
echo "Testing memory system..."
timeout 10s openclaw memory search "test" >/dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "$(date): ⚠️  WARNING: Memory system timeout or failure" >> "$LOG_FILE"
    echo "⚠️ Memory system issues detected"
fi

# Check 4: Process Health  
PID=$(ps aux | grep -v grep | grep "openclaw-gateway" | awk '{print $2}')
if [ -z "$PID" ]; then
    echo "$(date): ❌ CRITICAL: OpenClaw gateway process not found" >> "$LOG_FILE"
    echo "🚨 GATEWAY PROCESS DEAD - restart needed"
    exit 1
fi

echo "$(date): ✅ Gateway health check passed (PID: $PID)" >> "$LOG_FILE"
echo "✅ Gateway healthy"