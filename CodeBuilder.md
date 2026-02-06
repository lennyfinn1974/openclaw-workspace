# CodeBuilder.md - Complete Development Operating System

*Your AI development workflow combining Terminal Control + Vibe Coding + Claude Team Strategy*

---

## 🚦 TERMINAL CONTROL RULES (Critical!)

### Before ANY Terminal Action:
1. **Check Process Status:** `ps aux | grep claude` - never interrupt active processes
2. **Verify Terminal State:** Check if Claude Code is running/thinking/idle
3. **Use Idle Terminals Only:** Find terminals showing prompt (`❯`) not active work

### Safe Terminal Commands:
```bash
# Check what's running
osascript -e 'tell application "Terminal" to get contents of tab 1 of window id XXX' | tail -5

# Only send to IDLE terminals (showing ❯ prompt)
osascript -e 'tell application "Terminal" to do script "command" in tab 1 of window id XXX'
```

### Terminal & Claude Code Communication Protocol:

#### **Launch New Claude Code Session:**
```bash
osascript -e 'tell application "Terminal" to do script "cd /workspace && claude"'
```

#### **Send Enter Key:**
```bash
osascript -e 'tell application "Terminal" to do script "" in front window'
```

#### **Send Text Input:**
```bash
osascript -e 'tell application "Terminal" to do script "your text here" in front window'
```

#### **Handle Interactive Prompts:**
```bash
# Approve/Accept (usually "1" or "y")
osascript -e 'tell application "Terminal" to do script "1" in front window'

# Deny/Reject (usually "2" or "n") 
osascript -e 'tell application "Terminal" to do script "2" in front window'

# Custom response
osascript -e 'tell application "Terminal" to do script "your response" in front window'
```

#### **Monitor Terminal Output:**
```bash
# Get current terminal contents (last N lines)
osascript -e 'tell application "Terminal" to get contents of tab 1 of window id XXX' | tail -10

# Monitor for specific text/prompts
osascript -e 'tell application "Terminal" to get contents of tab 1 of window id XXX' | grep -i "prompt text"
```

### Claude Code Terminal States:
- **`❯`** - Ready for commands (SAFE to interact)
- **`✳ Thinking...`** - Processing (DO NOT INTERRUPT)
- **`⏵⏵ accept edits`** - Waiting for approval (SAFE to respond)
- **`◼ Task Name`** - Active task running (DO NOT INTERRUPT)
- **`⏺ Stop Task`** - Task completed/stopped (SAFE to continue)

### ❌ NEVER DO:
- Send questions to terminals showing "✳ Thinking..." 
- Interrupt processes showing "◼ Active Task"
- Send commands during active Claude Code sessions
- Multiple rapid commands without checking status

---

## 🎯 VIBE CODING METHODOLOGY

### Core Principles:
- **Flow Over Perfection:** Get systems working, then refine
- **Simplicity First:** Custom HTML/JS often beats complex frameworks  
- **Real Working Examples:** Build actual functional prototypes
- **Iterative Excellence:** Start minimal, enhance through usage

### Implementation Pattern:
1. **Rapid Prototype:** Get basic functionality working in <30 minutes
2. **User Feedback:** Test with real interaction, get immediate feedback
3. **Smart Enhancement:** Add features based on actual usage patterns
4. **Performance Tune:** Optimize after proving value

### 📚 REFERENCE SKILLS & KNOWLEDGE BASE

#### **Vibe Coding & Prompt Engineering Expert Knowledge:**
- **Master Document:** `memory/knowledge-building/vibe-coding-prompt-engineering-2026-02-05.md`
- **Content:** Expert-level strategic intelligence on human-AI collaboration patterns
- **Frameworks:** Flow state achievement, tool mastery, pattern recognition
- **Application:** Rapid agent skill prototyping, prompt library building

#### **Related Skills:**
- **MacOS Terminal Control:** `skills/macos-terminal-control/SKILL.md`
- **Sub-Agent Terminal:** `skills/subagent-terminal/SKILL.md` 
- **Skill Creator:** Use when building new development skills

