import { useKanbanStore } from '@/stores/kanban'
import { useNexusStore } from '@/stores/nexus'
import { generateId } from '@/lib/utils'

export interface NexusTaskConfig {
  command: string // e.g., "/learn", "research", "skill_development"
  objective: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  tags?: string[]
  estimatedDuration?: number // in minutes
  taskType: 'learn' | 'research' | 'skill' | 'general'
}

export interface NexusConfig {
  baseUrl: string // Default: localhost:8081
  apiKey?: string
  webhookSecret?: string
  mainAgentName: string // "Nexus"
}

export class NexusTicketFlowIntegration {
  private config: NexusConfig
  private subAgentCounter = 0
  private activeSubAgents = new Map<string, string>() // agentId -> taskId mapping

  constructor(config: NexusConfig) {
    this.config = config
  }

  /**
   * Initialize the integration - set up webhook endpoints and connect to Nexus
   */
  async initialize(): Promise<void> {
    console.log('🔮 Initializing Nexus Ticket Flow Integration...')
    
    // Set up webhook endpoint for receiving Nexus events
    await this.setupWebhookEndpoint()
    
    // Connect to Nexus instance
    await this.connectToNexus()
    
    // Set up real-time event listeners
    this.setupEventListeners()
    
    console.log('✅ Nexus Ticket Flow Integration initialized successfully!')
  }

  /**
   * Spawn a Nexus sub-agent with automatic ticket creation
   */
  async spawnNexusSubAgent(taskConfig: NexusTaskConfig): Promise<string> {
    const { createTask, moveTask } = useKanbanStore.getState()
    
    // Generate sub-agent name using Nexus naming convention
    this.subAgentCounter++
    const agentName = `${this.config.mainAgentName}-Sub${this.subAgentCounter}`
    
    // Create task in TODO column first
    const todoColumnId = this.getTodoColumnId()
    if (!todoColumnId) {
      throw new Error('No TODO column found in Kanban board')
    }

    // Create the task with enhanced details
    const taskTitle = `🔮 ${agentName}: ${this.truncateObjective(taskConfig.objective)}`
    const taskDescription = this.generateTaskDescription(agentName, taskConfig)
    
    createTask(todoColumnId, taskTitle, taskDescription)
    
    // Get the created task ID (assuming it's the last task added)
    const { tasks } = useKanbanStore.getState()
    const createdTask = tasks
      .filter(task => task.columnId === todoColumnId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]

    if (!createdTask) {
      throw new Error('Failed to create task for Nexus sub-agent')
    }

    // Update task with Nexus metadata
    const { updateTask } = useKanbanStore.getState()
    updateTask(createdTask.id, {
      priority: taskConfig.priority,
      tags: [
        'nexus-agent',
        'sub-agent',
        `agent-${this.subAgentCounter}`,
        `task-type-${taskConfig.taskType}`,
        ...(taskConfig.tags || [])
      ],
      isAutomated: true,
      nexusTaskId: `nexus-${agentName.toLowerCase()}-${Date.now()}`,
      nexusCommand: taskConfig.command
    })

    // Spawn the actual Nexus sub-agent (simulate Nexus API call)
    const agentId = await this.callNexusAPI('spawn-subagent', {
      command: taskConfig.command,
      objective: taskConfig.objective,
      name: agentName,
      priority: taskConfig.priority,
      taskType: taskConfig.taskType,
      webhookUrl: `${window.location.origin}/api/webhooks/nexus`,
      metadata: {
        ticketId: createdTask.id,
        boardId: createdTask.boardId
      }
    })

    // Store the mapping
    this.activeSubAgents.set(agentId, createdTask.id)

    // Add agent to Nexus store
    const { addAgent } = useNexusStore.getState()
    addAgent({
      id: agentId,
      sessionId: `session-${agentId}`,
      label: `${agentName}: ${this.truncateObjective(taskConfig.objective)}`,
      status: 'active',
      startTime: new Date().toISOString(),
      model: 'claude-sonnet-4',
      lastActivity: new Date().toISOString(),
      command: taskConfig.command,
      taskType: taskConfig.taskType
    })

    // Move task to IN PROGRESS automatically after short delay
    setTimeout(() => {
      this.moveTaskToInProgress(createdTask.id)
    }, 1500) // Slightly longer delay for Nexus to simulate research startup

    console.log(`✅ Nexus sub-agent spawned: ${agentName} -> Task: ${createdTask.id}`)
    return agentId
  }

