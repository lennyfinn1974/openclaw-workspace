#!/usr/bin/env python3
"""
Actionable Understanding System - Challenge Pattern Recognition & Auto-Suggestion
Part 3 of the QMD Knowledge Management System
"""

import json
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from qmd_search import QMDSearch
from learning_framework import LearningFramework

class ActionableUnderstanding:
    def __init__(self, workspace_path: str = "."):
        self.workspace_path = Path(workspace_path)
        self.qmd = QMDSearch(workspace_path)
        self.learning = LearningFramework(workspace_path)
        self.templates_file = self.workspace_path / "skill_templates.json"
        self.synthesis_file = self.workspace_path / "knowledge_synthesis.json"
        self.templates = self._load_skill_templates()
        self.synthesis_patterns = self._load_synthesis_patterns()
        
    def _load_skill_templates(self) -> Dict[str, Any]:
        """Load skill application templates"""
        default_templates = {
            "technical_implementation": {
                "name": "Technical Implementation Template",
                "description": "Systematic approach for technical challenges",
                "steps": [
                    "Cost Analysis: tmux + Claude Code vs API calls",
                    "Skill Requirements: Identify specific expertise needed",
                    "Sub-Agent Delegation: Assess if complex enough for delegation",
                    "Integration Points: Map to existing systems",
                    "Success Metrics: Define measurable completion criteria"
                ],
                "decision_points": [
                    "Is this cost-sensitive? → Use tmux + Claude Code",
                    "Is this complex? → Consider sub-agent delegation",
                    "Are there existing patterns? → Reference MEMORY.md",
                    "Does it integrate? → Check system architecture"
                ],
                "resources": ["TMUX_CLAUDE_CODE_WORKFLOW.md", "CODING_WORKLOAD_PROCESS.md"],
                "success_indicators": ["cost efficiency", "completion time", "code quality"],
                "risk_factors": ["API cost escalation", "context overflow", "integration complexity"]
            },
            
            "knowledge_research": {
                "name": "Multi-Angle Knowledge Research Template", 
                "description": "Comprehensive research with cross-validation",
                "steps": [
                    "Internal Knowledge: Search QMD for existing insights",
                    "External Research: Web search + documentation deep-dive",
                    "User Context: Check USER.md and MEMORY.md for preferences",
                    "Cross-Validation: Verify across multiple sources",
                    "Synthesis: Connect new knowledge to existing framework"
                ],
                "decision_points": [
                    "Is there internal knowledge? → Search QMD first",
                    "Is context needed? → Check USER.md and MEMORY.md",
                    "Is this novel? → Use external research",
                    "Are sources reliable? → Cross-validate findings"
                ],
                "resources": ["QMD_SYSTEM.md", "MEMORY.md", "web_search tool"],
                "success_indicators": ["source diversity", "insight quality", "actionability"],
                "risk_factors": ["single source bias", "context mismatch", "information overload"]
            },
            
            "system_integration": {
                "name": "System Integration Template",
                "description": "Connect new systems with existing architecture",
                "steps": [
                    "Current State: Document existing systems and capabilities",
                    "Integration Points: Identify connection opportunities",
                    "Risk Assessment: Analyze potential issues and mitigation",
                    "Implementation Plan: Step-by-step integration approach",
                    "Testing Strategy: Verify integration success"
                ],
                "decision_points": [
                    "Are there similar integrations? → Reference proven patterns",
                    "Is it critical? → Use staged deployment with rollback",
                    "Is it complex? → Consider sub-agent specialization",
                    "Are there dependencies? → Map integration sequence"
                ],
                "resources": ["COMPLETE_SUCCESS_DOCUMENTATION.md", "KANBAN_API_HELPER.md"],
                "success_indicators": ["system compatibility", "data flow", "error handling"],
                "risk_factors": ["breaking changes", "data loss", "performance degradation"]
            },
            
            "project_management": {
                "name": "AI Project Management Template",
                "description": "Autonomous task creation and tracking",
                "steps": [
                    "Work Breakdown: Decompose project into manageable tasks",
                    "Task Creation: Use Kanban API for programmatic task management",
                    "Agent Assignment: Delegate to appropriate sub-agents",
                    "Progress Tracking: Monitor via live Kanban board",
                    "Integration: Coordinate results into main workflow"
                ],
                "decision_points": [
                    "Can tasks be automated? → Use Kanban API integration",
                    "Do tasks need expertise? → Assign specialized sub-agents",
                    "Is coordination needed? → Use real-time board updates",
                    "Are deliverables clear? → Define success metrics"
                ],
                "resources": ["KANBAN_API_HELPER.md", "AGENTS.md"],
                "success_indicators": ["task completion rate", "coordination efficiency", "deliverable quality"],
                "risk_factors": ["task overlap", "resource conflicts", "communication gaps"]
            },
            
            "cost_optimization": {
                "name": "Cost-Effective Development Template",
                "description": "Minimize expenses while maximizing capabilities",
                "steps": [
                    "Cost Assessment: Analyze current approach expenses",
                    "Alternative Evaluation: Consider tmux + Claude Code options",
                    "Resource Allocation: Optimize between free and paid resources",
                    "Implementation: Deploy cost-effective approach",
                    "Monitoring: Track actual vs projected savings"
                ],
                "decision_points": [
                    "Is coding involved? → Try tmux + Claude Code first",
                    "Is it urgent? → Balance speed vs cost",
                    "Are capabilities adequate? → Verify Max subscription limits",
                    "Is monitoring needed? → Set up cost tracking"
                ],
                "resources": ["TMUX_CLAUDE_CODE_WORKFLOW.md", "MEMORY.md cost patterns"],
                "success_indicators": ["cost reduction %", "capability maintained", "implementation speed"],
                "risk_factors": ["capability limitations", "time overhead", "complexity increase"]
            }
        }
        
        if self.templates_file.exists():
            try:
                with open(self.templates_file, 'r') as f:
                    templates = json.load(f)
                    # Merge with defaults
                    for key, value in default_templates.items():
                        if key not in templates:
                            templates[key] = value
                    return templates
            except Exception as e:
                print(f"Error loading templates: {e}")
        
        return default_templates
    
    def _load_synthesis_patterns(self) -> Dict[str, Any]:
        """Load knowledge synthesis patterns"""
        default_patterns = {
            "connection_types": [
                "causal_relationship",      # A causes B
                "correlation",              # A and B occur together
                "contradiction",            # A conflicts with B 
                "reinforcement",            # A strengthens B
                "analogy",                  # A is similar to B
                "sequence",                 # A leads to B leads to C
                "hierarchy",                # A contains B contains C
                "dependency"                # A requires B
            ],
            
            "synthesis_rules": {
                "reinforcement": "Look for patterns that strengthen each other",
                "contradiction": "Identify conflicts and resolve or choose best option",
                "sequence": "Find logical progressions and workflows",
                "causal": "Map cause-effect relationships for prediction",
                "analogy": "Apply successful patterns to similar challenges"
            },
            
            "domains": [
                "technical_implementation",
                "cost_optimization", 
                "project_management",
                "knowledge_research",
                "system_integration",
                "user_experience",
                "strategic_planning"
            ]
        }
        
        if self.synthesis_file.exists():
            try:
                with open(self.synthesis_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error loading synthesis patterns: {e}")
        
        return default_patterns
    
    def recognize_challenge_pattern(self, challenge_description: str) -> Dict[str, Any]:
        """Advanced pattern recognition with auto-suggestion"""
        # Get basic pattern recognition from learning framework
        basic_pattern = self.learning.identify_challenge_pattern(challenge_description)
        
        # Enhanced analysis
        enhanced_analysis = self._analyze_challenge_complexity(challenge_description)
        related_knowledge = self.qmd.search(challenge_description, max_results=3)
        
        # Generate skill recommendations
        recommendations = self._generate_skill_recommendations(
            challenge_description, 
            basic_pattern,
            enhanced_analysis,
            related_knowledge
        )
        
        return {
            "challenge": challenge_description,
            "timestamp": datetime.now().isoformat(),
            "basic_pattern": basic_pattern,
            "complexity_analysis": enhanced_analysis,
            "related_knowledge": related_knowledge,
            "recommendations": recommendations,
            "confidence": self._calculate_confidence(basic_pattern, enhanced_analysis, related_knowledge)
        }
    
    def _analyze_challenge_complexity(self, challenge: str) -> Dict[str, Any]:
        """Analyze challenge complexity across multiple dimensions"""
        challenge_lower = challenge.lower()
        
        # Technical complexity indicators
        technical_indicators = ["api", "integration", "system", "architecture", "database", "security"]
        technical_score = sum(1 for indicator in technical_indicators if indicator in challenge_lower)
        
        # Knowledge complexity indicators  
        knowledge_indicators = ["research", "analysis", "learning", "strategy", "framework"]
        knowledge_score = sum(1 for indicator in knowledge_indicators if indicator in challenge_lower)
        
        # Time complexity indicators
        time_indicators = ["urgent", "asap", "quickly", "immediately", "deadline"]
        time_pressure = sum(1 for indicator in time_indicators if indicator in challenge_lower)
        
        # Cost complexity indicators
        cost_indicators = ["expensive", "budget", "cost", "cheap", "free", "optimize"]
        cost_sensitivity = sum(1 for indicator in cost_indicators if indicator in challenge_lower)
        
        # Scope indicators
        scope_indicators = ["complete", "comprehensive", "full", "entire", "all"]
        scope_size = sum(1 for indicator in scope_indicators if indicator in challenge_lower)
        
        return {
            "technical_complexity": min(technical_score, 5),
            "knowledge_complexity": min(knowledge_score, 5),
            "time_pressure": min(time_pressure, 3),
            "cost_sensitivity": min(cost_sensitivity, 3),
            "scope_size": min(scope_size, 3),
            "overall_complexity": min(technical_score + knowledge_score + scope_size, 10)
        }
    
    def _generate_skill_recommendations(self, challenge: str, basic_pattern: Dict[str, Any],
                                      complexity: Dict[str, Any], knowledge: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate actionable skill recommendations"""
        recommendations = []
        
        # Primary recommendation based on pattern
        if basic_pattern["pattern_name"] != "unknown":
            primary_template = self.templates.get(basic_pattern["pattern_name"])
            if primary_template:
                recommendations.append({
                    "priority": "primary",
                    "skill": basic_pattern["pattern_name"],
                    "template": primary_template["name"],
                    "reasoning": f"Matches proven pattern: {basic_pattern['pattern_data']['pattern']}",
                    "confidence": basic_pattern["confidence"],
                    "steps": primary_template["steps"][:3],  # First 3 steps
                    "resources": primary_template["resources"]
                })
        
        # Secondary recommendations based on complexity
        if complexity["cost_sensitivity"] >= 2:
            recommendations.append({
                "priority": "secondary",
                "skill": "cost_optimization",
                "template": "Cost-Effective Development Template",
                "reasoning": "Cost sensitivity detected - consider tmux + Claude Code",
                "confidence": complexity["cost_sensitivity"],
                "steps": ["Check tmux + Claude Code viability", "Compare costs", "Implement if beneficial"],
                "resources": ["TMUX_CLAUDE_CODE_WORKFLOW.md"]
            })
        
        if complexity["technical_complexity"] >= 3:
            recommendations.append({
                "priority": "secondary", 
                "skill": "system_integration",
                "template": "System Integration Template",
                "reasoning": "High technical complexity - consider sub-agent delegation",
                "confidence": complexity["technical_complexity"],
                "steps": ["Assess integration points", "Plan staged approach", "Consider sub-agent specialization"],
                "resources": ["AGENTS.md", "COMPLETE_SUCCESS_DOCUMENTATION.md"]
            })
        
        if complexity["knowledge_complexity"] >= 2:
            recommendations.append({
                "priority": "secondary",
                "skill": "knowledge_research", 
                "template": "Multi-Angle Knowledge Research Template",
                "reasoning": "Knowledge gap identified - use multi-angle research",
                "confidence": complexity["knowledge_complexity"],
                "steps": ["Search QMD", "External research", "Cross-validate sources"],
                "resources": ["QMD_SYSTEM.md", "web_search tool"]
            })
        
        # Tertiary recommendations from related knowledge
        for knowledge_item in knowledge[:2]:  # Top 2 knowledge items
            if knowledge_item["score"] >= 15:  # High relevance
                recommendations.append({
                    "priority": "tertiary",
                    "skill": "knowledge_application",
                    "template": f"Apply insights from {knowledge_item['file']}",
                    "reasoning": f"High relevance match in existing knowledge",
                    "confidence": knowledge_item["score"] / 20,  # Normalize to 0-1 scale
                    "steps": [f"Review {knowledge_item['file']}", "Extract applicable patterns", "Adapt to current challenge"],
                    "resources": [knowledge_item['file']]
                })
        
        return recommendations
    
    def _calculate_confidence(self, basic_pattern: Dict[str, Any], 
                            complexity: Dict[str, Any], knowledge: List[Dict[str, Any]]) -> float:
        """Calculate overall confidence in recommendations"""
        # Base confidence from pattern matching
        pattern_confidence = basic_pattern["confidence"] / 5.0  # Normalize to 0-1
        
        # Boost from complexity analysis
        complexity_boost = min(complexity["overall_complexity"] / 10.0, 0.3)
        
        # Boost from relevant knowledge
        knowledge_boost = min(len(knowledge) * 0.1, 0.2)
        
        return min(pattern_confidence + complexity_boost + knowledge_boost, 1.0)
    
    def apply_template(self, template_name: str, challenge: str, 
                      constraints: Dict[str, Any] = None) -> Dict[str, Any]:
        """Apply skill template to specific challenge"""
        if template_name not in self.templates:
            return {"error": f"Template '{template_name}' not found"}
        
        template = self.templates[template_name]
        
        # Customize template for specific challenge
        customized_steps = self._customize_template_steps(template["steps"], challenge, constraints)
        relevant_decisions = self._filter_decision_points(template["decision_points"], challenge)
        
        # Generate implementation plan
        implementation_plan = {
            "template_used": template_name,
            "challenge": challenge,
            "customized_steps": customized_steps,
            "decision_points": relevant_decisions,
            "resources": template["resources"],
            "success_metrics": template["success_indicators"],
            "risk_mitigation": self._assess_risks(template["risk_factors"], challenge),
            "estimated_timeline": self._estimate_timeline(customized_steps),
            "resource_requirements": self._estimate_resources(challenge, template)
        }
        
        return implementation_plan
    
    def _customize_template_steps(self, steps: List[str], challenge: str, 
                                 constraints: Dict[str, Any] = None) -> List[str]:
        """Customize template steps for specific challenge"""
        customized = []
        challenge_lower = challenge.lower()
        
        for step in steps:
            # Add specific context based on challenge
            if "cost" in step.lower() and "api" in challenge_lower:
                step += " (Priority: Check tmux + Claude Code for API call reduction)"
            elif "integration" in step.lower() and "system" in challenge_lower:
                step += " (Reference: COMPLETE_SUCCESS_DOCUMENTATION.md integration patterns)"
            elif "research" in step.lower() and ("unknown" in challenge_lower or "new" in challenge_lower):
                step += " (Use: Multi-angle research protocol with cross-validation)"
            
            customized.append(step)
        
        return customized
    
    def _filter_decision_points(self, decision_points: List[str], challenge: str) -> List[str]:
        """Filter decision points based on challenge relevance"""
        relevant = []
        challenge_lower = challenge.lower()
        
        for decision in decision_points:
            # Check if decision point is relevant to challenge
            decision_lower = decision.lower()
            
            if any(keyword in challenge_lower for keyword in ["cost", "expensive"] if "cost" in decision_lower):
                relevant.append(decision)
            elif any(keyword in challenge_lower for keyword in ["complex", "difficult"] if "complex" in decision_lower):
                relevant.append(decision)
            elif any(keyword in challenge_lower for keyword in ["integrate", "connect"] if "integrat" in decision_lower):
                relevant.append(decision)
            elif any(keyword in challenge_lower for keyword in ["pattern", "similar"] if "pattern" in decision_lower):
                relevant.append(decision)
        
        return relevant[:3]  # Top 3 most relevant
    
    def _assess_risks(self, risk_factors: List[str], challenge: str) -> List[Dict[str, str]]:
        """Assess risks and provide mitigation strategies"""
        risk_assessment = []
        challenge_lower = challenge.lower()
        
        for risk in risk_factors:
            risk_level = "medium"  # Default
            mitigation = "Monitor and review regularly"
            
            if "cost" in risk.lower() and ("budget" in challenge_lower or "expensive" in challenge_lower):
                risk_level = "high"
                mitigation = "Use tmux + Claude Code workflow to minimize API costs"
            elif "complex" in risk.lower() and ("complex" in challenge_lower or "difficult" in challenge_lower):
                risk_level = "high" 
                mitigation = "Break into smaller tasks and consider sub-agent delegation"
            elif "integration" in risk.lower() and "system" in challenge_lower:
                risk_level = "medium"
                mitigation = "Use staged deployment with rollback capability"
            
            risk_assessment.append({
                "risk": risk,
                "level": risk_level,
                "mitigation": mitigation
            })
        
        return risk_assessment
    
    def _estimate_timeline(self, steps: List[str]) -> Dict[str, str]:
        """Estimate timeline based on step complexity"""
        base_time_per_step = 30  # minutes
        total_minutes = len(steps) * base_time_per_step
        
        return {
            "estimated_steps": len(steps),
            "minutes_per_step": base_time_per_step,
            "total_minutes": total_minutes,
            "total_hours": round(total_minutes / 60, 1),
            "confidence": "rough estimate - adjust based on complexity"
        }
    
    def _estimate_resources(self, challenge: str, template: Dict[str, Any]) -> Dict[str, Any]:
        """Estimate resource requirements"""
        challenge_lower = challenge.lower()
        
        # Estimate based on challenge type
        if "api" in challenge_lower or "integration" in challenge_lower:
            approach = "tmux + Claude Code (FREE)" if "cost" in challenge_lower else "API calls (PAID)"
        else:
            approach = "Direct work"
        
        return {
            "primary_approach": approach,
            "sub_agent_needed": "complex" in challenge_lower or "integration" in challenge_lower,
            "external_resources": template.get("resources", []),
            "cost_estimate": "FREE via tmux" if "tmux" in approach else "Variable API costs"
        }
    
    def synthesize_knowledge(self, domain: str, insights: List[str]) -> Dict[str, Any]:
        """Synthesize insights across knowledge domains"""
        synthesis = {
            "domain": domain,
            "timestamp": datetime.now().isoformat(),
            "input_insights": insights,
            "connections": [],
            "patterns": [],
            "recommendations": [],
            "confidence": 0.0
        }
        
        # Find connections between insights
        for i, insight1 in enumerate(insights):
            for j, insight2 in enumerate(insights[i+1:], i+1):
                connection = self._identify_connection(insight1, insight2)
                if connection:
                    synthesis["connections"].append({
                        "insight1_index": i,
                        "insight2_index": j,
                        "connection_type": connection["type"],
                        "strength": connection["strength"],
                        "description": connection["description"]
                    })
        
        # Extract patterns
        synthesis["patterns"] = self._extract_patterns(insights, synthesis["connections"])
        
        # Generate recommendations
        synthesis["recommendations"] = self._generate_synthesis_recommendations(
            domain, synthesis["patterns"], synthesis["connections"]
        )
        
        # Calculate confidence
        synthesis["confidence"] = len(synthesis["connections"]) * 0.2 + len(synthesis["patterns"]) * 0.3
        synthesis["confidence"] = min(synthesis["confidence"], 1.0)
        
        return synthesis
    
    def _identify_connection(self, insight1: str, insight2: str) -> Optional[Dict[str, Any]]:
        """Identify connection between two insights"""
        insight1_lower = insight1.lower()
        insight2_lower = insight2.lower()
        
        # Causal relationship
        if ("cause" in insight1_lower or "leads to" in insight1_lower) and any(word in insight2_lower for word in ["result", "effect", "outcome"]):
            return {"type": "causal", "strength": 0.8, "description": "Causal relationship identified"}
        
        # Reinforcement
        if any(word in insight1_lower for word in ["confirms", "supports", "validates"]) and any(word in insight2_lower for word in ["same", "similar", "also"]):
            return {"type": "reinforcement", "strength": 0.7, "description": "Mutually reinforcing insights"}
        
        # Contradiction
        if any(word in insight1_lower for word in ["but", "however", "opposite"]) or any(word in insight2_lower for word in ["but", "however", "opposite"]):
            return {"type": "contradiction", "strength": 0.6, "description": "Contradictory insights requiring resolution"}
        
        # Sequence
        if any(word in insight1_lower for word in ["first", "then", "next", "after"]) and any(word in insight2_lower for word in ["second", "then", "next", "finally"]):
            return {"type": "sequence", "strength": 0.7, "description": "Sequential relationship"}
        
        return None
    
    def _extract_patterns(self, insights: List[str], connections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract patterns from insights and connections"""
        patterns = []
        
        # Pattern: Multiple reinforcing insights
        reinforcing_connections = [c for c in connections if c["connection_type"] == "reinforcement"]
        if len(reinforcing_connections) >= 2:
            patterns.append({
                "type": "convergent_evidence",
                "description": "Multiple insights converge on same conclusion",
                "strength": len(reinforcing_connections) * 0.3,
                "insights_involved": len(set([c["insight1_index"] for c in reinforcing_connections] + [c["insight2_index"] for c in reinforcing_connections]))
            })
        
        # Pattern: Causal chain
        causal_connections = [c for c in connections if c["connection_type"] == "causal"]
        if len(causal_connections) >= 1:
            patterns.append({
                "type": "causal_chain",
                "description": "Clear cause-effect relationships identified",
                "strength": sum(c["strength"] for c in causal_connections) / len(causal_connections),
                "chain_length": len(causal_connections)
            })
        
        return patterns
    
    def _generate_synthesis_recommendations(self, domain: str, patterns: List[Dict[str, Any]], 
                                          connections: List[Dict[str, Any]]) -> List[str]:
        """Generate actionable recommendations from synthesis"""
        recommendations = []
        
        for pattern in patterns:
            if pattern["type"] == "convergent_evidence":
                recommendations.append(f"High confidence action: Multiple insights support this approach in {domain}")
            elif pattern["type"] == "causal_chain":
                recommendations.append(f"Focus on root causes: Clear causal relationships identified in {domain}")
        
        # Handle contradictions
        contradictions = [c for c in connections if c["connection_type"] == "contradiction"]
        if contradictions:
            recommendations.append(f"Resolve conflicts: {len(contradictions)} contradictory insights need reconciliation")
        
        return recommendations
    
    def get_success_metrics(self) -> Dict[str, Any]:
        """Get success metrics for the actionable understanding system"""
        metrics = self.learning.get_learning_metrics()
        
        # Add template usage metrics
        template_usage = {"total_applications": 0, "template_success_rate": 0.0}
        
        # Add synthesis metrics  
        synthesis_metrics = {"total_syntheses": 0, "avg_confidence": 0.0}
        
        return {
            **metrics,
            "templates_available": len(self.templates),
            "synthesis_patterns": len(self.synthesis_patterns),
            "template_usage": template_usage,
            "synthesis_metrics": synthesis_metrics,
            "system_confidence": self._calculate_system_confidence(metrics)
        }
    
    def _calculate_system_confidence(self, metrics: Dict[str, Any]) -> float:
        """Calculate overall system confidence based on usage and success"""
        success_rate = metrics.get("success_rate", 0) / 100.0
        pattern_coverage = min(metrics.get("patterns_available", 0) / 10.0, 1.0)  # 10 patterns = full coverage
        knowledge_coverage = min(metrics.get("qmd_files_indexed", 0) / 100.0, 1.0)  # 100 files = good coverage
        
        return (success_rate * 0.5 + pattern_coverage * 0.3 + knowledge_coverage * 0.2)

def main():
    """Command-line interface for Actionable Understanding System"""
    import sys
    
    aus = ActionableUnderstanding()
    
    if len(sys.argv) < 2:
        print("Actionable Understanding System - Challenge Pattern Recognition")
        print("Commands:")
        print("  analyze <challenge>        - Full pattern analysis with recommendations")
        print("  template <name> <challenge> - Apply specific template to challenge")
        print("  synthesize <domain> <insight1> <insight2> ... - Synthesize knowledge")
        print("  templates                   - List available templates")
        print("  metrics                     - Show system success metrics")
        return
    
    command = sys.argv[1]
    
    if command == "analyze":
        if len(sys.argv) < 3:
            print("Usage: analyze <challenge>")
            return
        challenge = " ".join(sys.argv[2:])
        result = aus.recognize_challenge_pattern(challenge)
        
        print(f"🎯 Challenge Analysis: '{challenge}'")
        print("=" * 60)
        print(f"Pattern Matched: {result['basic_pattern']['pattern_name']}")
        print(f"Overall Confidence: {result['confidence']:.1%}")
        print(f"Complexity Score: {result['complexity_analysis']['overall_complexity']}/10")
        
        print(f"\n📋 Recommendations ({len(result['recommendations'])} found):")
        for i, rec in enumerate(result["recommendations"], 1):
            print(f"\n{i}. {rec['template']} ({rec['priority'].title()})")
            print(f"   Reasoning: {rec['reasoning']}")
            print(f"   Confidence: {rec['confidence']:.1f}")
            print(f"   Key Steps: {' → '.join(rec['steps'][:2])}")
        
        if result["related_knowledge"]:
            print(f"\n🔗 Related Knowledge:")
            for knowledge in result["related_knowledge"][:3]:
                print(f"   • {knowledge['file']} (Score: {knowledge['score']})")
        
    elif command == "template":
        if len(sys.argv) < 4:
            print("Usage: template <name> <challenge>")
            print("Available templates:")
            for name in aus.templates.keys():
                print(f"  {name}")
            return
        template_name = sys.argv[2]
        challenge = " ".join(sys.argv[3:])
        result = aus.apply_template(template_name, challenge)
        
        if "error" in result:
            print(f"Error: {result['error']}")
            return
        
        print(f"📋 Template Application: {result['template_used']}")
        print("=" * 50)
        print(f"Challenge: {result['challenge']}")
        print(f"\n🔧 Customized Steps:")
        for i, step in enumerate(result['customized_steps'], 1):
            print(f"{i}. {step}")
        
        print(f"\n⚠️  Risk Assessment:")
        for risk in result['risk_mitigation']:
            print(f"   {risk['risk']} ({risk['level']}) → {risk['mitigation']}")
        
        print(f"\n⏱️  Timeline: {result['estimated_timeline']['total_hours']} hours")
        print(f"💰 Resources: {result['resource_requirements']['primary_approach']}")
        
    elif command == "synthesize":
        if len(sys.argv) < 5:
            print("Usage: synthesize <domain> <insight1> <insight2> ...")
            return
        domain = sys.argv[2]
        insights = sys.argv[3:]
        result = aus.synthesize_knowledge(domain, insights)
        
        print(f"🧠 Knowledge Synthesis: {domain}")
        print("=" * 40)
        print(f"Insights Analyzed: {len(result['input_insights'])}")
        print(f"Connections Found: {len(result['connections'])}")
        print(f"Patterns Identified: {len(result['patterns'])}")
        print(f"Confidence: {result['confidence']:.1%}")
        
        if result["patterns"]:
            print(f"\n🔍 Patterns:")
            for pattern in result["patterns"]:
                print(f"   • {pattern['type']}: {pattern['description']}")
        
        if result["recommendations"]:
            print(f"\n💡 Recommendations:")
            for rec in result["recommendations"]:
                print(f"   • {rec}")
        
    elif command == "templates":
        print("Available Skill Templates:")
        print("=" * 30)
        for name, template in aus.templates.items():
            print(f"\n{name}:")
            print(f"   Description: {template['description']}")
            print(f"   Steps: {len(template['steps'])}")
            print(f"   Resources: {len(template['resources'])}")
        
    elif command == "metrics":
        metrics = aus.get_success_metrics()
        print("Actionable Understanding System Metrics:")
        print("=" * 40)
        print(f"Success Rate: {metrics['success_rate']}%")
        print(f"Total Challenges: {metrics['total_challenges']}")
        print(f"Knowledge Files: {metrics['qmd_files_indexed']}")
        print(f"Available Patterns: {metrics['patterns_available']}")
        print(f"Available Templates: {metrics['templates_available']}")
        print(f"System Confidence: {metrics['system_confidence']:.1%}")
    
    else:
        print(f"Unknown command: {command}")

if __name__ == "__main__":
    main()