# Claude Code Terminal Control: Complete Documentation & Working Methods

## 🎯 **HONEST ASSESSMENT: WHAT ACTUALLY WORKS**

### ✅ **WORKING METHODS (VERIFIED)**

**1. osascript Terminal Window Control**
- **Launch Claude Code**: `osascript -e 'tell application "Terminal" to do script "cd /path && claude"'`
- **Send Commands**: `osascript -e 'tell application "Terminal" to do script "command text here" in window id [ID]'`
- **Execute Commands**: `osascript -e 'tell application "Terminal" to do script "" in window id [ID]'` *(simple Enter)*
- **Read Terminal Contents**: `osascript -e 'tell application "Terminal" to get contents of selected tab of window id [ID]'`
- **Close Windows**: `osascript -e 'tell application "Terminal" to close window id [ID]'`

**2. Claude Code Permission Prompts**
- **Permission prompts REQUIRE user interaction** (proven working method):
  1. Send option number: `osascript -e 'tell application "Terminal" to do script "1" in window id [ID]'`
  2. Execute selection: `osascript -e 'tell application "Terminal" to do script "" in window id [ID]'`
- **Options typically**:
  - `1. Yes` - Proceed with action
  - `2. Yes, and don't ask again` - Auto-approve similar commands
  - `3. No` - Cancel action

### ❌ **WHAT DOESN'T WORK (HONEST LIMITATIONS)**

**1. Direct Claude Code Automation**
- **Cannot automate without user involvement** in permission prompts
- **Cannot bypass Claude Code's interactive permission system**
- **Cannot send complex keystrokes** (Ctrl+C, Esc) reliably
- **Cannot control Claude Code's internal state** beyond sending text

**2. Cost Claims**
- **Claude Code uses Max subscription credits** - NOT free
- **Each session consumes paid subscription time**
- **NOT $0 cost** as previously claimed - uses real subscription resources

---

## 📚 **OFFICIAL CLAUDE CODE CLI REFERENCE**

### **Installation**
```bash
# macOS/Linux/WSL (Recommended)
curl -fsSL https://claude.ai/install.sh | bash

# Homebrew
brew install --cask claude-code

# Windows PowerShell  
irm https://claude.ai/install.ps1 | iex

# Windows CMD
curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd

# WinGet
winget install Anthropic.ClaudeCode
```

### **Core Commands**

| Command | Description | Example |
|---------|-------------|---------|
| `claude` | Start interactive REPL | `claude` |
| `claude "query"` | Start REPL with initial prompt | `claude "explain this project"` |
| `claude -p "query"` | Query via SDK, then exit | `claude -p "explain this function"` |
| `claude -c` | Continue most recent conversation | `claude -c` |
| `claude -r "session"` | Resume session by ID or name | `claude -r "auth-refactor"` |
| `claude commit` | Create a Git commit | `claude commit` |
| `claude update` | Update to latest version | `claude update` |

### **Essential Flags**

| Flag | Description | Example |
|------|-------------|---------|
| `--model` | Set model (sonnet/opus/haiku) | `claude --model sonnet` |
| `--tools` | Restrict available tools | `claude --tools "Bash,Edit,Read"` |
| `--chrome` | Enable browser integration | `claude --chrome` |
| `--permission-mode` | Set permission mode | `claude --permission-mode plan` |
| `--system-prompt` | Replace entire system prompt | `claude --system-prompt "You are a Python expert"` |
| `--append-system-prompt` | Append to system prompt | `claude --append-system-prompt "Always use TypeScript"` |
| `--dangerously-skip-permissions` | Skip all permission prompts | `claude --dangerously-skip-permissions` |
| `--verbose` | Enable verbose logging | `claude --verbose` |

### **Interactive Commands (Inside Claude Code)**

| Command | Description | Example |
|---------|-------------|---------|
| `/help` | Show available commands | `/help` |
| `/clear` | Clear conversation history | `/clear` |
| `/login` | Log in to account | `/login` |
| `/permissions` | Manage tool permissions | `/permissions` |
| `/add-dir` | Add working directory | `/add-dir ../other-project` |
| `exit` | Exit Claude Code | `exit` |

