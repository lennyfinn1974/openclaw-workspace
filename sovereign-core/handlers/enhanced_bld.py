"""
Enhanced BLD Handler with Agent Teams Coordination
==================================================

Merges Agent Teams patterns with existing BLD workflow:
- File-based task coordination (like Agent Teams)
- Specialized agent roles with clear boundaries
- Structured communication protocols
- Reduced prompt complexity via specialization
- Max subscription compatible
"""

import asyncio
import json
import os
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

try:
    from ..routing import TieredRouter, ModelTier
except ImportError:
    from routing import TieredRouter, ModelTier


class TeamCoordination:
    """File-based team coordination system inspired by Agent Teams"""
    
    def __init__(self, workspace_path: Path):
        self.workspace = workspace_path
        self.coordination_dir = workspace_path / "coordination"
        self.tasks_dir = self.coordination_dir / "tasks"
        self.results_dir = self.coordination_dir / "results"
        self.messages_dir = self.coordination_dir / "messages"
        self.status_dir = self.coordination_dir / "status"
        
        # Ensure directories exist
        for dir_path in [self.coordination_dir, self.tasks_dir, self.results_dir, 
                        self.messages_dir, self.status_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)
    
    def create_task_pool(self, prd_content: str, project_name: str) -> List[Dict]:
        """Extract specialized workstreams from PRD and create task pool"""
        
        # 5 specialized workstreams (based on your proven structure)
        workstreams = [
            {
                "id": f"{project_name}-frontend",
                "role": "frontend-specialist", 
                "focus": "User Interface & Experience",
                "responsibilities": [
                    "React/Vue/Angular components",
                    "Responsive design implementation", 
                    "User interaction patterns",
                    "Frontend state management",
                    "Asset optimization"
                ],
                "output_files": ["frontend-implementation.md", "ui-components.json"],
                "dependencies": []
            },
            {
                "id": f"{project_name}-backend",
                "role": "backend-specialist",
                "focus": "API & Business Logic", 
                "responsibilities": [
                    "RESTful API endpoints",
                    "Authentication/authorization",
                    "Business logic implementation",
                    "Middleware & routing",
                    "Error handling patterns"
                ],
                "output_files": ["backend-api.md", "endpoints.json"],
                "dependencies": []
            },
            {
                "id": f"{project_name}-database",
                "role": "database-specialist",
                "focus": "Data Architecture & Persistence",
                "responsibilities": [
                    "Database schema design",
                    "Migration strategies", 
                    "Query optimization",
                    "Data validation rules",
                    "Backup & recovery"
                ],
                "output_files": ["database-schema.sql", "migrations.md"],
                "dependencies": []
            },
            {
                "id": f"{project_name}-testing", 
                "role": "testing-specialist",
                "focus": "Quality Assurance & Testing",
                "responsibilities": [
                    "Unit test suites",
                    "Integration test planning",
                    "End-to-end test scenarios",
                    "Performance testing",
                    "Security testing"
                ],
                "output_files": ["test-plan.md", "test-suites.json"],
                "dependencies": ["frontend", "backend", "database"]  # Testing depends on implementation
            },
            {
                "id": f"{project_name}-devops",
                "role": "devops-specialist", 
                "focus": "CI/CD & Infrastructure",
                "responsibilities": [
                    "Deployment automation",
                    "Environment configuration",
                    "CI/CD pipeline setup",
                    "Monitoring & logging",
                    "Infrastructure as code"
                ],
                "output_files": ["deployment.yml", "ci-cd-pipeline.md"],
                "dependencies": ["backend", "database"]  # DevOps needs services ready
            }
        ]
        
        # Write task files
        for ws in workstreams:
            task_file = self.tasks_dir / f"{ws['id']}.json"
            task_data = {
                "id": ws["id"],
                "role": ws["role"],
                "focus": ws["focus"],
                "responsibilities": ws["responsibilities"],
                "status": "pending",
                "owner": None,
                "blocked_by": ws["dependencies"],
                "output_files": ws["output_files"],
                "created_at": datetime.now().isoformat(),
                "prd_excerpt": self._extract_relevant_prd(prd_content, ws["focus"])
            }
            
            with open(task_file, 'w') as f:
                json.dump(task_data, f, indent=2)
        
        return workstreams
    
    def _extract_relevant_prd(self, prd_content: str, focus: str) -> str:
        """Extract relevant PRD sections for each specialist"""
        # Smart extraction based on specialist focus
        focus_keywords = {
            "User Interface & Experience": ["ui", "ux", "frontend", "interface", "user experience"],
            "API & Business Logic": ["api", "backend", "business logic", "endpoints", "authentication"],
            "Data Architecture & Persistence": ["database", "data", "schema", "persistence", "storage"],
            "Quality Assurance & Testing": ["testing", "quality", "test", "validation", "qa"],
            "CI/CD & Infrastructure": ["deployment", "infrastructure", "ci/cd", "devops", "pipeline"]
        }
        
        # Simple extraction - in production, this could be more sophisticated
        relevant_lines = []
        lines = prd_content.split('\n')
        keywords = focus_keywords.get(focus, [])
        
        for line in lines:
            if any(keyword.lower() in line.lower() for keyword in keywords):
                relevant_lines.append(line)
        
        return '\n'.join(relevant_lines[:10])  # Limit to key excerpts


