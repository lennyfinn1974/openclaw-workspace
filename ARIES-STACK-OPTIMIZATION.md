# Aries Stack Optimization Guide

## Current State (2026-02-05)
- **Main session:** ✅ qwen7b local (FREE)
- **Sub-agents:** ❌ claude-sonnet ($15/1M tokens)
- **Claude Code:** ✅ Max subscription (FREE)

## Key Discovery
**Sub-agents CAN'T change models mid-session** - they're locked to their spawn model.

## Optimization Strategy

### Immediate Actions
1. **Let current expensive sub-agents finish** - they're just coordinating Claude Code
2. **Configure future sub-agent spawns** to use local model
3. **Update cron jobs** to use working models (not deprecated deepseek-fast)

### Model Tier Architecture
```yaml
Tier 1 (Coordination/Monitoring):
  - qwen7b (LOCAL - FREE)
  - fast (groq/llama-3.1-8b-instant)
  
Tier 2 (Development/Analysis):
  - deepseek (openrouter)
  - gemini (google/gemini-2.5-flash)
  
Tier 3 (Critical Business):
  - sonnet (when absolutely needed)
  - opus (strategic decisions only)
```

### Sub-Agent Spawn Template
```python
# For Claude Code coordination work:
sessions_spawn(
    task="coordinate terminal work",
    model="qwen7b",  # LOCAL MODEL
    agentId="appropriate-agent"
)
```

### Cost Impact
- **Before:** Every sub-agent burns $15/1M tokens on sonnet
- **After:** Sub-agents use FREE local model for coordination
- **Savings:** 100% on sub-agent coordination costs

### Implementation Note
Since Claude Code Terminal does the actual work (using Max subscription), sub-agents only need basic coordination capability - perfect for local models!