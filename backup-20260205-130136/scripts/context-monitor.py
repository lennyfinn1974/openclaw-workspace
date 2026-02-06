#!/usr/bin/env python3
"""
Context Window Monitor & Preemptive Compaction
Prevents terminal control loss by managing context before it becomes critical
"""

import json
import os
import subprocess
from datetime import datetime
from pathlib import Path

def get_session_status():
    """Get current session context usage"""
    try:
        # This would be called from within OpenClaw context
        # Implementation depends on how we can access session_status programmatically
        return {
            'tokens_used': 0,  # Would be populated from actual session_status
            'tokens_max': 200000,
            'percentage': 0
        }
    except Exception as e:
        print(f"Error getting session status: {e}")
        return None

def get_active_terminals():
    """Get list of active Terminal windows (macOS)"""
    try:
        script = '''
        tell application "Terminal"
            set window_list to {}
            repeat with w in windows
                set end of window_list to (id of w)
            end repeat
            return window_list
        end tell
        '''
        
        result = subprocess.run(['osascript', '-e', script], 
                              capture_output=True, text=True)
        
        if result.returncode == 0:
            # Parse the returned window IDs
            window_ids = result.stdout.strip().split(', ')
            return [w.strip() for w in window_ids if w.strip()]
        return []
    except Exception as e:
        print(f"Error getting terminal windows: {e}")
        return []

def save_compaction_state(context_usage, terminal_windows):
    """Save current state before compaction"""
    timestamp = datetime.now().strftime("%Y-%m-%d-%H-%M")
    state_file = f"memory/{timestamp}-pre-compaction-state.md"
    
    state_content = f"""# Pre-Compaction State - {datetime.now().strftime("%Y-%m-%d %H:%M")}

## Context Status
- **Tokens Used:** {context_usage.get('tokens_used', 0):,}
- **Tokens Max:** {context_usage.get('tokens_max', 200000):,}
- **Percentage:** {context_usage.get('percentage', 0):.1f}%

## Active Terminal Windows
"""
    
    for window_id in terminal_windows:
        state_content += f"- Window ID: {window_id}\n"
        
        # Try to get window contents
        try:
            script = f'''tell application "Terminal" to get contents of selected tab of window id {window_id}'''
            result = subprocess.run(['osascript', '-e', script], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                state_content += f"  - Contents: {result.stdout[:200]}...\n"
        except:
            state_content += f"  - Contents: Could not retrieve\n"
    
    state_content += """
## Recovery Instructions
1. Use terminal window IDs above to reconnect
2. Check for Claude Code sessions that need continuation
3. Resume any interrupted tasks from this context
"""
    
    # Ensure memory directory exists
    os.makedirs("memory", exist_ok=True)
    
    with open(state_file, 'w') as f:
        f.write(state_content)
    
    print(f"Pre-compaction state saved to: {state_file}")
    return state_file

def check_context_usage():
    """Main monitoring function"""
    status = get_session_status()
    if not status:
        return False
    
    percentage = status.get('percentage', 0)
    
    if percentage >= 85:
        print("🚨 EMERGENCY: Context >85% - Immediate compaction required")
        terminal_windows = get_active_terminals()
        state_file = save_compaction_state(status, terminal_windows)
        print(f"State saved. Manual compaction required via /new")
        return True
        
    elif percentage >= 70:
        print("⚠️ WARNING: Context >70% - Preemptive compaction recommended")
        terminal_windows = get_active_terminals()
        state_file = save_compaction_state(status, terminal_windows)
        print(f"State saved. Consider compaction soon.")
        return True
    
    return False

if __name__ == "__main__":
    check_context_usage()