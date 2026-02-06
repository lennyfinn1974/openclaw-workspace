"""
OpenClaw Integration Layer
=========================

Bridges Sovereign Command Architecture with multi-provider model system.

Providers:
- Groq: Ultra-fast inference (OpenAI-compatible API)
- OpenRouter: Multi-model gateway (DeepSeek, Grok, Gemini)

These extend the core Ollama + Anthropic providers in routing/__init__.py.
"""

import json
import logging
import os
from typing import Any, Dict, Optional

logger = logging.getLogger("sovereign.integrations")

# Import sovereign types
try:
    from ..routing import ModelTier, ModelConfig, TieredRouter
except ImportError:
    from routing import ModelTier, ModelConfig, TieredRouter


class GroqProvider:
    """Groq ultra-fast inference provider (OpenAI-compatible API).

    Conforms to sovereign's provider interface: complete(model, prompt) -> Dict.
    """

    BASE_URL = "https://api.groq.com/openai/v1"

    def __init__(self):
        self._api_key = os.environ.get("GROQ_API_KEY", "")
        self._available = None

    def is_available(self, model: ModelConfig = None) -> bool:
        """Check if Groq API key is configured."""
        if self._available is None:
            if not self._api_key:
                self._available = False
            else:
                try:
                    import httpx
                    resp = httpx.get(
                        f"{self.BASE_URL}/models",
                        headers={"Authorization": f"Bearer {self._api_key}"},
                        timeout=5.0,
                    )
                    self._available = resp.status_code == 200
                except Exception:
                    self._available = False
        return self._available

    async def complete(self, model: ModelConfig, prompt: str) -> Dict[str, Any]:
        """Complete prompt using Groq API."""
        import httpx

        async with httpx.AsyncClient(
            base_url=self.BASE_URL,
            timeout=60.0,
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
        ) as client:
            payload = {
                "model": model.name,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": min(model.max_context, 8192),
            }

            resp = await client.post("/chat/completions", json=payload)
            resp.raise_for_status()
            data = resp.json()

            choice = data.get("choices", [{}])[0]
            content = choice.get("message", {}).get("content", "")
            usage = data.get("usage", {})

            return {
                "content": content,
                "tokens_in": usage.get("prompt_tokens", 0),
                "tokens_out": usage.get("completion_tokens", 0),
            }


class OpenRouterProvider:
    """OpenRouter multi-model gateway (OpenAI-compatible API).

    Supports: DeepSeek, Grok, Gemini, and 100+ models.
    Conforms to sovereign's provider interface: complete(model, prompt) -> Dict.
    """

    BASE_URL = "https://openrouter.ai/api/v1"

    def __init__(self):
        self._api_key = os.environ.get("OPENROUTER_API_KEY", "")
        self._available = None

    def is_available(self, model: ModelConfig = None) -> bool:
        """Check if OpenRouter API key is configured."""
        if self._available is None:
            if not self._api_key:
                self._available = False
            else:
                try:
                    import httpx
                    resp = httpx.get(
                        f"{self.BASE_URL}/models",
                        headers={"Authorization": f"Bearer {self._api_key}"},
                        timeout=5.0,
                    )
                    self._available = resp.status_code == 200
                except Exception:
                    self._available = False
        return self._available

    async def complete(self, model: ModelConfig, prompt: str) -> Dict[str, Any]:
        """Complete prompt using OpenRouter API."""
        import httpx

        async with httpx.AsyncClient(
            base_url=self.BASE_URL,
            timeout=120.0,
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "HTTP-Referer": "http://localhost:8080",
                "X-Title": "Sovereign Command Architecture",
                "Content-Type": "application/json",
            },
        ) as client:
            payload = {
                "model": model.name,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": min(model.max_context, 8192),
            }

            resp = await client.post("/chat/completions", json=payload)
            resp.raise_for_status()
            data = resp.json()

            choice = data.get("choices", [{}])[0]
            content = choice.get("message", {}).get("content", "")
            usage = data.get("usage", {})

            return {
                "content": content,
                "tokens_in": usage.get("prompt_tokens", 0),
                "tokens_out": usage.get("completion_tokens", 0),
            }


# Extended model configurations for Groq and OpenRouter
EXTENDED_MODELS = {
    # Groq — Tier 1 (LOCAL/cheap, ultra-fast)
    "groq-llama": ModelConfig(
        name="llama-3.3-70b-versatile",
        tier=ModelTier.LOCAL,
        cost_per_1k_input=0.00059,
        cost_per_1k_output=0.00079,
        max_context=8192,
        provider="groq",
    ),
    "groq-mixtral": ModelConfig(
        name="mixtral-8x7b-32768",
        tier=ModelTier.LOCAL,
        cost_per_1k_input=0.00024,
        cost_per_1k_output=0.00024,
        max_context=32768,
        provider="groq",
    ),

    # OpenRouter — Tier 1-2 (cheap to balanced)
    "deepseek-chat": ModelConfig(
        name="deepseek/deepseek-chat-v3-0324",
        tier=ModelTier.LOCAL,
        cost_per_1k_input=0.00027,
        cost_per_1k_output=0.0011,
        max_context=8192,
        provider="openrouter",
    ),
    "deepseek-r1": ModelConfig(
        name="deepseek/deepseek-r1",
        tier=ModelTier.BALANCED,
        cost_per_1k_input=0.00055,
        cost_per_1k_output=0.00219,
        max_context=8192,
        provider="openrouter",
    ),
    "grok": ModelConfig(
        name="x-ai/grok-3-mini-beta",
        tier=ModelTier.BALANCED,
        cost_per_1k_input=0.0003,
        cost_per_1k_output=0.0005,
        max_context=8192,
        provider="openrouter",
    ),

    # OpenRouter — Tier 3 (premium)
    "gemini-pro": ModelConfig(
        name="google/gemini-2.5-pro-preview",
        tier=ModelTier.PREMIUM,
        cost_per_1k_input=0.00125,
        cost_per_1k_output=0.01,
        max_context=8192,
        provider="openrouter",
    ),
}


def get_enhanced_router() -> TieredRouter:
    """Get TieredRouter with all 4 providers connected.

    Returns a router with:
    - Ollama (local, free) — core
    - Anthropic (haiku/sonnet/opus) — core
    - Groq (llama/mixtral, ultra-fast) — extended
    - OpenRouter (deepseek/grok/gemini) — extended
    """
    router = TieredRouter()

    # Add extended models
    router.models.update(EXTENDED_MODELS)

    # Add extended providers
    router._providers["groq"] = GroqProvider()
    router._providers["openrouter"] = OpenRouterProvider()

    # Log what's available
    available = [
        name for name, provider in router._providers.items()
        if provider.is_available()
    ]
    logger.info(f"Enhanced router: {len(router.models)} models, providers={available}")

    return router
