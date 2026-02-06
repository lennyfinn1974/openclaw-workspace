import React, { useEffect } from 'react'
import { useNexusStore, nexusHelpers } from '@/stores/nexus'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Search,
  Brain,
  Clock,
  Users,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertCircle,
  BookOpen,
  Zap as Lightning,
  Eye
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function NexusStatus() {
  const {
    agents,
    activities,
    isConnected,
    lastSyncTime,
    error,
    connect,
    disconnect,
    syncAgents,
    syncActivities
  } = useNexusStore()

  const activeAgents = agents.filter(agent => agent.status === 'active')
  const completedAgents = agents.filter(agent => agent.status === 'completed')
  const failedAgents = agents.filter(agent => agent.status === 'failed')
  const overallProgress = nexusHelpers.getOverallProgress(activities)
  const activeTasksCount = nexusHelpers.getActiveTasksCount(activities)

  useEffect(() => {
    // Auto-sync every 30 seconds when connected
    if (isConnected) {
      const interval = setInterval(() => {
        Promise.all([syncAgents(), syncActivities()])
      }, 30000)
      
      return () => clearInterval(interval)
    }
  }, [isConnected, syncAgents, syncActivities])

  const handleRefresh = async () => {
    await Promise.all([syncAgents(), syncActivities()])
  }

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <Card className="border-purple-200 dark:border-purple-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {isConnected ? (
                <Wifi className="h-5 w-5 text-purple-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-500" />
              )}
              <span className="text-purple-700 dark:text-purple-300">Nexus Connection</span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant={isConnected ? 'default' : 'destructive'}
                className={cn(
                  'animate-pulse',
                  isConnected && 'bg-purple-500 hover:bg-purple-600'
                )}
              >
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => isConnected ? disconnect() : connect()}
                className="border-purple-200 hover:bg-purple-50 dark:border-purple-700 dark:hover:bg-purple-950"
              >
                {isConnected ? 'Disconnect' : 'Connect'}
              </Button>
            </div>
          </div>
          {lastSyncTime && (
            <CardDescription className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last sync: {new Date(lastSyncTime).toLocaleTimeString()}
            </CardDescription>
          )}
        </CardHeader>
        {error && (
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-destructive">{error}</span>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Agent Statistics */}
      {isConnected && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/50">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Brain className="h-5 w-5 text-purple-500" />
                <span className="text-2xl font-bold text-purple-700 dark:text-purple-300">{activeAgents.length}</span>
              </div>
              <p className="text-sm text-purple-600 dark:text-purple-400">Active</p>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/50">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Eye className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold text-green-700 dark:text-green-300">{completedAgents.length}</span>
              </div>
              <p className="text-sm text-green-600 dark:text-green-400">Insights Ready</p>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/50">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <span className="text-2xl font-bold text-red-700 dark:text-red-300">{failedAgents.length}</span>
              </div>
              <p className="text-sm text-red-600 dark:text-red-400">Failed</p>
            </CardContent>
          </Card>

          <Card className="border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/50">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Users className="h-5 w-5 text-indigo-500" />
                <span className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{agents.length}</span>
              </div>
              <p className="text-sm text-indigo-600 dark:text-indigo-400">Total</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Research Progress Overview */}
      {isConnected && activeTasksCount > 0 && (
        <Card className="border-purple-200 dark:border-purple-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
              <Search className="h-5 w-5" />
              Research Progress
            </CardTitle>
            <CardDescription>
              {activeTasksCount} active research tasks • {overallProgress}% overall progress
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress 
              value={overallProgress} 
              className="mb-4" 
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-purple-500" />
                <span className="text-sm">{activities.research_tasks.filter(t => t.status === 'active').length} Research Tasks</span>
              </div>
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-500" />
                <span className="text-sm">{activities.learn_commands.length} Learning Commands</span>
              </div>
              <div className="flex items-center gap-2">
                <Lightning className="h-4 w-4 text-yellow-500" />
                <span className="text-sm">{activities.skill_developments.filter(s => s.status === 'in_progress').length} Skill Developments</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Agents List */}
      {isConnected && agents.length > 0 && (
        <Card className="border-purple-200 dark:border-purple-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                <Brain className="h-5 w-5" />
                Agent Activity
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefresh}
                className="flex items-center gap-1 border-purple-200 hover:bg-purple-50 dark:border-purple-700 dark:hover:bg-purple-950"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {agents.slice(0, 5).map((agent) => {
                const status = nexusHelpers.formatAgentStatus(agent)
                const taskTypeStyle = nexusHelpers.getTaskTypeStyle(agent.taskType)
                const runtime = nexusHelpers.getAgentRuntime(agent)

                return (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-purple-100 bg-purple-50/50 hover:bg-purple-100/50 transition-colors dark:border-purple-800 dark:bg-purple-950/20 dark:hover:bg-purple-950/40"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center">
                        <span className="text-lg">{status.icon}</span>
                        <span className={cn("text-sm ml-1", taskTypeStyle.color)}>{taskTypeStyle.icon}</span>
                      </div>
                      <div>
                        <p className="font-medium text-sm text-purple-800 dark:text-purple-200">{agent.label}</p>
                        <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400">
                          <span>{agent.model}</span>
                          <span>•</span>
                          <span>{runtime}</span>
                          {agent.currentTask && (
                            <>
                              <span>•</span>
                              <span>{agent.currentTask}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {agent.progress && (
                        <div className="flex items-center gap-1">
                          <Progress value={agent.progress} className="w-12 h-2" />
                          <span className="text-xs text-purple-600 dark:text-purple-400">{agent.progress}%</span>
                        </div>
                      )}
                      {agent.tokensUsed && (
                        <Badge variant="outline" className="text-xs border-purple-200 dark:border-purple-700">
                          {agent.tokensUsed.toLocaleString()} tokens
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={cn('text-xs border-purple-200 dark:border-purple-700', status.color)}
                      >
                        {status.label}
                      </Badge>
                    </div>
                  </div>
                )
              })}
              
              {agents.length > 5 && (
                <p className="text-center text-sm text-purple-600 dark:text-purple-400 py-2">
                  ... and {agents.length - 5} more agents
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Integration Guide */}
      {!isConnected && (
        <Card className="border-purple-200 dark:border-purple-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
              <Brain className="h-5 w-5 text-purple-500" />
              Nexus Integration
            </CardTitle>
            <CardDescription>
              Connect to Nexus to sync your research tasks and learning activities in real-time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/20">
                <h4 className="font-medium mb-2 text-purple-800 dark:text-purple-200">Quick Setup:</h4>
                <ol className="space-y-1 text-sm text-purple-600 dark:text-purple-400 list-decimal list-inside">
                  <li>Make sure Nexus is running on localhost:8081</li>
                  <li>Click the "Connect" button above</li>
                  <li>Your research tasks and learning activities will sync automatically</li>
                  <li>Use /learn commands, research tasks, and skill development features</li>
                </ol>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={connect} 
                  className="flex-1 bg-purple-500 hover:bg-purple-600 text-white"
                >
                  <Brain className="mr-2 h-4 w-4" />
                  Connect to Nexus
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}