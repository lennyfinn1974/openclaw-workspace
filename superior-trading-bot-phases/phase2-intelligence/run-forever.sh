#!/bin/bash
# Phase 2 Intelligence — Auto-restart wrapper
# Keeps the process alive, restarts on crash/kill with backoff

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

LOG="/tmp/phase2.log"
PID_FILE="/tmp/phase2.pid"
MAX_RESTARTS=50
RESTART_DELAY=3
restart_count=0

# Trap signals so wrapper itself ignores SIGHUP and handles SIGTERM gracefully
trap '' SIGHUP
trap 'echo "[Wrapper] SIGINT — shutting down"; kill $child_pid 2>/dev/null; rm -f "$PID_FILE"; exit 0' SIGINT
trap 'echo "[Wrapper] SIGTERM — shutting down"; kill $child_pid 2>/dev/null; rm -f "$PID_FILE"; exit 0' SIGTERM

# Ensure deps are ready (one-time)
if [ ! -d node_modules ]; then
  echo "[Wrapper] Installing Node dependencies..."
  npm install
fi
if [ ! -d venv ]; then
  echo "[Wrapper] Setting up Python venv..."
  python3 -m venv venv
  source venv/bin/activate
  pip install -q -r requirements.txt 2>/dev/null
else
  source venv/bin/activate
fi
if [ ! -d dist ]; then
  echo "[Wrapper] Building TypeScript..."
  npx tsc 2>/dev/null
fi

echo "[Wrapper] Phase 2 auto-restart wrapper started (max $MAX_RESTARTS restarts)"
echo "[Wrapper] Log: $LOG"
echo ""

while [ $restart_count -lt $MAX_RESTARTS ]; do
  echo "[Wrapper] Starting Phase 2 Intelligence (attempt $((restart_count + 1)))..." | tee -a "$LOG"

  PYTHON_PATH="$DIR/venv/bin/python" node dist/index.js >> "$LOG" 2>&1 &
  child_pid=$!
  echo $child_pid > "$PID_FILE"

  echo "[Wrapper] PID: $child_pid" | tee -a "$LOG"

  # Wait for child to exit
  wait $child_pid
  exit_code=$?

  echo "[Wrapper] Process exited with code $exit_code at $(date)" | tee -a "$LOG"

  # If clean exit (code 0 from our SIGTERM handler), check if wrapper should stop
  if [ $exit_code -eq 0 ]; then
    echo "[Wrapper] Clean exit — restarting in ${RESTART_DELAY}s..." | tee -a "$LOG"
  elif [ $exit_code -eq 130 ] || [ $exit_code -eq 143 ]; then
    echo "[Wrapper] Killed by signal — restarting in ${RESTART_DELAY}s..." | tee -a "$LOG"
  else
    echo "[Wrapper] Crashed (code $exit_code) — restarting in ${RESTART_DELAY}s..." | tee -a "$LOG"
  fi

  restart_count=$((restart_count + 1))
  sleep $RESTART_DELAY

  # Back off if restarting too fast (more than 10 restarts)
  if [ $restart_count -gt 10 ]; then
    RESTART_DELAY=10
  fi
  if [ $restart_count -gt 30 ]; then
    RESTART_DELAY=30
  fi
done

echo "[Wrapper] Max restarts ($MAX_RESTARTS) reached — giving up" | tee -a "$LOG"
rm -f "$PID_FILE"
