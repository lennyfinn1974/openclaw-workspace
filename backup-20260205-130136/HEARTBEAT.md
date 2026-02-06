# HEARTBEAT.md - System Health Monitoring

## Gateway Health Check (Priority #1)
**Every heartbeat: Check gateway status and auto-restart if needed**

```bash
# Quick gateway health check
openclaw gateway status | grep "RPC probe: ok" >/dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "⚠️ GATEWAY DOWN - Auto-restarting..."
    # Log the incident 
    echo "$(date): Gateway restart triggered by heartbeat" >> ~/gateway-restarts.log
    # Restart via gateway tool (requires restart=true in config)
    # Will be handled by heartbeat logic
fi
```

## Periodic Checks (Rotate through these)
- **Context Monitor:** Check session_status for 70%+ context usage (140k/200k tokens)
- **Terminal Control:** Verify active Claude Code sessions remain responsive
- **Process health:** Verify OpenClaw daemon is responding
- **Log monitoring:** Check for recent EPIPE errors or crashes  
- **Memory system:** Ensure QMD is operational (timeout issues detected)
- **API connectivity:** Test provider endpoints (OpenAI 504s seen)

## Auto-Actions Allowed
- **Context compaction** (when >70% usage detected)
- **Terminal state preservation** before compaction
- **Sub-agent task handoff** to isolated sessions
- Gateway restart (critical)
- Log rotation if logs grow large
- Memory cleanup if QMD timeouts persist
- Provider fallback if API issues detected
- Telegram routing check (verify response delivery)

## Emergency Thresholds
- **Context >70% (140k tokens):** Trigger preemptive compaction protocol
- **Context >85% (170k tokens):** Emergency compaction + terminal handoff
- **Gateway down:** Immediate restart
- **3+ EPIPE errors in 1 hour:** Preemptive restart
- **QMD timeout >3 times:** Switch to builtin memory temporarily
- **API 504s >5 times:** Switch to fallback providers

## Context Compaction Protocol
**When triggered at 70%+ usage:**
1. Document all active terminal window IDs and Claude Code sessions
2. Save current task state to `memory/YYYY-MM-DD-pre-compaction-state.md`
3. Hand off long-running tasks to sub-agents via sessions_spawn
4. Create new session with /new (preserves MEMORY.md + workspace files)
5. Restore terminal connections using documented window IDs
6. Resume sub-agent coordination from preserved state