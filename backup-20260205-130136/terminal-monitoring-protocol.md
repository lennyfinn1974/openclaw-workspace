# Terminal Monitoring & Engagement Protocol

## 🎯 TERMINAL TASK LIFECYCLE

### 1. Pre-Launch Planning
- [ ] Define specific task objective
- [ ] Identify required inputs/responses  
- [ ] Set success criteria
- [ ] Plan monitoring checkpoints

### 2. Launch Protocol
```bash
# Create new terminal with descriptive task
osascript -e 'tell application "Terminal" to do script "echo \"=== TASK: [DESCRIPTION] ===\" && cd [PATH] && [COMMAND]"'
```

### 3. Active Monitoring Loop
- [ ] Check terminal contents every 30-60 seconds
- [ ] Identify if waiting for input
- [ ] Respond to prompts immediately  
- [ ] Monitor for completion/errors

### 4. Response Handling
```bash
# Send responses to waiting terminals
osascript -e 'tell application "Terminal" to do script "[RESPONSE]" in window id [ID]'
```

### 5. Completion Verification
- [ ] Verify task objectives met
- [ ] Document results
- [ ] Clean up if needed

## 🔧 CURRENT ACTIVE TERMINALS

| Window ID | Task | Status | Next Action |
|-----------|------|--------|-------------|
| 309 | Bulldog Platform | ✅ RUNNING | Monitor stability |

## 📋 MONITORING COMMANDS

```bash
# Check terminal contents
osascript -e 'tell application "Terminal" to get contents of selected tab of window id [ID]' | tail -10

# Send input to terminal
osascript -e 'tell application "Terminal" to do script "[INPUT]" in window id [ID]'

# Check process status
ps aux | grep -E "(npm|node)" | grep -v grep
```

## 🚨 ALERT TRIGGERS
- Terminal waiting for input >30 seconds
- Process exits unexpectedly  
- Error messages appear
- Services become unresponsive

---

**PROTOCOL STATUS:** ✅ IMPLEMENTED for Bulldog Platform repairs