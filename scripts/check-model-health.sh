#!/bin/bash
# Quick model health check for heartbeat monitoring
# Returns 0 if healthy, 1 if fallback needed

MONITOR_SCRIPT="scripts/model-fallback-monitor.py"

if [ -f "$MONITOR_SCRIPT" ]; then
    python3 "$MONITOR_SCRIPT" health_check
    exit $?
else
    # No monitoring configured, assume healthy
    exit 0
fi