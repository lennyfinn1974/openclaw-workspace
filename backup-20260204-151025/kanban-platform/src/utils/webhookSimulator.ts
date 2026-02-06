import { getOpenClawIntegration, defaultOpenClawConfig } from '@/services/openclawIntegration'

export interface WebhookEventData {
  type: 'subagent.spawned' | 'subagent.progress' | 'subagent.completed' | 'subagent.failed'
  agentId: string
  sessionId: string
  data: any
  timestamp: string
  metadata?: any
}

/**
 * Simulate webhook events for testing the integration
 */
export class WebhookSimulator {
  private static instance: WebhookSimulator

  static getInstance(): WebhookSimulator {
    if (!WebhookSimulator.instance) {
      WebhookSimulator.instance = new WebhookSimulator()
    }
    return WebhookSimulator.instance
  }

  /**
   * Simulate spawning a sub-agent from outside the Kanban platform
   */
  async simulateSubAgentSpawn(objective: string, priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'): Promise<string> {
    try {
      console.log('🎭 Simulating sub-agent spawn from external OpenClaw instance...')
      
      // Initialize integration if not already done
      const integration = getOpenClawIntegration(defaultOpenClawConfig)
      
      // Spawn sub-agent with the provided objective
      const agentId = await integration.spawnSubAgent({
        objective,
        priority,
        tags: ['simulated', 'external'],
        estimatedDuration: Math.floor(Math.random() * 60) + 10 // 10-70 minutes
      })

      // Simulate some progress updates after a delay
      setTimeout(() => this.simulateProgressUpdate(agentId, 'Agent started and analyzing requirements...'), 2000)
      setTimeout(() => this.simulateProgressUpdate(agentId, 'Halfway through the task...'), 10000)

      return agentId
    } catch (error) {
      console.error('Failed to simulate sub-agent spawn:', error)
      throw error
    }
  }

  /**
   * Simulate progress update
   */
  private async simulateProgressUpdate(agentId: string, message: string): Promise<void> {
    const event: WebhookEventData = {
      type: 'subagent.progress',
      agentId,
      sessionId: `session-${agentId}`,
      data: {
        progress: message,
        status: 'working'
      },
      timestamp: new Date().toISOString()
    }

    this.sendWebhookEvent(event)
  }

  /**
   * Simulate sub-agent completion
   */
  async simulateCompletion(agentId: string): Promise<void> {
    const event: WebhookEventData = {
      type: 'subagent.completed',
      agentId,
      sessionId: `session-${agentId}`,
      data: {
        result: {
          status: 'success',
          message: 'Task completed successfully!',
          artifacts: ['report.pdf', 'summary.md'],
          executionTime: Math.floor(Math.random() * 1800) + 300 // 5-35 minutes
        }
      },
      timestamp: new Date().toISOString()
    }

    this.sendWebhookEvent(event)
  }

  /**
   * Simulate sub-agent failure
   */
  async simulateFailure(agentId: string): Promise<void> {
    const event: WebhookEventData = {
      type: 'subagent.failed',
      agentId,
      sessionId: `session-${agentId}`,
      data: {
        error: 'Simulated failure for testing purposes',
        errorCode: 'SIMULATION_ERROR',
        details: 'This is a test failure to demonstrate error handling'
      },
      timestamp: new Date().toISOString()
    }

    this.sendWebhookEvent(event)
  }

  /**
   * Send webhook event to the integration system
   */
  private sendWebhookEvent(event: WebhookEventData): void {
    // Simulate webhook delivery via postMessage
    window.postMessage({
      source: 'openclaw-webhook',
      payload: event
    }, '*')

    console.log('📡 Webhook event sent:', event)
  }

  /**
   * Test the full workflow with a realistic scenario
   */
  async testFullWorkflow(): Promise<void> {
    console.log('🧪 Starting full workflow test...')

    try {
      // Spawn a few test sub-agents
      const agent1 = await this.simulateSubAgentSpawn(
        'Analyze competitor pricing strategies for Q1 2024',
        'high'
      )
      
      const agent2 = await this.simulateSubAgentSpawn(
        'Create API documentation for new endpoints',
        'medium'
      )

      const agent3 = await this.simulateSubAgentSpawn(
        'Optimize database queries for user dashboard',
        'urgent'
      )

      // Simulate different outcomes after various delays
      setTimeout(() => this.simulateCompletion(agent1), 15000) // Complete first agent
      setTimeout(() => this.simulateFailure(agent2), 20000)    // Fail second agent  
      setTimeout(() => this.simulateCompletion(agent3), 25000) // Complete third agent

      console.log('✅ Full workflow test initiated!')
      console.log('- Agent 1: Will complete in 15 seconds')
      console.log('- Agent 2: Will fail in 20 seconds')
      console.log('- Agent 3: Will complete in 25 seconds')

    } catch (error) {
      console.error('❌ Full workflow test failed:', error)
    }
  }
}

// Export convenience functions
export const webhookSimulator = WebhookSimulator.getInstance()

export const testIntegrationFromOpenClaw = async (objective: string, priority?: 'low' | 'medium' | 'high' | 'urgent') => {
  return webhookSimulator.simulateSubAgentSpawn(objective, priority)
}

export const testFullWorkflow = async () => {
  return webhookSimulator.testFullWorkflow()
}

// Make functions available globally for easy testing
declare global {
  interface Window {
    openclawTest: {
      spawnAgent: (objective: string, priority?: 'low' | 'medium' | 'high' | 'urgent') => Promise<string>
      testWorkflow: () => Promise<void>
      simulator: WebhookSimulator
    }
  }
}

// Expose testing functions globally
window.openclawTest = {
  spawnAgent: testIntegrationFromOpenClaw,
  testWorkflow: testFullWorkflow,
  simulator: webhookSimulator
}