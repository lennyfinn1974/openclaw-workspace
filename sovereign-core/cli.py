#!/usr/bin/env python3
"""
Sovereign CLI
=============

Command-line interface for the Sovereign Command Architecture.

Usage:
    python -m sovereign.cli "BLD:APP web-dashboard"
    python -m sovereign.cli "SYS:STATUS"
    python -m sovereign.cli --interactive
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

# Add parent to path for local development
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from sovereign import Sovereign, get_sovereign
except ImportError:
    import sys
    sys.path.insert(0, str(Path(__file__).parent))
    from sovereign import Sovereign, get_sovereign


def print_result(result: dict, json_output: bool = False):
    """Print command result."""
    if json_output:
        print(json.dumps(result, indent=2, default=str))
        return

    if "error" in result:
        print(f"❌ Error: {result['error']}")
        return

    # Format output
    print(f"\n{'=' * 60}")
    print(f"Model: {result.get('model', 'unknown')} (Tier: {result.get('tier', 'unknown')})")
    print(f"Duration: {result.get('duration_ms', 0):.0f}ms")
    print(f"Tokens: {result.get('tokens_in', 0)} in / {result.get('tokens_out', 0)} out")
    print(f"{'=' * 60}\n")

    content = result.get("content", "")
    if content:
        print(content)
    else:
        print("(No content returned)")
    print()


async def interactive_mode(sov: Sovereign):
    """Run interactive command mode."""
    print("\n🔱 Sovereign Command Architecture v1.0")
    print("=" * 40)
    print("Enter commands in format: PREFIX:ACTION [args]")
    print("Examples:")
    print("  BLD:APP web-dashboard")
    print("  ANZ:CODE ./src/main.py")
    print("  SYS:STATUS")
    print("\nType 'help' for command list, 'quit' to exit\n")

    while True:
        try:
            command = input("sovereign> ").strip()

            if not command:
                continue

            if command.lower() in ("quit", "exit", "q"):
                print("Goodbye!")
                break

            if command.lower() == "help":
                print_help(sov)
                continue

            if command.lower() == "status":
                print_status(sov)
                continue

            # Execute command
            result = await sov.execute(command)
            print_result(result)

        except KeyboardInterrupt:
            print("\nGoodbye!")
            break
        except EOFError:
            break


def print_help(sov: Sovereign):
    """Print available commands."""
    print("\n📚 Available Commands:\n")
    commands = sov.commands.list_commands()
    current_prefix = ""

    for cmd in commands:
        prefix = cmd["command"].split(":")[0]
        if prefix != current_prefix:
            current_prefix = prefix
            print(f"\n{prefix}:")
        print(f"  {cmd['command']:15} - {cmd['description']}")

    print("\n📝 Shortcuts:")
    try:
        from sovereign.commands import SHORTCUTS
    except ImportError:
        from commands import SHORTCUTS
    for shortcut, full in SHORTCUTS.items():
        print(f"  {shortcut:10} -> {full}")
    print()


def print_status(sov: Sovereign):
    """Print system status."""
    status = sov.get_status()
    print("\n📊 System Status:\n")
    print(f"  Session ID:      {status['session_id']}")
    print(f"  Workspace:       {status['workspace']}")
    print(f"  Commands Run:    {status['commands_executed']}")
    print(f"  Context Protected: {status['context_protected']}")

    router = status.get("router_status", {})
    if router:
        print(f"\n  Router Stats:")
        print(f"    Total Requests: {router.get('total_requests', 0)}")
        print(f"    Total Cost:     ${router.get('total_cost_usd', 0):.4f}")
        print(f"    Savings:        ${router.get('savings_usd', 0):.4f}")
        print(f"    Escalations:    {router.get('escalations', 0)}")
        print(f"    Available:      {', '.join(router.get('available_models', []))}")
    print()


async def main():
    parser = argparse.ArgumentParser(
        description="Sovereign Command Architecture CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s "BLD:APP web-dashboard"     Build an application
  %(prog)s "ANZ:CODE ./src/main.py"    Analyze code
  %(prog)s "SYS:STATUS"                Check system status
  %(prog)s --interactive               Interactive mode
  %(prog)s --list                      List all commands
        """,
    )

    parser.add_argument(
        "command",
        nargs="?",
        help="Command to execute (e.g., 'BLD:APP web-dashboard')",
    )
    parser.add_argument(
        "-i", "--interactive",
        action="store_true",
        help="Run in interactive mode",
    )
    parser.add_argument(
        "-j", "--json",
        action="store_true",
        help="Output results as JSON",
    )
    parser.add_argument(
        "-l", "--list",
        action="store_true",
        help="List available commands",
    )
    parser.add_argument(
        "-s", "--status",
        action="store_true",
        help="Show system status",
    )
    parser.add_argument(
        "-w", "--workspace",
        type=Path,
        help="Workspace directory",
    )

    args = parser.parse_args()

    # Initialize Sovereign
    sov = Sovereign(workspace=args.workspace) if args.workspace else get_sovereign()

    # Handle modes
    if args.list:
        print_help(sov)
        return

    if args.status:
        print_status(sov)
        return

    if args.interactive or not args.command:
        await interactive_mode(sov)
        return

    # Execute single command
    result = await sov.execute(args.command)
    print_result(result, json_output=args.json)

    # Exit with error code if command failed
    if "error" in result:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
