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
import { useNexusStore } from '@/stores/nexus'
import { useKanbanStore } from '@/stores/kanban'
import { getNexusIntegration, defaultNexusConfig, NexusTaskConfig } from '@/services/nexusIntegration'
import { Brain, BookOpen, Search, Zap, CheckCircle, Clock, AlertCircle, Play, Settings, Eye } from 'lucide-react'

export const NexusIntegrationPanel: React.FC = () => {
  const { agents, activities, isConnected } = useNexusStore()
  const { tasks } = useKanbanStore()
  const [isInitialized, setIsInitialized] = useState(false)
  const [isSpawning, setIsSpawning] = useState(false)
  const [spawnDialogOpen, setSpawnDialogOpen] = useState(false)
  
  // Form state for spawning Nexus sub-agents
  const [objective, setObjective] = useState('')
  const [command, setCommand] = useState<string>('/learn')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium')
  const [taskType, setTaskType] = useState<'learn' | 'research' | 'skill' | 'general'>('learn')
  const [tags, setTags] = useState('')
  const [estimatedDuration, setEstimatedDuration] = useState<number>(30)

  // Initialize integration
  useEffect(() => {
    const initializeIntegration = async () => {
      try {
        const integration = getNexusIntegration(defaultNexusConfig)
        await integration.initialize()
        setIsInitialized(true)
      } catch (error) {
        console.error('Failed to initialize Nexus integration:', error)
      }
    }

    if (!isInitialized) {
      initializeIntegration()
    }
  }, [isInitialized])

  // Mock data for demonstration
  const mockObjectives = [
    "Learn about advanced machine learning architectures",
    "Research quantum computing applications in AI",
    "Develop skills in natural language processing",
    "Study blockchain technology and smart contracts",
    "Research sustainable AI practices and ethics",
    "Learn about computer vision and image recognition"
  ]

  // Calculate some statistics
  const nexusTasks = tasks.filter(task => 
    task.tags.includes('nexus-agent') || task.nexusTaskId
  )
  const activeNexusTasks = nexusTasks.filter(task => task.status === 'active')
  const completedNexusTasks = nexusTasks.filter(task => task.status === 'completed')

  const handleSpawnSubAgent = async () => {
    if (!objective.trim()) return

    setIsSpawning(true)
    try {
      const integration = getNexusIntegration()
      const config: NexusTaskConfig = {
        command,
        objective: objective.trim(),
        priority,
        taskType,
        tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
        estimatedDuration
      }

      const agentId = await integration.spawnNexusSubAgent(config)
      console.log('Nexus sub-agent spawned:', agentId)

      // Reset form
      setObjective('')
      setCommand('/learn')
      setPriority('medium')
      setTaskType('learn')
      setTags('')
      setEstimatedDuration(30)
      setSpawnDialogOpen(false)

    } catch (error) {
      console.error('Failed to spawn Nexus sub-agent:', error)
    } finally {
      setIsSpawning(false)
    }
  }

  const handleQuickAction = async (actionType: 'learn' | 'research' | 'skill', topic: string) => {
    try {
      const integration = getNexusIntegration()
      
      switch (actionType) {
        case 'learn':
          await integration.createLearnTicket(topic)
          break
        case 'research':
          await integration.createResearchTicket(topic, 'deep')
          break
        case 'skill':
          await integration.createSkillTicket(topic, 'Advanced skill development')
          break
      }
    } catch (error) {
      console.error(`Failed to create ${actionType} ticket:`, error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
            <Brain className="h-6 w-6 text-purple-500" />
            Nexus Ticket Flow Integration
          </CardTitle>
          <CardDescription>
            Automated research task creation and learning activity tracking for Nexus AI
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-purple-500 animate-pulse' : 'bg-gray-300'}`} />
                <span className="text-sm font-medium">
                  {isConnected ? 'Connected to Nexus' : 'Disconnected'}
                </span>
              </div>
              <Badge variant="outline" className="border-purple-200 text-purple-600">
                localhost:8081
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isInitialized ? 'default' : 'outline'} className="bg-purple-500">
                {isInitialized ? 'Initialized' : 'Initializing...'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/50">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Brain className="h-5 w-5 text-purple-500" />
              <span className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                {agents.filter(a => a.status === 'active').length}
              </span>
            </div>
            <p className="text-sm text-purple-600 dark:text-purple-400">Active Agents</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/50">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <BookOpen className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {activities.learn_commands.length}
              </span>
            </div>
            <p className="text-sm text-blue-600 dark:text-blue-400">Learning Tasks</p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/50">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Search className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold text-green-700 dark:text-green-300">
                {activities.research_tasks.filter(t => t.status === 'active').length}
              </span>
            </div>
            <p className="text-sm text-green-600 dark:text-green-400">Research Tasks</p>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/50">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              <span className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                {activities.skill_developments.filter(s => s.status === 'in_progress').length}
              </span>
            </div>
            <p className="text-sm text-yellow-600 dark:text-yellow-400">Skill Development</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spawn Sub-Agent */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Spawn Nexus Sub-Agent
            </CardTitle>
            <CardDescription>
              Create automated tickets for research and learning activities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Dialog open={spawnDialogOpen} onOpenChange={setSpawnDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full bg-purple-500 hover:bg-purple-600">
                  <Brain className="mr-2 h-4 w-4" />
                  Spawn Research Agent
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-500" />
                    Spawn Nexus Sub-Agent
                  </DialogTitle>
                  <DialogDescription>
                    Configure and spawn a new Nexus sub-agent for research or learning tasks
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Command Type</label>
                    <Select value={command} onValueChange={setCommand}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="/learn">🎓 /learn - Learning command</SelectItem>
                        <SelectItem value="research">🔍 research - Deep research</SelectItem>
                        <SelectItem value="skill_development">⚡ skill_development - Skill building</SelectItem>
                        <SelectItem value="general">🔮 general - General task</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Objective</label>
                    <Textarea
                      value={objective}
                      onChange={(e) => setObjective(e.target.value)}
                      placeholder="What should Nexus research or learn about?"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Task Type</label>
                      <Select value={taskType} onValueChange={(value) => setTaskType(value as any)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="learn">🎓 Learn</SelectItem>
                          <SelectItem value="research">🔍 Research</SelectItem>
                          <SelectItem value="skill">⚡ Skill</SelectItem>
                          <SelectItem value="general">🔮 General</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Priority</label>
                      <Select value={priority} onValueChange={(value) => setPriority(value as any)}>
                        <SelectTrigger>
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
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Duration (minutes): {estimatedDuration}
                    </label>
                    <input
                      type="range"
                      min="15"
                      max="120"
                      step="15"
                      value={estimatedDuration}
                      onChange={(e) => setEstimatedDuration(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Tags (optional)</label>
                    <Input
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      placeholder="research, ai, machine-learning"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleSpawnSubAgent}
                      disabled={isSpawning || !objective.trim()}
                      className="flex-1 bg-purple-500 hover:bg-purple-600"
                    >
                      {isSpawning ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                          Spawning...
                        </>
                      ) : (
                        <>
                          <Brain className="mr-2 h-4 w-4" />
                          Spawn Agent
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setSpawnDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Separator />

            {/* Quick Actions */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Quick Actions:</p>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction('learn', 'Machine Learning Fundamentals')}
                  className="justify-start border-blue-200 hover:bg-blue-50"
                >
                  <BookOpen className="mr-2 h-3 w-3 text-blue-500" />
                  Learn: ML Fundamentals
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction('research', 'AI Ethics and Safety')}
                  className="justify-start border-green-200 hover:bg-green-50"
                >
                  <Search className="mr-2 h-3 w-3 text-green-500" />
                  Research: AI Ethics
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction('skill', 'Data Analysis')}
                  className="justify-start border-yellow-200 hover:bg-yellow-50"
                >
                  <Zap className="mr-2 h-3 w-3 text-yellow-500" />
                  Skill: Data Analysis
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Activities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Current Activities
            </CardTitle>
            <CardDescription>
              Live research and learning activities from Nexus
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Research Tasks */}
              {activities.research_tasks.slice(0, 3).map((task) => (
                <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border border-purple-100 bg-purple-50/50">
                  <div>
                    <p className="font-medium text-sm text-purple-800">{task.topic}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs border-purple-200">
                        {task.status}
                      </Badge>
                      <span className="text-xs text-purple-600">{task.progress}%</span>
                    </div>
                  </div>
                  <Search className="h-4 w-4 text-purple-500" />
                </div>
              ))}
              
              {/* Learning Commands */}
              {activities.learn_commands.slice(0, 2).map((cmd) => (
                <div key={cmd.id} className="flex items-center justify-between p-3 rounded-lg border border-blue-100 bg-blue-50/50">
                  <div>
                    <p className="font-medium text-sm text-blue-800">{cmd.topic}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={cmd.progress} className="w-16 h-2" />
                      <span className="text-xs text-blue-600">{cmd.progress}%</span>
                    </div>
                  </div>
                  <BookOpen className="h-4 w-4 text-blue-500" />
                </div>
              ))}

              {activities.research_tasks.length === 0 && activities.learn_commands.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-8 w-8 mx-auto mb-2 text-purple-300" />
                  <p className="text-sm">No active Nexus activities</p>
                  <p className="text-xs">Spawn a research agent to get started</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sample Objectives */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Sample Research Objectives
          </CardTitle>
          <CardDescription>
            Click any objective below to quickly spawn a Nexus agent
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mockObjectives.map((obj, index) => (
              <Button
                key={index}
                variant="outline"
                className="justify-start text-left h-auto p-4 border-purple-100 hover:bg-purple-50"
                onClick={() => {
                  setObjective(obj)
                  setSpawnDialogOpen(true)
                }}
              >
                <div>
                  <p className="font-medium text-sm">{obj}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {obj.includes('Learn') ? 'learn' : obj.includes('Research') ? 'research' : 'skill'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      ~{30 + Math.floor(Math.random() * 60)}min
                    </span>
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}