  /**
   * Create ticket for /learn command
   */
  async createLearnTicket(topic: string, details?: string): Promise<string> {
    return this.spawnNexusSubAgent({
      command: '/learn',
      objective: `Learn about: ${topic}`,
      priority: 'medium',
      tags: ['learning', 'research'],
      taskType: 'learn',
      estimatedDuration: 30
    })
  }

  /**
   * Create ticket for skills development
   */
  async createSkillTicket(skill: string, description: string): Promise<string> {
    return this.spawnNexusSubAgent({
      command: 'skill_development',
      objective: `Develop skill: ${skill} - ${description}`,
      priority: 'high',
      tags: ['skill-development', 'capability'],
      taskType: 'skill',
      estimatedDuration: 45
    })
  }

  /**
   * Create ticket for research tasks
   */
  async createResearchTicket(researchTopic: string, depth: 'shallow' | 'deep' = 'deep'): Promise<string> {
    const duration = depth === 'deep' ? 60 : 20
    return this.spawnNexusSubAgent({
      command: 'research',
      objective: `Research: ${researchTopic}`,
      priority: depth === 'deep' ? 'high' : 'medium',
      tags: ['research', `${depth}-dive`],
      taskType: 'research',
      estimatedDuration: duration
    })
  }

  /**
   * Handle Nexus sub-agent completion
   */
  async completeNexusSubAgent(agentId: string, result?: any): Promise<void> {
    const taskId = this.activeSubAgents.get(agentId)
    if (!taskId) {
      console.warn(`No task found for Nexus agent: ${agentId}`)
      return
    }

    // Move task to DONE column
    await this.moveTaskToDone(taskId)

    // Update agent status
    const { updateAgent } = useNexusStore.getState()
    updateAgent(agentId, {
      status: 'completed',
      endTime: new Date().toISOString()
    })

    // Add completion comment to task with Nexus branding
    if (result) {
      const { addComment } = useKanbanStore.getState()
      addComment(taskId, `🔮 Nexus sub-agent completed successfully!\n\n**Results:**\n${this.formatNexusResult(result)}`, 'Nexus System')
    }

    // Clean up mapping
    this.activeSubAgents.delete(agentId)

    console.log(`✅ Nexus sub-agent completed: ${agentId} -> Task: ${taskId}`)
  }

  /**
   * Handle Nexus sub-agent failure
   */
  async failNexusSubAgent(agentId: string, error: string): Promise<void> {
    const taskId = this.activeSubAgents.get(agentId)
    if (!taskId) {
      console.warn(`No task found for Nexus agent: ${agentId}`)
      return
    }

    // Update task with failure status
    const { updateTask, addComment } = useKanbanStore.getState()
    updateTask(taskId, {
      tags: [...(useKanbanStore.getState().tasks.find(t => t.id === taskId)?.tags || []), 'failed'],
      priority: 'urgent' // Escalate failed tasks
    })

    // Add failure comment with Nexus branding
    addComment(taskId, `❌ Nexus sub-agent failed: ${error}`, 'Nexus System')

    // Update agent status
    const { updateAgent } = useNexusStore.getState()
    updateAgent(agentId, {
      status: 'failed',
      endTime: new Date().toISOString()
    })

    // Clean up mapping
    this.activeSubAgents.delete(agentId)

    console.log(`❌ Nexus sub-agent failed: ${agentId} -> Task: ${taskId}`)
  }

  /**
   * Monitor Nexus task queue and research activities
   */
  async monitorNexusActivities(): Promise<void> {
    try {
      const activities = await this.callNexusAPI('get-activities', {})
      const { updateActivities } = useNexusStore.getState()
      updateActivities(activities)
    } catch (error) {
      console.error('Failed to monitor Nexus activities:', error)
    }
  }

  /**
   * Get real-time status of all active Nexus sub-agents
   */
  getActiveNexusSubAgents() {
    const { agents } = useNexusStore.getState()
    return agents.filter(agent => agent.status === 'active' && agent.label.includes('-Sub'))
  }

  /**
   * Set up webhook endpoint for receiving Nexus events
   */
  private async setupWebhookEndpoint(): Promise<void> {
    console.log('🔗 Setting up Nexus webhook endpoint...')
    
    // Listen for Nexus events via postMessage (for demo)
    window.addEventListener('message', (event) => {
      if (event.data.source === 'nexus-webhook') {
        this.handleWebhookEvent(event.data.payload)
      }
    })
  }

  /**
   * Connect to Nexus instance
   */
  private async connectToNexus(): Promise<void> {
    const { connect } = useNexusStore.getState()
    await connect()
  }

