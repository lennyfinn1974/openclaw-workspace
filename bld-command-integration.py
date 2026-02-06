#!/usr/bin/env python3
"""
BLD Command Integration for OpenClaw
====================================

Integrates Sovereign Command Architecture BLD commands with OpenClaw agent system.
Creates /cmd endpoint and workflow automation.
"""

import asyncio
import json
import subprocess
import tempfile
from pathlib import Path


async def execute_bld_command(command: str, args: list = None, flags: dict = None):
    """Execute BLD command with OpenClaw agent integration."""
    
    print(f"🚀 Executing BLD Command: {command}")
    print(f"📝 Args: {args}")
    print(f"🔧 Flags: {flags}")
    
    # Phase 1: Generate PRD using Gemini via OpenClaw
    if command == "BLD:APP":
        app_name = args[0] if args else "application"
        
        # Create enhanced prompt for PRD generation
        prd_prompt = f"""Create a comprehensive Product Requirements Document (PRD) for a {app_name} web application.

CONTEXT: This is for autonomous development using Claude Code terminals with minimal human intervention.

Include these sections:

1. EXECUTIVE SUMMARY 
   - High-level overview and value proposition
   
2. TECHNICAL ARCHITECTURE
   - Modern web stack recommendations
   - Database design
   - API structure
   
3. FEATURE BREAKDOWN
   - Core features with detailed specifications
   - User authentication and authorization
   - User interface requirements
   
4. WORKSTREAM ALLOCATION
   Break down development into 5 autonomous workstreams:
   
   **Frontend Team:**
   - Component library setup
   - UI/UX implementation 
   - State management
   - Authentication integration
   
   **Backend API Team:**
   - API endpoints design
   - Authentication middleware
   - Data models
   - Business logic
   
   **Database Team:**
   - Schema design
   - Migration scripts
   - Data seeding
   - Optimization
   
   **Testing Team:**
   - Unit test framework
   - Integration tests
   - E2E testing
   - Test automation
   
   **CI/CD Team:**
   - Build pipeline
   - Deployment automation
   - Environment management
   - Monitoring setup

5. IMPLEMENTATION SEQUENCE
   - Phase-by-phase development plan
   - Cross-team dependencies
   - Integration checkpoints

Focus on creating actionable specifications that autonomous AI development teams can implement with minimal coordination."""

        # Execute PRD generation via OpenClaw agent
        print("📋 Phase 1: Generating PRD with Gemini...")
        
        try:
            result = subprocess.run([
                "openclaw", "agent",
                "--session-id", "bld-command-session",
                "--message", prd_prompt,
                "--json"
            ], capture_output=True, text=True, timeout=120)
            
            if result.returncode == 0:
                prd_result = json.loads(result.stdout)
                prd_content = prd_result.get("content", "")
                
                print("✅ PRD Generated successfully")
                print(f"📄 PRD Length: {len(prd_content)} characters")
                
                # Save PRD to file
                prd_file = Path(f"memory/PRD-{app_name}-{datetime.now().strftime('%Y%m%d-%H%M')}.md")
                prd_file.parent.mkdir(exist_ok=True)
                prd_file.write_text(f"# PRD: {app_name}\n\n{prd_content}")
                print(f"💾 PRD saved to: {prd_file}")
                
                # Phase 2: Extract workstreams
                workstreams = extract_workstreams(prd_content)
                print(f"🔄 Extracted {len(workstreams)} workstreams")
                
                # Phase 3: Create terminal sessions for each workstream
                terminal_sessions = await create_terminal_sessions(workstreams)
                print(f"🖥️ Created {len(terminal_sessions)} terminal sessions")
                
                return {
                    "status": "success",
                    "prd_file": str(prd_file),
                    "workstreams": workstreams,
                    "terminal_sessions": terminal_sessions,
                    "message": f"BLD:APP {app_name} - PRD generated and workstreams allocated"
                }
                
            else:
                error_msg = result.stderr or "Unknown error"
                print(f"❌ PRD Generation failed: {error_msg}")
                return {
                    "status": "error",
                    "error": f"PRD generation failed: {error_msg}"
                }
                
        except Exception as e:
            print(f"❌ Exception in PRD generation: {e}")
            return {
                "status": "error", 
                "error": f"Exception: {str(e)}"
            }
            
    else:
        return {
            "status": "error",
            "error": f"Unsupported BLD command: {command}"
        }


def extract_workstreams(prd_content: str) -> list:
    """Extract workstream information from PRD content."""
    workstreams = []
    
    # Simple extraction - look for team sections
    team_keywords = [
        ("frontend", "Frontend Team"),
        ("backend", "Backend API Team"), 
        ("database", "Database Team"),
        ("testing", "Testing Team"),
        ("ci-cd", "CI/CD Team")
    ]
    
    for keyword, team_name in team_keywords:
        # Extract content for each team
        start_marker = team_name
        if start_marker.lower() in prd_content.lower():
            workstreams.append({
                "id": keyword,
                "name": team_name,
                "description": f"Tasks for {team_name}",
                "status": "ready"
            })
    
    return workstreams


async def create_terminal_sessions(workstreams: list) -> list:
    """Create Claude Code terminal sessions for each workstream."""
    terminal_sessions = []
    
    for i, workstream in enumerate(workstreams):
        try:
            # Create new terminal window for workstream
            script_command = f"""
cd /Users/lennyfinn/.openclaw/workspace && 
echo "🚀 {workstream['name']} Workstream" && 
echo "Status: {workstream['status']}" &&
echo "Ready for Claude Code development..." &&
claude
"""
            
            result = subprocess.run([
                "osascript", "-e", 
                f'tell application "Terminal" to do script "{script_command}"'
            ], capture_output=True, text=True)
            
            if result.returncode == 0:
                window_id = result.stdout.strip()
                terminal_sessions.append({
                    "workstream_id": workstream["id"],
                    "workstream_name": workstream["name"], 
                    "window_id": window_id,
                    "status": "active"
                })
                print(f"✅ Created terminal for {workstream['name']}: {window_id}")
            else:
                print(f"❌ Failed to create terminal for {workstream['name']}")
                
        except Exception as e:
            print(f"❌ Exception creating terminal for {workstream['name']}: {e}")
    
    return terminal_sessions


# Test the BLD command integration
async def main():
    """Test the BLD command integration."""
    print("🧪 Testing BLD Command Integration")
    print("=" * 50)
    
    # Test BLD:APP command
    result = await execute_bld_command("BLD:APP", ["dashboard"], {"with-auth": True})
    
    print("\n📊 Final Result:")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    from datetime import datetime
    asyncio.run(main())