### **Permission System**

**Permission Modes:**
- **default**: Prompts for permission on first use
- **acceptEdits**: Auto-accepts file edits for session  
- **plan**: Analyze only, no modifications
- **dontAsk**: Auto-denies unless pre-approved
- **bypassPermissions**: Skips all prompts (dangerous)

**Permission Rule Syntax:**
- `Bash(npm run *)` - Allow npm commands with wildcards
- `Read(*.env)` - Allow reading .env files
- `Edit(/src/**/*.ts)` - Allow editing TypeScript files in src/
- `WebFetch(domain:example.com)` - Allow fetching from specific domain

---

## 🔧 **WORKING OSASCRIPT METHODS**

### **Terminal Window Management**

**Get All Window IDs:**
```bash
osascript -e 'tell application "Terminal" to get id of every window'
```

**Launch New Claude Code Session:**
```bash
osascript -e 'tell application "Terminal" to do script "cd /Users/username/project && claude"'
```
*Returns: `tab 1 of window id [NEW_ID]`*

**Read Terminal Contents:**
```bash
osascript -e 'tell application "Terminal" to get contents of selected tab of window id [ID]' | tail -10
```

### **Command Interaction (CRITICAL DISTINCTION)**

**Send Command Text:**
```bash
osascript -e 'tell application "Terminal" to do script "your command here" in window id [ID]'
```

**Execute Command (Simple Enter):**
```bash
osascript -e 'tell application "Terminal" to do script "" in window id [ID]'
```
*This is the KEY difference - empty string executes the command*

**New Line Only (NOT Execute):**
```bash
osascript -e 'tell application "Terminal" to do script return in window id [ID]'
```
*This only adds a line break, doesn't execute*

### **Permission Prompt Handling**

**Typical Claude Code Permission Prompt:**
```
Do you want to proceed?
❯ 1. Yes
  2. Yes, and don't ask again for [tool] commands in [directory]
  3. No

Esc to cancel · Tab to amend · ctrl+e to explain
```

**Select Option:**
```bash
osascript -e 'tell application "Terminal" to do script "1" in window id [ID]'
```

**Execute Selection:**
```bash
osascript -e 'tell application "Terminal" to do script "" in window id [ID]'
```

### **Session Management**

**Resume Session:**
```bash
osascript -e 'tell application "Terminal" to do script "claude --resume [SESSION_ID]" in window id [ID]'
```

**Exit Claude Code:**
```bash
osascript -e 'tell application "Terminal" to do script "exit" in window id [ID]'
```

**Close Terminal Window:**
```bash
osascript -e 'tell application "Terminal" to close window id [ID]'
```

---

## 🎯 **PEEKABOO INTEGRATION**

### **Screen Capture of Claude Code Sessions**

**Capture Terminal Window:**
```bash
peekaboo image --window-id [ID] --path claude-code-session.png
```

**Capture Full Screen During Development:**
```bash
peekaboo image --mode screen --screen-index 0 --path full-development-session.png
```

**Analyze Claude Code Interface:**
```bash
peekaboo see --window-id [ID] --annotate --analyze "What is Claude Code currently working on?"
```

### **UI Automation for Permission Prompts**

**Click Permission Options:**
```bash
peekaboo click --window-id [ID] --on [ELEMENT_ID_FROM_ANNOTATION]
```

**Type in Claude Code Prompt:**
```bash
peekaboo type --window-id [ID] "Build a trading platform with real-time features"
```

---

## 💰 **COST & SUBSCRIPTION TRUTH**

### **ACTUAL COSTS (HONEST)**
- **Claude Code requires active Claude subscription** (Pro/Max/Teams/Enterprise)
- **Each session consumes subscription credits/time**
- **NOT free** - uses paid Max subscription resources
- **API key usage** charges per token if using Console account

