import React, { useEffect } from 'react'
import { useOpenClawStore, openclawHelpers } from '@/stores/openclaw'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Activity,
  Zap,
  Clock,
  Users,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function OpenClawStatus() {
  const {
    agents,
    isConnected,
    isConnecting,
    lastSyncTime,
    error,
    connect,
    disconnect,
    syncAgents,
    initializeConnection
  } = useOpenClawStore()

  const activeAgents = agents.filter(agent => agent.status === 'active')
  const completedAgents = agents.filter(agent => agent.status === 'completed')
  const failedAgents = agents.filter(agent => agent.status === 'failed')

  // Initialize connection on component mount
  useEffect(() => {
    initializeConnection()
  }, [initializeConnection])

  useEffect(() => {
    // Auto-sync every 30 seconds when connected
    if (isConnected) {
      const interval = setInterval(() => {
        syncAgents()
      }, 30000)
      
      return () => clearInterval(interval)
    }
  }, [isConnected, syncAgents])

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {isConnecting ? (
                <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
              ) : isConnected ? (
                <Wifi className="h-5 w-5 text-openclaw-success" />
              ) : (
                <WifiOff className="h-5 w-5 text-openclaw-error" />
              )}
              OpenClaw Connection
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  isConnecting 
                    ? 'default' 
                    : isConnected 
                      ? 'success' 
                      : 'destructive'
                }
                className={cn(
                  isConnecting && 'animate-pulse',
                  isConnected && 'openclaw-pulse'
                )}
              >
                {isConnecting 
                  ? 'Connecting...' 
                  : isConnected 
                    ? 'Connected' 
                    : 'Disconnected'}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => isConnected ? disconnect() : connect()}
                disabled={isConnecting}
              >
                {isConnecting 
                  ? 'Connecting...' 
                  : isConnected 
                    ? 'Disconnect' 
                    : 'Connect'}
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
          <Card className="openclaw-status-connected">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Activity className="h-5 w-5 text-openclaw-success" />
                <span className="text-2xl font-bold">{activeAgents.length}</span>
              </div>
              <p className="text-sm text-muted-foreground">Active</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Zap className="h-5 w-5 text-info" />
                <span className="text-2xl font-bold">{completedAgents.length}</span>
              </div>
              <p className="text-sm text-muted-foreground">Completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-openclaw-error" />
                <span className="text-2xl font-bold">{failedAgents.length}</span>
              </div>
              <p className="text-sm text-muted-foreground">Failed</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{agents.length}</span>
              </div>
              <p className="text-sm text-muted-foreground">Total</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Agents List */}
      {isConnected && agents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Agent Activity
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={syncAgents}
                className="flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {agents.slice(0, 5).map((agent) => {
                const status = openclawHelpers.formatAgentStatus(agent)
                const runtime = openclawHelpers.getAgentRuntime(agent)

                return (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{status.icon}</span>
                      <div>
                        <p className="font-medium text-sm">{agent.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {agent.model} • {runtime}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {agent.tokensUsed && (
                        <Badge variant="outline" className="text-xs">
                          {agent.tokensUsed.toLocaleString()} tokens
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={cn('text-xs', status.color)}
                      >
                        {status.label}
                      </Badge>
                    </div>
                  </div>
                )
              })}
              
              {agents.length > 5 && (
                <p className="text-center text-sm text-muted-foreground py-2">
                  ... and {agents.length - 5} more agents
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Integration Guide */}
      {!isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-openclaw-primary" />
              OpenClaw Integration
            </CardTitle>
            <CardDescription>
              Connect to OpenClaw to sync your tasks and agents in real-time. Your connection will be remembered and restored automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 rounded-lg border bg-muted/50">
                <h4 className="font-medium mb-2">Quick Setup:</h4>
                <ol className="space-y-1 text-sm text-muted-foreground list-decimal list-inside">
                  <li>Make sure OpenClaw is running on your system</li>
                  <li>Click the "Connect" button above</li>
                  <li>Your connection will be saved and restored on page refresh</li>
                  <li>Your agents and tasks will sync automatically</li>
                  <li>Enable "OpenClaw Automated Task" for webhook integration</li>
                </ol>
              </div>
              <div className="flex gap-2">
                <Button onClick={connect} className="flex-1">
                  <Zap className="mr-2 h-4 w-4" />
                  Connect to OpenClaw
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}