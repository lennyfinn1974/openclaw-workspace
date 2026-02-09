#!/usr/bin/env python3
"""
Test Brave Search API with your key
===================================
"""

import asyncio
import aiohttp
import os
from pathlib import Path

# Load environment variables
env_path = Path("../.env")
print(f"🔍 Looking for .env at: {env_path.resolve()}")
if env_path.exists():
    for line in env_path.read_text().split('\n'):
        if '=' in line and not line.startswith('#'):
            key, value = line.split('=', 1)
            os.environ[key.strip()] = value.strip()

async def test_brave_search():
    """Test Brave Search API with your key."""
    api_key = os.getenv("BRAVE_SEARCH_API_KEY")
    
    if not api_key:
        print("❌ No API key found in .env")
        return False
    
    print(f"🔑 Testing with API key: {api_key[:10]}...")
    
    url = "https://api.search.brave.com/res/v1/web/search"
    headers = {
        "Accept": "application/json", 
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": api_key
    }
    params = {
        "q": "OpenClaw AI assistant",
        "count": 3
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, params=params) as response:
                print(f"📡 Response status: {response.status}")
                
                if response.status == 200:
                    data = await response.json()
                    results = data.get("web", {}).get("results", [])
                    
                    print("✅ Brave Search API working!")
                    print(f"📊 Found {len(results)} results")
                    
                    for i, result in enumerate(results[:2], 1):
                        print(f"\n{i}. {result.get('title', 'No title')}")
                        print(f"   {result.get('url', 'No URL')}")
                        print(f"   {result.get('description', 'No description')[:100]}...")
                    
                    return True
                    
                elif response.status == 401:
                    print("❌ API key invalid or expired")
                    return False
                elif response.status == 429:
                    print("❌ Rate limit exceeded")
                    return False
                else:
                    error_text = await response.text()
                    print(f"❌ API error {response.status}: {error_text}")
                    return False
                    
    except Exception as e:
        print(f"❌ Connection error: {e}")
        return False

async def main():
    """Test the Brave Search API."""
    print("🧪 Testing Brave Search API...")
    print("=" * 40)
    
    success = await test_brave_search()
    
    if success:
        print("\n🎯 SUCCESS! Your Brave Search API is working")
        print("✅ Nexus can now use Brave Search instead of Google")
        print("\n🚀 Next: Restart Nexus to activate Brave Search")
    else:
        print("\n❌ API test failed")
        print("💡 Check your API key at: https://brave.com/search/api/")

if __name__ == "__main__":
    asyncio.run(main())