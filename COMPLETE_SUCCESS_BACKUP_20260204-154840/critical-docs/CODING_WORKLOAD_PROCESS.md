# 🎯 Coding Workload Process - Standard Operating Procedure

## 🏆 MANDATORY FOR ALL CODING TASKS

**CRITICAL RULE:** Never do coding work via expensive API calls when tmux + Claude Code Terminal is available.

---

## 🔧 Quick Start Checklist

### ✅ Before Any Coding Task:

1. **Check if Claude Code Terminal is available**
   ```bash
   which claude
   which tmux
   ```

2. **If available → Use tmux delegation (FREE)**
   - Follow tmux + Claude Code workflow
   - Use Max subscription instead of API calls
   - Save massive costs

3. **If NOT available → Document why and proceed with API**
   - Note the limitation
   - Estimate cost impact
   - Consider environment setup

---

## 🚀 Standard Delegation Workflow

### Step 1: Setup (One-time per project)
```bash
# Create tmux session for Claude Code
cd project-directory
SOCKET_DIR="${TMPDIR:-/tmp}/openclaw-tmux-sockets"
mkdir -p "$SOCKET_DIR"
SOCKET="$SOCKET_DIR/claude-coding.sock"
SESSION="claude-coding"

tmux -S "$SOCKET" new -d -s "$SESSION" -n claude
tmux -S "$SOCKET" send-keys -t "$SESSION":0.0 "claude" Enter
```

### Step 2: Delegate Task
```bash
# Send specific coding task
TASK="Your specific coding request here"
tmux -S "$SOCKET" send-keys -t "$SESSION":0.0 -l -- "$TASK"
tmux -S "$SOCKET" send-keys -t "$SESSION":0.0 Enter
```

### Step 3: Auto-Approve Permissions
```bash
# Approve file access (option 2 for session-wide)
tmux -S "$SOCKET" send-keys -t "$SESSION":0.0 "2"
tmux -S "$SOCKET" send-keys -t "$SESSION":0.0 Enter
```

### Step 4: Monitor & Capture Results
```bash
# Capture Claude Code's response
tmux -S "$SOCKET" capture-pane -p -J -t "$SESSION":0.0 -S -50
```

---

## 📋 Task Categories & Examples

### 🔍 Code Analysis
```bash
TASK="Analyze this codebase for security vulnerabilities and suggest specific fixes"
```

### 🛠️ Feature Development  
```bash
TASK="Add dark mode support to this React application with proper state management"
```

### 🐛 Bug Fixing
```bash
TASK="Fix the authentication issues in the server code and add proper error handling"
```

### 📊 Architecture Review
```bash
TASK="Review the system architecture and suggest improvements for scalability"
```

### 🧪 Testing
```bash
TASK="Write comprehensive tests for the user authentication module"
```

### 📚 Documentation
```bash
TASK="Create API documentation for all the endpoints in this Express server"
```

---

## 💰 Cost Awareness

### ✅ FREE (Use This Approach):
- **tmux + Claude Code Terminal**
- **Max subscription usage**
- **Unlimited analysis time**
- **No token counting stress**

### ❌ EXPENSIVE (Avoid When Possible):
- **Direct OpenClaw API coding work**
- **Long analysis sessions via API**
- **Complex implementations via API**
- **Multiple iteration cycles via API**

### 📊 Impact Examples:
- **Small task:** Save $5-10 per task
- **Medium analysis:** Save $20-50 per session  
- **Large project:** Save $100+ per implementation
- **Monthly total:** Potentially save $500+ per month

---

## 🎯 Quality Assurance

### ✅ Ensure Proper Delegation:
- Task actually sent to Claude Code Terminal ✓
- Using Max subscription, not API calls ✓  
- User can monitor progress if desired ✓
- Results captured and integrated ✓

### ❌ Signs of Failed Delegation:
- "I'll work on this myself" (wrong approach)
- No tmux session created (missed opportunity)
- API token usage for coding tasks (expensive)
- False claims about delegation (dishonest)

---

## 🔄 Session Management

### Create New Session:
```bash
create_claude_session() {
    local project=$1
    local session_id="claude-${project}-$(date +%s)"
    cd "$project" 
    tmux -S "$SOCKET" new -d -s "$session_id" -n claude
    tmux -S "$SOCKET" send-keys -t "$session_id":0.0 "claude" Enter
    echo "$session_id"
}
```

### List Active Sessions:
```bash
tmux -S "$SOCKET" list-sessions
```

### Clean Up Completed Sessions:
```bash
tmux -S "$SOCKET" kill-session -t "$SESSION"
```

---

## 🛡️ Error Handling

### Common Issues & Solutions:

**Claude Code not responding:**
- Check if session is still active: `tmux list-sessions`
- Restart session if needed
- Verify permissions were approved

**Permission prompts:**
- Always approve with option "2" for session-wide access
- Monitor for additional permission requests
- Auto-approve common file access patterns

**Session disconnection:**
- Sessions persist even if detached
- Reattach with: `tmux -S "$SOCKET" attach -t "$SESSION"`
- Check session status before creating new ones

---

## 📈 Performance Optimization

### For Large Projects:
- Create dedicated sessions per major component
- Use descriptive session names for organization
- Monitor resource usage and clean up completed work

### For Multiple Tasks:
- Run parallel sessions for independent work streams  
- Coordinate results at completion
- Avoid session conflicts with unique naming

### For Long-running Analysis:
- Background sessions work well for deep analysis
- Check progress periodically without interrupting
- Capture incremental results for status updates

---

## 🎉 Success Metrics

### Track These KPIs:
- **Cost savings:** $ saved per month vs API usage
- **Task completion:** Successful delegations vs failures  
- **Time efficiency:** Delegation setup vs direct work time
- **Quality:** Claude Code results vs API results

### Monthly Review Questions:
1. How much did we save in API costs?
2. What percentage of coding tasks used delegation?
3. Were there any delegation failures to learn from?
4. Can we improve the workflow further?

---

## 📚 Reference Documentation

### Primary Guide:
- **`TMUX_CLAUDE_CODE_WORKFLOW.md`** - Comprehensive implementation details

### OpenClaw Skills:
- **`/skills/tmux/SKILL.md`** - tmux remote control capabilities
- **`/skills/coding-agent/SKILL.md`** - General coding agent patterns

### Claude Code Documentation:
- **`claude --help`** - All available options and modes
- **Claude Code docs** - Official Anthropic documentation

---

## 🎯 Enforcement

### For OpenClaw (Me):
**MANDATORY:** Always attempt tmux delegation before API coding work
**DOCUMENT:** Any cases where delegation isn't possible
**REPORT:** Cost savings achieved through proper delegation

### For Users:
**EXPECT:** Real delegation instead of false claims
**MONITOR:** Costs to ensure savings are achieved  
**REQUEST:** tmux delegation for all coding tasks

### For System:
**TRACK:** API vs Max subscription usage ratios
**OPTIMIZE:** Delegation workflow for efficiency
**MAINTAIN:** Session management and cleanup

---

**🏆 GOAL: 100% of coding tasks use FREE Max subscription via tmux delegation**

*Established: 2026-02-04*  
*Status: Mandatory Standard Operating Procedure*  
*Impact: Massive cost reduction for all coding work*