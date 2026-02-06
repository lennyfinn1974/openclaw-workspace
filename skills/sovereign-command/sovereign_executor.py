#!/usr/bin/env python3
"""
Sovereign Command Executor for OpenClaw Integration
==================================================

This is the default execution engine for all Aries operations.
Transforms complex workflows into simple master commands.
"""

import asyncio
import subprocess
import os
import sys
from pathlib import Path
import json

SOVEREIGN_CORE_PATH = "/Users/lennyfinn/.openclaw/workspace/sovereign-core"

class SovereignExecutor:
    """Enhanced Sovereign Command Architecture Executor"""
    
    def __init__(self):
        self.sovereign_path = Path(SOVEREIGN_CORE_PATH)
        self.venv_python = self.sovereign_path / "venv" / "bin" / "python"
        
    async def execute(self, command: str) -> dict:
        """Execute a sovereign master command."""
        try:
            # For now, use the runner script
            runner_script = self.sovereign_path / "run_sovereign.py"
            
            if not runner_script.exists():
                return {
                    "status": "error", 
                    "message": "Sovereign system not found. Please check installation."
                }
            
            # Execute the command
            result = subprocess.run([
                str(self.venv_python), 
                str(runner_script), 
                command
            ], 
            cwd=str(self.sovereign_path),
            capture_output=True, 
            text=True
            )
            
            if result.returncode == 0:
                return {
                    "status": "success",
                    "command": command,
                    "output": result.stdout,
                    "mode": "sovereign"
                }
            else:
                return {
                    "status": "error",
                    "command": command,
                    "error": result.stderr,
                    "output": result.stdout
                }
                
        except Exception as e:
            return {
                "status": "error",
                "command": command, 
                "error": str(e)
            }
    
    def is_sovereign_command(self, user_input: str) -> bool:
        """Check if input should use sovereign command architecture."""
        # Check for explicit master commands
        master_prefixes = ["BLD:", "ANZ:", "SYS:", "QRY:", "MEM:"]
        if any(user_input.startswith(prefix) for prefix in master_prefixes):
            return True
            
        # Check for sovereign-appropriate tasks
        sovereign_keywords = [
            "build", "create", "make", "generate", "construct",
            "analyze", "review", "audit", "check", "examine", 
            "deploy", "status", "backup", "monitor", "clean",
            "find", "search", "query", "lookup", "locate",
            "remember", "save", "recall", "store", "retrieve"
        ]
        
        return any(keyword in user_input.lower() for keyword in sovereign_keywords)
    
    def suggest_sovereign_command(self, user_input: str) -> str:
        """Suggest appropriate sovereign command for user input."""
        lower_input = user_input.lower()
        
        # Build-related suggestions
        if any(word in lower_input for word in ["build", "create", "make", "generate"]):
            if "app" in lower_input or "application" in lower_input:
                return "BLD:APP"
            elif "api" in lower_input:
                return "BLD:API" 
            elif "component" in lower_input:
                return "BLD:CMP"
            else:
                return "BLD:APP"
                
        # Analysis-related suggestions
        elif any(word in lower_input for word in ["analyze", "review", "audit", "check"]):
            if "code" in lower_input:
                return "ANZ:CODE"
            elif "performance" in lower_input or "perf" in lower_input:
                return "ANZ:PERF"
            elif "cost" in lower_input:
                return "ANZ:COST"
            elif "security" in lower_input or "sec" in lower_input:
                return "ANZ:SEC"
            else:
                return "ANZ:CODE"
                
        # System-related suggestions
        elif any(word in lower_input for word in ["status", "health", "deploy", "backup"]):
            if "status" in lower_input or "health" in lower_input:
                return "SYS:STATUS"
            elif "backup" in lower_input:
                return "SYS:BACKUP"
            elif "deploy" in lower_input:
                return "SYS:DEPLOY"
            else:
                return "SYS:STATUS"
                
        # Query-related suggestions  
        elif any(word in lower_input for word in ["find", "search", "query", "lookup"]):
            if "docs" in lower_input or "documentation" in lower_input:
                return "QRY:DOCS"
            else:
                return "QRY:FIND"
                
        # Memory-related suggestions
        elif any(word in lower_input for word in ["remember", "save", "recall", "store"]):
            return "MEM:SAVE"
            
        else:
            return "SYS:STATUS"  # Default fallback

# Global executor instance
_executor = SovereignExecutor()

async def execute_sovereign(command: str) -> dict:
    """Main execution function for sovereign commands."""
    return await _executor.execute(command)

def should_use_sovereign(user_input: str) -> bool:
    """Check if user input should use sovereign architecture."""
    return _executor.is_sovereign_command(user_input)

def get_sovereign_suggestion(user_input: str) -> str:
    """Get suggested sovereign command for user input."""
    return _executor.suggest_sovereign_command(user_input)

if __name__ == "__main__":
    # Test execution
    if len(sys.argv) > 1:
        command = sys.argv[1]
        result = asyncio.run(execute_sovereign(command))
        print(json.dumps(result, indent=2))
    else:
        print("Usage: python sovereign_executor.py 'COMMAND'")