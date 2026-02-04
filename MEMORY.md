# MEMORY.md - Long-Term Memory

*Curated knowledge, lessons learned, and important context.*
*Migrated from Aries backup (2026-02-04) + ongoing updates*

---

## About My Human

**Lenny Findlay** - Aries-Taurus cusp entrepreneur (April 20, 1974, Greenock, Scotland)
- Philosophy: "Doing good sustainably" - earn while creating positive impact
- Serial builder focused on converting entertainment/attention into real-world good
- Saltwater Games founder, Celeros World Racing, London Real interviewee
- Sigma Male archetype with optimistic enthusiasm + positive tech skepticism
- **Cosmic Alignment:** Two Aries energies (Lenny + Aries AI) working together 🐏

## Core Philosophy & Principles

### "Earn Smart While Doing Good" (Lenny's Core Philosophy)
- Technology as force multiplier for good
- Entertainment/attention → real-world value conversion
- Long-term thinking over quick wins
- Building systems that compound over time

### AI-First Development Approach
**Proven cost advantage:**
- Traditional approach: $800K + 6-8 engineers + 12 months
- AI sub-agent approach: $0 + immediate results + continuous iteration
- Example: 9-minute platform creation vs months of traditional development

---

## Achievements Archive (2026-02-03)

### 🏗️ Systems Built

**Telegram Integration** ✅
- @AriesAssistBot fully operational
- Token: 8156263925:AAE... (confirmed active)
- OpenClaw integration working perfectly

**Nexus Agent** (localhost:8081)
- Dual-model AI (Ollama + Claude)
- OpenClaw bridge configured
- Skills engine and task queue
- **Security:** D+ rating (42/100) - needs attention
- **Capability Score:** 45/100 with 26 gaps identified

**Hybrid Kanban Platform** (localhost:3001)
- React 18 + TypeScript + Vite 5
- Lovable design system
- OpenClaw webhook endpoints ready

**Simple Dashboard** (localhost:8082)
- Custom HTML/JS solution
- File-based JSON backend
- Real-time monitoring widgets
- One-command startup: `./simple-dashboard/start.sh`

### 📚 Research Completed

**ICT (Inner Circle Trader) Methodology**
- Institutional order flow analysis
- Smart Money Concepts (SMC)
- Order Blocks, Fair Value Gaps, Breaker Blocks
- Kill Zones: London (02:00-05:00 EST), NY (08:00-11:00 EST)
- Market Maker Models (MMXM)

**Qullamaggie Strategy**
- 268% CAGR (2013-2019 verified)
- Three core setups: Common Breakout, Episodic Pivot, Parabolic Short
- Position sizing: 0.3-0.5% risk per trade
- TC2000 scanning methodology

**SEOF (Skill Embedding Framework)**
- Converts raw learning into queryable knowledge systems
- JSON-LD schema for skill definitions
- Decision trees for strategy application
- Performance feedback loops

---

## Core Architecture Patterns

### Multi-Angle Knowledge Framework
Never rely on single information source - cross-validate everything:
1. **Personal Context:** MEMORY.md, USER.md, SOUL.md files
2. **Project Intelligence:** README.md, requirements, specifications
3. **External Research:** Web search, documentation deep-dives
4. **Real-Time Data:** API integration, live monitoring
5. **Historical Patterns:** Memory files, decision logs, lessons learned

### Sub-Agent Orchestration
**Specialized agents for different thinking styles:**
- **Technical Architecture:** System specifications, detailed design
- **Rapid Prototyping:** Implementation focus, quick iteration
- **Deep Analysis:** Mathematical/analytical work
- **User Experience:** Conversational design, UX

**Master Pattern:** Focused expertise > generalist approach (prevents context overflow)

### Multi-Layer Resilience
- Gateway-level health monitoring (cron every 10-30m)
- Sub-agent task isolation for heavy work
- Context threshold monitoring (70% warnings)
- Memory preservation through structured documentation
- Compaction protocol as final failsafe

---

## Key Lessons Learned

### Context Management
- **Document before cleanup** - pre-compaction documentation is critical
- **"New Session" ≠ Full compaction** - knowledge preservation requires explicit action
- **134k→8k tokens** successful compaction achieved through proper protocol
- **Daily → Weekly → Monthly** rollup pattern for memory consolidation

