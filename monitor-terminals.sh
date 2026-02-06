#!/bin/bash
# Terminal Monitoring Script - Claude Team Methodology
# Brief status checks without context bloat

echo "🔍 TERMINAL STATUS CHECK $(date +%H:%M)"

# Terminal 955 - Security & Foundation
echo "T955-Security:" $(osascript -e 'tell application "Terminal" to get contents of tab 1 of window id 955' 2>/dev/null | grep -E "Progress:|Error:|Completed:" | tail -1 | cut -c1-60)

# Terminal 961 - Architecture Integration  
echo "T961-Architecture:" $(osascript -e 'tell application "Terminal" to get contents of tab 1 of window id 961' 2>/dev/null | grep -E "Progress:|Error:|Completed:|⏺" | tail -1 | cut -c1-60)

# Terminal 962 - Features & Testing
echo "T962-Features:" $(osascript -e 'tell application "Terminal" to get contents of tab 1 of window id 962' 2>/dev/null | grep -E "Progress:|Error:|Completed:" | tail -1 | cut -c1-60)

# Check for prompts needing approval
for term in 955 961 962; do
  if osascript -e "tell application \"Terminal\" to get contents of tab 1 of window id $term" 2>/dev/null | grep -q "❯\|Enter to confirm\|Do you want"; then
    echo "⚠️ T$term needs approval"
  fi
done

echo "---"