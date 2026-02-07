#!/usr/bin/env python3
"""
Nexus Enhanced - Main Backend Server
===================================

Comprehensive AI assistant with full OpenClaw integration.

Features:
- FastAPI backend with WebSocket support
- All 52 OpenClaw skills integrated  
- Plugin system for extensions
- Real-time chat capabilities
- Multi-model AI routing

Usage:
    python main.py                    # Default port 8082
    python main.py --port 9000        # Custom port
    NEXUS_PORT=9000 python main.py    # Environment port
"""

import asyncio
import logging
import os
import sys
from pathlib import Path

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from backend.api.routes import router as api_router
from backend.core.openclaw_integration import OpenClawIntegration
from backend.core.websocket_manager import WebSocketManager
from backend.core.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("nexus.main")

# Create FastAPI app
app = FastAPI(
    title="Nexus Enhanced",
    description="Comprehensive AI Assistant with OpenClaw Integration",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:5173", "http://localhost:8082"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances
openclaw_integration = None
websocket_manager = WebSocketManager()

@app.on_event("startup")
async def startup():
    """Initialize services on startup."""
    global openclaw_integration
    
    logger.info("🚀 Starting Nexus Enhanced...")
    
    # Initialize OpenClaw integration
    openclaw_integration = OpenClawIntegration()
    await openclaw_integration.initialize()
    
    # Set up API dependencies
    app.state.openclaw = openclaw_integration
    app.state.websocket_manager = websocket_manager
    
    logger.info(f"✅ Nexus Enhanced started on port {settings.port}")
    logger.info(f"📚 Available skills: {len(openclaw_integration.get_available_skills())}")
    logger.info(f"🔌 Available plugins: {len(openclaw_integration.get_available_plugins())}")

@app.on_event("shutdown") 
async def shutdown():
    """Cleanup on shutdown."""
    logger.info("🛑 Shutting down Nexus Enhanced...")
    
    if openclaw_integration:
        await openclaw_integration.cleanup()
    
    await websocket_manager.disconnect_all()

# Include API routes
app.include_router(api_router, prefix="/api")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time chat."""
    await websocket_manager.connect(websocket)
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            
            # Process message through OpenClaw integration
            if openclaw_integration:
                response = await openclaw_integration.process_message(
                    message=data.get("message", ""),
                    user_id=data.get("user_id", "anonymous"),
                    conversation_id=data.get("conversation_id")
                )
                
                # Send response back to client
                await websocket.send_json(response)
            else:
                await websocket.send_json({
                    "error": "OpenClaw integration not initialized"
                })
                
    except WebSocketDisconnect:
        await websocket_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket_manager.disconnect(websocket)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": "2.0.0",
        "openclaw_integration": openclaw_integration is not None,
        "skills_count": len(openclaw_integration.get_available_skills()) if openclaw_integration else 0,
        "plugins_count": len(openclaw_integration.get_available_plugins()) if openclaw_integration else 0
    }

# Serve frontend static files (when built)
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")

def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Nexus Enhanced Backend")
    parser.add_argument("--port", type=int, default=settings.port, help="Port to run on")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind to")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload")
    
    args = parser.parse_args()
    
    logger.info(f"🚀 Starting Nexus Enhanced on {args.host}:{args.port}")
    
    # Run the server
    uvicorn.run(
        "main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        access_log=True
    )

if __name__ == "__main__":
    main()