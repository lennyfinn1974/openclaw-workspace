#!/bin/bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "=== Phase 2: Intelligence & Learning System ==="
echo ""

# 1. Install Node dependencies
echo "[1/4] Installing Node dependencies..."
if [ ! -d node_modules ]; then
  npm install
fi

# 2. Set up Python venv and install ML dependencies
echo "[2/4] Setting up Python environment..."
if [ ! -d venv ]; then
  python3 -m venv venv
fi
source venv/bin/activate
pip install -q -r requirements.txt 2>/dev/null || {
  echo "Warning: Some Python deps may not have installed. Falling back to sklearn-only mode."
  pip install -q numpy scipy scikit-learn pandas 2>/dev/null
}

# 3. Build TypeScript
echo "[3/4] Building TypeScript..."
npx tsc 2>/dev/null || {
  echo "TypeScript build had warnings, running with tsx instead..."
}

# 4. Start
echo "[4/4] Starting Intelligence System..."
echo ""

# Use tsx for dev (handles TS directly), fallback to compiled JS
if command -v npx &> /dev/null; then
  PYTHON_PATH="$DIR/venv/bin/python" npx tsx src/index.ts
else
  PYTHON_PATH="$DIR/venv/bin/python" node dist/index.js
fi
