# Claude Code Instruction Patterns

Proven patterns for effective Claude Code automation and complex task execution.

## Boris Cherny Methodology Integration

### 1. Plan Mode First Pattern
```bash
# Always start with planning
osascript -e 'tell application "Terminal" to do script "Create comprehensive plan for: [TASK]. Analyze requirements, identify challenges, design solution architecture. Present detailed step-by-step plan before implementation." in front window'
```

### 2. Better Prompts Pattern
```bash
# Instead of: "Fix the code"
# Use: "Analyze codebase for security vulnerabilities, implement fixes following industry best practices, add comprehensive error handling, and create documentation"

# Instead of: "Make it work"  
# Use: "Diagnose the root cause of the failing tests, implement targeted fixes maintaining backward compatibility, and verify all functionality"
```

### 3. Don't Micromanage Pattern
```bash
# Instead of step-by-step instructions
# Use comprehensive outcome-focused commands:
osascript -e 'tell application "Terminal" to do script "Transform this codebase into production-ready system: fix security issues, optimize performance, add monitoring, implement CI/CD pipeline. Make all decisions needed to achieve production readiness." in front window'
```

## Complex Task Patterns

### Project Analysis & Upgrade
```bash
# Comprehensive project transformation
INSTRUCTION="Analyze this codebase comprehensively. Identify all security vulnerabilities, performance bottlenecks, code quality issues, and missing features. Create and execute a complete upgrade plan: fix security (aim for A-grade), optimize performance, improve code structure, add missing functionality, implement error handling, create documentation. Make this production-ready."
```

### Multi-Framework Integration
```bash
# Integration between systems
INSTRUCTION="Integrate this project with [TARGET_SYSTEM]. Analyze both codebases, design seamless integration architecture, implement bidirectional communication, add error handling and monitoring. Ensure both systems work together optimally while maintaining their individual functionality."
```

### Architecture Modernization
```bash
# Legacy system upgrade
INSTRUCTION="Modernize this legacy codebase. Analyze current architecture, identify outdated patterns, design modern replacement architecture, implement migration strategy, maintain backward compatibility during transition, add modern best practices (containerization, CI/CD, monitoring, documentation)."
```

## Effective Instruction Components

### 1. Context Setting
```
"Given this [PROJECT_TYPE] project that [CURRENT_STATE]..."
```

### 2. Objective Definition
```
"Transform it into [DESIRED_STATE] by [SPECIFIC_OUTCOMES]..."
```

### 3. Success Criteria
```
"Success criteria: [MEASURABLE_GOALS]"
```

### 4. Constraints & Requirements
```
"Requirements: maintain [COMPATIBILITY], follow [STANDARDS], achieve [PERFORMANCE_TARGETS]"
```

### 5. Decision Authority
```
"Make all technical decisions needed to achieve these goals. If you need clarification, proceed with industry best practices."
```

## Domain-Specific Patterns

### Security Hardening
```bash
INSTRUCTION="Comprehensive security audit and hardening. Scan for all OWASP Top 10 vulnerabilities, implement input validation, add authentication/authorization, secure data handling, implement rate limiting, add security headers, create security documentation. Achieve A-grade security rating."
```

### Performance Optimization
```bash
INSTRUCTION="Complete performance optimization. Profile application, identify bottlenecks, optimize database queries, implement caching strategies, optimize bundle sizes, add performance monitoring, implement lazy loading where applicable. Achieve <100ms response times."
```

### Code Quality & Maintainability
```bash
INSTRUCTION="Improve code quality to enterprise standards. Refactor for readability, add comprehensive type safety, implement consistent error handling, add unit tests with >90% coverage, create API documentation, establish coding standards, add linting and formatting."
```

### Integration & API Development
```bash
INSTRUCTION="Build robust API integration. Design RESTful endpoints, implement proper HTTP status codes, add comprehensive error handling, create OpenAPI documentation, implement rate limiting, add authentication, create integration tests, ensure backward compatibility."
```

## Incremental Development Patterns

