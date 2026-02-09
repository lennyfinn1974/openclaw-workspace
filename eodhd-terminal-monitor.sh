#!/bin/bash
# EODHD Integration CC Terminal Monitor

echo "[$(date)] EODHD Terminal Monitor started - monitoring for prompts"

while true; do
    # Check for active Claude processes and their terminal sessions
    CLAUDE_PIDS=$(ps aux | grep 'claude$' | grep -v grep | awk '{print $2}' | head -4)
    
    for PID in $CLAUDE_PIDS; do
        # Get TTY for this Claude process
        TTY=$(lsof -p $PID 2>/dev/null | grep 'CHR.*tty' | head -1 | awk '{print $9}' | cut -d'/' -f3)
        
        if [[ -n "$TTY" ]]; then
            # Check for EODHD-related work or prompts
            CONTENT=$(script -q /dev/null timeout 2 cat /dev/$TTY 2>/dev/null | tail -20)
            
            # Look for common CC prompts related to EODHD
            if echo "$CONTENT" | grep -q -E "(Do you want to proceed|Apply this edit|EODHD|WebSocket|market data|trading.*error|connection.*failed)"; then
                echo "[$(date)] FOUND EODHD-related prompt in $TTY (PID $PID)"
                echo "$CONTENT" | tail -10
                echo "---"
            fi
        fi
    done
    
    sleep 5
done
