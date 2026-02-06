#!/bin/bash
# Enhanced Sovereign Command Architecture - Shell Profile Integration
# Add this to ~/.zshrc or ~/.bash_profile for persistent access across reboots

# Sovereign System Environment Variables
export SOVEREIGN_CORE="/Users/lennyfinn/.openclaw/workspace/sovereign-core"
export SOVEREIGN_SKILLS="/Users/lennyfinn/.openclaw/workspace/skills/sovereign-command"
export OPENCLAW_WORKSPACE="/Users/lennyfinn/.openclaw/workspace"

# Sovereign Command Aliases (Always Available)
alias sovereign="cd $SOVEREIGN_CORE && source venv/bin/activate && python run_sovereign.py"
alias sov="cd $SOVEREIGN_CORE && source venv/bin/activate && python run_sovereign.py"

# Master Command Shortcuts
alias bld="sovereign 'BLD:"  # Build commands
alias anz="sovereign 'ANZ:"  # Analysis commands  
alias sys="sovereign 'SYS:"  # System commands
alias qry="sovereign 'QRY:"  # Query commands
alias mem="sovereign 'MEM:"  # Memory commands

# Quick Status Check
alias sovereign-status="cd $SOVEREIGN_CORE && source venv/bin/activate && python run_sovereign.py 'SYS:STATUS'"

# Integration Test
alias sovereign-test="cd $SOVEREIGN_SKILLS && python3 sovereign_executor.py 'SYS:STATUS'"

# Workspace Navigation
alias cdw="cd $OPENCLAW_WORKSPACE"
alias cdsov="cd $SOVEREIGN_CORE"

echo "🚀 Enhanced Sovereign Command Architecture - Ready!"
echo "💡 Try: sovereign 'SYS:STATUS' or sovereign-status"