# 🧵 Quick Reference: tmux + Claude Code

## 🚀 One-Command Setup
```bash
cd project-dir && SOCKET="${TMPDIR:-/tmp}/openclaw-tmux-sockets/claude.sock" && mkdir -p "$(dirname "$SOCKET")" && tmux -S "$SOCKET" new -d -s claude -n code "claude"
```

## ⚡ Send Task
```bash
SOCKET="${TMPDIR:-/tmp}/openclaw-tmux-sockets/claude.sock" && tmux -S "$SOCKET" send-keys -t claude:0.0 -l -- "YOUR TASK HERE" && tmux -S "$SOCKET" send-keys -t claude:0.0 Enter
```

## 🔑 Auto-Approve Permissions
```bash
SOCKET="${TMPDIR:-/tmp}/openclaw-tmux-sockets/claude.sock" && tmux -S "$SOCKET" send-keys -t claude:0.0 "2" && tmux -S "$SOCKET" send-keys -t claude:0.0 Enter
```

## 📸 Capture Results
```bash
SOCKET="${TMPDIR:-/tmp}/openclaw-tmux-sockets/claude.sock" && tmux -S "$SOCKET" capture-pane -p -J -t claude:0.0 -S -50
```

## 👀 Live Monitor
```bash
SOCKET="${TMPDIR:-/tmp}/openclaw-tmux-sockets/claude.sock" && tmux -S "$SOCKET" attach -t claude
```

---

## 💰 Remember: FREE vs EXPENSIVE
- ✅ **tmux + Claude Code** = FREE Max subscription  
- ❌ **Direct API coding** = $$$$ expensive charges

**Always choose tmux delegation for coding tasks!**