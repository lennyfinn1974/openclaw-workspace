import { useKanbanStore } from '@/stores/kanban'
import { useOpenClawStore } from '@/stores/openclaw'
import { generateId } from '@/lib/utils'

export interface SubAgentConfig {
  objective: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  tags?: string[]
  estimatedDuration?: number // in minutes
}

export interface OpenClawConfig {
  baseUrl: string
  apiKey?: string
  webhookSecret?: string
  mainAgentName: string // "Aries"
}

export class OpenClawTicketFlowIntegration {
  private config: OpenClawConfig
  private subAgentCounter = 0
  private activeSubAgents = new Map<string, string>() // agentId -> taskId mapping

  constructor(config: OpenClawConfig) {
    this.config = config
  }

  /**
   * Initialize the integration - set up webhook endpoints and connect to OpenClaw
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing OpenClaw Ticket Flow Integration...')
    
    // Set up webhook endpoint for receiving OpenClaw events
    await this.setupWebhookEndpoint()
    
    // Connect to OpenClaw instance
    await this.connectToOpenClaw()
    
    // Set up real-time event listeners
    this.setupEventListeners()
    
    console.log('✅ OpenClaw Ticket Flow Integration initialized successfully!')
  }

  /**
   * Spawn a sub-agent with automatic ticket creation
   */
  async spawnSubAgent(subAgentConfig: SubAgentConfig): Promise<string> {
    const { createTask, moveTask } = useKanbanStore.getState()
    
    // Generate sub-agent name using naming convention
    this.subAgentCounter++
    const agentName = `${this.config.mainAgentName}-Sub${this.subAgentCounter}`
    
    // Create task in TODO column first
    const todoColumnId = this.getTodoColumnId()
    if (!todoColumnId) {
      throw new Error('No TODO column found in Kanban board')
    }

    // Create the task with enhanced details
    const taskTitle = `🤖 ${agentName}: ${this.truncateObjective(subAgentConfig.objective)}`
    const taskDescription = this.generateTaskDescription(agentName, subAgentConfig)
    
    createTask(todoColumnId, taskTitle, taskDescription)
    
    // Get the created task ID (assuming it's the last task added)
    const { tasks } = useKanbanStore.getState()
    const createdTask = tasks
      .filter(task => task.columnId === todoColumnId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]

    if (!createdTask) {
      throw new Error('Failed to create task for sub-agent')
    }

    // Update task with OpenClaw metadata
    const { updateTask } = useKanbanStore.getState()
    updateTask(createdTask.id, {
      priority: subAgentConfig.priority,
      tags: [
        'openclaw-agent',
        'sub-agent',
        `agent-${this.subAgentCounter}`,
        ...(subAgentConfig.tags || [])
      ],
      isAutomated: true,
      openclawTaskId: `openclaw-${agentName.toLowerCase()}-${Date.now()}`
    })

    // Spawn the actual sub-agent (simulate OpenClaw API call)
    const agentId = await this.callOpenClawAPI('spawn-subagent', {
      objective: subAgentConfig.objective,
      name: agentName,
      priority: subAgentConfig.priority,
      webhookUrl: `${window.location.origin}/api/webhooks/openclaw`,
      metadata: {
        ticketId: createdTask.id,
        boardId: createdTask.boardId
      }
    })

    // Store the mapping
    this.activeSubAgents.set(agentId, createdTask.id)

    // Add agent to OpenClaw store
    const { addAgent } = useOpenClawStore.getState()
    addAgent({
      id: agentId,
      sessionId: `session-${agentId}`,
      label: `${agentName}: ${this.truncateObjective(subAgentConfig.objective)}`,
      status: 'active',
      startTime: new Date().toISOString(),
      model: 'claude-sonnet-4',
      lastActivity: new Date().toISOString()
    })

    // Move task to IN PROGRESS automatically
    setTimeout(() => {
      this.moveTaskToInProgress(createdTask.id)
    }, 1000) // Small delay to simulate agent startup

    console.log(`✅ Sub-agent spawned: ${agentName} -> Task: ${createdTask.id}`)
    return agentId
  }

  /**
   * Handle sub-agent completion
   */
  async completeSubAgent(agentId: string, result?: any): Promise<void> {
    const taskId = this.activeSubAgents.get(agentId)
    if (!taskId) {
      console.warn(`No task found for agent: ${agentId}`)
      return
    }

    // Move task to DONE column
    await this.moveTaskToDone(taskId)

    // Update agent status
    const { updateAgent } = useOpenClawStore.getState()
    updateAgent(agentId, {
      status: 'completed',
      endTime: new Date().toISOString()
    })

    // Add completion comment to task
    if (result) {
      const { addComment } = useKanbanStore.getState()
      addComment(taskId, `🎉 Sub-agent completed successfully!\n\nResult: ${JSON.stringify(result, null, 2)}`, 'OpenClaw System')
    }

    // Clean up mapping
    this.activeSubAgents.delete(agentId)

    console.log(`✅ Sub-agent completed: ${agentId} -> Task: ${taskId}`)
  }

