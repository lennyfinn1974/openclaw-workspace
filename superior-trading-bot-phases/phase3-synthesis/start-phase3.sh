#!/bin/bash
# Phase 3: Strategy Synthesis & Paper Trading — Start Script
# Run this from a regular terminal (not inside Claude Code)
#
# Usage:
#   ./start-phase3.sh          # foreground (Ctrl+C to stop)
#   ./start-phase3.sh --bg     # background with auto-restart

cd "$(dirname "$0")"

LOGFILE="/tmp/phase3.log"
PIDFILE="/tmp/phase3.pid"

stop_phase3() {
  if [ -f "$PIDFILE" ]; then
    PID=$(cat "$PIDFILE")
    if kill -0 "$PID" 2>/dev/null; then
      echo "[Phase3] Stopping PID $PID..."
      kill "$PID"
      rm -f "$PIDFILE"
    fi
  fi
  # Also kill anything on port 9003
  lsof -ti:9003 2>/dev/null | xargs kill 2>/dev/null
}

if [ "$1" = "--stop" ]; then
  stop_phase3
  echo "[Phase3] Stopped."
  exit 0
fi

# Clean up any stale process
stop_phase3
sleep 1

if [ "$1" = "--bg" ]; then
  echo "[Phase3] Starting in background..."
  echo "[Phase3] Log: $LOGFILE"
  nohup npx tsx src/index.ts >> "$LOGFILE" 2>&1 &
  echo $! > "$PIDFILE"
  echo "[Phase3] PID: $(cat $PIDFILE)"
  echo "[Phase3] Stop with: $0 --stop"
  echo "[Phase3] Logs with: tail -f $LOGFILE"
else
  echo "[Phase3] Starting in foreground (Ctrl+C to stop)..."
  echo "[Phase3] Dashboard: http://localhost:9003"
  echo "[Phase3] Arena: http://localhost:8101"
  echo ""
  npx tsx src/index.ts
fi