  /**
   * Set up event listeners for real-time updates
   */
  private setupEventListeners(): void {
    console.log('👂 Setting up Nexus event listeners for real-time updates...')
    
    // Monitor Nexus activities every 30 seconds
    setInterval(() => {
      this.monitorNexusActivities()
    }, 30000)
  }

  /**
   * Handle incoming webhook events from Nexus
   */
  private async handleWebhookEvent(event: any): Promise<void> {
    console.log('📨 Received Nexus webhook event:', event)

    switch (event.type) {
      case 'subagent.spawned':
        await this.handleSubAgentSpawned(event)
        break
      case 'subagent.progress':
        await this.handleSubAgentProgress(event)
        break
      case 'subagent.completed':
        await this.completeNexusSubAgent(event.agentId, event.result)
        break
      case 'subagent.failed':
        await this.failNexusSubAgent(event.agentId, event.error)
        break
      case 'research.started':
        await this.handleResearchStarted(event)
        break
      case 'learn.completed':
        await this.handleLearnCompleted(event)
        break
      default:
        console.log('Unhandled Nexus webhook event type:', event.type)
    }
  }

  /**
   * Handle Nexus sub-agent spawned event
   */
  private async handleSubAgentSpawned(event: any): Promise<void> {
    const taskId = event.metadata?.ticketId
    if (taskId) {
      this.activeSubAgents.set(event.agentId, taskId)
      await this.moveTaskToInProgress(taskId)
    }
  }

  /**
   * Handle Nexus sub-agent progress updates
   */
  private async handleSubAgentProgress(event: any): Promise<void> {
    const taskId = this.activeSubAgents.get(event.agentId)
    if (!taskId) return

    const { addComment } = useKanbanStore.getState()
    addComment(
      taskId,
      `🔮 Nexus Progress Update: ${event.progress}\n\n**Status:** ${event.status || 'Working on research...'}${event.insights ? '\n\n**Insights:** ' + event.insights : ''}`,
      'Nexus System'
    )
  }

  /**
   * Handle research started event
   */
  private async handleResearchStarted(event: any): Promise<void> {
    const { addComment } = useKanbanStore.getState()
    const taskId = this.activeSubAgents.get(event.agentId)
    if (taskId) {
      addComment(taskId, `🔍 Research started: ${event.topic}`, 'Nexus System')
    }
  }

  /**
   * Handle learn completed event
   */
  private async handleLearnCompleted(event: any): Promise<void> {
    const { addComment } = useKanbanStore.getState()
    const taskId = this.activeSubAgents.get(event.agentId)
    if (taskId) {
      addComment(taskId, `🎓 Learning completed: ${event.summary}`, 'Nexus System')
    }
  }

  /**
   * Move task to IN PROGRESS column
   */
  private async moveTaskToInProgress(taskId: string): Promise<void> {
    const inProgressColumnId = this.getInProgressColumnId()
    if (!inProgressColumnId) {
      console.warn('No IN PROGRESS column found')
      return
    }

    const { moveTask, tasks } = useKanbanStore.getState()
    const task = tasks.find(t => t.id === taskId)
    if (task && task.columnId !== inProgressColumnId) {
      const inProgressTasks = tasks.filter(t => t.columnId === inProgressColumnId)
      moveTask(taskId, inProgressColumnId, inProgressTasks.length)
    }
  }

  /**
   * Move task to DONE column
   */
  private async moveTaskToDone(taskId: string): Promise<void> {
    const doneColumnId = this.getDoneColumnId()
    if (!doneColumnId) {
      console.warn('No DONE column found')
      return
    }

    const { moveTask, tasks } = useKanbanStore.getState()
    const task = tasks.find(t => t.id === taskId)
    if (task && task.columnId !== doneColumnId) {
      const doneTasks = tasks.filter(t => t.columnId === doneColumnId)
      moveTask(taskId, doneColumnId, 0) // Add to top of DONE column
    }
  }

  /**
   * Get TODO column ID
   */
  private getTodoColumnId(): string | null {
    const { columns } = useKanbanStore.getState()
    const todoColumn = columns.find(col => 
      col.name.toLowerCase().includes('todo') || col.name.toLowerCase().includes('to do')
    )
    return todoColumn?.id || columns[0]?.id || null
  }

