import React, { useState, useEffect } from 'react'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { OpenClawStatus } from '@/components/openclaw/OpenClawStatus'
import { OpenClawIntegrationPanel } from '@/components/openclaw/OpenClawIntegrationPanel'
import { NexusStatus } from '@/components/nexus/NexusStatus'
import { NexusIntegrationPanel } from '@/components/nexus/NexusIntegrationPanel'
import { HistoricalDataMigration } from '@/components/migration/HistoricalDataMigration'
import { RecentActivity } from '@/components/activity/RecentActivity'
import { WebhookIntegration } from '@/components/WebhookIntegration'
import { AutomationPanel } from '@/components/automation/AutomationPanel'
import { initializeSampleData } from '@/lib/sampleData'
import { useWebhookIntegration } from '@/hooks/useWebhookIntegration'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  LayoutDashboard,
  Settings,
  Zap,
  Menu,
  X,
  Github,
  ExternalLink,
  Activity,
  Bot,
  Database,
  Brain,
  Users,
  BookOpen,
  Zap as Lightning,
  Workflow,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type View = 'kanban' | 'openclaw' | 'nexus' | 'unified' | 'integration' | 'migration' | 'activity' | 'webhook' | 'automation' | 'settings'

export default function App() {
  const [currentView, setCurrentView] = useState<View>('kanban')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { loadCombinedData, isLoading } = useWebhookIntegration({ autoConnect: false })

  // Load live data instead of sample data
  useEffect(() => {
    // Clear any existing localStorage data to start fresh
    localStorage.removeItem('kanban-storage')
    
    loadCombinedData().catch(error => {
      console.error('Failed to load live data:', error)
      // Fallback to sample data only if API fails
      initializeSampleData()
    })
  }, [])

  // Close sidebar when view changes (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [currentView])

  // Close sidebar on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSidebarOpen(false)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="h-screen flex bg-background">
      {/* Sidebar */}
      <aside 
        className={cn(
          "w-64 bg-card border-r flex flex-col transition-transform duration-300 ease-in-out z-40",
          "fixed md:relative md:translate-x-0 h-full",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Sidebar Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Zap className="h-6 w-6 text-openclaw-primary" />
                Hybrid Kanban
              </h1>
              <p className="text-sm text-muted-foreground">
                Lovable + OpenClaw
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-2">
            <Button
              variant={currentView === 'kanban' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setCurrentView('kanban')}
            >
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Kanban Board
            </Button>
            
            <div className="py-2">
              <p className="text-xs font-medium text-muted-foreground mb-2 px-2">AI AGENTS</p>
              
              <Button
                variant={currentView === 'unified' ? 'default' : 'ghost'}
                className="w-full justify-start mb-1"
                onClick={() => setCurrentView('unified')}
              >
                <Users className="mr-2 h-4 w-4" />
                Unified Dashboard
                <Badge variant="outline" className="ml-auto text-xs">New</Badge>
              </Button>
              
              <Button
                variant={currentView === 'openclaw' ? 'default' : 'ghost'}
                className="w-full justify-start mb-1"
                onClick={() => setCurrentView('openclaw')}
              >
                <Zap className="mr-2 h-4 w-4 text-blue-500" />
                Aries Status
              </Button>
              
              <Button
                variant={currentView === 'nexus' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setCurrentView('nexus')}
              >
                <Brain className="mr-2 h-4 w-4 text-purple-500" />
                Nexus Status
                <Badge variant="outline" className="ml-auto text-xs">New</Badge>
              </Button>
            </div>
            
            <div className="py-2">
              <p className="text-xs font-medium text-muted-foreground mb-2 px-2">TOOLS</p>
              
              <Button
                variant={currentView === 'integration' ? 'default' : 'ghost'}
                className="w-full justify-start mb-1"
                onClick={() => setCurrentView('integration')}
              >
                <Bot className="mr-2 h-4 w-4" />
                Ticket Integration
              </Button>
              
              <Button
                variant={currentView === 'migration' ? 'default' : 'ghost'}
                className="w-full justify-start mb-1"
                onClick={() => setCurrentView('migration')}
              >
                <Database className="mr-2 h-4 w-4" />
                Data Migration
              </Button>
              
              <Button
                variant={currentView === 'activity' ? 'default' : 'ghost'}
                className="w-full justify-start mb-1"
                onClick={() => setCurrentView('activity')}
              >
                <Activity className="mr-2 h-4 w-4" />
                Recent Activity
              </Button>
              
              <Button
                variant={currentView === 'webhook' ? 'default' : 'ghost'}
                className="w-full justify-start mb-1"
                onClick={() => setCurrentView('webhook')}
              >
                <Lightning className="mr-2 h-4 w-4" />
                Webhook Integration
                <Badge variant="outline" className="ml-auto text-xs">Live</Badge>
              </Button>

              <Button
                variant={currentView === 'automation' ? 'default' : 'ghost'}
                className="w-full justify-start mb-1"
                onClick={() => setCurrentView('automation')}
              >
                <Workflow className="mr-2 h-4 w-4" />
                Automation Rules
                <Badge variant="outline" className="ml-auto text-xs">New</Badge>
              </Button>

              <Button
                variant={currentView === 'settings' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setCurrentView('settings')}
              >
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </div>
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Hybrid Kanban Platform v1.0.0
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                React + Vite
              </Badge>
              <Badge variant="openclaw" className="text-xs">
                OpenClaw Ready
              </Badge>
            </div>
          </div>
        </div>
      </aside>

      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-card border-b px-4 py-3 md:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div>
                <h2 className="font-semibold">
                  {currentView === 'kanban' && 'Kanban Board'}
                  {currentView === 'openclaw' && 'Aries Status'}
                  {currentView === 'nexus' && 'Nexus Status'}
                  {currentView === 'unified' && 'Unified AI Dashboard'}
                  {currentView === 'integration' && 'Ticket Flow Integration'}
                  {currentView === 'migration' && 'Historical Data Migration'}
                  {currentView === 'activity' && 'Recent Activity'}
                  {currentView === 'webhook' && 'Webhook Integration'}
                  {currentView === 'automation' && 'Automation Rules'}
                  {currentView === 'settings' && 'Settings'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {currentView === 'kanban' && 'Manage your tasks with drag & drop'}
                  {currentView === 'openclaw' && 'Real-time Aries agent monitoring and status'}
                  {currentView === 'nexus' && 'Real-time Nexus research and learning monitoring'}
                  {currentView === 'unified' && 'Complete dual-agent mission control interface'}
                  {currentView === 'integration' && 'Automated sub-agent ticket creation and tracking'}
                  {currentView === 'migration' && 'Import complete work history from previous dashboard systems'}
                  {currentView === 'activity' && 'Track all changes and updates'}
                  {currentView === 'webhook' && 'Real-time webhook integration for live ticket creation'}
                  {currentView === 'automation' && 'Configure rules that trigger actions on board events'}
                  {currentView === 'settings' && 'Configure your workspace'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="hidden md:flex"
              >
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="mr-2 h-4 w-4" />
                  GitHub
                </a>
              </Button>
            </div>
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-hidden">
          {currentView === 'kanban' && <KanbanBoard />}
          {currentView === 'openclaw' && (
            <div className="p-6 overflow-auto">
              <OpenClawStatus />
            </div>
          )}
          {currentView === 'nexus' && (
            <div className="p-6 overflow-auto">
              <NexusStatus />
            </div>
          )}
          {currentView === 'unified' && (
            <div className="p-6 overflow-auto">
              <UnifiedDashboard />
            </div>
          )}
          {currentView === 'integration' && (
            <div className="p-6 overflow-auto">
              <IntegrationView />
            </div>
          )}
          {currentView === 'migration' && (
            <div className="p-6 overflow-auto">
              <HistoricalDataMigration />
            </div>
          )}
          {currentView === 'activity' && (
            <div className="p-6 overflow-auto">
              <RecentActivity />
            </div>
          )}
          {currentView === 'webhook' && (
            <div className="p-6 overflow-auto">
              <WebhookIntegration />
            </div>
          )}
          {currentView === 'automation' && (
            <div className="p-6 overflow-auto">
              <AutomationPanel />
            </div>
          )}
          {currentView === 'settings' && (
            <div className="p-6 overflow-auto">
              <SettingsView />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function IntegrationView() {
  const [activeTab, setActiveTab] = useState<'aries' | 'nexus' | 'both'>('both')

  return (
    <div className="space-y-6">
      {/* Integration Header */}
      <Card className="bg-gradient-to-r from-blue-50 via-white to-purple-50 dark:from-blue-950/20 dark:via-background dark:to-purple-950/20 border-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Bot className="h-6 w-6 text-primary" />
            Dual-Agent Ticket Integration
            <Badge variant="outline" className="ml-auto">Unified Control</Badge>
          </CardTitle>
          <CardDescription>
            Automated ticket creation and tracking for both Aries task automation and Nexus research intelligence
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === 'both' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('both')}
            >
              <Users className="mr-2 h-3 w-3" />
              Both Systems
            </Button>
            <Button
              variant={activeTab === 'aries' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('aries')}
              className="border-blue-200 hover:bg-blue-50"
            >
              <Zap className="mr-2 h-3 w-3 text-blue-500" />
              Aries Only
            </Button>
            <Button
              variant={activeTab === 'nexus' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('nexus')}
              className="border-purple-200 hover:bg-purple-50"
            >
              <Brain className="mr-2 h-3 w-3 text-purple-500" />
              Nexus Only
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Integration Panels */}
      {(activeTab === 'both' || activeTab === 'aries') && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-300">Aries Integration</h3>
            <Badge variant="outline" className="border-blue-200 text-blue-600">Task Automation</Badge>
          </div>
          <OpenClawIntegrationPanel />
        </div>
      )}

      {(activeTab === 'both' || activeTab === 'nexus') && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            <h3 className="text-lg font-semibold text-purple-700 dark:text-purple-300">Nexus Integration</h3>
            <Badge variant="outline" className="border-purple-200 text-purple-600">Research Intelligence</Badge>
          </div>
          <NexusIntegrationPanel />
        </div>
      )}
    </div>
  )
}

function UnifiedDashboard() {
  return (
    <div className="space-y-6">
      {/* Header with dual-agent overview */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Zap className="h-6 w-6 text-blue-500" />
              <span className="text-blue-700 dark:text-blue-300">Aries</span>
            </div>
            <span className="text-muted-foreground">+</span>
            <div className="flex items-center gap-2">
              <Brain className="h-6 w-6 text-purple-500" />
              <span className="text-purple-700 dark:text-purple-300">Nexus</span>
            </div>
            <Badge variant="outline" className="ml-auto">Dual-Agent Mission Control</Badge>
          </CardTitle>
          <CardDescription>
            Unified dashboard for coordinating both AI systems - task automation and research intelligence
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Side-by-side agent status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aries (OpenClaw) Status */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-300">Aries Status</h3>
            <Badge variant="outline" className="border-blue-200 text-blue-600">Task Automation</Badge>
          </div>
          <OpenClawStatus />
        </div>

        {/* Nexus Status */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="h-5 w-5 text-purple-500" />
            <h3 className="text-lg font-semibold text-purple-700 dark:text-purple-300">Nexus Status</h3>
            <Badge variant="outline" className="border-purple-200 text-purple-600">Research Intelligence</Badge>
          </div>
          <NexusStatus />
        </div>
      </div>

      {/* Integration Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Integration Status
          </CardTitle>
          <CardDescription>
            Real-time coordination between Aries and Nexus agents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/20">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-blue-500" />
                <span className="font-medium text-blue-700 dark:text-blue-300">Aries Integration</span>
              </div>
              <p className="text-sm text-blue-600 dark:text-blue-400">Connected to localhost:8080</p>
              <Badge variant="default" className="mt-2 bg-blue-500">Active</Badge>
            </div>
            
            <div className="p-4 rounded-lg border bg-purple-50 dark:bg-purple-950/20">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="h-4 w-4 text-purple-500" />
                <span className="font-medium text-purple-700 dark:text-purple-300">Nexus Integration</span>
              </div>
              <p className="text-sm text-purple-600 dark:text-purple-400">Connected to localhost:8081</p>
              <Badge variant="default" className="mt-2 bg-purple-500">Active</Badge>
            </div>
            
            <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-950/20">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="h-4 w-4 text-green-500" />
                <span className="font-medium text-green-700 dark:text-green-300">Ticket Sync</span>
              </div>
              <p className="text-sm text-green-600 dark:text-green-400">Real-time coordination</p>
              <Badge variant="default" className="mt-2 bg-green-500">Synced</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks for dual-agent coordination
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button variant="outline" className="flex items-center gap-2 border-blue-200 hover:bg-blue-50">
              <Zap className="h-4 w-4 text-blue-500" />
              Spawn Aries Agent
            </Button>
            <Button variant="outline" className="flex items-center gap-2 border-purple-200 hover:bg-purple-50">
              <Brain className="h-4 w-4 text-purple-500" />
              Start Nexus Research
            </Button>
            <Button variant="outline" className="flex items-center gap-2 border-green-200 hover:bg-green-50">
              <BookOpen className="h-4 w-4 text-green-500" />
              Create Learn Task
            </Button>
            <Button variant="outline" className="flex items-center gap-2 border-yellow-200 hover:bg-yellow-50">
              <Lightning className="h-4 w-4 text-yellow-500" />
              Develop Skill
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SettingsView() {
  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Platform Settings</CardTitle>
          <CardDescription>
            Configure your Hybrid Kanban Platform preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Dark Mode</p>
              <p className="text-sm text-muted-foreground">
                Toggle between light and dark themes
              </p>
            </div>
            <Button variant="outline" size="sm">
              Coming Soon
            </Button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Auto-sync with Aries</p>
              <p className="text-sm text-muted-foreground">
                Automatically sync tasks when Aries agents complete
              </p>
            </div>
            <Button variant="outline" size="sm">
              Enabled
            </Button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Auto-sync with Nexus</p>
              <p className="text-sm text-muted-foreground">
                Automatically sync research tasks when Nexus agents complete
              </p>
            </div>
            <Button variant="outline" size="sm">
              Enabled
            </Button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Notification Sounds</p>
              <p className="text-sm text-muted-foreground">
                Play sounds when tasks are updated
              </p>
            </div>
            <Button variant="outline" size="sm">
              Disabled
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dual-Agent Integration</CardTitle>
          <CardDescription>
            Configure how this platform integrates with both AI systems
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-500" />
              Aries (OpenClaw) Integration
            </h4>
            <div className="space-y-2">
              <p className="font-medium mb-2">Webhook Endpoint</p>
              <div className="p-3 bg-muted rounded-md font-mono text-sm">
                {window.location.origin}/api/webhooks/openclaw
              </div>
              <p className="text-xs text-muted-foreground">
                Configure this URL in your OpenClaw instance for real-time updates
              </p>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-500" />
              Nexus Integration
            </h4>
            <div className="space-y-2">
              <p className="font-medium mb-2">Webhook Endpoint</p>
              <div className="p-3 bg-muted rounded-md font-mono text-sm">
                {window.location.origin}/api/webhooks/nexus
              </div>
              <p className="text-xs text-muted-foreground">
                Configure this URL in your Nexus instance for research activity updates
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <ExternalLink className="mr-2 h-4 w-4" />
              Aries Documentation
            </Button>
            <Button variant="outline" size="sm">
              <ExternalLink className="mr-2 h-4 w-4" />
              Nexus Documentation
            </Button>
            <Button variant="outline" size="sm">
              Test Connections
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
          <CardDescription>
            Information about this Dual-Agent Mission Control Platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium">Version</p>
              <p className="text-muted-foreground">2.0.0</p>
            </div>
            <div>
              <p className="font-medium">Build</p>
              <p className="text-muted-foreground">Development</p>
            </div>
            <div>
              <p className="font-medium">Framework</p>
              <p className="text-muted-foreground">React + Vite</p>
            </div>
            <div>
              <p className="font-medium">Design System</p>
              <p className="text-muted-foreground">Lovable + Tailwind</p>
            </div>
          </div>
          
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              This platform combines the beautiful design system from Lovable
              with local development control and dual-agent coordination between
              Aries (task automation) and Nexus (research intelligence).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}