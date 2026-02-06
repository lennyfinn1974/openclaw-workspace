#!/bin/bash
# Quick status checker for Terminal Automation Monitor

WORKSPACE="/Users/lennyfinn/.openclaw/workspace"
STATUS_FILE="$WORKSPACE/terminal-status.json"
LOG_FILE="$WORKSPACE/terminal-monitor.log"

echo "🔍 TERMINAL AUTOMATION MONITOR STATUS"
echo "====================================="

# Check if monitor is running
if pgrep -f "terminal-automation-monitor.sh" > /dev/null; then
    echo "✅ Monitor Process: RUNNING"
else
    echo "❌ Monitor Process: STOPPED"
fi

# Show recent log entries
if [ -f "$LOG_FILE" ]; then
    echo ""
    echo "📋 Recent Activity (last 10 lines):"
    echo "-----------------------------------"
    tail -10 "$LOG_FILE"
fi

# Show current window status
if [ -f "$STATUS_FILE" ]; then
    echo ""
    echo "🪟 Current Window Status:"
    echo "------------------------"
    cat "$STATUS_FILE" | python3 -m json.tool 2>/dev/null || cat "$STATUS_FILE"
fi

# Show active Terminal windows
echo ""
echo "🖥️ Active Terminal Windows:"
echo "--------------------------"
osascript -e 'tell application "Terminal" to get id of every window' 2>/dev/null | tr ',' '\n' | while read window_id; do
    if [ -n "$window_id" ]; then
        echo "Window ID: $window_id"
    fi
done