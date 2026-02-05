"""
Master Command System
=====================

3-letter command prefixes for sovereign operations:

BUILD Commands (BLD):
    BLD:APP     - Build application
    BLD:API     - Build API endpoint
    BLD:CMP     - Build component
    BLD:SVC     - Build service
    BLD:TST     - Build tests

ANALYZE Commands (ANZ):
    ANZ:CODE    - Analyze code
    ANZ:PERF    - Analyze performance
    ANZ:SEC     - Security analysis
    ANZ:DEP     - Dependency analysis
    ANZ:ARC     - Architecture analysis

SYSTEM Commands (SYS):
    SYS:STATUS  - System status
    SYS:CONFIG  - Configuration
    SYS:LOG     - View logs
    SYS:CLEAR   - Clear cache/state
    SYS:SYNC    - Sync state

QUERY Commands (QRY):
    QRY:FIND    - Find files/content
    QRY:SEARCH  - Search workspace
    QRY:GREP    - Pattern search
    QRY:HIST    - History query

CREATE Commands (CRT):
    CRT:FILE    - Create file
    CRT:DIR     - Create directory
    CRT:DOC     - Create documentation
    CRT:SKILL   - Create skill

MEMORY Commands (MEM):
    MEM:SAVE    - Save to memory
    MEM:LOAD    - Load from memory
    MEM:LIST    - List memories
    MEM:CLEAR   - Clear memory
"""

import re
from dataclasses import dataclass
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Tuple


class CommandPrefix(str, Enum):
    """Master command prefixes."""
    BLD = "BLD"  # Build
    ANZ = "ANZ"  # Analyze
    SYS = "SYS"  # System
    QRY = "QRY"  # Query
    CRT = "CRT"  # Create
    MEM = "MEM"  # Memory
    FND = "FND"  # Find
    RUN = "RUN"  # Run/Execute
    TST = "TST"  # Test
    DOC = "DOC"  # Document
    SEC = "SEC"  # Security
    OPT = "OPT"  # Optimize
    ARC = "ARC"  # Architecture
    DEP = "DEP"  # Deploy


@dataclass
class MasterCommand:
    """A parsed master command."""
    prefix: CommandPrefix
    action: str
    args: List[str]
    raw: str
    flags: Dict[str, Any]

    @property
    def full_action(self) -> str:
        return f"{self.prefix.value}:{self.action}"

    def __str__(self) -> str:
        return f"{self.prefix.value}:{self.action} {' '.join(self.args)}"


class CommandRegistry:
    """Registry and parser for master commands."""

    # Command pattern: PREFIX:ACTION [args] [--flags]
    PATTERN = re.compile(
        r'^([A-Z]{3}):([A-Z_]+)\s*(.*)?$',
        re.IGNORECASE
    )

    def __init__(self):
        self.handlers: Dict[str, Callable] = {}
        self._register_defaults()

    def _register_defaults(self):
        """Register default command handlers."""
        # These will be overridden by actual implementations
        default_commands = [
            # Build
            ("BLD:APP", "Build application"),
            ("BLD:API", "Build API endpoint"),
            ("BLD:CMP", "Build component"),
            ("BLD:SVC", "Build service"),
            ("BLD:TST", "Build tests"),
            # Analyze
            ("ANZ:CODE", "Analyze code"),
            ("ANZ:PERF", "Performance analysis"),
            ("ANZ:SEC", "Security analysis"),
            ("ANZ:DEP", "Dependency analysis"),
            ("ANZ:ARC", "Architecture analysis"),
            # System
            ("SYS:STATUS", "System status"),
            ("SYS:CONFIG", "Configuration"),
            ("SYS:LOG", "View logs"),
            ("SYS:CLEAR", "Clear cache"),
            ("SYS:SYNC", "Sync state"),
            # Query
            ("QRY:FIND", "Find files"),
            ("QRY:SEARCH", "Search workspace"),
            ("QRY:GREP", "Pattern search"),
            ("QRY:HIST", "History query"),
            # Create
            ("CRT:FILE", "Create file"),
            ("CRT:DIR", "Create directory"),
            ("CRT:DOC", "Create documentation"),
            ("CRT:SKILL", "Create skill"),
            # Memory
            ("MEM:SAVE", "Save to memory"),
            ("MEM:LOAD", "Load from memory"),
            ("MEM:LIST", "List memories"),
            ("MEM:CLEAR", "Clear memory"),
        ]
        for cmd, desc in default_commands:
            self.handlers[cmd] = {"description": desc, "handler": None}

    def parse(self, command_str: str) -> Optional[Dict[str, Any]]:
        """Parse a command string into components."""
        command_str = command_str.strip()

        match = self.PATTERN.match(command_str)
        if not match:
            return None

        prefix_str, action, args_str = match.groups()

        try:
            prefix = CommandPrefix(prefix_str.upper())
        except ValueError:
            return None

        # Parse args and flags
        args, flags = self._parse_args(args_str or "")

        return {
            "prefix": prefix.value,
            "action": action.upper(),
            "args": args,
            "flags": flags,
            "raw": command_str,
        }

    def _parse_args(self, args_str: str) -> Tuple[List[str], Dict[str, Any]]:
        """Parse arguments and flags from string."""
        args = []
        flags = {}

        if not args_str:
            return args, flags

        parts = args_str.split()
        i = 0
        while i < len(parts):
            part = parts[i]
            if part.startswith("--"):
                key = part[2:]
                if "=" in key:
                    k, v = key.split("=", 1)
                    flags[k] = v
                elif i + 1 < len(parts) and not parts[i + 1].startswith("-"):
                    flags[key] = parts[i + 1]
                    i += 1
                else:
                    flags[key] = True
            elif part.startswith("-"):
                flags[part[1:]] = True
            else:
                args.append(part)
            i += 1

        return args, flags

    def register(self, command: str, handler: Callable, description: str = ""):
        """Register a command handler."""
        self.handlers[command.upper()] = {
            "handler": handler,
            "description": description,
        }

    def get_handler(self, prefix: str, action: str) -> Optional[Callable]:
        """Get handler for a command."""
        key = f"{prefix}:{action}".upper()
        entry = self.handlers.get(key)
        return entry["handler"] if entry else None

    def list_commands(self, prefix: str = None) -> List[Dict[str, str]]:
        """List registered commands."""
        commands = []
        for cmd, info in self.handlers.items():
            if prefix and not cmd.startswith(prefix.upper()):
                continue
            commands.append({
                "command": cmd,
                "description": info.get("description", ""),
            })
        return sorted(commands, key=lambda x: x["command"])


# Command shortcuts for common operations
SHORTCUTS = {
    "build": "BLD:APP",
    "analyze": "ANZ:CODE",
    "status": "SYS:STATUS",
    "find": "QRY:FIND",
    "search": "QRY:SEARCH",
    "create": "CRT:FILE",
    "save": "MEM:SAVE",
    "load": "MEM:LOAD",
    "test": "TST:RUN",
    "deploy": "DEP:APP",
}


def expand_shortcut(cmd: str) -> str:
    """Expand command shortcut to full form."""
    parts = cmd.split(None, 1)
    if parts and parts[0].lower() in SHORTCUTS:
        expanded = SHORTCUTS[parts[0].lower()]
        if len(parts) > 1:
            expanded += " " + parts[1]
        return expanded
    return cmd