  /**
   * Get IN PROGRESS column ID
   */
  private getInProgressColumnId(): string | null {
    const { columns } = useKanbanStore.getState()
    const inProgressColumn = columns.find(col => 
      col.name.toLowerCase().includes('progress') || col.name.toLowerCase().includes('doing')
    )
    return inProgressColumn?.id || null
  }

  /**
   * Get DONE column ID
   */
  private getDoneColumnId(): string | null {
    const { columns } = useKanbanStore.getState()
    const doneColumn = columns.find(col => 
      col.name.toLowerCase().includes('done') || col.name.toLowerCase().includes('complete')
    )
    return doneColumn?.id || null
  }

  /**
   * Simulate Nexus API call
   */
  private async callNexusAPI(endpoint: string, data: any): Promise<any> {
    // In a real implementation, this would make HTTP requests to Nexus API at localhost:8081
    console.log(`🔮 Nexus API call: ${endpoint}`, data)
    
    // Simulate API delay (Nexus typically takes a bit longer due to research complexity)
    await new Promise(resolve => setTimeout(resolve, 800))
    
    // Return mock responses based on endpoint
    switch (endpoint) {
      case 'spawn-subagent':
        return `nexus-agent-${generateId()}`
      case 'get-activities':
        return {
          research_tasks: [
            { id: 'research-1', topic: 'AI Ethics', status: 'active' },
            { id: 'research-2', topic: 'Quantum Computing', status: 'completed' }
          ],
          learn_commands: [
            { id: 'learn-1', topic: 'Machine Learning', progress: 85 }
          ],
          skill_developments: [
            { id: 'skill-1', skill: 'Data Analysis', status: 'in_progress' }
          ]
        }
      default:
        return {}
    }
  }

  /**
   * Truncate objective for display
   */
  private truncateObjective(objective: string, maxLength: number = 50): string {
    if (objective.length <= maxLength) return objective
    return `${objective.substring(0, maxLength)}...`
  }

  /**
   * Format Nexus results for display
   */
  private formatNexusResult(result: any): string {
    if (typeof result === 'string') return result
    
    if (result.insights) {
      return `**Key Insights:**\n${result.insights}\n\n**Summary:** ${result.summary || 'Task completed successfully'}`
    }
    
    return JSON.stringify(result, null, 2)
  }

  /**
   * Generate comprehensive task description for Nexus tasks
   */
  private generateTaskDescription(agentName: string, config: NexusTaskConfig): string {
    const estimatedDuration = config.estimatedDuration ? 
      `\n**Estimated Duration:** ${config.estimatedDuration} minutes` : ''
    
    const taskTypeEmoji = {
      learn: '🎓',
      research: '🔍',
      skill: '⚡',
      general: '🔮'
    }[config.taskType] || '🔮'

    return `## 🔮 Nexus Sub-Agent Task

**Agent Name:** ${agentName}
**Command:** \`${config.command}\`
**Objective:** ${config.objective}
**Priority:** ${config.priority.toUpperCase()}
**Task Type:** ${taskTypeEmoji} ${config.taskType.replace('_', ' ').toUpperCase()}${estimatedDuration}

### 📋 Task Details
This task is automatically managed by Nexus and will progress through the following stages:
- ✅ **Created** - Task created and Nexus sub-agent spawned
- 🔄 **In Progress** - Nexus sub-agent actively researching/learning
- 🎉 **Completed** - Nexus sub-agent finished with insights

### 🏷️ Tags
${config.tags?.map(tag => `\`${tag}\``).join(', ') || 'None'}

### 🔗 Integration
This task is synchronized with Nexus sub-agent lifecycle events. Research progress, learning insights, and status updates will be automatically reflected here.

### 🔮 Nexus Features
- **Deep Research:** Advanced analysis and synthesis
- **Continuous Learning:** Adaptive knowledge acquisition
- **Insight Generation:** Automated discovery of key findings

---
*Powered by Nexus Ticket Flow Integration*`
  }
}

// Export singleton instance
let nexusIntegrationInstance: NexusTicketFlowIntegration | null = null

export const getNexusIntegration = (config?: NexusConfig): NexusTicketFlowIntegration => {
  if (!nexusIntegrationInstance && config) {
    nexusIntegrationInstance = new NexusTicketFlowIntegration(config)
  }
  
  if (!nexusIntegrationInstance) {
    throw new Error('Nexus integration not initialized. Please provide config.')
  }
  
  return nexusIntegrationInstance
}

// Default configuration
export const defaultNexusConfig: NexusConfig = {
  baseUrl: 'http://localhost:8081', // Default Nexus API URL
  mainAgentName: 'Nexus'
}