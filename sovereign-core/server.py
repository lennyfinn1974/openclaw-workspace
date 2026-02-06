#!/usr/bin/env python3
"""
Sovereign HTTP Server
=====================

REST API for the Sovereign Command Architecture.

Endpoints:
    POST /cmd              Execute a sovereign command
    GET  /cmd/list         List available commands
    GET  /status           System status
    GET  /health           Health check

Usage:
    python server.py                    # Default port 8090
    python server.py --port 9000        # Custom port
    SOVEREIGN_PORT=9000 python server.py
"""

import argparse
import asyncio
import json
import logging
import os
import sys
import time
from pathlib import Path

from aiohttp import web

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from sovereign import Sovereign, get_sovereign
from commands import SHORTCUTS

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("sovereign.server")

# Global sovereign instance
_sovereign: Sovereign = None


def get_sov() -> Sovereign:
    global _sovereign
    if _sovereign is None:
        _sovereign = get_sovereign()
    return _sovereign


async def handle_cmd(request: web.Request) -> web.Response:
    """POST /cmd — Execute a sovereign command.

    Request body (JSON):
        {"command": "BLD:APP web-dashboard"}
        or
        {"command": "build web-dashboard"}  (shortcut form)

    Response (JSON):
        {"content": "...", "model": "...", "tier": "...", ...}
    """
    try:
        body = await request.json()
    except json.JSONDecodeError:
        return web.json_response(
            {"error": "Invalid JSON body"},
            status=400,
        )

    command_str = body.get("command", "").strip()
    if not command_str:
        return web.json_response(
            {"error": "Missing 'command' field"},
            status=400,
        )

    # Expand shortcuts (e.g., "build" -> "BLD:APP")
    from commands import expand_shortcut
    command_str = expand_shortcut(command_str)

    logger.info(f"/cmd: {command_str}")

    sov = get_sov()
    start = time.time()

    try:
        result = await sov.execute(command_str)
    except Exception as e:
        logger.error(f"/cmd error: {e}")
        return web.json_response(
            {"error": str(e)},
            status=500,
        )

    result["server_duration_ms"] = (time.time() - start) * 1000
    return web.json_response(result)


async def handle_cmd_list(request: web.Request) -> web.Response:
    """GET /cmd/list — List available commands."""
    sov = get_sov()
    prefix = request.query.get("prefix")
    commands = sov.commands.list_commands(prefix)

    return web.json_response({
        "commands": commands,
        "shortcuts": SHORTCUTS,
        "total": len(commands),
    })


async def handle_status(request: web.Request) -> web.Response:
    """GET /status — System status."""
    sov = get_sov()
    status = sov.get_status()
    # Convert Path objects to strings for JSON serialization
    status["workspace"] = str(status.get("workspace", ""))
    return web.json_response(status)


async def handle_health(request: web.Request) -> web.Response:
    """GET /health — Health check."""
    sov = get_sov()
    available_models = [
        name for name, model in sov.router.models.items()
        if sov.router._is_available(model)
    ]
    return web.json_response({
        "status": "ok" if available_models else "degraded",
        "providers": list(sov.router._providers.keys()),
        "available_models": available_models,
    })


def create_app() -> web.Application:
    """Create the aiohttp application."""
    app = web.Application()
    app.router.add_post("/cmd", handle_cmd)
    app.router.add_get("/cmd/list", handle_cmd_list)
    app.router.add_get("/status", handle_status)
    app.router.add_get("/health", handle_health)
    return app


def main():
    parser = argparse.ArgumentParser(description="Sovereign HTTP Server")
    parser.add_argument(
        "--port", "-p",
        type=int,
        default=int(os.environ.get("SOVEREIGN_PORT", "8090")),
        help="Port to listen on (default: 8090)",
    )
    parser.add_argument(
        "--host",
        default=os.environ.get("SOVEREIGN_HOST", "127.0.0.1"),
        help="Host to bind to (default: 127.0.0.1)",
    )
    args = parser.parse_args()

    # Initialize sovereign eagerly so startup errors are visible
    logger.info("Initializing Sovereign...")
    get_sov()

    app = create_app()
    logger.info(f"Starting Sovereign HTTP server on {args.host}:{args.port}")
    logger.info(f"Endpoints: POST /cmd | GET /cmd/list | GET /status | GET /health")
    web.run_app(app, host=args.host, port=args.port, print=None)


if __name__ == "__main__":
    main()
