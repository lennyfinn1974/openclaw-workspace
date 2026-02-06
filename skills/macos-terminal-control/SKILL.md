---
name: macos-terminal-control
description: Control macOS Terminal and Claude Code via osascript automation. Use for autonomous terminal operations, Claude Code interaction, visible terminal windows, command execution, prompt handling, and progress monitoring. Essential for breakthrough terminal automation without manual intervention.
---

# MacOS Terminal Control & Claude Code Automation

Complete automation system for controlling macOS Terminal and Claude Code sessions via osascript commands.

## Core Breakthrough Methods

### 1. Visible Terminal Window Creation

**Always use visible terminals** for transparency and user trust:

```bash
osascript -e 'tell application "Terminal" to do script "cd /path && echo \"Project Ready\" && claude"'
```

**Returns:** `tab 1 of window id 941` (use this ID for future commands)

### 2. Command Execution in Active Terminal

**Send commands to active terminal:**
```bash
osascript -e 'tell application "Terminal" to do script "command here" in front window'
```

**Send Enter/Return to execute commands:**
```bash
osascript -e 'tell application "Terminal" to do script return in front window'
```

### 3. Terminal Content Monitoring

**Read current terminal contents:**
```bash
osascript -e 'tell application "Terminal" to get contents of selected tab of window 1'
```

**Monitor last N lines:**
```bash
osascript -e 'tell application "Terminal" to get contents of selected tab of window 1' | tail -10
```

### 4. Claude Code Interaction Patterns

#### Starting Claude Code
```bash
# Basic startup
osascript -e 'tell application "Terminal" to do script "cd /project && claude"'

# With project context
osascript -e 'tell application "Terminal" to do script "cd /project && claude --project ."'
```

#### Security Prompt Handling
When Claude Code shows security prompt:
```
❯ 1. Yes, I trust this folder
  2. No, exit
```

**Response sequence:**
```bash
# Send option 1
osascript -e 'tell application "Terminal" to do script "1" in front window'

# Send Enter to confirm
osascript -e 'tell application "Terminal" to do script return in front window'
```

#### Sending Instructions to Claude Code
```bash
# Multi-line instructions
osascript -e 'tell application "Terminal" to do script "Analyze codebase, fix security issues, implement new features. Create comprehensive plan and execute." in front window'

# Execute with Enter
osascript -e 'tell application "Terminal" to do script return in front window'
```

## 🎯 GREYED OUT SUGGESTIONS (CRITICAL BREAKTHROUGH)

### Pattern Recognition & Acceptance
```bash
# Detect greyed out suggestions at bottom of Claude Code
osascript -e 'tell application "Terminal" to get contents of selected tab of window 1' | grep "⎿.*"

# Example output:
# "⎿   Design a comprehensive implementation plan for Nexus-OpenClaw bidirectional communication..."

# Automatic acceptance (just press Enter):
osascript -e 'tell application "Terminal" to do script return in front window'
```

**Critical Discovery:** Greyed suggestions are ACCEPTED by pressing Enter, not typed commands.

## Advanced Automation Patterns

### Full Autonomous Workflow

```bash
# 1. Create visible terminal
WINDOW_ID=$(osascript -e 'tell application "Terminal" to do script "cd /project && claude"')

# 2. Wait for Claude Code to start
sleep 3

# 3. Handle security prompt
osascript -e 'tell application "Terminal" to do script "1" in front window'
osascript -e 'tell application "Terminal" to do script return in front window'

# 4. Send comprehensive instructions
osascript -e 'tell application "Terminal" to do script "Your detailed project instructions here" in front window'

# 5. Execute
osascript -e 'tell application "Terminal" to do script return in front window'

# 6. Monitor progress
while true; do
  sleep 10
  osascript -e 'tell application "Terminal" to get contents of selected tab of window 1' | tail -5
done
```

### Progress Monitoring Loop

```bash
# Continuous monitoring with status updates
check_progress() {
  local content=$(osascript -e 'tell application "Terminal" to get contents of selected tab of window 1')
  
  # Check for completion indicators
  if echo "$content" | grep -q "completed\|finished\|done"; then
    echo "✅ Claude Code task completed"
    return 0
  fi
  
  # Check for prompts requiring response
  if echo "$content" | grep -q "❯\|Enter\|confirm"; then
    echo "⚠️ Claude Code waiting for input"
    return 1
  fi
  
  return 2  # Still working
}
```

## Error Handling & Recovery

### Common Issues and Solutions

**Issue:** Terminal stuck on security prompt
```bash
# Solution: Double confirm
osascript -e 'tell application "Terminal" to do script "1" in front window'
sleep 1
osascript -e 'tell application "Terminal" to do script return in front window'
```

**Issue:** Claude Code not responding
```bash
# Solution: Fresh terminal
osascript -e 'tell application "Terminal" to do script "cd /project && claude --reset"'
```

**Issue:** Long instructions truncated
```bash
# Solution: Break into smaller chunks
osascript -e 'tell application "Terminal" to do script "Part 1: Analyze codebase" in front window'
osascript -e 'tell application "Terminal" to do script return in front window'
sleep 5
osascript -e 'tell application "Terminal" to do script "Part 2: Implement fixes" in front window'
osascript -e 'tell application "Terminal" to do script return in front window'
```

## Production Automation Script

See `scripts/autonomous_terminal.sh` for complete automation implementation.

## Advanced References

- **Terminal States**: See `references/terminal-states.md` for complete state detection
- **Claude Code Prompts**: See `references/claude-prompts.md` for effective instruction patterns
- **Error Recovery**: See `references/error-handling.md` for troubleshooting guide

## Success Criteria

✅ Terminal window visible to user  
✅ Commands execute without manual intervention  
✅ Claude Code responds to complex instructions  
✅ Progress monitoring automated  
✅ Error recovery handled automatically  

**Critical:** Always use visible terminals for transparency and trust!