"""
Tiered Model Routing System
===========================

Achieves ~80% cost savings through intelligent model selection:

Tier 1 - LOCAL (Free/Cheap):
    - Ollama local models
    - Simple queries, status checks
    - Pattern matching, file operations
    - Cost: $0.00/1K tokens

Tier 2 - BALANCED (Moderate):
    - Claude Haiku / GPT-3.5
    - Analysis, moderate complexity
    - Code review, documentation
    - Cost: ~$0.25/1M tokens

Tier 3 - PREMIUM (Full Power):
    - Claude Sonnet/Opus, GPT-4
    - Complex builds, architecture
    - Critical decisions, security
    - Cost: ~$3-15/1M tokens

Routing Strategy:
    1. Estimate complexity from command
    2. Check if lower tier can handle
    3. Route to cheapest capable tier
    4. Escalate if needed
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger("sovereign.routing")


class ModelTier(Enum):
    """Model capability tiers."""
    LOCAL = auto()      # Ollama, local models - FREE
    BALANCED = auto()   # Haiku, 3.5 - CHEAP
    PREMIUM = auto()    # Sonnet, Opus, GPT-4 - EXPENSIVE


@dataclass
class ModelConfig:
    """Configuration for a model."""
    name: str
    tier: ModelTier
    cost_per_1k_input: float  # USD
    cost_per_1k_output: float
    max_context: int
    provider: str
    endpoint: Optional[str] = None
    api_key_env: Optional[str] = None


@dataclass
class RoutingStats:
    """Statistics for routing decisions."""
    total_requests: int = 0
    requests_by_tier: Dict[str, int] = field(default_factory=dict)
    tokens_by_tier: Dict[str, int] = field(default_factory=dict)
    cost_by_tier: Dict[str, float] = field(default_factory=dict)
    escalations: int = 0
    savings_usd: float = 0.0


# Pre-configured models
MODELS = {
    # Tier 1 - Local
    "ollama-llama3": ModelConfig(
        name="llama3:8b",
        tier=ModelTier.LOCAL,
        cost_per_1k_input=0.0,
        cost_per_1k_output=0.0,
        max_context=8192,
        provider="ollama",
        endpoint="http://localhost:11434",
    ),
    "ollama-mistral": ModelConfig(
        name="mistral:7b",
        tier=ModelTier.LOCAL,
        cost_per_1k_input=0.0,
        cost_per_1k_output=0.0,
        max_context=8192,
        provider="ollama",
        endpoint="http://localhost:11434",
    ),
    "ollama-kimi": ModelConfig(
        name="kimi-k2.5:cloud",
        tier=ModelTier.LOCAL,
        cost_per_1k_input=0.0,
        cost_per_1k_output=0.0,
        max_context=32768,
        provider="ollama",
        endpoint="http://localhost:11434",
    ),

    # Tier 2 - Balanced
    "claude-haiku": ModelConfig(
        name="claude-3-haiku-20240307",
        tier=ModelTier.BALANCED,
        cost_per_1k_input=0.00025,
        cost_per_1k_output=0.00125,
        max_context=200000,
        provider="anthropic",
        api_key_env="ANTHROPIC_API_KEY",
    ),

    # Tier 3 - Premium
    "claude-sonnet": ModelConfig(
        name="claude-sonnet-4-20250514",
        tier=ModelTier.PREMIUM,
        cost_per_1k_input=0.003,
        cost_per_1k_output=0.015,
        max_context=200000,
        provider="anthropic",
        api_key_env="ANTHROPIC_API_KEY",
    ),
    "claude-opus": ModelConfig(
        name="claude-opus-4-20250514",
        tier=ModelTier.PREMIUM,
        cost_per_1k_input=0.015,
        cost_per_1k_output=0.075,
        max_context=200000,
        provider="anthropic",
        api_key_env="ANTHROPIC_API_KEY",
    ),
}


class TieredRouter:
    """Routes requests to appropriate model tier."""

    def __init__(self):
        self.stats = RoutingStats()
        self.models = MODELS.copy()
        self._providers: Dict[str, Any] = {}
        self._init_providers()

    def _init_providers(self):
        """Initialize model providers."""
        # Ollama provider
        self._providers["ollama"] = OllamaProvider()

        # Anthropic provider (lazy init)
        self._providers["anthropic"] = AnthropicProvider()

    async def route(
        self,
        tier: ModelTier,
        command: Dict[str, Any],
        context: str = "",
        force_model: str = None,
    ) -> Dict[str, Any]:
        """Route request to appropriate model."""
        start_time = time.time()

        # Select model
        if force_model and force_model in self.models:
            model = self.models[force_model]
        else:
            model = self._select_model(tier)

        if not model:
            return {"error": "No available model for tier"}

        # Build prompt
        prompt = self._build_prompt(command, context)

        # Execute
        try:
            provider = self._providers.get(model.provider)
            if not provider:
                return {"error": f"Unknown provider: {model.provider}"}

            result = await provider.complete(model, prompt)

            # Track stats
            self._track_request(model, result, tier)

            return {
                "content": result.get("content", ""),
                "model": model.name,
                "tier": tier.name,
                "tokens_in": result.get("tokens_in", 0),
                "tokens_out": result.get("tokens_out", 0),
                "duration_ms": (time.time() - start_time) * 1000,
            }

        except Exception as e:
            logger.error(f"Routing error: {e}")
            # Try escalation
            if tier != ModelTier.PREMIUM:
                logger.info(f"Escalating from {tier.name} to higher tier")
                self.stats.escalations += 1
                next_tier = ModelTier(tier.value + 1)
                return await self.route(next_tier, command, context)
            return {"error": str(e)}

    def _select_model(self, tier: ModelTier) -> Optional[ModelConfig]:
        """Select best available model for tier."""
        # Prefer models in order (extended models added by integrations)
        tier_preferences = {
            ModelTier.LOCAL: [
                "ollama-kimi", "groq-llama", "groq-mixtral",
                "deepseek-chat", "ollama-llama3", "ollama-mistral",
            ],
            ModelTier.BALANCED: [
                "claude-haiku", "deepseek-r1", "grok",
                "ollama-kimi", "ollama-llama3", "ollama-mistral",
            ],
            ModelTier.PREMIUM: [
                "claude-sonnet", "gemini-pro", "claude-opus",
                "ollama-kimi", "ollama-llama3", "ollama-mistral",
            ],
        }

        for model_name in tier_preferences.get(tier, []):
            model = self.models.get(model_name)
            if model and self._is_available(model):
                return model

        return None

    def _is_available(self, model: ModelConfig) -> bool:
        """Check if model is available."""
        provider = self._providers.get(model.provider)
        return provider and provider.is_available(model)

    def _build_prompt(self, command: Dict[str, Any], context: str) -> str:
        """Build prompt from command and context."""
        # Handlers can inject a specialized prompt
        if command.get("prompt_override"):
            parts = []
            if context:
                parts.append(f"{context}\n")
            parts.append(command["prompt_override"])
            return "\n".join(parts)

        parts = []

        if context:
            parts.append(f"Context:\n{context}\n")

        cmd_str = f"{command['prefix']}:{command['action']}"
        args = " ".join(command.get("args", []))

        parts.append(f"Command: {cmd_str}")
        if args:
            parts.append(f"Arguments: {args}")

        parts.append("\nExecute this command and provide the result.")

        return "\n".join(parts)

    def _track_request(self, model: ModelConfig, result: Dict, tier: ModelTier):
        """Track request statistics."""
        tier_name = tier.name
        tokens_in = result.get("tokens_in", 0)
        tokens_out = result.get("tokens_out", 0)

        self.stats.total_requests += 1
        self.stats.requests_by_tier[tier_name] = self.stats.requests_by_tier.get(tier_name, 0) + 1
        self.stats.tokens_by_tier[tier_name] = self.stats.tokens_by_tier.get(tier_name, 0) + tokens_in + tokens_out

        # Calculate cost
        cost = (tokens_in / 1000 * model.cost_per_1k_input) + (tokens_out / 1000 * model.cost_per_1k_output)
        self.stats.cost_by_tier[tier_name] = self.stats.cost_by_tier.get(tier_name, 0) + cost

        # Calculate savings (vs always using premium)
        premium_cost = (tokens_in / 1000 * 0.015) + (tokens_out / 1000 * 0.075)
        self.stats.savings_usd += premium_cost - cost

    def get_status(self) -> Dict[str, Any]:
        """Get router status and statistics."""
        return {
            "total_requests": self.stats.total_requests,
            "requests_by_tier": self.stats.requests_by_tier,
            "cost_by_tier": self.stats.cost_by_tier,
            "total_cost_usd": sum(self.stats.cost_by_tier.values()),
            "savings_usd": self.stats.savings_usd,
            "escalations": self.stats.escalations,
            "available_models": [
                name for name, model in self.models.items()
                if self._is_available(model)
            ],
        }


class OllamaProvider:
    """Ollama local model provider."""

    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url
        self._available = None

    def is_available(self, model: ModelConfig = None) -> bool:
        """Check if Ollama is available."""
        if self._available is None:
            try:
                import httpx
                resp = httpx.get(f"{self.base_url}/api/tags", timeout=2.0)
                self._available = resp.status_code == 200
            except Exception:
                self._available = False
        return self._available

    async def complete(self, model: ModelConfig, prompt: str) -> Dict[str, Any]:
        """Complete prompt using Ollama."""
        import httpx

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": model.name,
                    "prompt": prompt,
                    "stream": False,
                },
                timeout=120.0,
            )
            data = response.json()
            return {
                "content": data.get("response", ""),
                "tokens_in": data.get("prompt_eval_count", 0),
                "tokens_out": data.get("eval_count", 0),
            }


class AnthropicProvider:
    """Anthropic Claude provider."""

    def __init__(self):
        self._client = None

    def is_available(self, model: ModelConfig = None) -> bool:
        """Check if Anthropic API is available."""
        import os
        return bool(os.environ.get("ANTHROPIC_API_KEY"))

    async def complete(self, model: ModelConfig, prompt: str) -> Dict[str, Any]:
        """Complete prompt using Claude."""
        import anthropic
        import os

        client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

        message = client.messages.create(
            model=model.name,
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )

        return {
            "content": message.content[0].text if message.content else "",
            "tokens_in": message.usage.input_tokens,
            "tokens_out": message.usage.output_tokens,
        }