### Phase-Based Development
```bash
# Phase 1: Foundation
INSTRUCTION="Phase 1 - Establish solid foundation: analyze codebase, fix critical issues, implement basic structure, add essential error handling. Create stable base for further development."

# Phase 2: Core Features (sent after Phase 1 completes)
INSTRUCTION="Phase 2 - Implement core functionality: build main features, add business logic, implement data persistence, create user interfaces. Focus on feature completeness."

# Phase 3: Polish & Production (sent after Phase 2 completes)  
INSTRUCTION="Phase 3 - Production readiness: optimize performance, add comprehensive testing, implement monitoring, create documentation, add deployment configuration. Make it production-ready."
```

## Error Handling & Recovery Patterns

### Graceful Error Handling
```bash
INSTRUCTION="If you encounter errors: 1) Analyze root cause, 2) Implement targeted fix, 3) Add prevention measures, 4) Continue with task. If critical error prevents progress, explain issue and propose alternative approach. Don't stop - adapt and proceed."
```

### Dependency Management
```bash
INSTRUCTION="Handle all dependencies automatically. If packages are missing, install them. If versions conflict, resolve compatibility. If documentation is unclear, use best practices. Make all decisions needed to complete the task successfully."
```

## Monitoring & Progress Patterns

### Self-Reporting Progress
```bash
INSTRUCTION="Provide progress updates every 2 minutes. Format: 'Progress: [Current Phase] - [What you're doing] - [Estimated remaining time]'. Continue working while reporting."
```

### Milestone-Based Reporting
```bash
INSTRUCTION="Report completion of major milestones: 'MILESTONE: [Description] - COMPLETED'. Include brief summary of what was accomplished and next steps."
```

## Advanced Automation Patterns

### File System Operations
```bash
INSTRUCTION="Organize this project properly. Create appropriate directory structure, move files to correct locations, establish naming conventions, add proper file permissions, create necessary configuration files."
```

### Environment Setup
```bash
INSTRUCTION="Set up complete development environment. Install dependencies, configure tools, create necessary config files, establish build process, add development scripts, create environment documentation."
```

### Testing & Validation
```bash
INSTRUCTION="Implement comprehensive testing strategy. Create unit tests, integration tests, end-to-end tests, add test automation, implement CI/CD pipeline, add code coverage reporting, create testing documentation."
```

## Quality Assurance Patterns

### Code Review Simulation
```bash
INSTRUCTION="Perform comprehensive code review on your own work. Check for security issues, performance problems, code quality, maintainability, documentation completeness. Fix any issues found. Aim for production-quality code."
```

### Best Practices Enforcement
```bash
INSTRUCTION="Apply industry best practices throughout: follow SOLID principles, implement proper error handling, use appropriate design patterns, maintain code consistency, add comprehensive logging, follow security best practices."
```

## Example: Complete Nexus Upgrade Instruction

```bash
COMPREHENSIVE_NEXUS_UPGRADE="NEXUS AGENT TRANSFORMATION PROJECT

MISSION: Transform Nexus from D+ security rating into production-ready AI powerhouse using OpenClaw's proven architecture patterns.

PHASE 1 - FOUNDATION:
- Analyze both codebases: ./nexus-server/ vs ~/Downloads/Nexus/
- Identify which has latest work and consolidate into unified codebase
- Fix all security vulnerabilities (achieve A-grade security)
- Implement proper error handling and input validation

PHASE 2 - ARCHITECTURE UPGRADE:
- Port OpenClaw's sub-agent orchestration patterns
- Implement breakthrough terminal control system
- Add cost-optimization model routing (70-90% cost reduction)
- Integrate context management and memory systems

PHASE 3 - ENHANCED INTEGRATION:
- Build bidirectional OpenClaw ↔ Nexus communication
- Implement strategic intelligence sharing
- Add parallel development workflows
- Create comprehensive testing suite

SUCCESS CRITERIA:
- Single unified Nexus codebase
- A-grade security rating achieved
- OpenClaw integration fully operational
- Cost-effective model routing working
- Production-ready deployment

METHODOLOGY: Plan → Implement → Test → Document
Make all technical decisions needed. If you need information, analyze available code and apply best practices. Transform Nexus into an enterprise-grade AI system."
```

This instruction provides comprehensive guidance while giving Claude Code full autonomy to make technical decisions and implement solutions.