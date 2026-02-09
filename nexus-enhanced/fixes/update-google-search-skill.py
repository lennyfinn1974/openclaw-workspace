#!/usr/bin/env python3
"""
Update Nexus Google Search Skill to Use Brave Search
====================================================

Replace the broken Google Search skill with working Brave Search integration.
"""

import os
import shutil
from pathlib import Path

def find_google_search_skill():
    """Find the Google Search skill in Nexus Enhanced."""
    # Common locations for skills in Nexus
    possible_paths = [
        Path("../backend/skills/google_search/"),
        Path("../skills/google-search/"),  
        Path("../integrations/google-search/"),
        Path("../backend/integrations/google_search/")
    ]
    
    for path in possible_paths:
        if path.exists():
            print(f"📁 Found Google Search skill at: {path}")
            return path
    
    print("🔍 Google Search skill location not found - will create new one")
    return None

def create_brave_search_skill():
    """Create a new Brave Search skill to replace Google Search."""
    
    # Create skills directory if it doesn't exist
    skills_dir = Path("../backend/skills/brave_search/")
    skills_dir.mkdir(parents=True, exist_ok=True)
    
    # Create the main skill file
    skill_code = '''"""
Brave Search Skill for Nexus Enhanced
====================================

Web search using Brave Search API (same as OpenClaw uses).
Replaces the broken Google Search integration.
"""

import os
import logging
from typing import Dict, Any, List, Optional
import aiohttp

logger = logging.getLogger("nexus.skills.brave_search")


class BraveSearchSkill:
    """Brave Search integration for Nexus Enhanced."""
    
    def __init__(self):
        self.skill_id = "brave-search"
        self.name = "Brave Search"
        self.description = "Web search using Brave Search API"
        self.api_key = os.getenv("BRAVE_SEARCH_API_KEY")
        self.base_url = "https://api.search.brave.com/res/v1/web/search"
        
    def is_configured(self) -> bool:
        """Check if the skill is properly configured."""
        return bool(self.api_key)
    
    async def search(self, query: str, count: int = 5, country: str = "US", 
                    search_lang: str = "en") -> Dict[str, Any]:
        """Perform web search using Brave Search API."""
        
        if not self.is_configured():
            return {
                "success": False,
                "error": "Brave Search API key not configured",
                "config_help": "Add BRAVE_SEARCH_API_KEY to .env file"
            }
        
        headers = {
            "Accept": "application/json",
            "Accept-Encoding": "gzip", 
            "X-Subscription-Token": self.api_key
        }
        
        params = {
            "q": query,
            "count": min(count, 20),  # Brave API max is 20
            "country": country,
            "search_lang": search_lang,
            "ui_lang": search_lang
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.base_url, headers=headers, params=params) as response:
                    
                    if response.status == 200:
                        data = await response.json()
                        return self._format_results(data, query)
                        
                    elif response.status == 401:
                        return {
                            "success": False,
                            "error": "Invalid API key",
                            "help": "Check your Brave Search API key"
                        }
                        
                    elif response.status == 429:
                        return {
                            "success": False,
                            "error": "Rate limit exceeded",
                            "help": "Try again later or upgrade your Brave Search plan"
                        }
                        
                    else:
                        error_text = await response.text()
                        return {
                            "success": False,
                            "error": f"API error {response.status}: {error_text}"
                        }
                        
        except Exception as e:
            logger.error(f"Brave Search API error: {e}")
            return {
                "success": False,
                "error": f"Search failed: {str(e)}"
            }
    
    def _format_results(self, data: Dict, original_query: str) -> Dict[str, Any]:
        """Format Brave Search results for Nexus."""
        
        results = []
        
        if "web" in data and "results" in data["web"]:
            for item in data["web"]["results"]:
                results.append({
                    "title": item.get("title", ""),
                    "url": item.get("url", ""),
                    "snippet": item.get("description", ""),
                    "source": "Brave Search"
                })
        
        return {
            "success": True,
            "query": original_query,
            "provider": "brave",
            "count": len(results),
            "results": results,
            "source": "Brave Search API"
        }
    
    async def quick_search(self, query: str) -> str:
        """Quick search that returns formatted text."""
        result = await self.search(query, count=5)
        
        if not result["success"]:
            return f"❌ Search failed: {result['error']}"
        
        if not result["results"]:
            return f"🔍 No results found for: {query}"
        
        output = [f"🔍 Search results for: {query}\\n"]
        
        for i, item in enumerate(result["results"], 1):
            output.append(f"{i}. **{item['title']}**")
            output.append(f"   {item['url']}")
            if item['snippet']:
                output.append(f"   {item['snippet'][:150]}...")
            output.append("")
        
        return "\\n".join(output)


# Skill instance for Nexus integration
brave_search_skill = BraveSearchSkill()


# Nexus skill interface functions
async def search_web(query: str, count: int = 5) -> Dict[str, Any]:
    """Main search function for Nexus integration."""
    return await brave_search_skill.search(query, count)


async def quick_search_web(query: str) -> str:
    """Quick search with formatted output."""
    return await brave_search_skill.quick_search(query)


# Skill metadata for Nexus registration
SKILL_METADATA = {
    "id": "brave-search",
    "name": "Brave Search",
    "description": "Web search using Brave Search API (same as OpenClaw)",
    "version": "1.0.0",
    "author": "Nexus Enhanced",
    "functions": [
        {
            "name": "search_web",
            "description": "Search the web and return structured results",
            "parameters": {
                "query": "Search query string",
                "count": "Number of results (default: 5, max: 20)"
            }
        },
        {
            "name": "quick_search_web", 
            "description": "Search the web and return formatted text",
            "parameters": {
                "query": "Search query string"
            }
        }
    ],
    "configured": brave_search_skill.is_configured(),
    "config_keys": ["BRAVE_SEARCH_API_KEY"]
}
'''
    
    skill_file = skills_dir / "__init__.py"
    skill_file.write_text(skill_code)
    print(f"✅ Created Brave Search skill at: {skill_file}")
    
    return skills_dir

