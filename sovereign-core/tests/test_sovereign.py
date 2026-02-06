"""
Sovereign Command Architecture Tests
====================================

Tests for all major components:
- Command parsing
- Model routing
- Storage operations
- Context protection
- Hybrid search
"""

import asyncio
import json
import pytest
import sys
import tempfile
from pathlib import Path

# Add parent for imports
parent_dir = str(Path(__file__).parent.parent)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

# Import modules directly (not as package)
from commands import CommandRegistry, CommandPrefix
from routing import TieredRouter, ModelTier, MODELS
from storage import SovereignStorage
from context import ContextProtector, ProtectionLevel
from search import HybridSearch


# =============================================================================
# Command Tests
# =============================================================================

class TestCommandRegistry:
    """Test command parsing and registry."""

    def setup_method(self):
        self.registry = CommandRegistry()

    def test_parse_simple_command(self):
        """Parse basic command."""
        result = self.registry.parse("BLD:APP")
        assert result is not None
        assert result["prefix"] == "BLD"
        assert result["action"] == "APP"
        assert result["args"] == []

    def test_parse_command_with_args(self):
        """Parse command with arguments."""
        result = self.registry.parse("BLD:APP web-dashboard --env=prod")
        assert result is not None
        assert result["args"] == ["web-dashboard"]
        assert result["flags"]["env"] == "prod"

    def test_parse_command_case_insensitive(self):
        """Parse handles case variations."""
        result = self.registry.parse("bld:app test")
        assert result is not None
        assert result["prefix"] == "BLD"
        assert result["action"] == "APP"

    def test_parse_invalid_command(self):
        """Invalid commands return None."""
        assert self.registry.parse("INVALID") is None
        assert self.registry.parse("X:Y") is None  # Prefix too short
        assert self.registry.parse("TOOLONG:ACTION") is None

    def test_list_commands(self):
        """List all registered commands."""
        commands = self.registry.list_commands()
        assert len(commands) > 0
        assert any(c["command"] == "BLD:APP" for c in commands)

    def test_list_commands_by_prefix(self):
        """Filter commands by prefix."""
        bld_commands = self.registry.list_commands(prefix="BLD")
        assert all(c["command"].startswith("BLD:") for c in bld_commands)

    def test_register_handler(self):
        """Register custom handler."""
        def my_handler():
            return "test"

        self.registry.register("CUS:TEST", my_handler, "Custom test command")
        handler = self.registry.get_handler("CUS", "TEST")
        assert handler == my_handler


# =============================================================================
# Routing Tests
# =============================================================================

class TestTieredRouter:
    """Test model routing."""

    def setup_method(self):
        self.router = TieredRouter()

    def test_model_tiers_defined(self):
        """All tiers have models defined."""
        assert any(m.tier == ModelTier.LOCAL for m in MODELS.values())
        assert any(m.tier == ModelTier.BALANCED for m in MODELS.values())
        assert any(m.tier == ModelTier.PREMIUM for m in MODELS.values())

    def test_model_selection_local(self):
        """Local tier selects Ollama models."""
        model = self.router._select_model(ModelTier.LOCAL)
        # May be None if Ollama not running
        if model:
            assert model.tier == ModelTier.LOCAL
            assert model.provider == "ollama"

    def test_model_selection_balanced(self):
        """Balanced tier selects Haiku."""
        model = self.router._select_model(ModelTier.BALANCED)
        if model:
            assert model.tier == ModelTier.BALANCED

    def test_model_selection_premium(self):
        """Premium tier selects Sonnet/Opus."""
        model = self.router._select_model(ModelTier.PREMIUM)
        if model:
            assert model.tier == ModelTier.PREMIUM

    def test_build_prompt(self):
        """Prompt building works."""
        command = {"prefix": "BLD", "action": "APP", "args": ["test"]}
        prompt = self.router._build_prompt(command, "context here")
        assert "BLD:APP" in prompt
        assert "context here" in prompt
        assert "test" in prompt

    def test_stats_tracking(self):
        """Stats are tracked correctly."""
        initial = self.router.stats.total_requests
        # Note: Can't test actual routing without models
        status = self.router.get_status()
        assert "total_requests" in status
        assert "savings_usd" in status


# =============================================================================
# Storage Tests
# =============================================================================

class TestSovereignStorage:
    """Test storage operations."""

    @pytest.fixture
    def storage(self, tmp_path):
        return SovereignStorage(tmp_path / "data")

    @pytest.mark.asyncio
    async def test_append_jsonl(self, storage):
        """Append to JSONL file."""
        success = await storage.append_jsonl("test.jsonl", {"key": "value"})
        assert success

        records = await storage.read_jsonl("test.jsonl")
        assert len(records) == 1
        assert records[0]["key"] == "value"

    @pytest.mark.asyncio
    async def test_write_markdown(self, storage):
        """Write markdown with frontmatter."""
        success = await storage.write_markdown(
            "test.md",
            "# Hello World",
            {"title": "Test", "tags": ["a", "b"]},
        )
        assert success

        result = await storage.read_markdown("test.md")
        assert result is not None
        assert "Hello World" in result["content"]
        assert result["frontmatter"]["title"] == "Test"

    def test_query(self, storage):
        """Query stored records."""
        # Add some records first
        asyncio.run(storage.append_jsonl("events.jsonl", {"type": "login", "user": "alice"}))
        asyncio.run(storage.append_jsonl("events.jsonl", {"type": "logout", "user": "bob"}))

        results = storage.query("events", where={"type": "login"})
        assert len(results) == 1
        assert results[0]["user"] == "alice"

    def test_metadata(self, storage):
        """Metadata storage."""
        asyncio.run(storage.set_metadata("version", "1.0.0"))
        assert storage.get_metadata("version") == "1.0.0"
        assert storage.get_metadata("missing", "default") == "default"

    def test_status(self, storage):
        """Storage status."""
        status = storage.get_status()
        assert "data_path" in status
        assert "collections" in status


