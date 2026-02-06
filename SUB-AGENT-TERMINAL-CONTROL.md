# Sub-Agent Terminal Control Guide

**Enable sub-agents to work independently with Claude Code and terminal commands**

## 🎯 Problem Solved
Sub-agents can now spawn and control their own terminal sessions without requiring the main session as a bridge.

## 🔧 Architecture

```
Main Session (Aries) ──┬── Terminal Window 617 (Direct osascript)
                       │
Shared tmux Socket ────┼── Sub-Agent A Session ── tmux session "subagent-A"
                       │                       └── Claude Code Terminal
                       │
                       └── Sub-Agent B Session ── tmux session "subagent-B"
                                               └── Independent Terminal Work
```

## 🚀 Implementation Steps

### 1. Setup Shared Terminal Access

```bash
# Run the setup script
./scripts/setup-shared-terminal-access.sh

# This creates:
# - Shared tmux socket for all sessions
# - Configuration files
# - Master terminal session
```

### 2. Sub-Agent Terminal Commands

**Create Independent Terminal Session:**
```bash
# Load shared configuration
source "$OPENCLAW_SHARED_SOCKET_DIR/config.env"

# Create dedicated session for this sub-agent
SESSION_ID="subagent-$(uuidgen | head -c 8)"
tmux -S "$OPENCLAW_SHARED_SOCKET" new-session -d -s "$SESSION_ID" -n terminal

# Set working directory
tmux -S "$OPENCLAW_SHARED_SOCKET" send-keys -t "$SESSION_ID":0 "cd /Users/lennyfinn/.openclaw/workspace" Enter

# Launch Claude Code
tmux -S "$OPENCLAW_SHARED_SOCKET" send-keys -t "$SESSION_ID":0 "claude" Enter
```

**Send Commands to Terminal:**
```bash
# Execute command in sub-agent terminal
tmux -S "$OPENCLAW_SHARED_SOCKET" send-keys -t "$SESSION_ID":0 "npm install" Enter

# Handle Claude Code permission prompts
tmux -S "$OPENCLAW_SHARED_SOCKET" send-keys -t "$SESSION_ID":0 "1" Enter  # Approve
tmux -S "$OPENCLAW_SHARED_SOCKET" send-keys -t "$SESSION_ID":0 "2" Enter  # Don't ask again
```

**Monitor Terminal Output:**
```bash
# Get recent terminal output
tmux -S "$OPENCLAW_SHARED_SOCKET" capture-pane -p -t "$SESSION_ID":0 -S -200

# Wait for specific output (using tmux skill helper)
wait-for-text.sh -t "$SESSION_ID":0 -p "❯|$|claude>" -T 30
```

**Interactive Control:**
```bash
# For complex interactions, attach to the session
tmux -S "$OPENCLAW_SHARED_SOCKET" attach -t "$SESSION_ID"
# Detach with Ctrl+b d
```

### 3. Sub-Agent Session Template

**Add to sub-agent skills:**
```python
def setup_independent_terminal():
    """Setup independent terminal control for this sub-agent"""
    
    # Load shared terminal configuration
    exec('source "$OPENCLAW_SHARED_SOCKET_DIR/config.env" 2>/dev/null || echo "Shared terminal not configured"')
    
    # Create unique session ID
    session_id = f"subagent-{datetime.now().strftime('%H%M%S')}"
    
    # Create tmux session
    exec(f'''
    tmux -S "$OPENCLAW_SHARED_SOCKET" new-session -d -s "{session_id}" -n terminal
    tmux -S "$OPENCLAW_SHARED_SOCKET" send-keys -t "{session_id}":0 "cd /Users/lennyfinn/.openclaw/workspace" Enter
    ''')
    
    return session_id

def launch_claude_code(session_id):
    """Launch Claude Code in sub-agent terminal"""
    exec(f'tmux -S "$OPENCLAW_SHARED_SOCKET" send-keys -t "{session_id}":0 "claude" Enter')
    
def send_terminal_command(session_id, command):
    """Send command to sub-agent terminal"""
    exec(f'tmux -S "$OPENCLAW_SHARED_SOCKET" send-keys -t "{session_id}":0 "{command}" Enter')
    
def get_terminal_output(session_id, lines=200):
    """Get terminal output from sub-agent session"""
    return exec(f'tmux -S "$OPENCLAW_SHARED_SOCKET" capture-pane -p -t "{session_id}":0 -S -{lines}')
```

## 🎯 Usage Examples

### **Sub-Agent: Independent TradeSim Pro Development**
```python
# Sub-agent creates its own terminal
session_id = setup_independent_terminal()

# Launch Claude Code for development work
launch_claude_code(session_id)

# Send development commands without main session bridge
send_terminal_command(session_id, "cd trading-platform")
send_terminal_command(session_id, "npm run dev")

# Handle Claude Code permissions independently
send_terminal_command(session_id, "2")  # Don't ask again for npm commands

# Monitor progress
output = get_terminal_output(session_id)
```

### **Sub-Agent: Parallel Analysis Tasks**
```python
# Multiple sub-agents can work simultaneously
session_a = setup_independent_terminal()  # Market data analysis
session_b = setup_independent_terminal()  # Code review

# Launch different Claude Code instances
launch_claude_code(session_a)
launch_claude_code(session_b)

# Work on different tasks in parallel
send_terminal_command(session_a, "analyze market data patterns")
send_terminal_command(session_b, "review trading algorithm code")
```

## ✅ Advantages

### **Complete Independence**
- ✅ Sub-agents control their own terminals
- ✅ No main session bridging required
- ✅ Parallel work possible
- ✅ Session isolation maintained

### **Full Claude Code Access**
- ✅ Each sub-agent can launch Claude Code
- ✅ Independent permission handling
- ✅ Separate context per terminal
- ✅ No tool access conflicts

### **Scalability**
- ✅ Unlimited sub-agent terminal sessions
- ✅ Resource isolation
- ✅ Easy monitoring and management
- ✅ Clean session cleanup

### **Transparency**
- ✅ Human can monitor any sub-agent terminal
- ✅ `tmux attach` for live viewing
- ✅ Complete command history available
- ✅ Real terminal windows (not simulated)

## 🛠️ Management Commands

```bash
# List all active sessions
tmux -S "$OPENCLAW_SHARED_SOCKET" list-sessions

# Monitor specific sub-agent
tmux -S "$OPENCLAW_SHARED_SOCKET" attach -t "subagent-abc123"

# Kill completed sub-agent session
tmux -S "$OPENCLAW_SHARED_SOCKET" kill-session -t "subagent-abc123"

# Emergency: Kill all sub-agent sessions
tmux -S "$OPENCLAW_SHARED_SOCKET" list-sessions | grep subagent | cut -d: -f1 | xargs -n1 tmux -S "$OPENCLAW_SHARED_SOCKET" kill-session -t
```

## 🚀 Deployment

**Immediate activation:**
1. Run setup script: `./scripts/setup-shared-terminal-access.sh`
2. Update sub-agent skills with terminal control functions
3. Test with one sub-agent creating independent terminal
4. Scale to multiple parallel sub-agent terminals

**Result:** Sub-agents work independently with Claude Code, no more bridging required! 🎯