class SpecializedAgentPrompts:
    """Specialized agent prompts with reduced complexity"""
    
    @staticmethod
    def get_specialist_prompt(role: str, task_data: Dict) -> str:
        """Get specialized prompt for each agent role"""
        
        base_context = f"""
You are a {role.replace('-', ' ').title()}. 

PROJECT: {task_data['id']}
FOCUS: {task_data['focus']}

RESPONSIBILITIES:
{chr(10).join(f"- {resp}" for resp in task_data['responsibilities'])}

RELEVANT PRD CONTEXT:
{task_data['prd_excerpt']}

OUTPUT REQUIREMENTS:
{chr(10).join(f"- {file}" for file in task_data['output_files'])}
        """
        
        role_specific_instructions = {
            "frontend-specialist": """
YOUR SPECIALIZED ROLE: Frontend Implementation Expert

FOCUS AREAS:
- Modern component architecture (React/Vue/Angular)
- Responsive design patterns 
- State management strategies
- Performance optimization
- Accessibility compliance

COMMUNICATION PROTOCOL:
1. Read your task file: workspace/coordination/tasks/{task_id}.json
2. Claim task: update status to "in_progress", owner to your agent name
3. Implement your frontend components/logic
4. Output results to workspace/coordination/results/{task_id}/
5. Signal completion via cron wake event with summary

CONSTRAINT: Focus ONLY on frontend concerns. Do not implement backend/database logic.
            """,
            
            "backend-specialist": """
YOUR SPECIALIZED ROLE: Backend API Expert

FOCUS AREAS:
- RESTful API design and implementation
- Authentication/authorization systems
- Business logic architecture
- Database integration patterns
- Error handling & validation

COMMUNICATION PROTOCOL:
1. Check workspace/coordination/tasks/{task_id}.json for your assignment
2. Claim task by updating status and owner
3. Implement API endpoints and business logic  
4. Document API specifications
5. Output to workspace/coordination/results/{task_id}/
6. Signal completion with API documentation summary

CONSTRAINT: Focus ONLY on backend API/logic. Do not implement frontend or DevOps.
            """,
            
            "database-specialist": """  
YOUR SPECIALIZED ROLE: Database Architecture Expert

FOCUS AREAS:
- Schema design and normalization
- Migration strategy planning
- Query optimization
- Data integrity constraints
- Performance indexing

COMMUNICATION PROTOCOL:
1. Read task assignment from workspace/coordination/tasks/{task_id}.json
2. Claim task (update status/owner)
3. Design database schema and migrations
4. Create data validation rules
5. Output schema files to workspace/coordination/results/{task_id}/
6. Signal completion with schema summary

CONSTRAINT: Focus ONLY on data architecture. Do not implement application logic.
            """,
            
            "testing-specialist": """
YOUR SPECIALIZED ROLE: Quality Assurance Expert  

FOCUS AREAS:
- Test strategy development
- Unit/integration test design
- End-to-end testing scenarios
- Performance test planning
- Security testing protocols

COMMUNICATION PROTOCOL:
1. Wait for dependencies: check other tasks completion in workspace/coordination/tasks/
2. When ready, claim your task 
3. Review implemented frontend/backend code
4. Create comprehensive test suites
5. Output test plans to workspace/coordination/results/{task_id}/
6. Signal completion with test coverage summary

CONSTRAINT: Focus ONLY on testing/QA. Wait for implementation tasks to complete.
            """,
            
            "devops-specialist": """
YOUR SPECIALIZED ROLE: DevOps & Infrastructure Expert

FOCUS AREAS:  
- Deployment automation
- CI/CD pipeline configuration
- Infrastructure as code
- Monitoring and logging setup
- Environment configuration

COMMUNICATION PROTOCOL:
1. Monitor task dependencies in workspace/coordination/tasks/
2. When backend/database tasks complete, claim your task
3. Create deployment configurations
4. Design CI/CD pipelines  
5. Output infrastructure files to workspace/coordination/results/{task_id}/
6. Signal completion with deployment summary

CONSTRAINT: Focus ONLY on DevOps/infrastructure. Depend on backend/database completion.
            """
        }
        
        return base_context + role_specific_instructions.get(role, "")


