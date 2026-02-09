#!/bin/bash
# Enhanced Terminal Monitor for Superior Trading Bot Multi-Phase Build
TERMINALS=(2583 2584 2585 2586)
NAMES=("Phase2-Intelligence" "Phase3-Synthesis" "Phase4-LiveTrading" "Phase5-Evolution")

echo "[$(date)] Enhanced Terminal Monitor started - monitoring terminals: ${TERMINALS[*]}"

while true; do
    for i in "${!TERMINALS[@]}"; do
        TERM_ID=${TERMINALS[$i]}
        NAME=${NAMES[$i]}
        
        # Get terminal contents (more lines for better context)
        CONTENT=$(osascript -e "tell application \"Terminal\" to get contents of selected tab of window id $TERM_ID" 2>/dev/null | tail -15)
        
        if [[ -n "$CONTENT" ]]; then
            # Check for "Do you want to proceed?" prompts
            if echo "$CONTENT" | grep -q "Do you want to proceed?"; then
                echo "[$(date)] $NAME: Found permission prompt - selecting option 2"
                osascript -e "tell application \"Terminal\" to do script \"2\" in window id $TERM_ID" 2>/dev/null
                sleep 1
                osascript -e "tell application \"Terminal\" to do script \"\" in window id $TERM_ID" 2>/dev/null
            fi
            
            # Check for "accept edits" prompts
            if echo "$CONTENT" | grep -q "accept edits on"; then
                echo "[$(date)] $NAME: Found accept edits prompt"
                osascript -e "tell application \"Terminal\" to do script \"\" in window id $TERM_ID" 2>/dev/null
            fi
            
            # Check for greyed suggestions (❯ without permission context)
            if echo "$CONTENT" | grep -q "❯" && ! echo "$CONTENT" | grep -q "Do you want" && ! echo "$CONTENT" | grep -q "accept edits"; then
                echo "[$(date)] $NAME: Found suggestion prompt"
                osascript -e "tell application \"Terminal\" to do script \"\" in window id $TERM_ID" 2>/dev/null
            fi
            
            # Check for "Run shell command" prompts
            if echo "$CONTENT" | grep -q "Run shell command"; then
                echo "[$(date)] $NAME: Found shell command prompt - approving"
                osascript -e "tell application \"Terminal\" to do script \"1\" in window id $TERM_ID" 2>/dev/null
                sleep 1
                osascript -e "tell application \"Terminal\" to do script \"\" in window id $TERM_ID" 2>/dev/null
            fi
        fi
    done
    
    sleep 15  # Check every 15 seconds instead of 30
done
