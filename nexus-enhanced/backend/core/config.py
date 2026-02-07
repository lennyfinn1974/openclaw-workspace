"""
Nexus Enhanced Configuration
===========================

Central configuration management for Nexus Enhanced backend.
"""

import os
from pathlib import Path
from typing import List, Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""
    model_config = {
        "extra": "ignore",  # Allow extra environment variables
        "env_file": ".env",
        "env_file_encoding": "utf-8"
    }
    
    # Server Configuration
    app_name: str = "Nexus Enhanced"
    version: str = "2.0.0"
    port: int = int(os.getenv("NEXUS_PORT", 8082))
    host: str = "127.0.0.1"
    debug: bool = bool(os.getenv("DEBUG", False))
    
    # OpenClaw Integration
    openclaw_executable: str = "openclaw"
    openclaw_workspace: Path = Path.home() / ".openclaw" / "workspace"
    openclaw_skills_enabled: bool = True
    
    # Database
    database_url: str = "sqlite:///./nexus_enhanced.db"
    
    # Authentication (optional)
    secret_key: str = os.getenv("SECRET_KEY", "nexus-enhanced-secret-key-change-in-production")
    google_client_id: Optional[str] = os.getenv("GOOGLE_CLIENT_ID")
    google_client_secret: Optional[str] = os.getenv("GOOGLE_CLIENT_SECRET")
    
    # AI Models
    anthropic_api_key: Optional[str] = os.getenv("ANTHROPIC_API_KEY")
    openai_api_key: Optional[str] = os.getenv("OPENAI_API_KEY") 
    google_ai_api_key: Optional[str] = os.getenv("GOOGLE_AI_API_KEY")
    
    # Skills Configuration
    enabled_skills: List[str] = [
        "apple-notes", "bear-notes", "github", "gog", "weather", 
        "things-mac", "coding-agent", "tmux", "sonoscli", "blucli",
        "peekaboo", "openai-image-gen", "openai-whisper-api", 
        "gemini", "clawhub", "skill-creator", "healthcheck",
        "bluebubbles", "macos-terminal-control", "subagent-terminal"
    ]
    
    # Plugin Configuration
    plugins_directory: Path = Path(__file__).parent.parent / "plugins"
    plugins_enabled: bool = True
    
    # Logging
    log_level: str = "INFO"
    log_file: Optional[Path] = Path(__file__).parent.parent.parent / "logs" / "nexus-enhanced.log"
    
    # CORS
    allowed_origins: List[str] = [
        "http://localhost:3001",
        "http://localhost:5173", 
        "http://localhost:8082"
    ]
    
    # Configuration is now handled by model_config above


# Global settings instance
settings = Settings()


def get_openclaw_skills_path() -> Path:
    """Get the path to OpenClaw skills."""
    skills_path = Path("/opt/homebrew/lib/node_modules/openclaw/skills")
    if not skills_path.exists():
        # Fallback locations
        fallback_paths = [
            Path("/usr/local/lib/node_modules/openclaw/skills"),
            Path.home() / ".openclaw" / "skills",
            settings.openclaw_workspace / "skills"
        ]
        
        for path in fallback_paths:
            if path.exists():
                return path
    
    return skills_path


def get_workspace_skills_path() -> Path:
    """Get the path to workspace-specific skills."""
    return settings.openclaw_workspace / "skills"


def is_skill_enabled(skill_name: str) -> bool:
    """Check if a skill is enabled."""
    return skill_name in settings.enabled_skills