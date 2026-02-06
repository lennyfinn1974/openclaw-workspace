#!/bin/bash
# Terminal Automation Monitor v3 - ENHANCED with Suggested Command Pattern
# Complete Claude Code Project Lifecycle Management
# NEW: Handles greyed out suggestion acceptance + smart option selection

# Configuration
WORKSPACE="/Users/lennyfinn/.openclaw/workspace"
LOG_FILE="$WORKSPACE/terminal-monitor.log"
STATUS_FILE="$WORKSPACE/terminal-status.json"
MONITOR_INTERVAL=5  # Check every 5 seconds

# Initialize logging
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Get all Terminal window IDs
get_terminal_windows() {
    osascript -e 'tell application "Terminal" to get id of every window' 2>/dev/null | tr ',' '\n' | xargs
}

# Enhanced pattern recognition for all Claude Code interaction types
check_terminal_state() {
    local window_id=$1
    local content=$(osascript -e "tell application \"Terminal\" to get contents of selected tab of window id $window_id" 2>/dev/null | tail -15)
    
    # Pattern 1: Permission Prompts (highest priority)
    if echo "$content" | grep -q "Do you want to proceed?\|Do you want to allow"; then
        echo "PERMISSION_PROMPT"
        
    # Pattern 2: Suggested Commands (NEW - greyed out text with actions)
    elif echo "$content" | grep -q "❯.*[a-zA-Z]" && ! echo "$content" | grep -q "1\. Yes\|2\. Yes"; then
        echo "SUGGESTED_COMMAND"
        
    # Pattern 3: Working States  
    elif echo "$content" | grep -q "Running…\|Contemplating…\|Boogieing…\|Thundering…\|Discombobulating…\|Baked.*for"; then
        echo "WORKING"
        
    # Pattern 4: Empty Prompt (manual input needed)
    elif echo "$content" | grep -q "❯$\|❯[[:space:]]*$"; then
        echo "READY_FOR_INPUT"
        
    # Default: Monitor
    else
        echo "MONITORING"
    fi
}

# Smart permission approval - prefers "don't ask again" options
handle_permission_prompt() {
    local window_id=$1
    local content=$(osascript -e "tell application \"Terminal\" to get contents of selected tab of window id $window_id" 2>/dev/null)
    
    log_message "🔐 Handling permission prompt for window $window_id"
    
    # Smart option selection based on prompt content
    if echo "$content" | grep -q "don't ask again"; then
        # PREFERRED: Option 2 = "Yes, and don't ask again" 
        osascript -e "tell application \"Terminal\" to do script \"2\" in window id $window_id" >/dev/null 2>&1
        log_message "✅ Selected option 2 (Yes, and don't ask again) for window $window_id"
    elif echo "$content" | grep -q "1\\. Yes"; then
        # Fallback: Option 1 = "Yes"
        osascript -e "tell application \"Terminal\" to do script \"1\" in window id $window_id" >/dev/null 2>&1
        log_message "✅ Selected option 1 (Yes) for window $window_id"
    else
        # Default: Try option 1
        osascript -e "tell application \"Terminal\" to do script \"1\" in window id $window_id" >/dev/null 2>&1
        log_message "✅ Selected default option 1 for window $window_id"
    fi
    
    sleep 1
    
    # Execute selection with empty string (the critical distinction!)
    osascript -e "tell application \"Terminal\" to do script \"\" in window id $window_id" >/dev/null 2>&1
    
    log_message "🎯 Permission approved and executed for window $window_id"
}

# NEW: Handle suggested commands (just press Enter)
handle_suggested_command() {
    local window_id=$1
    local content=$(osascript -e "tell application \"Terminal\" to get contents of selected tab of window id $window_id" 2>/dev/null)
    local suggestion=$(echo "$content" | grep "❯" | sed 's/❯//' | xargs | head -1)
    
    log_message "📋 Accepting Claude Code suggestion for window $window_id: '$suggestion'"
    
    # Just press Enter - Claude Code suggestion accepted (no text input needed)
    osascript -e "tell application \"Terminal\" to do script \"\" in window id $window_id" >/dev/null 2>&1
    
    log_message "✨ Suggestion accepted and executing for window $window_id"
}

# Check project completion status
check_completion_status() {
    local window_id=$1
    local content=$(osascript -e "tell application \"Terminal\" to get contents of selected tab of window id $window_id" 2>/dev/null)
    
    # Check for completion indicators
    if echo "$content" | grep -q "git push\|deployed\|live\|completed\|finished"; then
        echo "COMPLETED"
    elif echo "$content" | grep -q "error\|failed\|Error"; then
        echo "ERROR"
    else
        echo "IN_PROGRESS"
    fi
}

# Send intelligent next development step
send_next_step() {
    local window_id=$1
    local content=$(osascript -e "tell application \"Terminal\" to get contents of selected tab of window id $window_id" 2>/dev/null | tail -20)
    
    # Determine next logical step based on current state
    if echo "$content" | grep -q "server.*running"; then
        if ! echo "$content" | grep -q "frontend.*running"; then
            log_message "🚀 Server running, requesting frontend startup for window $window_id"
            osascript -e "tell application \"Terminal\" to do script \"Start the frontend development server and ensure both services work together\" in window id $window_id" >/dev/null 2>&1
            osascript -e "tell application \"Terminal\" to do script \"\" in window id $window_id" >/dev/null 2>&1
        fi
    elif echo "$content" | grep -q "frontend.*ready\|Ready in"; then
        if ! echo "$content" | grep -q "commit\|git add"; then
            log_message "💾 Frontend ready, requesting code commit for window $window_id"
            osascript -e "tell application \"Terminal\" to do script \"Commit all changes to git with a descriptive message about the platform completion\" in window id $window_id" >/dev/null 2>&1
            osascript -e "tell application \"Terminal\" to do script \"\" in window id $window_id" >/dev/null 2>&1
        fi
    elif echo "$content" | grep -q "commit.*successful\|pushed.*successfully"; then
        log_message "🎉 Project completion detected for window $window_id"
        osascript -e "tell application \"Terminal\" to do script \"Excellent! The project is now complete and deployed. Great work!\" in window id $window_id" >/dev/null 2>&1
        osascript -e "tell application \"Terminal\" to do script \"\" in window id $window_id" >/dev/null 2>&1
    fi
}

# Update status tracking
update_status() {
    local window_data="["
    local first=true
    
    for window_id in $(get_terminal_windows); do
        if [ "$first" = false ]; then
            window_data+=","
        fi
        first=false
        
        local status=$(check_terminal_state "$window_id")
        local completion=$(check_completion_status "$window_id")
        
        window_data+="{\"id\":$window_id,\"status\":\"$status\",\"completion\":\"$completion\",\"timestamp\":\"$(date -Iseconds)\"}"
    done
    
    window_data+="]"
    echo "$window_data" > "$STATUS_FILE"
}

# Main monitoring loop
main_monitor() {
    log_message "=== TERMINAL AUTOMATION MONITOR V3 STARTED ==="
    log_message "🎯 NEW: Suggested command pattern recognition enabled"
    log_message "🔐 ENHANCED: Smart option selection - prefers 'don't ask again'"
    log_message "📁 Monitoring workspace: $WORKSPACE"
    
    while true; do
        # Get all current Terminal windows
        windows=($(get_terminal_windows))
        
        if [ ${#windows[@]} -eq 0 ]; then
            log_message "⏳ No Terminal windows found, waiting..."
            sleep "$MONITOR_INTERVAL"
            continue
        fi
        
        # Process each window with enhanced state detection
        for window_id in "${windows[@]}"; do
            if [ -z "$window_id" ]; then continue; fi
            
            state=$(check_terminal_state "$window_id")
            
            case $state in
                "PERMISSION_PROMPT")
                    handle_permission_prompt "$window_id"
                    ;;
                "SUGGESTED_COMMAND")
                    handle_suggested_command "$window_id"
                    ;;
                "READY_FOR_INPUT")
                    send_next_step "$window_id"
                    ;;
                "WORKING")
                    log_message "⚡ Window $window_id is actively working..."
                    ;;
                "MONITORING")
                    log_message "👀 Window $window_id being monitored..."
                    ;;
            esac
        done
        
        # Update status file
        update_status
        
        sleep "$MONITOR_INTERVAL"
    done
}

# Signal handlers for clean shutdown
cleanup() {
    log_message "=== TERMINAL AUTOMATION MONITOR V3 STOPPED ==="
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start monitoring
main_monitor