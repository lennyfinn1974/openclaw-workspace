#!/usr/bin/env python3
"""
Enhanced Sovereign Command Architecture
=======================================

Hybrid system combining:
- Proven Sovereign AI Workspace (JSONL + Markdown + Vector/SQLite)
- Master Command system (BLD/ANZ/SYS 3-letter commands)
- Tiered model routing (80% cost savings)
- Context protection

Usage:
    from sovereign import Sovereign
    sov = Sovereign()
    result = await sov.execute("BLD:APP web-dashboard")
"""

import asyncio
import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .commands import CommandRegistry, MasterCommand
from .routing import TieredRouter, ModelTier
from .storage import SovereignStorage
from .context import ContextProtector
from .search import HybridSearch

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sovereign")

# Base paths
SOVEREIGN_HOME = Path(os.environ.get("SOVEREIGN_HOME", "~/.sovereign")).expanduser()
WORKSPACE_PATH = Path(os.environ.get("SOVEREIGN_WORKSPACE", "~/.openclaw/workspace")).expanduser()


class Sovereign:
    """Enhanced Sovereign Command Architecture - Main Controller."""

    def __init__(self, workspace: Path = None):
        self.workspace = workspace or WORKSPACE_PATH
        self.home = SOVEREIGN_HOME
        self._ensure_dirs()

        # Core components
        self.commands = CommandRegistry()
        self.router = TieredRouter()
        self.storage = SovereignStorage(self.home / "data")
        self.context = ContextProtector()
        self.search = HybridSearch(self.home / "index")

        # Session state
        self.session_id = datetime.now().strftime("%Y%m%d-%H%M%S")
        self.history: List[Dict] = []

        logger.info(f"Sovereign initialized: session={self.session_id}")

    def _ensure_dirs(self):
        """Create required directories."""
        dirs = [
            self.home,
            self.home / "data",
            self.home / "index",
            self.home / "logs",
            self.home / "context",
            self.workspace / "memory",
        ]
        for d in dirs:
            d.mkdir(parents=True, exist_ok=True)

    async def execute(self, command_str: str) -> Dict[str, Any]:
        """Execute a sovereign command.

        Command format: PREFIX:ACTION [args]
        Examples:
            BLD:APP web-dashboard
            ANZ:CODE ./src/main.py
            SYS:STATUS
        """
        start_time = datetime.now()

        # Parse command
        parsed = self.commands.parse(command_str)
        if not parsed:
            return {"error": f"Invalid command: {command_str}"}

        prefix, action, args = parsed["prefix"], parsed["action"], parsed["args"]

        # Determine model tier based on command complexity
        tier = self._determine_tier(prefix, action)
        logger.info(f"Executing {prefix}:{action} with tier={tier.name}")

        # Protect context if needed
        context = self.context.get_protected_context(prefix)

        # Route to appropriate model
        result = await self.router.route(
            tier=tier,
            command=parsed,
            context=context,
        )

        # Store execution record
        record = {
            "session": self.session_id,
            "timestamp": start_time.isoformat(),
            "command": command_str,
            "prefix": prefix,
            "action": action,
            "tier": tier.name,
            "duration_ms": (datetime.now() - start_time).total_seconds() * 1000,
            "success": "error" not in result,
        }
        self.history.append(record)
        await self.storage.append_jsonl("commands.jsonl", record)

        # Index for search
        if result.get("content"):
            await self.search.index_content(
                content=result["content"],
                metadata={"command": command_str, "timestamp": start_time.isoformat()},
            )

        return result

    def _determine_tier(self, prefix: str, action: str) -> ModelTier:
        """Determine model tier based on command complexity."""
        # Tier 1 (Local/Cheap): Simple queries, status checks
        tier1_actions = {"STATUS", "LIST", "SHOW", "GET", "CHECK", "PING"}

        # Tier 2 (Balanced): Analysis, moderate complexity
        tier2_prefixes = {"ANZ", "QRY", "FND"}

        # Tier 3 (Premium): Complex builds, architecture, critical ops
        tier3_prefixes = {"BLD", "ARC", "SEC", "CRT"}

        if action.upper() in tier1_actions:
            return ModelTier.LOCAL
        elif prefix.upper() in tier2_prefixes:
            return ModelTier.BALANCED
        elif prefix.upper() in tier3_prefixes:
            return ModelTier.PREMIUM
        else:
            return ModelTier.BALANCED

    async def search_workspace(self, query: str, limit: int = 10) -> List[Dict]:
        """Search workspace using hybrid search."""
        return await self.search.query(query, limit=limit)

    def get_status(self) -> Dict[str, Any]:
        """Get current sovereign status."""
        return {
            "session_id": self.session_id,
            "workspace": str(self.workspace),
            "commands_executed": len(self.history),
            "router_status": self.router.get_status(),
            "storage_status": self.storage.get_status(),
            "context_protected": self.context.is_protected(),
        }

    async def save_memory(self, key: str, content: str, tags: List[str] = None):
        """Save content to persistent memory."""
        memory_file = self.workspace / "memory" / f"{key}.md"
        metadata = {
            "key": key,
            "tags": tags or [],
            "created": datetime.now().isoformat(),
            "session": self.session_id,
        }

        # Write markdown with frontmatter
        frontmatter = "---\n" + "\n".join(f"{k}: {v}" for k, v in metadata.items()) + "\n---\n\n"
        memory_file.write_text(frontmatter + content)

        # Index for search
        await self.search.index_content(content, metadata)
        logger.info(f"Saved memory: {key}")

    async def load_memory(self, key: str) -> Optional[str]:
        """Load content from persistent memory."""
        memory_file = self.workspace / "memory" / f"{key}.md"
        if memory_file.exists():
            content = memory_file.read_text()
            # Strip frontmatter
            if content.startswith("---"):
                parts = content.split("---", 2)
                if len(parts) >= 3:
                    return parts[2].strip()
            return content
        return None


# Quick access functions
_sovereign: Optional[Sovereign] = None


def get_sovereign() -> Sovereign:
    """Get or create global Sovereign instance."""
    global _sovereign
    if _sovereign is None:
        _sovereign = Sovereign()
    return _sovereign


async def execute(command: str) -> Dict[str, Any]:
    """Execute a sovereign command."""
    return await get_sovereign().execute(command)


async def search(query: str, limit: int = 10) -> List[Dict]:
    """Search sovereign workspace."""
    return await get_sovereign().search_workspace(query, limit)
