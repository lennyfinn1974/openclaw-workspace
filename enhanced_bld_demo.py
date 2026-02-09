#!/usr/bin/env python3
"""
Enhanced BLD Workflow Demo
==========================

Demonstrates the integration of Agent Teams patterns with your existing
BLD workflow while maintaining Max subscription compatibility.

Usage:
    python enhanced_bld_demo.py "BLD:APP trading-dashboard --auto-spawn"
"""

import asyncio
import json
import sys
from pathlib import Path

# Add sovereign-core to path
sys.path.insert(0, str(Path(__file__).parent / "sovereign-core"))

from sovereign import Sovereign
from handlers.enhanced_bld import enhanced_bld_app, TeamCoordination, SpecializedAgentPrompts


async def demo_enhanced_bld_workflow(command: str):
    """Demo the enhanced BLD workflow with Agent Teams patterns"""
    
    print("🚀 ENHANCED BLD WORKFLOW DEMO")
    print("=" * 50)
    print(f"Command: {command}")
    print()
    
    # Initialize Sovereign system
    sov = Sovereign()
    
    # Parse the command
    parsed = sov.commands.parse(command)
    if not parsed:
        print("❌ Invalid command format")
        return
    
    print("📋 PHASE 1: PRD Generation + Task Pool Creation")
    print("-" * 50)
    
    # Execute enhanced BLD handler
    result = await enhanced_bld_app(parsed, sov.router)
    
    if not result.get("success"):
        print(f"❌ PRD Generation failed: {result.get('error')}")
        return
    
    print("✅ PRD Generated successfully")
    print(f"📄 App: {result.get('app_name')}")
    print(f"🎯 Type: {result.get('app_type')}")
    
    # Show coordination setup
    coord_info = result.get("coordination", {})
    print(f"\n📁 Coordination Directory: {coord_info.get('coordination_dir')}")
    print(f"📋 Task Files Created: {coord_info.get('workstreams_created')}")
    
    print("\n🤖 PHASE 2: Specialized Agent Architecture")
    print("-" * 50)
    
    team_arch = result.get("team_architecture", {})
    for specialist in team_arch.get("specialists", []):
        print(f"  🔧 {specialist['role']}: {specialist['focus']}")
    
    print(f"\n📡 Communication: {team_arch.get('communication_protocol')}")
    print(f"🔄 Coordination: {team_arch.get('coordination_pattern')}")
    
    print("\n🚀 PHASE 3: Agent Spawn Commands (Max Compatible)")
    print("-" * 50)
    
    spawn_commands = coord_info.get("agent_spawn_commands", [])
    for i, cmd in enumerate(spawn_commands, 1):
        print(f"\n  Agent {i}: {cmd['agentId']}")
        print(f"    Timeout: {cmd['runTimeoutSeconds']}s")
        print(f"    Cleanup: {cmd['cleanup']}")
        
        # Show sample of specialized prompt (truncated)
        prompt_preview = cmd['task'][:200] + "..." if len(cmd['task']) > 200 else cmd['task']
        print(f"    Prompt Preview: {prompt_preview}")
    
    print(f"\n⚡ PHASE 4: Enhanced Features")
    print("-" * 50)
    
    enhancements = result.get("enhancements", {})
    for feature, description in enhancements.items():
        print(f"  ✨ {feature.replace('_', ' ').title()}: {description}")
    
    print(f"\n⏱️  Total Duration: {result.get('duration_ms', 0):.1f}ms")
    print()
    
    # Show file structure created
    workspace_path = Path("~/.openclaw/workspace").expanduser()
    coord_dir = workspace_path / "coordination"
    
    if coord_dir.exists():
        print("📂 Coordination Files Created:")
        for task_file in (coord_dir / "tasks").glob("*.json"):
            with open(task_file) as f:
                task_data = json.load(f)
            print(f"  📋 {task_file.name}: {task_data.get('focus', 'Unknown')}")
    
    print("\n🎯 NEXT STEPS:")
    print("1. Run actual agent spawning via OpenClaw sessions_spawn")
    print("2. Agents read their task files and begin specialized work")  
    print("3. File-based coordination ensures no conflicts")
    print("4. Reduced prompts via specialization = faster execution")
    print("5. All on Max subscription - no upgrade required!")


def show_comparison():
    """Show comparison between old and new workflow"""
    
    print("\n🔄 WORKFLOW COMPARISON")
    print("=" * 50)
    
    print("❌ OLD BLD WORKFLOW:")
    print("  1. BLD:APP → PRD generation")
    print("  2. Create 5 generic Claude Code terminals")
    print("  3. Manual coordination between terminals")
    print("  4. Generic prompts for each terminal")
    print("  5. Risk of overlapping work")
    
    print("\n✅ ENHANCED BLD WORKFLOW (Agent Teams Patterns):")
    print("  1. BLD:APP → PRD + specialized task pool")
    print("  2. Create 5 specialized agents with clear roles")
    print("  3. File-based coordination (like Agent Teams)")
    print("  4. Reduced prompt complexity via specialization")
    print("  5. Automatic dependency management")
    print("  6. Structured output and communication")
    print("  7. Max subscription compatible!")
    
    print("\n🎯 KEY IMPROVEMENTS:")
    print("  ⚡ Faster execution (specialized vs generic prompts)")
    print("  🎯 Clear role boundaries (no overlap)")
    print("  📋 Task dependency management")
    print("  💰 Same cost (Max subscription)")
    print("  🔄 Agent Teams coordination without paywall")


async def main():
    """Main demo function"""
    
    # Default command if none provided
    command = sys.argv[1] if len(sys.argv) > 1 else "BLD:APP trading-dashboard --auto-spawn"
    
    await demo_enhanced_bld_workflow(command)
    show_comparison()
    
    print("\n🚀 Ready to integrate enhanced patterns into your BLD workflow!")


if __name__ == "__main__":
    asyncio.run(main())