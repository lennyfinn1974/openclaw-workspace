import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { useOpenClawStore } from '@/stores/openclaw'
import { useKanbanStore } from '@/stores/kanban'
import { getOpenClawIntegration, defaultOpenClawConfig, SubAgentConfig } from '@/services/openclawIntegration'
import { Activity, Bot, CheckCircle, Clock, AlertCircle, Play, Zap, Settings } from 'lucide-react'

export const OpenClawIntegrationPanel: React.FC = () => {
  const { agents, isConnected } = useOpenClawStore()
  const { tasks } = useKanbanStore()
  const [isInitialized, setIsInitialized] = useState(false)
  const [isSpawning, setIsSpawning] = useState(false)
  const [spawnDialogOpen, setSpawnDialogOpen] = useState(false)
  
  // Form state for spawning sub-agents
  const [objective, setObjective] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium')
  const [tags, setTags] = useState('')
  const [estimatedDuration, setEstimatedDuration] = useState<number>(30)

  // Initialize integration
  useEffect(() => {
    const initializeIntegration = async () => {
      try {
        const integration = getOpenClawIntegration(defaultOpenClawConfig)
        await integration.initialize()
        setIsInitialized(true)
      } catch (error) {
        console.error('Failed to initialize OpenClaw integration:', error)
      }
    }

    if (!isInitialized) {
      initializeIntegration()
    }
  }, [isInitialized])

  // Mock data for demonstration
  const mockObjectives = [
    "Research competitor pricing strategies for Q1 2024",
    "Analyze user feedback from last product release",
    "Create comprehensive API documentation",
    "Optimize database queries for better performance",
    "Design UI mockups for mobile app redesign",
    "Conduct security audit of authentication system"
  ]

  const spawnSubAgent = async () => {
    if (!objective.trim()) return

    setIsSpawning(true)
    try {
      const integration = getOpenClawIntegration()
      const config: SubAgentConfig = {
        objective: objective.trim(),
        priority,
        tags: tags.split(',').map(t => t.trim()).filter(t => t.length > 0),
        estimatedDuration
      }

      await integration.spawnSubAgent(config)
      
      // Reset form
      setObjective('')
      setTags('')
      setEstimatedDuration(30)
      setSpawnDialogOpen(false)
      
    } catch (error) {
      console.error('Failed to spawn sub-agent:', error)
    } finally {
      setIsSpawning(false)
    }
  }

  const simulateCompletion = async (agentId: string) => {
    try {
      const integration = getOpenClawIntegration()
      await integration.completeSubAgent(agentId, {
        status: 'success',
        message: 'Task completed successfully!',
        artifacts: ['report.pdf', 'analysis.json']
      })
    } catch (error) {
      console.error('Failed to complete sub-agent:', error)
    }
  }

  const simulateFailure = async (agentId: string) => {
    try {
      const integration = getOpenClawIntegration()
      await integration.failSubAgent(agentId, 'Simulated failure for testing purposes')
    } catch (error) {
      console.error('Failed to fail sub-agent:', error)
    }
  }

  // Get statistics
  const openclawTasks = tasks.filter(task => task.isAutomated && task.tags.includes('openclaw-agent'))
  const activeTasks = openclawTasks.filter(task => task.tags.includes('sub-agent') && !task.tags.includes('failed'))
  const completedTasks = openclawTasks.filter(task => {
    const doneColumnId = useKanbanStore.getState().columns.find(col => 
      col.name.toLowerCase().includes('done')
    )?.id
    return task.columnId === doneColumnId
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">OpenClaw Integration</h2>
          <p className="text-muted-foreground">
            Real-time ticket flow integration with sub-agent lifecycle management
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={isConnected ? "success" : "destructive"} className="px-3 py-1">
            <div className="w-2 h-2 rounded-full bg-current mr-2" />
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
          <Badge variant={isInitialized ? "success" : "secondary"} className="px-3 py-1">
            {isInitialized ? 'Initialized' : 'Initializing...'}
          </Badge>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Bot className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{agents.filter(a => a.status === 'active').length}</p>
                <p className="text-sm text-muted-foreground">Active Agents</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-warning" />
              <div>
                <p className="text-2xl font-bold">{activeTasks.length}</p>
                <p className="text-sm text-muted-foreground">Active Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-success" />
              <div>
                <p className="text-2xl font-bold">{completedTasks.length}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Zap className="h-5 w-5 text-accent" />
              <div>
                <p className="text-2xl font-bold">{openclawTasks.length}</p>
                <p className="text-sm text-muted-foreground">Total Tickets</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Play className="h-5 w-5" />
            <span>Quick Actions</span>
          </CardTitle>
          <CardDescription>
            Spawn sub-agents and test the ticket flow integration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Dialog open={spawnDialogOpen} onOpenChange={setSpawnDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={!isInitialized}>
                  <Bot className="h-4 w-4 mr-2" />
                  Spawn Sub-Agent
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Spawn New Sub-Agent</DialogTitle>
                  <DialogDescription>
                    Create a new sub-agent with automatic ticket tracking
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Objective</label>
                    <Textarea
                      placeholder="What should this sub-agent accomplish?"
                      value={objective}
                      onChange={(e) => setObjective(e.target.value)}
                      className="mt-1"
                      rows={3}
                    />
                    <div className="flex flex-wrap gap-1 mt-2">
                      {mockObjectives.slice(0, 3).map((mockObj, idx) => (
                        <Button
                          key={idx}
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => setObjective(mockObj)}
                        >
                          {mockObj.substring(0, 30)}...
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Priority</label>
                      <Select value={priority} onValueChange={(value: any) => setPriority(value)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Duration (min)</label>
                      <Input
                        type="number"
                        value={estimatedDuration}
                        onChange={(e) => setEstimatedDuration(Number(e.target.value))}
                        className="mt-1"
                        min="1"
                        max="480"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Tags (comma-separated)</label>
                    <Input
                      placeholder="research, analysis, urgent"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setSpawnDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={spawnSubAgent} 
                      disabled={!objective.trim() || isSpawning}
                    >
                      {isSpawning ? 'Spawning...' : 'Spawn Agent'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button 
              variant="outline"
              onClick={() => setObjective(mockObjectives[Math.floor(Math.random() * mockObjectives.length)])}
            >
              Random Objective
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active Agents */}
      {agents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Sub-Agents</CardTitle>
            <CardDescription>
              Currently running sub-agents and their associated tickets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {agents.map((agent) => {
                const associatedTask = openclawTasks.find(task => 
                  task.tags.some(tag => tag.includes(agent.id.split('-').pop() || ''))
                )

                return (
                  <div key={agent.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant={
                          agent.status === 'active' ? 'default' :
                          agent.status === 'completed' ? 'success' :
                          agent.status === 'failed' ? 'destructive' : 'secondary'
                        }>
                          {agent.status}
                        </Badge>
                        <span className="font-medium">{agent.label}</span>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Session: {agent.sessionId}</p>
                        <p>Started: {new Date(agent.startTime).toLocaleTimeString()}</p>
                        {associatedTask && (
                          <p>Ticket: {associatedTask.title}</p>
                        )}
                      </div>
                    </div>
                    
                    {agent.status === 'active' && (
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => simulateCompletion(agent.id)}
                        >
                          Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => simulateFailure(agent.id)}
                        >
                          Fail
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Integration Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Integration Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Webhook Endpoint</span>
              <Badge variant="success">Active</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Real-time Updates</span>
              <Badge variant={isConnected ? "success" : "destructive"}>
                {isConnected ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Naming Convention</span>
              <span className="text-sm text-muted-foreground">Aries-Sub1, Aries-Sub2...</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Ticket Flow</span>
              <span className="text-sm text-muted-foreground">TODO → IN PROGRESS → DONE</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}