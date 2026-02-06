# Context Compaction Protocol
*Preserve terminal control and sub-agent coordination during context window management*

## Trigger Conditions
- **70% context usage (140k/200k tokens):** Preemptive preparation
- **85% context usage (170k/200k tokens):** Emergency compaction required

## Pre-Compaction Checklist

### 1. Document Current State
```bash
# Save current session status
session_status > memory/$(date +%Y-%m-%d-%H-%M)-session-before-compaction.txt

# Get terminal window inventory
osascript -e 'tell application "Terminal" to get id of every window' > memory/terminal-windows-$(date +%Y-%m-%d-%H-%M).txt
```

### 2. Preserve Active Tasks
- **List running sub-agents:** `sessions_list` 
- **Document active terminal sessions** with window IDs
- **Save Claude Code session states** if any are running
- **Note any long-running processes** that need continuation

### 3. Hand Off to Sub-Agents
For any complex ongoing work:
```
sessions_spawn(
    task="Continue [specific work] from saved state in memory/[date]-pre-compaction-state.md",
    agentId="default",
    cleanup="keep"
)
```

## Compaction Execution

### 4. Update Memory Files
```bash
# Document critical insights in MEMORY.md
memory_search("recent important decisions")
# Add any new learnings to MEMORY.md before compaction

# Update daily memory
echo "# $(date +%Y-%m-%d) Context Compaction" >> memory/$(date +%Y-%m-%d).md
echo "- Context reached [X]% at $(date)" >> memory/$(date +%Y-%m-%d).md
echo "- Preserved terminal windows: [list IDs]" >> memory/$(date +%Y-%m-%d).md
```

### 5. Execute Compaction
**Manual process (user action required):**
```
Type: /new
```

This preserves:
- ✅ MEMORY.md (long-term memory)
- ✅ All workspace files (SOUL.md, USER.md, TOOLS.md, etc.)
- ✅ Sub-agent sessions (continue independently)
- ✅ File system state
- ❌ Current conversation context (gets reset)

## Post-Compaction Recovery

### 6. Restore Terminal Connections
```bash
# Read saved window IDs
cat memory/terminal-windows-[timestamp].txt

# For each window ID, check if still active:
osascript -e 'tell application "Terminal" to get contents of selected tab of window id [ID]'

# Resume Claude Code sessions if needed
osascript -e 'tell application "Terminal" to do script "claude" in window id [ID]'
```

### 7. Reconnect to Sub-Agents
```bash
# List active sub-agents
sessions_list

# Check on handed-off tasks
sessions_send(sessionKey="[sub-agent-session]", message="Status update on [task]")
```

### 8. Verify System Health
- **Context usage back to low levels**
- **Terminal control responsive** 
- **Sub-agents operational**
- **No lost work or broken processes**

## Automation Integration

### HEARTBEAT.md Integration
Add to heartbeat checks:
```python
# Check context usage every heartbeat
status = session_status()
if status.percentage > 70:
    print("⚠️ Context compaction recommended")
    # Execute pre-compaction checklist
```

### Emergency Procedures
**If context hits 90%+ unexpectedly:**
1. **Immediate handoff to sub-agents** for any critical work
2. **Emergency /new** without full documentation
3. **Post-compaction recovery** using this protocol

## Success Criteria
- ✅ Terminal windows remain controllable after compaction
- ✅ No sub-agent coordination is lost  
- ✅ Work continues seamlessly across session boundary
- ✅ Context resets to <10% usage
- ✅ System responsiveness restored

## Testing Protocol
**Simulate compaction at 50% usage to verify process works:**
1. Get context to 50% with test content
2. Execute full protocol 
3. Verify all recovery steps work
4. Document any gaps or improvements needed

---
*This protocol ensures continuous operation even during context management*