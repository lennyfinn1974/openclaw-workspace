# CommandLibrary.md - Comprehensive Development Command Library

*Structured catalog of all proven commands and workflows*

---

## 🚦 TERMINAL CONTROL COMMANDS

### Terminal Status & Monitoring
```bash
# Check terminal window count
osascript -e 'tell application "Terminal" to get count of windows'

# Get terminal contents (last N lines)
osascript -e 'tell application "Terminal" to get contents of tab 1 of window id XXX' | tail -10

# Check for idle terminals (safe to use)
# Look for: ❯ prompt = SAFE, ✳ Thinking... = DO NOT INTERRUPT
```

### Claude Code Interaction
```bash
# Launch new Claude Code session
osascript -e 'tell application "Terminal" to do script "cd /workspace && claude"'

# Send Enter key (submit/continue)
osascript -e 'tell application "Terminal" to do script "" in front window'

# Send text input to active terminal
osascript -e 'tell application "Terminal" to do script "your command here" in tab 1 of window id XXX'

# Handle interactive prompts
osascript -e 'tell application "Terminal" to do script "1" in front window'  # Accept/Approve
osascript -e 'tell application "Terminal" to do script "2" in front window'  # Deny/Reject
```

### Process Management
```bash
# Check Claude Code processes
ps aux | grep claude | grep -v grep

# Check for specific project processes
ps aux | grep [project-name]

# Monitor background tasks
process list  # OpenClaw process management
```

---

## 🎯 DEVELOPMENT WORKFLOW COMMANDS

### CodeBuilder.md Activation
```bash
# Universal execution command
"Follow CodeBuilder.md for [project/task]"

# This triggers:
# 1. Load reference skills
# 2. Apply expert knowledge
# 3. Check context usage
# 4. Check terminal status  
# 5. Select appropriate model
# 6. Execute with proper methodology
```

### Context Management
```bash
# Monitor context usage
session_status  # Check Context: XX%/200k

# Emergency thresholds:
# 70% (140k) = WARNING - start cleanup
# 85% (170k) = CRITICAL - immediate compaction

# Context protection protocol
# 1. Document terminal states
# 2. Save to memory/YYYY-MM-DD-pre-compaction-state.md
# 3. /new session (preserves MEMORY.md + workspace)
```

### Model Selection Commands
```bash
# Cost-effective model switching
session_status model="fast"        # Groq - 150x cheaper for routine tasks
session_status model="deepseek"    # 7x cheaper for development work
session_status model="sonnet"      # Premium for critical analysis only

# Model hierarchy:
# Tier 1: fast, deepseek-fast (routine tasks)
# Tier 2: deepseek, gemini (development)  
# Tier 3: sonnet, opus (critical analysis)
```

---

## 🛡️ SYSTEM OPERATIONS COMMANDS

### Gateway Health Management
```bash
# Status check
openclaw gateway status

# Health probe verification
openclaw gateway status | grep "RPC probe: ok"

# Auto-restart if needed (emergency)
openclaw gateway restart

# EPIPE error monitoring  
grep -c "EPIPE\|broken pipe" /tmp/openclaw/openclaw-YYYY-MM-DD.log

# Emergency threshold: >5 EPIPE errors in 1 hour = preemptive restart
```

### Log Management System
```bash
# Store large outputs (prevent context bloat)
logs/YYYY-MM-DD/filename.md

# Auto-cleanup script
logs/cleanup.sh  # Removes logs >15 days

# Usage pattern:
# 1. Store detailed data in logs/
# 2. Provide summary in response
# 3. Reference log file for details
```

### Memory Operations
```bash
# Semantic search
memory_search query="search terms"

# Retrieve specific content
memory_get path="MEMORY.md" from=100 lines=20

# Document important events
# Daily: memory/YYYY-MM-DD.md
# Long-term: MEMORY.md
```

---

## 💰 COST OPTIMIZATION COMMANDS

### Resource Management
```bash
# Context monitoring
session_status  # Watch for >70% usage

# Sub-agent spawning (cost-effective)
sessions_spawn({
  task: "specific task description",
  model: "deepseek",  # Cost-effective choice
  cleanup: "keep"
});

# Model fallback strategy:
# Local models (FREE) → Groq (cheap) → Claude (premium)
```

### Efficient Execution Patterns
```bash
# Batch similar operations
# Use sub-agents for isolated work
# Main session for terminal control only
# Log large data instead of context dumps
```

---

## 🔮 FUTURE COMMANDS (Anticipated Needs)

### Project Template Generation
```bash
# Rapid project setup
"Follow CodeBuilder.md for React TypeScript project"
"Follow CodeBuilder.md for API backend setup"  
"Follow CodeBuilder.md for database schema design"
```

### Automated Testing Workflows
```bash
# Quality assurance automation
"Follow CodeBuilder.md for testing suite setup"
"Follow CodeBuilder.md for CI/CD pipeline"
```

### Deployment Pipelines
```bash
# Production deployment
"Follow CodeBuilder.md for production deployment"
"Follow CodeBuilder.md for environment setup"
```

### Performance Monitoring
```bash
# System health dashboards
"Follow CodeBuilder.md for monitoring setup"
"Follow CodeBuilder.md for performance optimization"
```

---

## 🎯 QUICK REFERENCE

### Emergency Commands
```bash
# Gateway down
openclaw gateway restart

# Context overflow (>85%)
/new  # Preserves MEMORY.md + workspace

# Terminal unresponsive
# Find idle terminal, don't interrupt active processes
```

### Daily Operations
```bash
# Morning startup
session_status  # Check context, model, capabilities
memory_search query="yesterday" # Get recent context

# Evening shutdown
# Update memory files with day's work
# Clean up large log files if needed
```

### Quality Assurance
```bash
# Before major operations:
# 1. Check context usage (<70%)
# 2. Verify terminal availability (idle terminals only)
# 3. Select appropriate model for task complexity
# 4. Follow CodeBuilder.md methodology
# 5. Document results in memory/logs
```

---

*Last Updated: 2026-02-05 | Continuously evolved through practice*