### **When to Consult These Resources:**
- Before starting any major development task
- When creating new prompt templates or AI workflows
- For advanced terminal automation requirements
- When building new skills or capabilities

---

## 🏗️ CLAUDE TEAM BEST PRACTICES (Boris Cherny Method)

### The 10 Revolutionary Principles:

#### 1. **Work in Parallel** 
- Multiple git worktrees with separate Claude sessions
- "Single biggest productivity unlock"
- Use sub-agents for isolated development work

#### 2. **Plan Mode First**
- Complex tasks start with detailed planning → one-shot implementation
- Ask Claude: "Plan this completely before implementation"

#### 3. **Maintain CodeBuilder.md** 
- Self-improving documentation: "Update CodeBuilder.md so you don't make that mistake again"
- Document every lesson learned immediately

#### 4. **Build Your Own Skills**
- Repetitive tasks → reusable skills/commands
- Commit working patterns to git
- Create skill templates for common workflows

#### 5. **Automate Bug Fixes**
- Don't micromanage, let Claude find the way
- "Go fix the failing CI tests" not "change line 42"

#### 6. **Better Prompts**
- "Grill me on these changes" 
- "Scrap this and implement the elegant solution"
- "What would go wrong with this approach?"

#### 7. **Use Subagents** (For Non-Terminal Work)
- Offload planning/analysis to keep main context clean
- Specialized agents for research, documentation, strategy
- **Reality Check:** Sub-agents cannot control Terminal/Claude Code keyboards
- Main session must handle all interactive terminal work

#### 8. **Data & Analytics**
- Claude + CLI tools for data work
- "Haven't written SQL in 6+ months" - let Claude handle it

#### 9. **Voice Dictation**
- 3x faster than typing
- More detailed prompts through natural speech
- Better context and nuance in requests

#### 10. **Learn with Claude**
- Explanatory output style
- Generate presentations/diagrams
- Teaching mode for complex concepts

---

## 💰 COST OPTIMIZATION STRATEGY

### Model Selection Hierarchy:
- **Tier 1:** `fast`, `deepseek-fast` (Groq) - 150x cheaper for routine tasks
- **Tier 2:** `deepseek`, `gemini` - 7x cheaper for development work  
- **Tier 3:** `sonnet`, `opus` - Premium models for critical analysis only

### Cost-Saving Architecture:
- **Local Models:** `qwen2.5:7b` (FREE) for heartbeats, coordination, simple tasks
- **Claude Code:** Max subscription ($20/month) for development work
- **Anthropic API:** Premium models only for critical business analysis
- **Potential Savings:** 70-90% cost reduction while maintaining quality

---

## 🔧 TECHNICAL EXECUTION PATTERNS

## 🎮 CLAUDE CODE COMMANDS & CONTROL

### Essential Claude Code Commands:
- **Start Claude Code:** `claude` (in terminal)
- **Resume Session:** `claude --resume [session-id]`
- **Exit Claude Code:** `Ctrl+D` or type `exit`
- **Interrupt/Stop:** `Ctrl+C` (stops current task)
- **Suspend:** `Ctrl+Z` (backgrounds process)

### Claude Code Interactive Controls:
- **Accept Changes:** Press `Tab` or `Enter` when seeing "⏵⏵ accept edits"
- **Cycle Options:** `Shift+Tab` to cycle through choices
- **Edit in Vim:** `Ctrl+G` when available
- **Hide Tasks:** `Ctrl+T` to toggle task panel
- **View Files:** `↓` arrow to expand file views
- **Interrupt:** `Esc` to interrupt current operation

### Sub-Agent Reality Check:
**❌ Sub-agents CANNOT control Terminal keyboards directly**
**✅ Main session must handle all Terminal/Claude Code interaction**

### Proper Workflow:
```bash
# Main session coordinates everything
1. Launch Claude Code in visible Terminal
2. Send commands via osascript 
3. Monitor progress and handle prompts
4. Use sub-agents for planning/analysis only
5. Main session executes all terminal work
```

