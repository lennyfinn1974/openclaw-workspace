import { create } from 'zustand'
import { NexusState, NexusAgent, NexusWebhook, NexusTaskEvent, NexusActivities } from '@/types'
import { generateId } from '@/lib/utils'

interface NexusActions {
  // Connection management
  connect: () => Promise<void>
  disconnect: () => void
  setConnected: (connected: boolean) => void

  // Agent management
  addAgent: (agent: NexusAgent) => void
  updateAgent: (id: string, updates: Partial<NexusAgent>) => void
  removeAgent: (id: string) => void
  clearAgents: () => void

  // Activities monitoring
  updateActivities: (activities: NexusActivities) => void
  clearActivities: () => void

  // Webhook management
  addWebhook: (webhook: Omit<NexusWebhook, 'id' | 'createdAt'>) => void
  removeWebhook: (id: string) => void
  toggleWebhook: (id: string) => void

  // Event handling
  handleWebhookEvent: (event: NexusTaskEvent) => void

  // Sync with external Nexus instance
  syncAgents: () => Promise<void>
  syncActivities: () => Promise<void>
  setLastSyncTime: (time: string) => void
  setError: (error?: string) => void
}

export const useNexusStore = create<NexusState & NexusActions>((set, get) => ({
  // Initial state
  agents: [],
  activities: {
    research_tasks: [],
    learn_commands: [],
    skill_developments: []
  },
  webhooks: [],
  isConnected: false,
  lastSyncTime: undefined,
  error: undefined,

  // Connection management
  connect: async () => {
    try {
      set({ error: undefined })
      
      console.log('Connecting to Nexus...')
      
      // Mock connection delay (Nexus takes a bit longer to connect)
      await new Promise(resolve => setTimeout(resolve, 1200))
      
      set({ 
        isConnected: true,
        lastSyncTime: new Date().toISOString()
      })
      
      // Start syncing agents and activities
      const { syncAgents, syncActivities } = get()
      await Promise.all([syncAgents(), syncActivities()])
      
      console.log('Connected to Nexus successfully')
    } catch (error) {
      console.error('Failed to connect to Nexus:', error)
      set({ 
        error: error instanceof Error ? error.message : 'Connection failed',
        isConnected: false
      })
    }
  },

  disconnect: () => {
    set({ 
      isConnected: false,
      agents: [],
      activities: {
        research_tasks: [],
        learn_commands: [],
        skill_developments: []
      },
      lastSyncTime: undefined 
    })
    console.log('Disconnected from Nexus')
  },

  setConnected: (connected: boolean) => {
    set({ isConnected: connected })
  },

  // Agent management
  addAgent: (agent: NexusAgent) => {
    set(state => ({
      agents: [...state.agents.filter(a => a.id !== agent.id), agent]
    }))
  },

  updateAgent: (id: string, updates: Partial<NexusAgent>) => {
    set(state => ({
      agents: state.agents.map(agent =>
        agent.id === id
          ? { ...agent, ...updates, lastActivity: new Date().toISOString() }
          : agent
      )
    }))
  },

  removeAgent: (id: string) => {
    set(state => ({
      agents: state.agents.filter(agent => agent.id !== id)
    }))
  },

  clearAgents: () => {
    set({ agents: [] })
  },

  // Activities monitoring
  updateActivities: (activities: NexusActivities) => {
    set({ activities })
  },

  clearActivities: () => {
    set({ 
      activities: {
        research_tasks: [],
        learn_commands: [],
        skill_developments: []
      }
    })
  },

  // Webhook management
  addWebhook: (webhook: Omit<NexusWebhook, 'id' | 'createdAt'>) => {
    const newWebhook: NexusWebhook = {
      ...webhook,
      id: generateId(),
      createdAt: new Date().toISOString()
    }
    set(state => ({
      webhooks: [...state.webhooks, newWebhook]
    }))
  },

  removeWebhook: (id: string) => {
    set(state => ({
      webhooks: state.webhooks.filter(webhook => webhook.id !== id)
    }))
  },

  toggleWebhook: (id: string) => {
    set(state => ({
      webhooks: state.webhooks.map(webhook =>
        webhook.id === id
          ? { ...webhook, isActive: !webhook.isActive }
          : webhook
      )
    }))
  },

  // Event handling
  handleWebhookEvent: (event: NexusTaskEvent) => {
    console.log('Received Nexus event:', event)
    
    const { addAgent, updateAgent } = get()
    
    switch (event.type) {
      case 'agent.created':
      case 'agent.started':
        addAgent({
          id: event.agentId,
          sessionId: event.sessionId,
          label: event.data.label || 'Unnamed Nexus Agent',
          status: 'active',
          startTime: event.timestamp,
          model: event.data.model || 'unknown',
          lastActivity: event.timestamp,
          command: event.data.command || 'general',
          taskType: event.data.taskType || 'general'
        })
        break
        
      case 'agent.completed':
        updateAgent(event.agentId, {
          status: 'completed',
          endTime: event.timestamp
        })
        break
        
      case 'agent.failed':
        updateAgent(event.agentId, {
          status: 'failed',
          endTime: event.timestamp
        })
        break
        
      case 'agent.paused':
        updateAgent(event.agentId, {
          status: 'paused'
        })
        break

      case 'research.started':
        updateAgent(event.agentId, {
          currentTask: event.data.topic
        })
        break

      case 'learn.progress':
        updateAgent(event.agentId, {
          progress: event.data.progress
        })
        break
    }
  },

  // Sync with external Nexus instance
  syncAgents: async () => {
    try {
      set({ error: undefined })
      
      // Mock API call to fetch agents from Nexus
      const mockAgents: NexusAgent[] = [
        {
          id: 'nexus-agent-1',
          sessionId: 'nexus-session-1',
          label: 'Machine Learning Research Agent',
          status: 'active',
          startTime: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
          model: 'claude-sonnet-4',
          tokensUsed: 3200,
          lastActivity: new Date().toISOString(),
          command: '/learn',
          taskType: 'research',
          currentTask: 'Deep Learning Architectures',
          progress: 65
        },
        {
          id: 'nexus-agent-2',
          sessionId: 'nexus-session-2',
          label: 'Quantum Computing Research Agent',
          status: 'completed',
          startTime: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
          endTime: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
          model: 'claude-sonnet-4',
          tokensUsed: 4500,
          lastActivity: new Date(Date.now() - 300000).toISOString(),
          command: 'research',
          taskType: 'research',
          currentTask: 'Quantum Algorithms',
          progress: 100
        }
      ]
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 600))
      
      set({ 
        agents: mockAgents,
        lastSyncTime: new Date().toISOString()
      })
      
    } catch (error) {
      console.error('Failed to sync Nexus agents:', error)
      set({ 
        error: error instanceof Error ? error.message : 'Sync failed'
      })
    }
  },

  syncActivities: async () => {
    try {
      // Mock API call to fetch current activities from Nexus
      const mockActivities: NexusActivities = {
        research_tasks: [
          { 
            id: 'research-1', 
            topic: 'AI Ethics in Autonomous Systems', 
            status: 'active', 
            progress: 40,
            agentId: 'nexus-agent-1',
            startedAt: new Date(Date.now() - 900000).toISOString()
          },
          { 
            id: 'research-2', 
            topic: 'Quantum Computing Applications', 
            status: 'completed', 
            progress: 100,
            agentId: 'nexus-agent-2',
            startedAt: new Date(Date.now() - 1800000).toISOString(),
            completedAt: new Date(Date.now() - 300000).toISOString()
          }
        ],
        learn_commands: [
          { 
            id: 'learn-1', 
            topic: 'Advanced Neural Networks', 
            progress: 75,
            agentId: 'nexus-agent-1',
            startedAt: new Date(Date.now() - 1200000).toISOString()
          }
        ],
        skill_developments: [
          { 
            id: 'skill-1', 
            skill: 'Data Visualization', 
            status: 'in_progress', 
            progress: 30,
            agentId: 'nexus-agent-3',
            startedAt: new Date(Date.now() - 600000).toISOString()
          }
        ]
      }
      
      await new Promise(resolve => setTimeout(resolve, 400))
      
      set({ activities: mockActivities })
      
    } catch (error) {
      console.error('Failed to sync Nexus activities:', error)
    }
  },

  setLastSyncTime: (time: string) => {
    set({ lastSyncTime: time })
  },

  setError: (error?: string) => {
    set({ error })
  }
}))

