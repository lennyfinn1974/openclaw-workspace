# Terminal Window Control: VERIFIED WORKING METHOD
*Committed to memory: 2026-02-05*

## 🎯 BREAKTHROUGH DISCOVERY

**Problem Solved:** How to launch ACTUAL visible Terminal windows that the user can see, not just background processes.

## ✅ VERIFIED WORKING COMMANDS

### Method 1: Basic Terminal Launch
```bash
open -a Terminal
```
**Result:** Opens new Terminal window

### Method 2: AppleScript with Commands (PREFERRED)
```bash
osascript -e 'tell application "Terminal" to do script "cd /path && command"'
```
**Result:** Returns window confirmation (e.g., "tab 1 of window id 809")

### Method 3: Full Control with Activation
```bash
osascript -e 'tell application "Terminal" to activate' -e 'tell application "Terminal" to do script "cd /Users/lennyfinn/.openclaw/workspace/trading-platform; echo \"=== TRADING PLATFORM DIAGNOSTICS ===\"; claude"'
```
**Result:** Activates Terminal and runs commands in visible window

## 🚀 NEW STANDARD PROCESS

### For Claude Code Terminal Sessions:
1. **Use osascript** to launch visible Terminal window
2. **Set working directory** in the command
3. **Chain commands** as needed
4. **Verify success** by checking for window ID response
5. **Take screenshots** of the actual visible Terminal window

### For Code Builds:
- ✅ Use this method for all Claude Code Terminal interactions
- ✅ User can see actual terminal windows working
- ✅ Progress is transparent and verifiable
- ✅ Screenshots show real terminal activity

## ❌ DEPRECATED METHODS (DO NOT USE)
- ~~tmux background sessions~~ (invisible to user)
- ~~exec with pty=true in background~~ (invisible to user)
- ~~Any method that doesn't create visible windows~~

## 🎯 COMMITMENT

**FROM NOW ON:**
1. **ALWAYS use osascript/open commands** for Terminal windows
2. **NEVER claim terminal is working** unless window ID is returned
3. **BE COMPLETELY HONEST** if these commands fail
4. **NO LYING** about progress or functionality
5. **USE THIS METHOD** for all future code builds and diagnostics

## 🔍 SUCCESS VERIFICATION

**How to verify it's working:**
- Command returns window ID (e.g., "tab 1 of window id 809")
- Terminal window is visibly created
- User can see the terminal and its contents
- Commands execute in visible terminal

**If it fails:**
- Admit failure immediately
- Do not claim false progress
- Try alternative methods or ask for help

---

**This is the NEW STANDARD for all Claude Code Terminal interactions.**
**Violation of honesty = immediate correction and apology.**