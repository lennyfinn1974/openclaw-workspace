#!/bin/bash
# 🚀 SUPERIOR TRADING BOT - Complete Build Monitor
# Tracks 4 Claude Code agents building Phases 2-5 in parallel

TERMINALS=(2583 2584 2585 2586)
PHASES=("Phase2-Intelligence" "Phase3-Synthesis" "Phase4-LiveTrading" "Phase5-Evolution")
STATUS_FILE="superior-bot-status.json"
COMPLETION_FILE="superior-bot-completion.log"

# Initialize status tracking
init_status() {
    cat > "$STATUS_FILE" << EOF
{
    "lastUpdate": "$(date -Iseconds)",
    "phases": {
        "phase2": {"id": 2583, "name": "Intelligence", "status": "active", "progress": 0, "lastActivity": "$(date -Iseconds)"},
        "phase3": {"id": 2584, "name": "Synthesis", "status": "active", "progress": 0, "lastActivity": "$(date -Iseconds)"},
        "phase4": {"id": 2585, "name": "Live Trading", "status": "active", "progress": 0, "lastActivity": "$(date -Iseconds)"},
        "phase5": {"id": 2586, "name": "Evolution", "status": "active", "progress": 0, "lastActivity": "$(date -Iseconds)"}
    },
    "completedPhases": 0,
    "totalPhases": 4
}
EOF
}

# Check completion indicators
check_completion() {
    local phase_id=$1
    local phase_name=$2
    local content="$3"
    
    # Look for definitive completion patterns (more specific)
    if echo "$content" | grep -qi "phase.*completed\|build.*completed\|all.*done\|implementation.*complete\|✅.*complete"; then
        # Also check if files were actually created
        local phase_dir=""
        case $phase_name in
            *"Intelligence"*) phase_dir="phase2-intelligence" ;;
            *"Synthesis"*) phase_dir="phase3-synthesis" ;;
            *"LiveTrading"*) phase_dir="phase4-live-trading" ;;
            *"Evolution"*) phase_dir="phase5-evolution" ;;
        esac
        
        local file_count=$(find superior-trading-bot-phases/$phase_dir/ -type f 2>/dev/null | wc -l)
        if [ $file_count -gt 0 ]; then
            echo "[$(date)] 🎉 $phase_name COMPLETED! ($file_count files created)"
            return 0
        else
            echo "[$(date)] 🔍 $phase_name: Completion indicator seen but no files created yet"
            return 1
        fi
    fi
    
    # Look for error patterns
    if echo "$content" | grep -qi "error\|failed\|❌"; then
        echo "[$(date)] ⚠️ $phase_name ERROR DETECTED!"
        return 2
    fi
    
    return 1
}

# Monitor single phase
monitor_phase() {
    local i=$1
    local term_id=${TERMINALS[$i]}
    local phase_name=${PHASES[$i]}
    
    echo "🔍 Monitoring $phase_name (Terminal $term_id)..."
    
    # Get terminal contents
    CONTENT=$(osascript -e "tell application \"Terminal\" to get contents of selected tab of window id $term_id" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        # Check for activity patterns
        if echo "$CONTENT" | grep -q "tool use\|tokens\|Bash\|Read\|Write"; then
            echo "  ✅ $phase_name: ACTIVE - Building/Working"
        elif echo "$CONTENT" | grep -q "Waiting\|Initializing"; then
            echo "  ⏳ $phase_name: INITIALIZING"
        elif echo "$CONTENT" | grep -q "Do you want to proceed"; then
            echo "  🤖 $phase_name: AWAITING PERMISSION (auto-handled)"
        else
            echo "  ❓ $phase_name: STATUS UNCLEAR"
        fi
        
        # Check completion
        check_completion "$term_id" "$phase_name" "$CONTENT"
        completion_status=$?
        
        # Log to completion file if complete
        if [ $completion_status -eq 0 ]; then
            echo "$(date -Iseconds): $phase_name COMPLETED" >> "$COMPLETION_FILE"
        fi
        
        # Show last few lines for context
        echo "$CONTENT" | tail -3 | sed "s/^/    /"
        
    else
        echo "  ❌ $phase_name: TERMINAL NOT ACCESSIBLE"
    fi
    echo
}

# Check directory progress
check_directory_progress() {
    echo "📁 Checking phase directories for file creation..."
    for phase in phase2-intelligence phase3-synthesis phase4-live-trading phase5-evolution; do
        file_count=$(find superior-trading-bot-phases/$phase/ -type f 2>/dev/null | wc -l)
        echo "  📂 $phase: $file_count files created"
    done
    echo
}

# Main monitoring function
run_monitor_cycle() {
    echo "🚀 SUPERIOR TRADING BOT - MONITORING CYCLE $(date)"
    echo "=" | tr ' ' '=' | head -c 80; echo
    
    # Check if base monitoring is still running
    if ! pgrep -f "multi-phase-terminal-monitor.sh" > /dev/null; then
        echo "⚠️  WARNING: Base monitoring script not running!"
    fi
    
    # Monitor each phase
    for i in "${!TERMINALS[@]}"; do
        monitor_phase $i
    done
    
    # Check directory progress
    check_directory_progress
    
    # Check completion count
    completed_count=$(grep -c "COMPLETED" "$COMPLETION_FILE" 2>/dev/null || echo 0)
    echo "🎯 COMPLETION STATUS: $completed_count/4 phases completed"
    
    if [ $completed_count -eq 4 ]; then
        echo "🎉🎉🎉 ALL PHASES COMPLETED! Meta-Cognitive Trading System is READY! 🎉🎉🎉"
    fi
    
    echo "=" | tr ' ' '=' | head -c 80; echo
    echo "Next check in 3 minutes..."
    echo
}

# Initialize if first run
if [ ! -f "$STATUS_FILE" ]; then
    init_status
fi

# Run monitoring cycle
run_monitor_cycle

# Schedule next check in 3 minutes if not running in loop mode
if [ "$1" != "--loop" ]; then
    echo "Setting up next 3-minute check..."
    (sleep 180 && bash "$0" --loop) &
fi

# If in loop mode, run continuously
if [ "$1" = "--loop" ]; then
    while true; do
        sleep 180  # 3 minutes
        run_monitor_cycle
        
        # Check if all phases are complete
        completed_count=$(grep -c "COMPLETED" "$COMPLETION_FILE" 2>/dev/null || echo 0)
        if [ $completed_count -eq 4 ]; then
            echo "🎉 All phases completed! Monitoring complete."
            break
        fi
    done
fi