  /**
   * Handle sub-agent failure
   */
  async failSubAgent(agentId: string, error: string): Promise<void> {
    const taskId = this.activeSubAgents.get(agentId)
    if (!taskId) {
      console.warn(`No task found for agent: ${agentId}`)
      return
    }

    // Update task with failure status (add failure tag)
    const { updateTask, addComment } = useKanbanStore.getState()
    updateTask(taskId, {
      tags: [...(useKanbanStore.getState().tasks.find(t => t.id === taskId)?.tags || []), 'failed'],
      priority: 'urgent' // Escalate failed tasks
    })

    // Add failure comment
    addComment(taskId, `❌ Sub-agent failed: ${error}`, 'OpenClaw System')

    // Update agent status
    const { updateAgent } = useOpenClawStore.getState()
    updateAgent(agentId, {
      status: 'failed',
      endTime: new Date().toISOString()
    })

    // Clean up mapping
    this.activeSubAgents.delete(agentId)

    console.log(`❌ Sub-agent failed: ${agentId} -> Task: ${taskId}`)
  }

  /**
   * Get real-time status of all active sub-agents
   */
  getActiveSubAgents() {
    const { agents } = useOpenClawStore.getState()
    return agents.filter(agent => agent.status === 'active' && agent.label.includes('-Sub'))
  }

  /**
   * Set up webhook endpoint for receiving OpenClaw events
   */
  private async setupWebhookEndpoint(): Promise<void> {
    // In a real implementation, this would register with a backend server
    // For now, simulate webhook setup
    console.log('🔗 Setting up webhook endpoint...')
    
    // Listen for OpenClaw events via postMessage (for demo)
    window.addEventListener('message', (event) => {
      if (event.data.source === 'openclaw-webhook') {
        this.handleWebhookEvent(event.data.payload)
      }
    })
  }

  /**
   * Connect to OpenClaw instance
   */
  private async connectToOpenClaw(): Promise<void> {
    const { connect } = useOpenClawStore.getState()
    await connect()
  }

  /**
   * Set up event listeners for real-time updates
   */
  private setupEventListeners(): void {
    // Listen for task movements in the Kanban board
    // This would be enhanced with WebSocket integration in production
    console.log('👂 Setting up event listeners for real-time updates...')
  }

  /**
   * Handle incoming webhook events from OpenClaw
   */
  private async handleWebhookEvent(event: any): Promise<void> {
    console.log('📨 Received OpenClaw webhook event:', event)

    switch (event.type) {
      case 'subagent.spawned':
        await this.handleSubAgentSpawned(event)
        break
      case 'subagent.progress':
        await this.handleSubAgentProgress(event)
        break
      case 'subagent.completed':
        await this.completeSubAgent(event.agentId, event.result)
        break
      case 'subagent.failed':
        await this.failSubAgent(event.agentId, event.error)
        break
      default:
        console.log('Unhandled webhook event type:', event.type)
    }
  }

  /**
   * Handle sub-agent spawned event
   */
  private async handleSubAgentSpawned(event: any): Promise<void> {
    const taskId = event.metadata?.ticketId
    if (taskId) {
      this.activeSubAgents.set(event.agentId, taskId)
      await this.moveTaskToInProgress(taskId)
    }
  }

  /**
   * Handle sub-agent progress updates
   */
  private async handleSubAgentProgress(event: any): Promise<void> {
    const taskId = this.activeSubAgents.get(event.agentId)
    if (!taskId) return

    const { addComment } = useKanbanStore.getState()
    addComment(
      taskId,
      `🔄 Progress Update: ${event.progress}\n\nStatus: ${event.status || 'Working...'}`,
      'OpenClaw System'
    )
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
   * Simulate OpenClaw API call
   */
  private async callOpenClawAPI(endpoint: string, data: any): Promise<string> {
    // In a real implementation, this would make HTTP requests to OpenClaw API
    console.log(`📡 OpenClaw API call: ${endpoint}`, data)
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Return mock agent ID
    return `agent-${generateId()}`
  }

  /**
   * Truncate objective for display
   */
  private truncateObjective(objective: string, maxLength: number = 50): string {
    if (objective.length <= maxLength) return objective
    return `${objective.substring(0, maxLength)}...`
  }

  /**
   * Generate comprehensive task description
   */
  private generateTaskDescription(agentName: string, config: SubAgentConfig): string {
    const estimatedDuration = config.estimatedDuration ? 
      `\n**Estimated Duration:** ${config.estimatedDuration} minutes` : ''
    
    return `## 🤖 Sub-Agent Task

**Agent Name:** ${agentName}
**Objective:** ${config.objective}
**Priority:** ${config.priority.toUpperCase()}${estimatedDuration}

### 📋 Task Details
This task is automatically managed by OpenClaw and will progress through the following stages:
- ✅ **Created** - Task created and sub-agent spawned
- 🔄 **In Progress** - Sub-agent actively working
- 🎉 **Completed** - Sub-agent finished successfully

### 🏷️ Tags
${config.tags?.map(tag => `\`${tag}\``).join(', ') || 'None'}

### 🔗 Integration
This task is synchronized with OpenClaw sub-agent lifecycle events. Status updates and progress will be automatically reflected here.

---
*Powered by OpenClaw Ticket Flow Integration*`
  }
}

// Export singleton instance
let integrationInstance: OpenClawTicketFlowIntegration | null = null

export const getOpenClawIntegration = (config?: OpenClawConfig): OpenClawTicketFlowIntegration => {
  if (!integrationInstance && config) {
    integrationInstance = new OpenClawTicketFlowIntegration(config)
  }
  
  if (!integrationInstance) {
    throw new Error('OpenClaw integration not initialized. Please provide config.')
  }
  
  return integrationInstance
}

// Default configuration
export const defaultOpenClawConfig: OpenClawConfig = {
  baseUrl: 'http://localhost:8080', // Default OpenClaw API URL
  mainAgentName: 'Aries'
}