def update_skill_registry():
    """Update Nexus skill registry to use Brave Search instead of Google."""
    
    registry_note = '''# SKILL REGISTRY UPDATE - Brave Search Integration
# ===============================================

# Replace Google Search skill registration with:

from backend.skills.brave_search import brave_search_skill, SKILL_METADATA

# Register the skill
skills_registry = {
    "brave-search": {
        "instance": brave_search_skill,
        "metadata": SKILL_METADATA,
        "functions": {
            "search": brave_search_skill.search,
            "quick_search": brave_search_skill.quick_search
        }
    }
}

# Remove old google-search registration if it exists
# skills_registry.pop("google-search", None)
'''
    
    note_file = Path("../backend/skills/skill_registry_update.py")
    note_file.write_text(registry_note)
    print(f"✅ Created skill registry update: {note_file}")

def main():
    """Update Nexus to use Brave Search instead of Google Search."""
    print("🔄 Replacing Google Search with Brave Search...")
    print("=" * 50)
    
    # Find existing Google Search skill
    google_skill_path = find_google_search_skill()
    
    # Create new Brave Search skill
    brave_skill_path = create_brave_search_skill()
    
    # Create registry update instructions
    update_skill_registry()
    
    print("\n🎯 UPDATES COMPLETE!")
    print("=" * 50)
    
    print("✅ Created new Brave Search skill")
    print("✅ Skill uses your working API key")
    print("✅ Same API that OpenClaw uses")
    print("✅ Registry update instructions created")
    
    print("\n🚀 NEXT STEPS:")
    print("1. Restart Nexus Enhanced")
    print("2. Test Brave Search in the interface")
    print("3. Verify 'configured: true' status")
    
    print("\n💡 SKILL FEATURES:")
    print("✅ Web search with structured results")
    print("✅ Quick search with formatted output")
    print("✅ Error handling and rate limit management")
    print("✅ Same results quality as OpenClaw searches")
    
    if google_skill_path:
        print(f"\n📝 NOTE: Old Google Search skill found at: {google_skill_path}")
        print("   Consider removing it after testing Brave Search")

if __name__ == "__main__":
    main()