// Helper functions for Nexus integration
export const nexusHelpers = {
  // Create webhook endpoint for Nexus integration
  createWebhookEndpoint: (): string => {
    return `${window.location.origin}/api/webhooks/nexus`
  },

  // Format Nexus agent status for display
  formatAgentStatus: (agent: NexusAgent): { 
    label: string
    color: string
    icon: string 
  } => {
    switch (agent.status) {
      case 'active':
        return {
          label: 'Researching',
          color: 'text-purple-500',
          icon: '🔮'
        }
      case 'completed':
        return {
          label: 'Insights Ready',
          color: 'text-green-500',
          icon: '🎓'
        }
      case 'failed':
        return {
          label: 'Research Failed',
          color: 'text-red-500',
          icon: '❌'
        }
      case 'paused':
        return {
          label: 'Paused',
          color: 'text-yellow-500',
          icon: '⏸️'
        }
      default:
        return {
          label: 'Unknown',
          color: 'text-gray-500',
          icon: '❓'
        }
    }
  },

  // Get task type icon and color
  getTaskTypeStyle: (taskType: string): { icon: string; color: string } => {
    switch (taskType) {
      case 'learn':
        return { icon: '🎓', color: 'text-blue-500' }
      case 'research':
        return { icon: '🔍', color: 'text-purple-500' }
      case 'skill':
        return { icon: '⚡', color: 'text-yellow-500' }
      default:
        return { icon: '🔮', color: 'text-indigo-500' }
    }
  },

  // Calculate agent runtime
  getAgentRuntime: (agent: NexusAgent): string => {
    const start = new Date(agent.startTime)
    const end = agent.endTime ? new Date(agent.endTime) : new Date()
    const diffMs = end.getTime() - start.getTime()
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    } else {
      return `${seconds}s`
    }
  },

  // Get total research progress across all activities
  getOverallProgress: (activities: NexusActivities): number => {
    const allTasks = [
      ...activities.research_tasks,
      ...activities.learn_commands,
      ...activities.skill_developments
    ]
    
    if (allTasks.length === 0) return 0
    
    const totalProgress = allTasks.reduce((sum, task) => sum + (task.progress || 0), 0)
    return Math.round(totalProgress / allTasks.length)
  },

  // Get active tasks count
  getActiveTasksCount: (activities: NexusActivities): number => {
    return activities.research_tasks.filter(t => t.status === 'active').length +
           activities.learn_commands.length + // learn commands are always active until completed
           activities.skill_developments.filter(t => t.status === 'in_progress').length
  }
}