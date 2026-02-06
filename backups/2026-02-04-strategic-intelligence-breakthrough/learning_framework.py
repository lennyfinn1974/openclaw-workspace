#!/usr/bin/env python3
"""
Strategic Learning Framework - Pattern Recognition & Skill Application System
Part 2 of the QMD Knowledge Management System
"""

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from qmd_search import QMDSearch

class LearningFramework:
    def __init__(self, workspace_path: str = "."):
        self.workspace_path = Path(workspace_path)
        self.qmd = QMDSearch(workspace_path)
        self.patterns_file = self.workspace_path / "learning_patterns.json"
        self.success_patterns = self._load_success_patterns()
        
    def _load_success_patterns(self) -> Dict[str, Any]:
        """Load documented success patterns from knowledge base"""
        default_patterns = {
            "technical_implementation": {
                "pattern": "AI-First Development",
                "evidence": "MEMORY.md: $0 vs $800K traditional cost",
                "triggers": ["coding", "development", "implementation", "technical"],
                "approach": {
                    "first_check": "Can tmux + Claude Code handle this?",
                    "cost_analysis": "Compare API calls vs Max subscription",
                    "delegation_threshold": "Complex = sub-agent, Simple = direct",
                    "success_metrics": ["cost efficiency", "completion time", "quality"]
                },
                "resources": ["TMUX_CLAUDE_CODE_WORKFLOW.md", "CODING_WORKLOAD_PROCESS.md"]
            },
            
            "knowledge_research": {
                "pattern": "Multi-Angle Knowledge Framework", 
                "evidence": "MEMORY.md: Never rely on single information source",
                "triggers": ["research", "learning", "analysis", "unknown"],
                "approach": {
                    "sources": ["Internal QMD", "External research", "User context", "Real-time data", "Historical patterns"],
                    "validation": "Cross-validate across multiple sources",
                    "synthesis": "Connect new knowledge to existing framework",
                    "persistence": "Update memory with insights"
                },
                "resources": ["MEMORY.md Multi-Angle Framework", "QMD_SYSTEM.md"]
            },
            
            "system_integration": {
                "pattern": "Sub-Agent Orchestration",
                "evidence": "MEMORY.md: Specialized expertise > generalist approach",
                "triggers": ["integration", "system", "architecture", "complex"],
                "approach": {
                    "specialization": "Technical Architecture, Rapid Prototyping, Deep Analysis, UX",
                    "isolation": "Sub-agent task isolation for heavy work",
                    "coordination": "Master Pattern: Focused expertise prevents context overflow",
                    "documentation": "Capture results and integrate back"
                },
                "resources": ["AGENTS.md", "COMPLETE_SUCCESS_DOCUMENTATION.md"]
            },
            
            "cost_optimization": {
                "pattern": "tmux + Claude Code Delegation",
                "evidence": "MEMORY.md: 100% cost reduction for coding work",
                "triggers": ["expensive", "cost", "coding", "development", "api"],
                "approach": {
                    "first_option": "Always attempt tmux delegation before API",
                    "setup": "One-time tmux session per project",
                    "monitoring": "Live visibility + result capture",
                    "integration": "Integrate results back to main workflow"
                },
                "resources": ["TMUX_CLAUDE_CODE_WORKFLOW.md", "QUICK_REFERENCE_TMUX_CLAUDE.md"]
            },
            
            "project_management": {
                "pattern": "Kanban API Integration",
                "evidence": "MEMORY.md: Autonomous AI task management proven",
                "triggers": ["task", "project", "management", "tracking", "coordination"],
                "approach": {
                    "endpoint": "POST localhost:3002/api/webhooks/openclaw",
                    "capabilities": "Create, update, move tasks programmatically",
                    "real_time": "Live board updates via Socket.io",
                    "autonomy": "Sub-agents can self-manage work breakdown"
                },
                "resources": ["KANBAN_API_HELPER.md", "COMPLETE_SUCCESS_DOCUMENTATION.md"]
            }
        }
        
        if self.patterns_file.exists():
            try:
                with open(self.patterns_file, 'r') as f:
                    patterns = json.load(f)
                    # Merge with defaults
                    for key, value in default_patterns.items():
                        if key not in patterns:
                            patterns[key] = value
                    return patterns
            except Exception as e:
                print(f"Error loading patterns: {e}")
        
        return default_patterns
    
    def _save_patterns(self):
        """Save success patterns"""
        with open(self.patterns_file, 'w') as f:
            json.dump(self.success_patterns, f, indent=2)
    
    def identify_challenge_pattern(self, challenge_description: str) -> Dict[str, Any]:
        """Identify which success pattern matches the challenge"""
        challenge_lower = challenge_description.lower()
        
        # Score patterns based on trigger words
        pattern_scores = {}
        for pattern_name, pattern_data in self.success_patterns.items():
            score = 0
            matches = []
            
            for trigger in pattern_data["triggers"]:
                if trigger in challenge_lower:
                    score += 1
                    matches.append(trigger)
            
            if score > 0:
                pattern_scores[pattern_name] = {
                    "score": score,
                    "matches": matches,
                    "pattern": pattern_data
                }
        
        # Return best match
        if pattern_scores:
            best_pattern = max(pattern_scores.keys(), key=lambda k: pattern_scores[k]["score"])
            return {
                "pattern_name": best_pattern,
                "confidence": pattern_scores[best_pattern]["score"],
                "matches": pattern_scores[best_pattern]["matches"],
                "pattern_data": pattern_scores[best_pattern]["pattern"]
            }
        
        return {"pattern_name": "unknown", "confidence": 0, "matches": [], "pattern_data": None}
    
    def suggest_approach(self, challenge: str) -> Dict[str, Any]:
        """Suggest approach based on identified pattern"""
        pattern_match = self.identify_challenge_pattern(challenge)
        
        if pattern_match["confidence"] == 0:
            # No pattern match - use general research approach
            return {
                "approach": "multi_angle_research",
                "reasoning": "No specific pattern identified - defaulting to comprehensive research",
                "steps": [
                    "Search QMD for similar challenges",
                    "External research and documentation",
                    "Check user preferences and context", 
                    "Cross-validate across sources",
                    "Synthesize and document new insights"
                ],
                "resources": ["QMD_SYSTEM.md", "MEMORY.md"],
                "pattern_used": "general_research"
            }
        
        pattern_data = pattern_match["pattern_data"]
        
        return {
            "approach": pattern_match["pattern_name"],
            "reasoning": f"Matched pattern: {pattern_data['pattern']} (confidence: {pattern_match['confidence']})",
            "evidence": pattern_data["evidence"],
            "steps": self._generate_steps(pattern_data["approach"]),
            "resources": pattern_data["resources"],
            "pattern_used": pattern_match["pattern_name"],
            "triggers_matched": pattern_match["matches"]
        }
    
    def _generate_steps(self, approach_data: Dict[str, Any]) -> List[str]:
        """Generate actionable steps from approach data"""
        steps = []
        
        for key, value in approach_data.items():
            if isinstance(value, str):
                steps.append(f"{key.replace('_', ' ').title()}: {value}")
            elif isinstance(value, list):
                steps.append(f"{key.replace('_', ' ').title()}: {', '.join(value)}")
            elif isinstance(value, dict):
                for subkey, subvalue in value.items():
                    steps.append(f"{key.replace('_', ' ').title()} - {subkey}: {subvalue}")
        
        return steps
    
    def search_related_knowledge(self, challenge: str, pattern_name: str = None) -> List[Dict[str, Any]]:
        """Search QMD for knowledge related to the challenge"""
        # Search for challenge keywords
        challenge_results = self.qmd.search(challenge, max_results=5)
        
        # If we have a pattern, search for pattern-specific knowledge
        pattern_results = []
        if pattern_name and pattern_name in self.success_patterns:
            pattern_data = self.success_patterns[pattern_name]
            pattern_query = pattern_data["pattern"]
            pattern_results = self.qmd.search(pattern_query, max_results=3)
        
        # Combine and deduplicate
        all_results = challenge_results + pattern_results
        seen = set()
        unique_results = []
        
        for result in all_results:
            if result["file"] not in seen:
                seen.add(result["file"])
                unique_results.append(result)
        
        return unique_results[:8]  # Max 8 results
    
    def create_decision_matrix(self, challenge: str, constraints: Dict[str, Any] = None) -> Dict[str, Any]:
        """Create decision matrix for resource allocation"""
        if constraints is None:
            constraints = {"time": "medium", "cost": "low", "complexity": "unknown"}
        
        # Analyze challenge complexity
        complexity_indicators = ["integration", "system", "architecture", "complex", "multiple"]
        complexity_score = sum(1 for indicator in complexity_indicators if indicator in challenge.lower())
        
        if complexity_score >= 2:
            complexity = "high"
        elif complexity_score == 1:
            complexity = "medium"
        else:
            complexity = "low"
        
        constraints["complexity"] = complexity
        
        # Decision matrix logic
        time_val = {"low": 1, "medium": 2, "high": 3}.get(constraints.get("time", "medium"), 2)
        cost_val = {"low": 1, "medium": 2, "high": 3}.get(constraints.get("cost", "low"), 1)
        comp_val = {"low": 1, "medium": 2, "high": 3}.get(constraints.get("complexity", "medium"), 2)
        
        # Resource allocation decision
        if comp_val >= 3 and cost_val <= 2:
            allocation = "tmux_claude_code"
            reasoning = "High complexity + cost constraints = use Max subscription via tmux"
        elif comp_val >= 3 and cost_val >= 3:
            allocation = "api_subagent"
            reasoning = "High complexity + no cost constraints = specialized sub-agent"
        elif time_val <= 1:
            allocation = "direct_implementation"
            reasoning = "Low time available = direct implementation"
        elif "research" in challenge.lower() or "analysis" in challenge.lower():
            allocation = "multi_angle_research"
            reasoning = "Research/analysis needed = multi-angle protocol"
        else:
            allocation = "pattern_based"
            reasoning = "Use identified pattern approach"
        
        return {
            "allocation": allocation,
            "reasoning": reasoning,
            "constraints_analyzed": constraints,
            "complexity_score": complexity_score,
            "recommendation_confidence": "high" if comp_val != 2 else "medium"
        }
    
    def capture_success(self, challenge: str, approach_used: str, outcome: str, 
                       insights: List[str]) -> Dict[str, Any]:
        """Capture successful approach for learning reinforcement"""
        success_entry = {
            "timestamp": datetime.now().isoformat(),
            "challenge": challenge,
            "approach_used": approach_used,
            "outcome": outcome,
            "insights": insights,
            "pattern_matched": self.identify_challenge_pattern(challenge)["pattern_name"]
        }
        
        # Save to daily memory
        today = datetime.now().strftime("%Y-%m-%d")
        memory_file = self.workspace_path / "memory" / f"{today}.md"
        
        success_markdown = f"""
### ✅ Success Captured: {challenge[:50]}...

**Approach Used:** {approach_used}
**Outcome:** {outcome}
**Pattern:** {success_entry['pattern_matched']}

**Key Insights:**
{chr(10).join(f'- {insight}' for insight in insights)}

*Captured: {success_entry['timestamp']}*
"""
        
        # Append to daily memory
        if memory_file.exists():
            with open(memory_file, 'a', encoding='utf-8') as f:
                f.write(success_markdown)
        else:
            # Create daily memory file
            memory_file.parent.mkdir(exist_ok=True)
            with open(memory_file, 'w', encoding='utf-8') as f:
                f.write(f"# {today} - Daily Memory\n\n{success_markdown}")
        
        return success_entry
    
    def analyze_failure(self, challenge: str, approach_attempted: str, 
                       failure_reason: str) -> Dict[str, Any]:
        """Analyze failed approach to improve pattern recognition"""
        pattern_match = self.identify_challenge_pattern(challenge)
        
        failure_analysis = {
            "timestamp": datetime.now().isoformat(),
            "challenge": challenge,
            "approach_attempted": approach_attempted,
            "failure_reason": failure_reason,
            "pattern_suggested": pattern_match["pattern_name"],
            "pattern_confidence": pattern_match["confidence"],
            "improvement_needed": self._suggest_improvement(approach_attempted, failure_reason)
        }
        
        # Update anti-patterns (create if doesn't exist)
        antipatterns_file = self.workspace_path / "antipatterns.json"
        
        if antipatterns_file.exists():
            with open(antipatterns_file, 'r') as f:
                antipatterns = json.load(f)
        else:
            antipatterns = {"failures": []}
        
        antipatterns["failures"].append(failure_analysis)
        
        with open(antipatterns_file, 'w') as f:
            json.dump(antipatterns, f, indent=2)
        
        return failure_analysis
    
    def _suggest_improvement(self, approach: str, failure_reason: str) -> List[str]:
        """Suggest improvements based on failure analysis"""
        suggestions = []
        
        if "cost" in failure_reason.lower():
            suggestions.append("Consider tmux + Claude Code workflow for cost reduction")
        
        if "complex" in failure_reason.lower():
            suggestions.append("Break down into smaller sub-tasks or use specialized sub-agent")
        
        if "knowledge" in failure_reason.lower() or "unknown" in failure_reason.lower():
            suggestions.append("Use multi-angle research protocol before implementation")
        
        if "context" in failure_reason.lower():
            suggestions.append("Check USER.md and MEMORY.md for relevant context")
        
        if not suggestions:
            suggestions.append("Review success patterns in learning_patterns.json")
        
        return suggestions
    
    def get_learning_metrics(self) -> Dict[str, Any]:
        """Get learning effectiveness metrics"""
        # Count successes from daily memory files
        success_count = 0
        total_challenges = 0
        
        memory_dir = self.workspace_path / "memory"
        if memory_dir.exists():
            for memory_file in memory_dir.glob("*.md"):
                try:
                    with open(memory_file, 'r', encoding='utf-8') as f:
                        content = f.read()
                        success_count += len(re.findall(r'### ✅ Success Captured:', content))
                        total_challenges += len(re.findall(r'### [✅❌]', content))
                except Exception:
                    continue
        
        # Count failures from antipatterns
        failure_count = 0
        antipatterns_file = self.workspace_path / "antipatterns.json"
        
        if antipatterns_file.exists():
            try:
                with open(antipatterns_file, 'r') as f:
                    antipatterns = json.load(f)
                    failure_count = len(antipatterns.get("failures", []))
            except Exception:
                pass
        
        total_challenges = max(total_challenges, success_count + failure_count)
        success_rate = (success_count / total_challenges * 100) if total_challenges > 0 else 0
        
        return {
            "total_challenges": total_challenges,
            "successes": success_count,
            "failures": failure_count,
            "success_rate": round(success_rate, 1),
            "patterns_available": len(self.success_patterns),
            "qmd_files_indexed": self.qmd.stats()["total_files"]
        }

