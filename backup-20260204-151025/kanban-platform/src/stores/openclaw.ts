import { create } from 'zustand'
import { OpenClawState, OpenClawAgent, OpenClawWebhook, OpenClawTaskEvent } from '@/types'
import { generateId } from '@/lib/utils'

interface OpenClawActions {
  // Connection management
  connect: () => Promise<void>
  disconnect: () => void
  setConnected: (connected: boolean) => void
  initializeConnection: () => Promise<void>
  setConnecting: (connecting: boolean) => void

  // Agent management
  addAgent: (agent: OpenClawAgent) => void
  updateAgent: (id: string, updates: Partial<OpenClawAgent>) => void
  removeAgent: (id: string) => void
  clearAgents: () => void

  // Webhook management
  addWebhook: (webhook: Omit<OpenClawWebhook, 'id' | 'createdAt'>) => void
  removeWebhook: (id: string) => void
  toggleWebhook: (id: string) => void

  // Event handling
  handleWebhookEvent: (event: OpenClawTaskEvent) => void

  // Sync with external OpenClaw instance
  syncAgents: () => Promise<void>
  setLastSyncTime: (time: string) => void
  setError: (error?: string) => void
}

// LocalStorage key for persistent connection state
const STORAGE_KEY = 'openclaw_connection_state'

// Helper functions for localStorage
const storage = {
  getConnectionState: (): boolean => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored === 'true'
    } catch (error) {
      console.warn('Failed to read OpenClaw connection state from localStorage:', error)
      return false
    }
  },
  
  setConnectionState: (connected: boolean): void => {
    try {
      localStorage.setItem(STORAGE_KEY, String(connected))
    } catch (error) {
      console.warn('Failed to save OpenClaw connection state to localStorage:', error)
    }
  },
  
  clearConnectionState: (): void => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.warn('Failed to clear OpenClaw connection state from localStorage:', error)
    }
  }
}

