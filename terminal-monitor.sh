#!/bin/bash
# Persistent Terminal Monitor for Multi-Agent Claude Code
TERMINALS=(2033 2034 2036)
NAMES=("Agent1-Observation" "Agent2-Synthesis" "Agent3-Execution")

while true; do
    for i in "${!TERMINALS[@]}"; do
        TERM_ID=${TERMINALS[$i]}
        NAME=${NAMES[$i]}
        
        # Get terminal contents
        CONTENT=$(osascript -e "tell application \"Terminal\" to get contents of selected tab of window id $TERM_ID" 2>/dev/null | tail -10)
        
        # Check for permission prompts
        if echo "$CONTENT" | grep -q "Do you want to proceed?"; then
            echo "[$(date)] $NAME: Answering permission prompt with option 2"
            osascript -e "tell application \"Terminal\" to do script \"2\" in window id $TERM_ID"
            osascript -e "tell application \"Terminal\" to do script \"\" in window id $TERM_ID"
        fi
        
        # Check for accept edits prompts
        if echo "$CONTENT" | grep -q "accept edits on"; then
            echo "[$(date)] $NAME: Accepting edits"
            osascript -e "tell application \"Terminal\" to do script \"\" in window id $TERM_ID"
        fi
        
        # Check for greyed suggestions
        if echo "$CONTENT" | grep -q "❯" && ! echo "$CONTENT" | grep -q "Do you want"; then
            echo "[$(date)] $NAME: Accepting suggestion"
            osascript -e "tell application \"Terminal\" to do script \"\" in window id $TERM_ID"
        fi
    done
    
    sleep 30
done