def main():
    """Command-line interface for Learning Framework"""
    import sys
    
    framework = LearningFramework()
    
    if len(sys.argv) < 2:
        print("Learning Framework - Strategic Skill Application System")
        print("Commands:")
        print("  analyze <challenge>     - Analyze challenge and suggest approach")
        print("  search <challenge>      - Search related knowledge")
        print("  matrix <challenge>      - Create decision matrix")
        print("  success <challenge> <approach> <outcome> - Capture success")
        print("  metrics                 - Show learning effectiveness metrics")
        print("  patterns                - List available patterns")
        return
    
    command = sys.argv[1]
    
    if command == "analyze":
        if len(sys.argv) < 3:
            print("Usage: analyze <challenge>")
            return
        challenge = " ".join(sys.argv[2:])
        result = framework.suggest_approach(challenge)
        
        print(f"Analysis for: '{challenge}'")
        print("-" * 50)
        print(f"Approach: {result['approach']}")
        print(f"Reasoning: {result['reasoning']}")
        if result.get('evidence'):
            print(f"Evidence: {result['evidence']}")
        print(f"Pattern Used: {result['pattern_used']}")
        if result.get('triggers_matched'):
            print(f"Triggers Matched: {', '.join(result['triggers_matched'])}")
        print("\nRecommended Steps:")
        for i, step in enumerate(result['steps'], 1):
            print(f"{i}. {step}")
        print(f"\nResources: {', '.join(result['resources'])}")
        
    elif command == "search":
        if len(sys.argv) < 3:
            print("Usage: search <challenge>") 
            return
        challenge = " ".join(sys.argv[2:])
        results = framework.search_related_knowledge(challenge)
        
        print(f"Related knowledge for: '{challenge}'")
        print("-" * 50)
        for i, result in enumerate(results, 1):
            print(f"{i}. {result['file']} (Score: {result['score']})")
            print(f"   Categories: {', '.join(result['categories'])}")
            print(f"   Preview: {result['preview'][:100]}...")
            print()
        
    elif command == "matrix":
        if len(sys.argv) < 3:
            print("Usage: matrix <challenge>")
            return
        challenge = " ".join(sys.argv[2:])
        matrix = framework.create_decision_matrix(challenge)
        
        print(f"Decision matrix for: '{challenge}'")
        print("-" * 50)
        print(f"Allocation: {matrix['allocation']}")
        print(f"Reasoning: {matrix['reasoning']}")
        print(f"Complexity Score: {matrix['complexity_score']}")
        print(f"Constraints: {matrix['constraints_analyzed']}")
        print(f"Confidence: {matrix['recommendation_confidence']}")
        
    elif command == "metrics":
        metrics = framework.get_learning_metrics()
        print("Learning Effectiveness Metrics:")
        print("-" * 30)
        print(f"Total Challenges: {metrics['total_challenges']}")
        print(f"Successes: {metrics['successes']}")
        print(f"Failures: {metrics['failures']}")
        print(f"Success Rate: {metrics['success_rate']}%")
        print(f"Available Patterns: {metrics['patterns_available']}")
        print(f"Knowledge Files: {metrics['qmd_files_indexed']}")
        
    elif command == "patterns":
        patterns = framework.success_patterns
        print("Available Success Patterns:")
        print("-" * 30)
        for name, data in patterns.items():
            print(f"{name}: {data['pattern']}")
            print(f"  Triggers: {', '.join(data['triggers'])}")
            print(f"  Evidence: {data['evidence']}")
            print()
    
    else:
        print(f"Unknown command: {command}")

if __name__ == "__main__":
    main()