export const useOpenClawStore = create<OpenClawState & OpenClawActions>((set, get) => ({
  // Initial state
  agents: [],
  webhooks: [],
  isConnected: false,
  isConnecting: false,
  lastSyncTime: undefined,
  error: undefined,

  // Initialize connection on app load
  initializeConnection: async () => {
    try {
      const wasConnected = storage.getConnectionState()
      
      if (wasConnected) {
        console.log('Auto-reconnecting to OpenClaw based on previous session...')
        
        // Set connecting state
        set({ 
          error: undefined, 
          isConnecting: true 
        })
        
        // Attempt to reconnect with timeout
        const connectWithTimeout = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Connection timeout'))
          }, 5000) // 5 second timeout for auto-reconnect
          
          // Simulate connection to OpenClaw instance
          setTimeout(() => {
            clearTimeout(timeout)
            resolve()
          }, 1000)
        })
        
        await connectWithTimeout
        
        set({ 
          isConnected: true,
          isConnecting: false,
          lastSyncTime: new Date().toISOString()
        })
        
        // Sync agents after successful reconnection
        const { syncAgents } = get()
        await syncAgents()
        
        console.log('Auto-reconnected to OpenClaw successfully')
      }
    } catch (error) {
      console.warn('Auto-reconnection failed:', error)
      // Clear stored state if auto-reconnect fails
      storage.clearConnectionState()
      set({ 
        error: 'Auto-reconnection failed. Please connect manually.',
        isConnected: false,
        isConnecting: false
      })
    }
  },

  // Connection management
  connect: async () => {
    try {
      set({ 
        error: undefined, 
        isConnecting: true 
      })
      
      // Simulate connection to OpenClaw instance
      // In a real implementation, this would establish WebSocket connection
      // or start polling the OpenClaw API
      
      console.log('Connecting to OpenClaw...')
      
      // Mock connection delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Save successful connection state to localStorage
      storage.setConnectionState(true)
      
      set({ 
        isConnected: true,
        isConnecting: false,
        lastSyncTime: new Date().toISOString()
      })
      
      // Start syncing agents
      const { syncAgents } = get()
      await syncAgents()
      
      console.log('Connected to OpenClaw successfully')
    } catch (error) {
      console.error('Failed to connect to OpenClaw:', error)
      
      // Clear connection state on failure
      storage.clearConnectionState()
      
      set({ 
        error: error instanceof Error ? error.message : 'Connection failed',
        isConnected: false,
        isConnecting: false
      })
    }
  },

  disconnect: () => {
    // Clear persistent connection state
    storage.clearConnectionState()
    
    set({ 
      isConnected: false,
      agents: [],
      lastSyncTime: undefined 
    })
    console.log('Disconnected from OpenClaw')
  },

  setConnected: (connected: boolean) => {
    // Update persistent storage when connection state changes
    if (connected) {
      storage.setConnectionState(true)
    } else {
      storage.clearConnectionState()
    }
    set({ isConnected: connected })
  },

  setConnecting: (connecting: boolean) => {
    set({ isConnecting: connecting })
  },

  // Agent management
  addAgent: (agent: OpenClawAgent) => {
    set(state => ({
      agents: [...state.agents.filter(a => a.id !== agent.id), agent]
    }))
  },

  updateAgent: (id: string, updates: Partial<OpenClawAgent>) => {
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

  // Webhook management
  addWebhook: (webhook: Omit<OpenClawWebhook, 'id' | 'createdAt'>) => {
    const newWebhook: OpenClawWebhook = {
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
  handleWebhookEvent: (event: OpenClawTaskEvent) => {
    console.log('Received OpenClaw event:', event)
    
    const { addAgent, updateAgent } = get()
    
    switch (event.type) {
      case 'agent.created':
      case 'agent.started':
        addAgent({
          id: event.agentId,
          sessionId: event.sessionId,
          label: event.data.label || 'Unnamed Agent',
          status: 'active',
          startTime: event.timestamp,
          model: event.data.model || 'unknown',
          lastActivity: event.timestamp
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
    }
  },

  // Sync with external OpenClaw instance
  syncAgents: async () => {
    try {
      set({ error: undefined })
      
      // Only sync if we're connected
      const { isConnected } = get()
      if (!isConnected) {
        return
      }
      
      // Mock API call to fetch agents from OpenClaw
      // In a real implementation, this would call the OpenClaw API
      const mockAgents: OpenClawAgent[] = [
        {
          id: 'agent-1',
          sessionId: 'session-1',
          label: 'Dashboard Enhancement Agent',
          status: 'active',
          startTime: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
          model: 'claude-sonnet-4',
          tokensUsed: 1250,
          lastActivity: new Date().toISOString()
        },
        {
          id: 'agent-2',
          sessionId: 'session-2',
          label: 'Data Processing Agent',
          status: 'completed',
          startTime: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
          endTime: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
          model: 'claude-sonnet-4',
          tokensUsed: 2100,
          lastActivity: new Date(Date.now() - 300000).toISOString()
        }
      ]
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500))
      
      set({ 
        agents: mockAgents,
        lastSyncTime: new Date().toISOString()
      })
      
    } catch (error) {
      console.error('Failed to sync agents:', error)
      
      // If sync fails repeatedly, it might indicate connection issues
      const errorMessage = error instanceof Error ? error.message : 'Sync failed'
      
      // Check if this is a connection-related error
      const connectionErrors = ['network', 'timeout', 'refused', 'unreachable']
      const isConnectionError = connectionErrors.some(term => 
        errorMessage.toLowerCase().includes(term)
      )
      
      if (isConnectionError) {
        // Clear persistent connection state if we detect connection issues
        storage.clearConnectionState()
        
        set({ 
          error: 'Connection lost. Please reconnect to OpenClaw.',
          isConnected: false
        })
      } else {
        set({ 
          error: errorMessage
        })
      }
    }
  },

  setLastSyncTime: (time: string) => {
    set({ lastSyncTime: time })
  },

  setError: (error?: string) => {
    set({ error })
  }
}))

// Helper functions for OpenClaw integration
export const openclawHelpers = {
  // Create webhook endpoint for OpenClaw integration
  createWebhookEndpoint: (): string => {
    return `${window.location.origin}/api/webhooks/openclaw`
  },

  // Format agent status for display
  formatAgentStatus: (agent: OpenClawAgent): { 
    label: string
    color: string
    icon: string 
  } => {
    switch (agent.status) {
      case 'active':
        return {
          label: 'Active',
          color: 'text-success',
          icon: '🔄'
        }
      case 'completed':
        return {
          label: 'Completed',
          color: 'text-info',
          icon: '✅'
        }
      case 'failed':
        return {
          label: 'Failed',
          color: 'text-destructive',
          icon: '❌'
        }
      case 'paused':
        return {
          label: 'Paused',
          color: 'text-warning',
          icon: '⏸️'
        }
      default:
        return {
          label: 'Unknown',
          color: 'text-muted-foreground',
          icon: '❓'
        }
    }
  },

  // Calculate agent runtime
  getAgentRuntime: (agent: OpenClawAgent): string => {
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
  }
}