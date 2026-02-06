# Terminal States Detection Guide

Complete reference for detecting and handling different terminal states in Claude Code automation.

## Claude Code States

### 1. Security Prompt State
**Detection pattern:**
```
❯ 1. Yes, I trust this folder
  2. No, exit
```

**Response:**
```bash
osascript -e 'tell application "Terminal" to do script "1" in front window'
osascript -e 'tell application "Terminal" to do script return in front window'
```

### 2. Ready State
**Detection pattern:**
```
Claude Code v2.1.31
▗ ▗   ▖ ▖  Opus 4.5 · Claude Max
           /path/to/project
  ▘▘ ▝▝    [✻] [✻] [✻] · 3 guest passes at /passes
────────────────────────────────────────────────────────
```

**Action:** Ready to receive instructions

### 3. Waiting for Input State
**Detection patterns:**
- `❯` prompt at start of line
- `Enter to confirm`
- `Press any key`
- `(y/N)`

**Response:** Send appropriate input or return

### 4. Working State
**Detection patterns:**
- Scrolling text
- Progress indicators
- File modifications
- `Analyzing...`, `Building...`, `Processing...`

**Action:** Monitor without interruption

### 5. Completion State
**Detection patterns:**
- `✅ Completed`
- `Task finished`
- `Success!`
- Return to command prompt

**Action:** Capture results

### 6. Error State
**Detection patterns:**
- `Error:`, `Failed:`, `Exception:`
- Red text indicators
- Stack traces

**Action:** Implement error recovery

## State Detection Script

```bash
detect_terminal_state() {
    local content=$(osascript -e 'tell application "Terminal" to get contents of selected tab of window 1')
    
    # Security prompt
    if echo "$content" | grep -q "Yes, I trust this folder"; then
        echo "SECURITY_PROMPT"
        return 0
    fi
    
    # Waiting for input
    if echo "$content" | grep -q "❯\|Enter to confirm\|Press any key\|(y/N)"; then
        echo "WAITING_INPUT"
        return 0
    fi
    
    # Error state
    if echo "$content" | grep -iq "error:\|failed:\|exception:"; then
        echo "ERROR"
        return 0
    fi
    
    # Completion
    if echo "$content" | grep -iq "completed\|finished\|success"; then
        echo "COMPLETED"
        return 0
    fi
    
    # Working
    if echo "$content" | grep -iq "analyzing\|building\|processing\|working"; then
        echo "WORKING"
        return 0
    fi
    
    # Ready
    if echo "$content" | grep -q "Claude Code.*Opus"; then
        echo "READY"
        return 0
    fi
    
    echo "UNKNOWN"
    return 1
}
```

## Advanced State Handling

### Timeout Handling
```bash
monitor_with_timeout() {
    local timeout=${1:-300}  # 5 minutes
    local start_time=$(date +%s)
    
    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        if [ $elapsed -gt $timeout ]; then
            echo "TIMEOUT"
            return 1
        fi
        
        local state=$(detect_terminal_state)
        echo "State: $state (${elapsed}s)"
        
        case $state in
            "COMPLETED")
                echo "Task completed successfully"
                return 0
                ;;
            "ERROR")
                echo "Error detected, implementing recovery"
                handle_error
                ;;
            "WAITING_INPUT")
                echo "Handling input prompt"
                handle_input_prompt
                ;;
        esac
        
        sleep 5
    done
}
```

### Error Recovery Patterns
```bash
handle_error() {
    local content=$(osascript -e 'tell application "Terminal" to get contents of selected tab of window 1')
    
    # Try restart if critical error
    if echo "$content" | grep -iq "fatal\|critical\|crashed"; then
        echo "Critical error, restarting..."
        restart_claude_code
        return
    fi
    
    # Try continue if recoverable
    if echo "$content" | grep -iq "warning\|skip"; then
        echo "Recoverable error, continuing..."
        osascript -e 'tell application "Terminal" to do script "continue" in front window'
        osascript -e 'tell application "Terminal" to do script return in front window'
        return
    fi
    
    echo "Unknown error, manual intervention needed"
}
```

## Terminal Content Parsing

### Extract Last Command Output
```bash
get_last_output() {
    local content=$(osascript -e 'tell application "Terminal" to get contents of selected tab of window 1')
    echo "$content" | sed -n '/^❯/,$p' | tail -n +2
}
```

### Extract Progress Information
```bash
extract_progress() {
    local content=$(osascript -e 'tell application "Terminal" to get contents of selected tab of window 1')
    echo "$content" | grep -E '[0-9]+%|[0-9]+/[0-9]+|Step [0-9]+' | tail -1
}
```

### Check for Specific Patterns
```bash
check_pattern() {
    local pattern=$1
    local content=$(osascript -e 'tell application "Terminal" to get contents of selected tab of window 1')
    echo "$content" | grep -q "$pattern"
}
```