#!/bin/bash
# Autonomous Terminal Control Script
# Complete automation for Claude Code development workflows

set -e

# Configuration
PROJECT_PATH=${1:-$(pwd)}
TASK_DESCRIPTION=${2:-"Analyze and improve codebase"}
TIMEOUT=${3:-300}  # 5 minutes default

echo "🚀 Starting Autonomous Terminal Session"
echo "Project: $PROJECT_PATH"
echo "Task: $TASK_DESCRIPTION"
echo "Timeout: ${TIMEOUT}s"

# Function: Create visible terminal
create_terminal() {
    local cmd="cd '$PROJECT_PATH' && echo '🎯 Claude Code Ready' && claude"
    local window_id=$(osascript -e "tell application \"Terminal\" to do script \"$cmd\"")
    echo "✅ Terminal created: $window_id"
    echo "$window_id" > /tmp/terminal_id.tmp
    sleep 3
}

# Function: Handle security prompt
handle_security() {
    echo "🔒 Handling security prompt..."
    osascript -e 'tell application "Terminal" to do script "1" in front window'
    sleep 1
    osascript -e 'tell application "Terminal" to do script return in front window'
    sleep 2
}

# Function: Send task instructions
send_instructions() {
    echo "📤 Sending instructions..."
    osascript -e "tell application \"Terminal\" to do script \"$TASK_DESCRIPTION\" in front window"
    sleep 1
    osascript -e 'tell application "Terminal" to do script return in front window'
}

# Function: Monitor progress
monitor_progress() {
    local start_time=$(date +%s)
    local last_content=""
    
    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        # Check timeout
        if [ $elapsed -gt $TIMEOUT ]; then
            echo "⏰ Timeout reached (${TIMEOUT}s)"
            break
        fi
        
        # Get terminal content
        local content=$(osascript -e 'tell application "Terminal" to get contents of selected tab of window 1' 2>/dev/null || echo "")
        
        # Check if content changed (indicating activity)
        if [ "$content" != "$last_content" ]; then
            echo "📊 Progress detected (${elapsed}s elapsed)"
            last_content="$content"
        fi
        
        # Check for completion indicators
        if echo "$content" | grep -iq "completed\|finished\|done\|success"; then
            echo "✅ Task completed successfully!"
            break
        fi
        
        # Check for prompts requiring response
        if echo "$content" | grep -q "❯.*Enter\|confirm\|approve"; then
            echo "🤖 Auto-approving prompt..."
            osascript -e 'tell application "Terminal" to do script return in front window'
            sleep 2
        fi
        
        sleep 5
    done
}

# Function: Get final results
get_results() {
    echo "📋 Getting final results..."
    local content=$(osascript -e 'tell application "Terminal" to get contents of selected tab of window 1')
    echo "Final terminal state:"
    echo "$content" | tail -20
}

# Main execution
main() {
    create_terminal
    handle_security
    send_instructions
    monitor_progress
    get_results
    
    echo "🎉 Autonomous terminal session complete!"
    
    # Cleanup
    rm -f /tmp/terminal_id.tmp
}

# Execute if run directly
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi