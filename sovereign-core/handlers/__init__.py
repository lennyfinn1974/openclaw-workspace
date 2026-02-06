"""
Command Handlers
================

Specialized handlers for sovereign commands that need more than
generic model routing. Each handler receives the parsed command
and the TieredRouter, and returns a result dict.

Handler signature:
    async def handler(parsed: Dict, router: TieredRouter, **kwargs) -> Dict[str, Any]
"""

import logging
import time
from typing import Any, Callable, Dict, Optional

logger = logging.getLogger("sovereign.handlers")

try:
    from ..routing import TieredRouter, ModelTier
except ImportError:
    from routing import TieredRouter, ModelTier


# --- PRD Generation for BLD:APP ---

PRD_SYSTEM_PROMPT = """You are a senior product architect generating Production Requirements Documents.
Output a complete, structured PRD in Markdown format. Be specific, actionable, and thorough."""

PRD_TEMPLATE = """Generate a comprehensive Product Requirements Document (PRD) for the following application:

**Application Name:** {app_name}
**Type:** {app_type}
**Additional Context:** {context}

## Required PRD Sections

1. **Executive Summary** — One paragraph overview
2. **Problem Statement** — What problem does this solve?
3. **Goals & Success Metrics** — Measurable outcomes
4. **User Stories** — At least 5 user stories in "As a [user], I want [action] so that [benefit]" format
5. **Technical Architecture**
   - Tech stack recommendation
   - System components diagram (text-based)
   - Data models (key entities and relationships)
   - API endpoints (if applicable)
6. **UI/UX Requirements** — Key screens/views and interactions
7. **Non-Functional Requirements** — Performance, security, scalability
8. **Implementation Phases** — Break into 3 phases with milestones
9. **Risk Assessment** — Top 3 risks with mitigations
10. **Estimated Effort** — T-shirt sizes (S/M/L/XL) per phase

Be specific to the application described. Do not use generic placeholder text."""


def _parse_build_args(parsed: Dict) -> Dict[str, str]:
    """Extract app name, type, and flags from parsed BLD:APP command."""
    args = parsed.get("args", [])
    flags = parsed.get("flags", {})

    app_name = args[0] if args else "unnamed-app"

    # Detect app type from name or --template flag
    app_type = flags.get("template", flags.get("type", ""))
    if not app_type:
        name_lower = app_name.lower()
        if any(kw in name_lower for kw in ("web", "dashboard", "portal", "ui")):
            app_type = "Web Application"
        elif any(kw in name_lower for kw in ("api", "service", "backend", "server")):
            app_type = "API/Backend Service"
        elif any(kw in name_lower for kw in ("cli", "tool", "script")):
            app_type = "CLI Tool"
        elif any(kw in name_lower for kw in ("mobile", "app", "ios", "android")):
            app_type = "Mobile Application"
        elif any(kw in name_lower for kw in ("bot", "agent")):
            app_type = "AI Agent/Bot"
        else:
            app_type = "Application"

    # Extra context from remaining args
    context = " ".join(args[1:]) if len(args) > 1 else "No additional context provided."
    if flags.get("description"):
        context = flags["description"]

    return {
        "app_name": app_name,
        "app_type": app_type,
        "context": context,
    }


async def handle_bld_app(parsed: Dict, router: TieredRouter, **kwargs) -> Dict[str, Any]:
    """Generate a PRD for BLD:APP using Gemini (preferred) or best available premium model.

    Usage:
        BLD:APP web-dashboard
        BLD:APP trading-bot --template=python
        BLD:APP my-api --description="REST API for user management"
    """
    start_time = time.time()
    build_args = _parse_build_args(parsed)

    prompt = PRD_TEMPLATE.format(**build_args)

    # Prefer gemini-pro for PRD generation (strong at structured docs)
    # Fall back through tiers until we find an available model
    preferred_models = [
        "gemini-pro", "claude-sonnet", "claude-opus",  # PREMIUM
        "deepseek-r1", "grok", "claude-haiku",          # BALANCED
        "groq-llama", "ollama-kimi", "deepseek-chat",   # LOCAL
    ]
    force_model = None
    selected_tier = ModelTier.PREMIUM
    for model_name in preferred_models:
        if model_name in router.models and router._is_available(router.models[model_name]):
            force_model = model_name
            selected_tier = router.models[model_name].tier
            break

    logger.info(f"BLD:APP handler: app={build_args['app_name']}, model={force_model or 'auto'}, tier={selected_tier.name}")

    # Build the command dict expected by router.route()
    prd_command = {
        "prefix": "BLD",
        "action": "APP",
        "args": [build_args["app_name"]],
        "prompt_override": prompt,
    }

    # Route — use the tier of whatever model we found
    result = await router.route(
        tier=selected_tier,
        command=prd_command,
        context=PRD_SYSTEM_PROMPT,
        force_model=force_model,
    )

    # Enrich result
    result["handler"] = "bld_app_prd"
    result["app_name"] = build_args["app_name"]
    result["app_type"] = build_args["app_type"]
    result["duration_ms"] = (time.time() - start_time) * 1000

    return result


# --- Handler Registry ---

HANDLERS: Dict[str, Callable] = {
    "BLD:APP": handle_bld_app,
}


def get_handler(prefix: str, action: str) -> Optional[Callable]:
    """Get specialized handler for a command, or None for generic routing."""
    key = f"{prefix}:{action}".upper()
    return HANDLERS.get(key)
