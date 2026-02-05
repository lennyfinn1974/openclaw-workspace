"""
Context Protection System
=========================

Manages protected context for sovereign operations:
- Separates sensitive vs shareable context
- Prevents context leakage between operations
- Maintains session isolation
- Provides context compression for efficiency

Protection Levels:
    NONE     - No protection, full context available
    PARTIAL  - Filter sensitive fields
    FULL     - Minimal context, operation-specific only
"""

import hashlib
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum, auto
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger("sovereign.context")


class ProtectionLevel(Enum):
    """Context protection levels."""
    NONE = auto()      # Full context available
    PARTIAL = auto()   # Filter sensitive fields
    FULL = auto()      # Minimal context only


@dataclass
class ContextFrame:
    """A single frame of context."""
    id: str
    content: str
    source: str
    timestamp: str
    protection: ProtectionLevel = ProtectionLevel.NONE
    tokens_estimate: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)


class ContextProtector:
    """Manages protected context for sovereign operations."""

    # Fields to filter in PARTIAL protection mode
    SENSITIVE_FIELDS = {
        "api_key", "password", "secret", "token", "credential",
        "private_key", "auth", "bearer", "session_id", "cookie",
        "ssn", "credit_card", "bank_account", "phone", "email",
    }

    # Prefixes that require FULL protection
    PROTECTED_PREFIXES = {"SEC", "ARC", "DEP"}

    def __init__(self, context_path: Optional[Path] = None):
        self.context_path = context_path
        self._frames: List[ContextFrame] = []
        self._protected = False
        self._protection_level = ProtectionLevel.NONE
        self._session_contexts: Dict[str, List[ContextFrame]] = {}
        self._max_frames = 100
        self._max_tokens = 50000

    def add_frame(
        self,
        content: str,
        source: str,
        protection: ProtectionLevel = ProtectionLevel.NONE,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Add a context frame."""
        frame_id = self._generate_frame_id(content, source)

        frame = ContextFrame(
            id=frame_id,
            content=content,
            source=source,
            timestamp=datetime.now().isoformat(),
            protection=protection,
            tokens_estimate=self._estimate_tokens(content),
            metadata=metadata or {},
        )

        self._frames.append(frame)

        # Trim old frames if needed
        self._trim_frames()

        logger.debug(f"Added context frame: {frame_id} ({frame.tokens_estimate} tokens)")
        return frame_id

    def get_protected_context(self, prefix: str = "") -> str:
        """Get context appropriate for the given command prefix."""
        # Determine protection level
        if prefix.upper() in self.PROTECTED_PREFIXES:
            level = ProtectionLevel.FULL
        elif self._protected:
            level = self._protection_level
        else:
            level = ProtectionLevel.NONE

        # Build context based on protection level
        if level == ProtectionLevel.FULL:
            return self._get_minimal_context()
        elif level == ProtectionLevel.PARTIAL:
            return self._get_filtered_context()
        else:
            return self._get_full_context()

    def _get_full_context(self) -> str:
        """Get full unfiltered context."""
        parts = []
        for frame in self._frames[-20:]:  # Last 20 frames
            if frame.protection == ProtectionLevel.FULL:
                continue  # Skip protected frames
            parts.append(f"[{frame.source}]\n{frame.content}")
        return "\n\n".join(parts)

    def _get_filtered_context(self) -> str:
        """Get context with sensitive fields filtered."""
        parts = []
        for frame in self._frames[-15:]:  # Last 15 frames
            if frame.protection == ProtectionLevel.FULL:
                continue
            filtered = self._filter_sensitive(frame.content)
            parts.append(f"[{frame.source}]\n{filtered}")
        return "\n\n".join(parts)

    def _get_minimal_context(self) -> str:
        """Get minimal context for protected operations."""
        # Only include non-protected frames from last 5
        parts = []
        for frame in self._frames[-5:]:
            if frame.protection != ProtectionLevel.NONE:
                continue
            # Further compress content
            compressed = self._compress_content(frame.content)
            parts.append(f"[{frame.source}] {compressed}")
        return "\n".join(parts)

    def _filter_sensitive(self, content: str) -> str:
        """Filter sensitive fields from content."""
        lines = content.split("\n")
        filtered = []
        for line in lines:
            lower_line = line.lower()
            is_sensitive = any(
                field in lower_line for field in self.SENSITIVE_FIELDS
            )
            if is_sensitive:
                # Redact the value part
                if ":" in line:
                    key = line.split(":")[0]
                    filtered.append(f"{key}: [REDACTED]")
                elif "=" in line:
                    key = line.split("=")[0]
                    filtered.append(f"{key}=[REDACTED]")
                else:
                    filtered.append("[SENSITIVE LINE REDACTED]")
            else:
                filtered.append(line)
        return "\n".join(filtered)

    def _compress_content(self, content: str, max_length: int = 200) -> str:
        """Compress content to essential summary."""
        # Take first and last portions
        if len(content) <= max_length:
            return content

        half = max_length // 2
        return content[:half] + "..." + content[-half:]

    def _estimate_tokens(self, text: str) -> int:
        """Estimate token count (rough: ~4 chars per token)."""
        return len(text) // 4

    def _generate_frame_id(self, content: str, source: str) -> str:
        """Generate unique frame ID."""
        data = f"{content[:100]}{source}{datetime.now().isoformat()}"
        return hashlib.sha256(data.encode()).hexdigest()[:12]

    def _trim_frames(self):
        """Trim frames to stay within limits."""
        # By count
        if len(self._frames) > self._max_frames:
            self._frames = self._frames[-self._max_frames:]

        # By tokens
        total_tokens = sum(f.tokens_estimate for f in self._frames)
        while total_tokens > self._max_tokens and len(self._frames) > 5:
            removed = self._frames.pop(0)
            total_tokens -= removed.tokens_estimate

    def set_protection(self, enabled: bool, level: ProtectionLevel = ProtectionLevel.PARTIAL):
        """Enable or disable context protection."""
        self._protected = enabled
        self._protection_level = level
        logger.info(f"Context protection: {'enabled' if enabled else 'disabled'} (level={level.name})")

    def is_protected(self) -> bool:
        """Check if context protection is enabled."""
        return self._protected

    def create_session_context(self, session_id: str) -> None:
        """Create isolated context for a session."""
        self._session_contexts[session_id] = []
        logger.debug(f"Created session context: {session_id}")

    def add_to_session(self, session_id: str, content: str, source: str) -> None:
        """Add context to a specific session."""
        if session_id not in self._session_contexts:
            self.create_session_context(session_id)

        frame = ContextFrame(
            id=self._generate_frame_id(content, source),
            content=content,
            source=source,
            timestamp=datetime.now().isoformat(),
            tokens_estimate=self._estimate_tokens(content),
        )
        self._session_contexts[session_id].append(frame)

    def get_session_context(self, session_id: str) -> str:
        """Get context for a specific session."""
        frames = self._session_contexts.get(session_id, [])
        parts = [f"[{f.source}]\n{f.content}" for f in frames[-10:]]
        return "\n\n".join(parts)

    def clear_session(self, session_id: str) -> None:
        """Clear a session's context."""
        if session_id in self._session_contexts:
            del self._session_contexts[session_id]
            logger.debug(f"Cleared session context: {session_id}")

    def get_stats(self) -> Dict[str, Any]:
        """Get context statistics."""
        total_tokens = sum(f.tokens_estimate for f in self._frames)
        return {
            "total_frames": len(self._frames),
            "total_tokens_estimate": total_tokens,
            "protection_enabled": self._protected,
            "protection_level": self._protection_level.name,
            "active_sessions": len(self._session_contexts),
            "frames_by_protection": {
                level.name: sum(1 for f in self._frames if f.protection == level)
                for level in ProtectionLevel
            },
        }

    def export_context(self, filepath: Path) -> bool:
        """Export current context to file."""
        try:
            data = {
                "exported_at": datetime.now().isoformat(),
                "frames": [
                    {
                        "id": f.id,
                        "content": f.content if f.protection == ProtectionLevel.NONE else "[PROTECTED]",
                        "source": f.source,
                        "timestamp": f.timestamp,
                        "protection": f.protection.name,
                    }
                    for f in self._frames
                ],
            }
            filepath.write_text(json.dumps(data, indent=2))
            return True
        except Exception as e:
            logger.error(f"Export error: {e}")
            return False