async def enhanced_bld_app(parsed: Dict, router: TieredRouter, **kwargs) -> Dict[str, Any]:
    """
    Enhanced BLD:APP handler with Agent Teams coordination patterns
    
    Flow:
    1. Generate PRD (existing logic)
    2. Create specialized task pool 
    3. Spawn 5 specialized agents with clear roles
    4. File-based coordination (like Agent Teams)
    5. Reduced prompt complexity via specialization
    """
    start_time = time.time()
    
    # Step 1: Generate PRD (keep existing logic)
    from . import handle_bld_app  # Import existing handler
    prd_result = await handle_bld_app(parsed, router, **kwargs)
    
    if not prd_result.get("success"):
        return prd_result
    
    prd_content = prd_result.get("content", "")
    app_name = prd_result.get("app_name", "unnamed-app")
    
    # Step 2: Setup team coordination
    workspace_path = Path(os.environ.get("SOVEREIGN_WORKSPACE", "~/.openclaw/workspace")).expanduser()
    coordinator = TeamCoordination(workspace_path)
    
    # Step 3: Create specialized task pool 
    workstreams = coordinator.create_task_pool(prd_content, app_name)
    
    # Step 4: Prepare specialized agent spawning
    agent_spawn_commands = []
    for ws in workstreams:
        task_data = {
            "id": ws["id"],
            "focus": ws["focus"],
            "responsibilities": ws["responsibilities"],
            "output_files": ws["output_files"],
            "prd_excerpt": coordinator._extract_relevant_prd(prd_content, ws["focus"])
        }
        
        # Create specialized prompt with reduced complexity
        specialist_prompt = SpecializedAgentPrompts.get_specialist_prompt(ws["role"], task_data)
        
        spawn_command = {
            "agentId": ws["role"],
            "task": specialist_prompt,
            "cleanup": "keep",  # Keep for coordination
            "runTimeoutSeconds": 1800,  # 30 minutes for complex builds
        }
        agent_spawn_commands.append(spawn_command)
    
    # Step 5: Enhanced result with coordination info
    enhanced_result = {
        **prd_result,
        "handler": "enhanced_bld_app", 
        "coordination": {
            "workstreams_created": len(workstreams),
            "coordination_dir": str(coordinator.coordination_dir),
            "task_files": [str(coordinator.tasks_dir / f"{ws['id']}.json") for ws in workstreams],
            "agent_spawn_commands": agent_spawn_commands
        },
        "team_architecture": {
            "specialists": [{"role": ws["role"], "focus": ws["focus"]} for ws in workstreams],
            "coordination_pattern": "file_based_tasks",
            "communication_protocol": "structured_output + cron_completion_signals"
        },
        "enhancements": {
            "reduced_prompt_complexity": "Specialized roles with clear boundaries",
            "file_based_coordination": "Agent Teams pattern without subscription restrictions",  
            "parallel_execution": "5 specialists work simultaneously",
            "dependency_management": "Testing/DevOps wait for implementation completion"
        },
        "duration_ms": (time.time() - start_time) * 1000
    }
    
    # Step 6: Auto-spawn agents (optional - can be manual)
    if parsed.get("flags", {}).get("auto_spawn"):
        enhanced_result["auto_spawn_initiated"] = True
        # Note: Actual spawning would happen via sessions_spawn calls
        # This is preparation data for the spawning
    
    return enhanced_result


# Update handlers registry
ENHANCED_HANDLERS = {
    "BLD:APP": enhanced_bld_app,
}