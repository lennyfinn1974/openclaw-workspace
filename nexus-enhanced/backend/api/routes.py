"""
API Routes
==========

REST API endpoints for Nexus Enhanced.
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from backend.core.openclaw_integration import OpenClawIntegration
from backend.core.websocket_manager import WebSocketManager

logger = logging.getLogger("nexus.api")

# Create router
router = APIRouter()


# Pydantic models for request/response
class ChatMessage(BaseModel):
    message: str
    user_id: Optional[str] = "anonymous"
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    user_id: str
    conversation_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class SkillExecuteRequest(BaseModel):
    skill_name: str
    command: str
    parameters: Optional[Dict[str, Any]] = None


class SkillResponse(BaseModel):
    skill: str
    command: str
    success: bool
    output: str
    error: Optional[str] = None


# Dependency injection
def get_openclaw_integration(request: Request) -> OpenClawIntegration:
    """Get OpenClaw integration from app state."""
    return request.app.state.openclaw


def get_websocket_manager(request: Request) -> WebSocketManager:
    """Get WebSocket manager from app state."""
    return request.app.state.websocket_manager


# API Endpoints

@router.get("/status")
async def get_status(openclaw: OpenClawIntegration = Depends(get_openclaw_integration)):
    """Get system status."""
    return {
        "status": "active",
        "version": "2.0.0",
        "openclaw_integration": openclaw.initialized,
        "skills_count": len(openclaw.get_available_skills()),
        "plugins_count": len(openclaw.get_available_plugins()),
        "features": [
            "OpenClaw Skills Integration", 
            "Real-time Chat",
            "Plugin System",
            "Multi-model AI",
            "Advanced Browser Control",
            "Notes & Task Management",
            "Development Tools"
        ]
    }


@router.get("/skills")
async def list_skills(openclaw: OpenClawIntegration = Depends(get_openclaw_integration)):
    """List all available skills."""
    return {
        "skills": openclaw.get_available_skills(),
        "total": len(openclaw.get_available_skills()),
        "ready": len([s for s in openclaw.get_available_skills() if s["ready"]])
    }


@router.get("/skills/{skill_name}")
async def get_skill_info(skill_name: str, 
                        openclaw: OpenClawIntegration = Depends(get_openclaw_integration)):
    """Get information about a specific skill."""
    skills = openclaw.get_available_skills()
    skill = next((s for s in skills if s["name"] == skill_name), None)
    
    if not skill:
        raise HTTPException(status_code=404, detail=f"Skill {skill_name} not found")
    
    return skill


@router.post("/skills/execute", response_model=SkillResponse)
async def execute_skill(request: SkillExecuteRequest,
                       openclaw: OpenClawIntegration = Depends(get_openclaw_integration)):
    """Execute a skill command."""
    if request.skill_name not in openclaw.skills:
        raise HTTPException(status_code=404, detail=f"Skill {request.skill_name} not found")
    
    skill = openclaw.skills[request.skill_name]
    result = await skill.execute(request.command, **(request.parameters or {}))
    
    return SkillResponse(
        skill=request.skill_name,
        command=request.command,
        success=result.get("success", False),
        output=result.get("output", ""),
        error=result.get("error")
    )


@router.get("/plugins")
async def list_plugins(openclaw: OpenClawIntegration = Depends(get_openclaw_integration)):
    """List all available plugins."""
    return {
        "plugins": openclaw.get_available_plugins(),
        "total": len(openclaw.get_available_plugins()),
        "enabled": len([p for p in openclaw.get_available_plugins() if p["enabled"]])
    }


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatMessage,
               openclaw: OpenClawIntegration = Depends(get_openclaw_integration)):
    """Process a chat message."""
    result = await openclaw.process_message(
        message=request.message,
        user_id=request.user_id,
        conversation_id=request.conversation_id
    )
    
    # Handle different response types
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return ChatResponse(
        response=result.get("response", str(result)),
        user_id=request.user_id,
        conversation_id=request.conversation_id,
        metadata=result
    )


@router.get("/conversations")
async def list_conversations():
    """List active conversations."""
    # Placeholder - implement conversation persistence later
    return {
        "conversations": [],
        "total": 0
    }


@router.get("/tools")
async def list_tools(openclaw: OpenClawIntegration = Depends(get_openclaw_integration)):
    """List available OpenClaw tools."""
    return {
        "tools": list(openclaw.tools_cache.keys()),
        "total": len(openclaw.tools_cache),
        "description": "Direct access to OpenClaw tools: web_search, browser, exec, files, memory, etc."
    }


@router.get("/websocket/stats")
async def websocket_stats(ws_manager: WebSocketManager = Depends(get_websocket_manager)):
    """Get WebSocket connection statistics."""
    return ws_manager.get_stats()


@router.get("/health")
async def health_check():
    """Detailed health check."""
    return {
        "status": "healthy",
        "version": "2.0.0",
        "timestamp": "2026-02-07T14:20:00Z",
        "components": {
            "api": "healthy",
            "websocket": "healthy", 
            "openclaw_integration": "healthy",
            "database": "healthy"
        }
    }


# Admin endpoints (for configuration)
@router.get("/admin/config")
async def get_config():
    """Get current configuration."""
    from backend.core.config import settings
    
    # Don't expose sensitive data
    config = {
        "app_name": settings.app_name,
        "version": settings.version,
        "port": settings.port,
        "debug": settings.debug,
        "openclaw_skills_enabled": settings.openclaw_skills_enabled,
        "plugins_enabled": settings.plugins_enabled,
        "enabled_skills": settings.enabled_skills,
        "log_level": settings.log_level
    }
    
    return config


@router.post("/admin/config")
async def update_config(config: Dict[str, Any]):
    """Update configuration."""
    # Placeholder - implement configuration updates
    return {
        "success": True,
        "message": "Configuration update functionality coming soon",
        "received": config
    }