## 🧹 CONTEXT WINDOW HYGIENE (Critical!)

### The Golden Rule:
**NEVER dump large datasets into context window!**

### Context Monitoring:
```bash
# Check current context usage
session_status  # Look for Context: XX%/200k

# Emergency thresholds:
# 70% (140k) = WARNING - start cleanup
# 85% (170k) = CRITICAL - immediate compaction
```

### Data Handling Protocol:
#### ✅ DO:
- **Summarize outputs** - "Found 9 terminal windows, 6 Claude processes"
- **Use logs directory** - Store large data in `logs/YYYY-MM-DD/filename.md`
- **Reference files** - "Details saved to logs/investigation.md" 
- **Concise status updates** - Key points only

#### ❌ NEVER:
- Dump full command outputs into chat
- Include large memory search results in response
- Paste entire file contents
- Show complete process lists or diagnostic dumps

### Log System Usage:
```bash
# Store large outputs
logs/YYYY-MM-DD/terminal-investigation.md
logs/YYYY-MM-DD/process-diagnostics.md  
logs/YYYY-MM-DD/memory-search-results.md

# Reference in response
"Investigation complete. Full details: logs/2026-02-05/terminal-investigation.md"
```

### Context Protection Strategy:
- **Monitor at 70%** context usage (140k/200k tokens)
- **Document terminal states** before any major operation
- **Use /new session** when approaching 85% (preserves MEMORY.md + workspace)
- **Preserve critical state** in structured memory files

---

## 📊 SUCCESS METRICS

### Quality Indicators:
- **Speed:** Prototype to working system in <1 hour
- **Cost:** 70%+ reduction through smart model selection
- **Reliability:** No context overflows, proper error handling
- **Maintainability:** Self-documenting code with clear patterns

### Anti-Patterns to Avoid:
- Expensive models for simple tasks
- Interrupting active terminal processes  
- Single-session bottlenecks
- Context bloat from large data dumps
- Over-engineering simple solutions

---

## 🎯 QUICK START COMMANDS

### When User Says "Follow CodeBuilder.md":
1. **Load Reference Skills:** Read relevant skill files for the task domain
2. **Apply Expert Knowledge:** Consult `memory/knowledge-building/vibe-coding-prompt-engineering-2026-02-05.md` for advanced patterns
3. **Check Context Usage:** Ensure <70% before starting large operations
4. **Check Terminal Status:** Identify idle terminals for work (look for `❯` prompt)
5. **Select Appropriate Model:** Match complexity to cost tier
6. **Plan First:** Map out approach before implementation (use Vibe Coding patterns)
7. **Execute in Main Session:** All Terminal/Claude Code work stays in main session
8. **Use Sub-Agents for:** Planning, research, documentation (non-interactive work)
9. **Log Large Data:** Store detailed outputs in logs/, provide summaries only
10. **Document Results:** Update this file and relevant skills with lessons learned

### **Skills Integration Protocol:**
```bash
# Always start with skill consultation:
read skills/[relevant-skill]/SKILL.md
read memory/knowledge-building/vibe-coding-prompt-engineering-2026-02-05.md

# Apply the learned patterns:
- Vibe Coding: Flow-first development approach
- Terminal Control: Proper osascript command sequences  
- Prompt Engineering: Advanced human-AI collaboration techniques
```

### Emergency Context Recovery:
```bash
# If context >70%, execute compaction protocol:
1. Document active terminal window IDs
2. Save current task state to memory/YYYY-MM-DD-pre-compaction-state.md
3. Hand off tasks to sub-agents via sessions_spawn
4. /new session (preserves MEMORY.md + workspace files)
5. Restore terminal connections using documented window IDs
```

---

## 🚀 ACTIVATION PHRASE

**User Command:** "Follow CodeBuilder.md for [project/task]"

**My Response:** Apply this complete methodology - proper terminal management, cost-optimized models, parallel sub-agents, and Claude Team best practices.

---

*Last Updated: 2026-02-05 | Evolution through practice*