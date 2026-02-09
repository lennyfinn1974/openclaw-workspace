# SKILL REGISTRY UPDATE - Brave Search Integration
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
