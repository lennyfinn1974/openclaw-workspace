#!/bin/bash

# Platform Monitoring Script
# Checks Kanban (5174), Nexus (8080), Trading (3000), and Claude Code sessions

TIMESTAMP=$(date "+%Y-%m-%d %H:%M")
LOG_FILE="memory/platform-monitoring-log.md"

echo "#### $TIMESTAMP - Automated Check" >> "$LOG_FILE"

# Check HTTP services
ISSUES=""
KANBAN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5174 2>/dev/null || echo "FAILED")
NEXUS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 2>/dev/null || echo "FAILED")
TRADING_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "FAILED")

if [ "$KANBAN_STATUS" = "200" ]; then
    echo "- ✅ Kanban (5174): HTTP 200" >> "$LOG_FILE"
else
    echo "- ❌ Kanban (5174): $KANBAN_STATUS" >> "$LOG_FILE"
    ISSUES="$ISSUES\nKANBAN SERVICE DOWN"
fi

if [ "$NEXUS_STATUS" = "200" ]; then
    echo "- ✅ Nexus (8080): HTTP 200" >> "$LOG_FILE"
else
    echo "- ❌ Nexus (8080): $NEXUS_STATUS" >> "$LOG_FILE"
    ISSUES="$ISSUES\nNEXUS SERVICE DOWN"
fi

if [ "$TRADING_STATUS" = "200" ]; then
    echo "- ✅ Trading (3000): HTTP 200" >> "$LOG_FILE"
else
    echo "- ❌ Trading (3000): $TRADING_STATUS" >> "$LOG_FILE"
    ISSUES="$ISSUES\nTRADING SERVICE DOWN"
fi

# Check Claude Code sessions
CLAUDE_COUNT=$(ps aux | grep -E "claude" | grep -v grep | wc -l | tr -d ' ')
echo "- ✅ Claude Code Sessions: $CLAUDE_COUNT active" >> "$LOG_FILE"

if [ -z "$ISSUES" ]; then
    echo "**STATUS: ALL SYSTEMS OPERATIONAL**" >> "$LOG_FILE"
else
    echo "**🚨 CRITICAL ISSUES DETECTED:**" >> "$LOG_FILE"
    echo -e "$ISSUES" >> "$LOG_FILE"
fi

echo "" >> "$LOG_FILE"

# If there are issues, output to terminal for immediate attention
if [ ! -z "$ISSUES" ]; then
    echo "CRITICAL PLATFORM ISSUES DETECTED at $TIMESTAMP:"
    echo -e "$ISSUES"
fi