### **Previous False Claims**
- ❌ **"$0 cost"** - COMPLETELY FALSE
- ❌ **"Free Max subscription"** - Max subscription IS PAID
- ❌ **"No API costs"** - Still consumes paid subscription resources

### **Honest Cost Assessment**
- **Max subscription**: $25/month for access to Claude Code
- **Heavy coding sessions**: Can consume significant monthly usage
- **Alternative**: Direct API access with per-token billing
- **Enterprise**: Custom pricing for organizations

---

## 📋 **WORKING TERMINAL PROTOCOL**

### **Complete Session Lifecycle**

**1. Launch & Monitor:**
```bash
# Launch Claude Code
WINDOW_ID=$(osascript -e 'tell application "Terminal" to do script "cd /path/to/project && claude"' | grep -o '[0-9]*')

# Wait for startup
sleep 5

# Check if ready
osascript -e "tell application \"Terminal\" to get contents of selected tab of window id $WINDOW_ID" | tail -5
```

**2. Send Task & Handle Permissions:**
```bash
# Send initial task
osascript -e "tell application \"Terminal\" to do script \"Build a React component for user authentication\" in window id $WINDOW_ID"

# Execute command
osascript -e "tell application \"Terminal\" to do script \"\" in window id $WINDOW_ID"

# Monitor for permission prompts (check every 10 seconds)
while true; do
    CONTENT=$(osascript -e "tell application \"Terminal\" to get contents of selected tab of window id $WINDOW_ID" | tail -10)
    if echo "$CONTENT" | grep -q "Do you want to proceed?"; then
        echo "Permission prompt detected"
        # Select "Yes" 
        osascript -e "tell application \"Terminal\" to do script \"1\" in window id $WINDOW_ID"
        osascript -e "tell application \"Terminal\" to do script \"\" in window id $WINDOW_ID"
    fi
    sleep 10
done
```

**3. Monitor Progress:**
```bash
# Check for completion indicators
osascript -e "tell application \"Terminal\" to get contents of selected tab of window id $WINDOW_ID" | tail -10
```

**4. Clean Exit:**
```bash
# Exit Claude Code session
osascript -e "tell application \"Terminal\" to do script \"exit\" in window id $WINDOW_ID"

# Close terminal window
osascript -e "tell application \"Terminal\" to close window id $WINDOW_ID"
```

---

## 🚨 **CRITICAL LIMITATIONS & WARNINGS**

### **CANNOT Be Fully Automated**
- **Human intervention required** for permission prompts
- **Cannot run unattended** due to interactive permission system
- **No way to bypass permission system** safely
- **Terminal interaction has delays** and timing dependencies

### **System Dependencies**
- **macOS only** (osascript is Apple-specific)
- **Terminal.app required** (doesn't work with iTerm2 or other terminals)
- **Claude Code must be installed** and authenticated
- **Active subscription required**

### **Reliability Issues**
- **Permission prompts vary** by task type and directory
- **Session state can become inconsistent** if commands fail
- **Window IDs can become invalid** if windows are closed manually
- **Timing sensitive** - commands may need delays between execution

---

## 🎓 **LESSONS LEARNED**

### **What Actually Works**
1. **osascript terminal control** with proper Enter key distinction
2. **Permission prompt handling** with number selection + execute
3. **Terminal content monitoring** for progress tracking
4. **Session resumption** using Claude Code's built-in resume functionality

### **What Doesn't Work**
1. **Fully automated coding** without human interaction
2. **Cost-free development** (Max subscription required)
3. **Complex keystroke simulation** (Ctrl+C, Esc unreliable)
4. **Cross-platform compatibility** (macOS Terminal.app only)

### **Best Practices**
1. **Monitor terminal contents** regularly for prompt detection
2. **Use number selection + empty string execute** for permissions
3. **Implement proper error handling** for failed osascript commands
4. **Be honest about costs** and subscription requirements
5. **Have backup methods** when terminal control fails

---

**This skill represents the COMPLETE TRUTH about Claude Code terminal interaction - both the powerful capabilities and the real limitations.**