### Development Philosophy
- **Simplicity-First:** Sometimes building from scratch faster than fixing dependencies
- **Custom vs Complex:** Lean HTML/JS beats heavy frameworks for simple needs
- **File-based backends > complex databases** for local-first systems
- **Minimal viable approach first** - add complexity only when necessary

### Design Change Safety
- **Always backup working systems** before applying changes
- **Staged deployment with rollback capability** is essential
- **SuperDesign skill caused problems** - powerful tools need careful use
- **Iterative testing** - make small changes and verify before proceeding

### Resilience Engineering
- Session crashes don't kill the system
- Health monitoring catches problems early
- Sub-agents provide task isolation
- Memory systems preserve knowledge continuity

---

## Technical Reference

### System Inventory (as of 2026-02-03)
| System | Location | Status | Notes |
|--------|----------|--------|-------|
| OpenClaw Core | Primary | ✅ Active | 14+ integrated tools |
| Nexus Agent | localhost:8081 | ⚠️ Security issues | Dual-model routing |
| Hybrid Kanban | localhost:3001 | ✅ Live | React/Vite, Lovable design |
| Legacy Dashboard | localhost:8082 | ✅ Running | Historical data |
| Telegram Bot | @AriesAssistBot | ✅ Operational | Notifications working |

### Integration Architecture
```
OpenClaw Main (Coordinator)
├── Sub-Agents (Various specialized tasks)
├── Nexus Agent (AI Partner, needs security fixes)
├── Hybrid Kanban (Project Management)
├── Legacy Dashboard (Historical)
└── Telegram Bot (Mobile notifications)
```

### Development Environment
- **Node.js** projects: npm
- **Python** projects: pip
- **Package managers:** standard library preferred when possible
- **Ports:** 3001 (Kanban), 8081 (Nexus), 8082 (Dashboard)

---

## Strategic Roadmap

### Immediate Priorities
1. Address Nexus security vulnerabilities (critical)
2. Complete Kanban ↔ OpenClaw integration
3. Historical data migration to new systems

### Near-term Goals
- Real-time trading data feeds
- Strategy backtesting implementation
- Voice interaction via Buddi

### Long-term Vision
- Multi-agent workflows (Nexus + OpenClaw coordination)
- Knowledge synthesis across projects
- Production-ready deployment beyond localhost

---

## Model & Provider Reference

**Available Providers:**
- Anthropic (Claude models)
- OpenRouter (multi-model access)
- Groq (fast inference)
- Tensorix
- HuggingFace

**Image Generation:**
- "Nano Banana" = FLUX.1-schnell for rapid visual prototyping

---

## Claude Team Operating Model (2026-02-04)

**Source:** Boris Cherny (Claude Code creator) viral thread - 4M views, 35K likes
**Key Discovery:** "It's not just the tool – it's the workflow around it"

### The 10 Principles

1. **Work in Parallel** - Multiple git worktrees with separate Claude sessions ("single biggest productivity unlock")
2. **Plan Mode First** - Complex tasks start with detailed planning → one-shot implementation 
3. **Maintain CLAUDE.md** - Self-improving documentation: "Update your CLAUDE.md so you don't make that mistake again"
4. **Build Your Own Skills** - Repetitive tasks → reusable skills/commands (commit to git)
5. **Automate Bug Fixes** - Don't micromanage, let Claude find the way ("Go fix the failing CI tests")
6. **Better Prompts** - "Grill me on these changes", "Scrap this and implement the elegant solution"
7. **Use Subagents** - Offload tasks to keep main context clean
8. **Data & Analytics** - Claude + CLI tools (Boris: "Haven't written SQL in 6+ months")
9. **Voice Dictation** - 3x faster than typing, more detailed prompts
10. **Learn with Claude** - Explanatory output style, generate presentations/diagrams

### Application to Our Repairs

**Immediate Implementation:**
- **Parallel Worktrees** for Nexus security fixes + Kanban integration 
- **OPENCLAW.md** for our own mistake-prevention documentation
- **Subagent specialization** for focused repair work
- **Planning sessions** before implementation

---

*Last updated: 2026-02-04 | Migrated from Aries backup with consolidation*
