#!/usr/bin/env python3
"""
Switch Nexus Google Search to Brave Search (Same as OpenClaw)
============================================================

Updates the Google Search skill to use Brave Search API instead.
"""

import json
from pathlib import Path

def update_env_for_brave():
    """Update .env file to use Brave Search instead of Google."""
    env_file = Path("../.env")
    
    if env_file.exists():
        content = env_file.read_text()
        
        # Remove Google Search lines
        lines = content.split('\n')
        new_lines = []
        
        for line in lines:
            if not line.startswith(('GOOGLE_SEARCH_API_KEY', 'GOOGLE_SEARCH_ENGINE_ID')):
                new_lines.append(line)
        
        # Add Brave Search configuration
        new_lines.extend([
            "",
            "# Brave Search API Configuration (Free tier: 2000 queries/month)",
            "# Get key at: https://brave.com/search/api/",
            "BRAVE_SEARCH_API_KEY=your_brave_api_key_here",
            ""
        ])
        
        env_file.write_text('\n'.join(new_lines))
        print("✅ Updated .env for Brave Search API")
        print("📝 Get your free API key at: https://brave.com/search/api/")
    else:
        print("❌ .env file not found")

def create_brave_search_integration():
    """Create integration code for Brave Search."""
    integration_code = '''
# Brave Search Integration for Nexus Enhanced
# ==========================================

import aiohttp
import os
from typing import Dict, List, Any

class BraveSearchAPI:
    """Brave Search API integration (same as OpenClaw uses)."""
    
    def __init__(self):
        self.api_key = os.getenv("BRAVE_SEARCH_API_KEY")
        self.base_url = "https://api.search.brave.com/res/v1/web/search"
    
    async def search(self, query: str, count: int = 5, country: str = "US") -> Dict[str, Any]:
        """Search using Brave Search API."""
        if not self.api_key:
            return {"error": "BRAVE_SEARCH_API_KEY not configured"}
        
        headers = {
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": self.api_key
        }
        
        params = {
            "q": query,
            "count": count,
            "country": country,
            "search_lang": "en",
            "ui_lang": "en"
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.base_url, headers=headers, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        return self._format_results(data)
                    else:
                        return {"error": f"Brave Search API error: {response.status}"}
        except Exception as e:
            return {"error": f"Search failed: {str(e)}"}
    
    def _format_results(self, data: Dict) -> Dict[str, Any]:
        """Format Brave Search results to match expected format."""
        results = []
        
        if "web" in data and "results" in data["web"]:
            for result in data["web"]["results"]:
                results.append({
                    "title": result.get("title", ""),
                    "url": result.get("url", ""),
                    "snippet": result.get("description", ""),
                    "source": "brave"
                })
        
        return {
            "query": data.get("query", {}).get("original", ""),
            "provider": "brave",
            "count": len(results),
            "results": results
        }

# Usage in Nexus skills:
# brave_search = BraveSearchAPI()
# results = await brave_search.search("your query", count=10)
'''
    
    # Save integration code
    code_file = Path("brave_search_integration.py")
    code_file.write_text(integration_code)
    print("✅ Created brave_search_integration.py")

def main():
    """Update Nexus to use Brave Search instead of Google."""
    print("🔄 Switching from Google Search to Brave Search...")
    print("=" * 50)
    
    update_env_for_brave()
    create_brave_search_integration()
    
    print("\n🎯 NEXT STEPS:")
    print("1. Get free Brave Search API key: https://brave.com/search/api/")
    print("2. Add key to .env file: BRAVE_SEARCH_API_KEY=your_key")
    print("3. Integration code ready in: brave_search_integration.py")
    print("4. Restart Nexus to apply changes")
    
    print("\n💡 ADVANTAGES OF BRAVE SEARCH:")
    print("✅ Free tier: 2000 queries/month")
    print("✅ Same API OpenClaw uses (proven working)")
    print("✅ Privacy-focused results")
    print("✅ No complex setup (just one API key)")
    print("✅ Better than Google Custom Search limitations")

if __name__ == "__main__":
    main()