#!/bin/bash
# Setup shared terminal access for sub-agents
# Enables sub-agents to control their own terminal sessions without bridging

set -e

# Shared socket configuration
SOCKET_DIR="${OPENCLAW_TMUX_SOCKET_DIR:-${TMPDIR:-/tmp}/openclaw-shared-terminals}"
mkdir -p "$SOCKET_DIR"
SHARED_SOCKET="$SOCKET_DIR/shared.sock"

echo "🧵 Setting up shared terminal access..."
echo "Socket: $SHARED_SOCKET"

# Create shared tmux socket if it doesn't exist
if ! tmux -S "$SHARED_SOCKET" list-sessions &>/dev/null; then
    echo "Creating shared tmux socket..."
    # Create initial session (will be the master session)
    tmux -S "$SHARED_SOCKET" new-session -d -s master -n main
    echo "Master session created."
fi

# Function to create sub-agent terminal session
create_subagent_session() {
    local session_id="$1"
    local workspace_path="$2"
    
    echo "Creating sub-agent terminal session: $session_id"
    
    # Create dedicated session for this sub-agent
    tmux -S "$SHARED_SOCKET" new-session -d -s "subagent-$session_id" -n terminal
    
    # Set working directory
    tmux -S "$SHARED_SOCKET" send-keys -t "subagent-$session_id":0 "cd $workspace_path" Enter
    
    # Optional: Start Claude Code in the session
    # tmux -S "$SHARED_SOCKET" send-keys -t "subagent-$session_id":0 "claude" Enter
    
    echo "Sub-agent session ready: subagent-$session_id"
    echo "Monitor: tmux -S '$SHARED_SOCKET' attach -t 'subagent-$session_id'"
}

# Export configuration for OpenClaw sessions
cat > "$SOCKET_DIR/config.env" << EOF
# Shared terminal configuration for OpenClaw sub-agents
export OPENCLAW_SHARED_SOCKET="$SHARED_SOCKET"
export OPENCLAW_SHARED_SOCKET_DIR="$SOCKET_DIR"

# Usage in sub-agent sessions:
# tmux -S "\$OPENCLAW_SHARED_SOCKET" new-session -d -s "my-session"
# tmux -S "\$OPENCLAW_SHARED_SOCKET" send-keys -t "my-session" "command" Enter
# tmux -S "\$OPENCLAW_SHARED_SOCKET" capture-pane -p -t "my-session" -S -200
EOF

echo ""
echo "✅ Shared terminal access configured!"
echo "Config file: $SOCKET_DIR/config.env"
echo ""
echo "Sub-agents can now create independent terminal sessions:"
echo "  tmux -S '$SHARED_SOCKET' new-session -d -s 'subagent-xyz'"
echo "  tmux -S '$SHARED_SOCKET' send-keys -t 'subagent-xyz' 'claude' Enter"
echo ""
echo "Monitor all sessions:"
echo "  tmux -S '$SHARED_SOCKET' list-sessions"
echo "  tmux -S '$SHARED_SOCKET' attach -t 'session-name'"