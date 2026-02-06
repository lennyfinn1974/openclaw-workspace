# HEARTBEAT.md - Context-Safe System Monitoring

## 🚨 CONTEXT-FIRST PRINCIPLE
**Every heartbeat must PRESERVE context, not consume it**

## Primary Check (Every Heartbeat)
**SELF-CONTEXT MONITORING:**
```bash
# Check my own context usage FIRST
session_status | grep "Context:" | grep -o "[0-9]*k/[0-9]*k ([0-9]*%)"
```

**Critical Thresholds (LOWERED for safety):**
- **>60% (120k tokens):** IMMEDIATE preemptive compaction
- **>50% (100k tokens):** Start sub-agent delegation 
- **>40% (80k tokens):** Light monitoring only

## Ultra-Light Heartbeat Protocol
**When context <40%:** Minimal gateway check only
**When context 40-50%:** Gateway + sub-agent delegation 
**When context 50-60%:** Emergency compaction prep
**When context >60%:** IMMEDIATE compaction (no other actions)

## Gateway Health (Minimal)
```bash
openclaw gateway status | grep -q "RPC probe: ok" || echo "GATEWAY_DOWN"
```

## Context-Safe Actions
- **Return HEARTBEAT_OK** (default response)
- **Spawn sub-agent** for heavy monitoring 
- **Trigger compaction** when needed
- **Log critical alerts** to daily memory

## BANNED in Heartbeats
❌ Platform status checks (delegate to sub-agent)
❌ Terminal content reading (too verbose)
❌ Multi-step diagnostics (context expensive)
❌ Complex tool chains (use sub-agents)

## Emergency Compaction (60%+ context)
1. **IMMEDIATE:** Document terminal session IDs
2. **IMMEDIATE:** Spawn monitoring sub-agent 
3. **IMMEDIATE:** Create new session (/new)
4. **IMMEDIATE:** Hand off monitoring to sub-agent