# =============================================================================
# Context Tests
# =============================================================================

class TestContextProtector:
    """Test context protection."""

    def setup_method(self):
        self.protector = ContextProtector()

    def test_add_frame(self):
        """Add context frames."""
        frame_id = self.protector.add_frame("test content", "test source")
        assert len(frame_id) == 12  # SHA256 truncated

    def test_get_context_unprotected(self):
        """Get full context when unprotected."""
        self.protector.add_frame("secret info", "source1")
        context = self.protector.get_protected_context()
        assert "secret info" in context

    def test_get_context_partial_protection(self):
        """Partial protection filters sensitive fields."""
        self.protector.add_frame("api_key: sk-12345", "config")
        self.protector.set_protection(True, ProtectionLevel.PARTIAL)
        context = self.protector.get_protected_context()
        assert "[REDACTED]" in context
        assert "sk-12345" not in context

    def test_get_context_full_protection(self):
        """Full protection provides minimal context."""
        self.protector.add_frame("detailed content here", "source1")
        self.protector.add_frame("more details", "source2")
        context = self.protector.get_protected_context("SEC")  # SEC triggers full
        # Should be compressed
        assert len(context) < len("detailed content here more details")

    def test_session_isolation(self):
        """Sessions are isolated."""
        self.protector.create_session_context("session1")
        self.protector.add_to_session("session1", "session1 data", "test")

        self.protector.create_session_context("session2")
        self.protector.add_to_session("session2", "session2 data", "test")

        ctx1 = self.protector.get_session_context("session1")
        ctx2 = self.protector.get_session_context("session2")

        assert "session1 data" in ctx1
        assert "session2 data" not in ctx1
        assert "session2 data" in ctx2

    def test_stats(self):
        """Context statistics."""
        self.protector.add_frame("test", "source")
        stats = self.protector.get_stats()
        assert stats["total_frames"] == 1
        assert "protection_level" in stats


# =============================================================================
# Search Tests
# =============================================================================

class TestHybridSearch:
    """Test hybrid search."""

    @pytest.fixture
    def search(self, tmp_path):
        return HybridSearch(tmp_path / "index")

    @pytest.mark.asyncio
    async def test_index_content(self, search):
        """Index content for search."""
        content_id = await search.index_content(
            "This is a test document about Python programming",
            metadata={"author": "test"},
            tags=["python", "tutorial"],
        )
        assert content_id > 0

    @pytest.mark.asyncio
    async def test_fts_search(self, search):
        """Full-text search."""
        await search.index_content("Python is a great programming language")
        await search.index_content("JavaScript runs in browsers")

        results = await search.query("Python", search_type="fts")
        assert len(results) > 0
        assert "Python" in results[0]["content"]

    @pytest.mark.asyncio
    async def test_vector_search(self, search):
        """Vector similarity search."""
        await search.index_content("Machine learning with neural networks")
        await search.index_content("Cooking recipes for beginners")

        results = await search.query("AI and deep learning", search_type="vector")
        assert len(results) > 0
        # ML content should rank higher than cooking
        ml_score = next((r["score"] for r in results if "Machine" in r["content"]), 0)
        cook_score = next((r["score"] for r in results if "Cooking" in r["content"]), 0)
        assert ml_score >= cook_score

    @pytest.mark.asyncio
    async def test_tag_filter(self, search):
        """Filter by tags."""
        await search.index_content("Python basics", tags=["python"])
        await search.index_content("JavaScript basics", tags=["javascript"])

        results = await search.query("basics", tags=["python"])
        assert all("Python" in r["content"] for r in results)

    def test_stats(self, search):
        """Search statistics."""
        stats = search.get_stats()
        assert "index_path" in stats
        assert "indexed_content" in stats


# =============================================================================
# Integration Tests
# =============================================================================

class TestIntegration:
    """Integration tests for full workflow."""

    @pytest.mark.asyncio
    async def test_command_to_storage(self, tmp_path):
        """Command execution stores to storage."""
        storage = SovereignStorage(tmp_path / "data")

        # Simulate command record
        record = {
            "command": "BLD:APP test",
            "prefix": "BLD",
            "action": "APP",
            "success": True,
        }
        await storage.append_jsonl("commands.jsonl", record)

        # Verify stored
        records = await storage.read_jsonl("commands.jsonl")
        assert len(records) == 1
        assert records[0]["command"] == "BLD:APP test"

    @pytest.mark.asyncio
    async def test_search_indexed_command(self, tmp_path):
        """Search finds indexed command results."""
        search = HybridSearch(tmp_path / "index")

        # Index command result
        await search.index_content(
            "Built web dashboard with React and TypeScript",
            metadata={"command": "BLD:APP web-dashboard"},
        )

        # Search should find it
        results = await search.query("React dashboard")
        assert len(results) > 0
        assert "React" in results[0]["content"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
