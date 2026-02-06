---
name: subagent-terminal
description: Enable sub-agents to control independent terminal sessions and Claude Code without main session bridging
metadata:
  { "openclaw": { "emoji": "🧵", "requires": { "bins": ["tmux"] } } }
---

# Sub-Agent Terminal Control Skill

**Give sub-agents independent terminal access for Claude Code and command execution**

## Quick Start

### 1. Setup (Run Once)
```bash
# Initialize shared terminal system
./scripts/setup-shared-terminal-access.sh
```

### 2. Create Independent Terminal Session
```bash
# Load shared configuration
OPENCLAW_SHARED_SOCKET="/var/folders/7r/8q0lsrwd4gzbq5tsdqj_qgxc0000gn/T//openclaw-shared-terminals/shared.sock"

# Create unique session for this sub-agent
SESSION_ID="subagent-$(date +%H%M%S)"
tmux -S "$OPENCLAW_SHARED_SOCKET" new-session -d -s "$SESSION_ID" -n terminal

# Set working directory
tmux -S "$OPENCLAW_SHARED_SOCKET" send-keys -t "$SESSION_ID":0 "cd /Users/lennyfinn/.openclaw/workspace" Enter
```

### 3. Launch Claude Code
```bash
# Start Claude Code in sub-agent terminal
tmux -S "$OPENCLAW_SHARED_SOCKET" send-keys -t "$SESSION_ID":0 "claude" Enter
```

### 4. Send Commands & Handle Permissions
```bash
# Execute development commands
tmux -S "$OPENCLAW_SHARED_SOCKET" send-keys -t "$SESSION_ID":0 "npm install" Enter

# Handle Claude Code permission prompts
tmux -S "$OPENCLAW_SHARED_SOCKET" send-keys -t "$SESSION_ID":0 "1" Enter  # Yes
tmux -S "$OPENCLAW_SHARED_SOCKET" send-keys -t "$SESSION_ID":0 "2" Enter  # Don't ask again

# Send complex tasks
tmux -S "$OPENCLAW_SHARED_SOCKET" send-keys -t "$SESSION_ID":0 "Fix the WebSocket connection in TradeSim Pro" Enter
```

### 5. Monitor Progress
```bash
# Get terminal output
tmux -S "$OPENCLAW_SHARED_SOCKET" capture-pane -p -t "$SESSION_ID":0 -S -200

# Check if task completed (look for shell prompt)
tmux -S "$OPENCLAW_SHARED_SOCKET" capture-pane -p -t "$SESSION_ID":0 -S -3 | grep -E "❯|%|$"
```

## Essential Commands

### Session Management
```bash
# List all sessions
tmux -S "$OPENCLAW_SHARED_SOCKET" list-sessions

# Kill completed session
tmux -S "$OPENCLAW_SHARED_SOCKET" kill-session -t "$SESSION_ID"

# Monitor live (human can attach)
tmux -S "$OPENCLAW_SHARED_SOCKET" attach -t "$SESSION_ID"
# Detach: Ctrl+b d
```

### Claude Code Workflows
```bash
# Common permission responses
echo "1" | tmux -S "$OPENCLAW_SHARED_SOCKET" send-keys -t "$SESSION_ID":0  # Approve
echo "2" | tmux -S "$OPENCLAW_SHARED_SOCKET" send-keys -t "$SESSION_ID":0  # Don't ask again
echo "3" | tmux -S "$OPENCLAW_SHARED_SOCKET" send-keys -t "$SESSION_ID":0  # Reject

# Interrupt Claude Code if needed
tmux -S "$OPENCLAW_SHARED_SOCKET" send-keys -t "$SESSION_ID":0 C-c
```

## Complete Example: Independent TradeSim Pro Development

```bash
#!/bin/bash
# Sub-agent: Independent TradeSim Pro WebSocket fix

# 1. Setup
OPENCLAW_SHARED_SOCKET="/var/folders/7r/8q0lsrwd4gzbq5tsdqj_qgxc0000gn/T//openclaw-shared-terminals/shared.sock"
SESSION_ID="websocket-fix-$(date +%H%M%S)"

# 2. Create session
tmux -S "$OPENCLAW_SHARED_SOCKET" new-session -d -s "$SESSION_ID" -n terminal
tmux -S "$OPENCLAW_SHARED_SOCKET" send-keys -t "$SESSION_ID":0 "cd /Users/lennyfinn/.openclaw/workspace/trading-platform" Enter

# 3. Launch Claude Code
tmux -S "$OPENCLAW_SHARED_SOCKET" send-keys -t "$SESSION_ID":0 "claude" Enter
sleep 2

# 4. Send development task
tmux -S "$OPENCLAW_SHARED_SOCKET" send-keys -t "$SESSION_ID":0 "Analyze and fix the WebSocket connection issues in the React trading platform" Enter
sleep 1

# 5. Handle permissions automatically
tmux -S "$OPENCLAW_SHARED_SOCKET" send-keys -t "$SESSION_ID":0 "2" Enter  # Don't ask again
sleep 5

# 6. Monitor progress
echo "=== Task Progress ==="
tmux -S "$OPENCLAW_SHARED_SOCKET" capture-pane -p -t "$SESSION_ID":0 -S -50

# 7. Human can monitor live
echo "Monitor live: tmux -S '$OPENCLAW_SHARED_SOCKET' attach -t '$SESSION_ID'"
```

## Benefits

✅ **Complete Independence** - No main session bridging required  
✅ **Parallel Execution** - Multiple sub-agents work simultaneously  
✅ **Full Claude Code Access** - Each sub-agent controls its own Claude Code instance  
✅ **Human Transparency** - Monitor any sub-agent terminal with `tmux attach`  
✅ **Resource Isolation** - Sessions don't interfere with each other  
✅ **Cost Effective** - Uses Claude Max subscription, not expensive API calls  

## Troubleshooting

**Session not found:**
```bash
# Check active sessions
tmux -S "$OPENCLAW_SHARED_SOCKET" list-sessions
```

**Permission prompts stuck:**
```bash
# Send interrupt
tmux -S "$OPENCLAW_SHARED_SOCKET" send-keys -t "$SESSION_ID":0 C-c
# Restart Claude Code
tmux -S "$OPENCLAW_SHARED_SOCKET" send-keys -t "$SESSION_ID":0 "claude" Enter
```

**Emergency cleanup:**
```bash
# Kill all sub-agent sessions
tmux -S "$OPENCLAW_SHARED_SOCKET" list-sessions | grep subagent | cut -d: -f1 | \
  xargs -n1 tmux -S "$OPENCLAW_SHARED_SOCKET" kill-session -t
```

---

**Result:** Sub-agents now work independently with Claude Code terminals! 🚀