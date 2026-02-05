"""
Sovereign Command Architecture
==============================

A hybrid AI command system combining:
- Master Command system (3-letter prefixes: BLD, ANZ, SYS)
- Tiered model routing (80% cost savings)
- Multi-format storage (JSONL, Markdown, SQLite)
- Hybrid search (vector + full-text + file)
- Context protection

Quick Start:
    from sovereign import Sovereign, execute

    # Create instance
    sov = Sovereign()

    # Execute commands
    result = await sov.execute("BLD:APP web-dashboard")
    result = await sov.execute("ANZ:CODE ./src/main.py")
    result = await sov.execute("SYS:STATUS")

    # Or use quick functions
    result = await execute("SYS:STATUS")

Command Format:
    PREFIX:ACTION [args] [--flags]

    Prefixes:
        BLD - Build (apps, APIs, components)
        ANZ - Analyze (code, performance, security)
        SYS - System (status, config, logs)
        QRY - Query (find, search, grep)
        CRT - Create (files, directories, skills)
        MEM - Memory (save, load, list)
"""

from .sovereign import Sovereign, get_sovereign, execute, search
from .commands import CommandRegistry, CommandPrefix, MasterCommand
from .routing import TieredRouter, ModelTier, ModelConfig
from .storage import SovereignStorage
from .context import ContextProtector, ProtectionLevel
from .search import HybridSearch

__version__ = "1.0.0"
__author__ = "Aries"

__all__ = [
    # Main class
    "Sovereign",
    "get_sovereign",
    "execute",
    "search",
    # Commands
    "CommandRegistry",
    "CommandPrefix",
    "MasterCommand",
    # Routing
    "TieredRouter",
    "ModelTier",
    "ModelConfig",
    # Storage
    "SovereignStorage",
    # Context
    "ContextProtector",
    "ProtectionLevel",
    # Search
    "HybridSearch",
]
