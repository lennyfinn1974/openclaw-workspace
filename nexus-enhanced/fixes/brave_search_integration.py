
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
