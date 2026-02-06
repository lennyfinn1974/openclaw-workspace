import React, { useState } from 'react'
import { useAutomationStore } from '@/stores/automation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatTime } from '@/lib/utils'
import { RuleEditor } from './RuleEditor'
import {
  Workflow,
  Plus,
  Edit3,
  Trash2,
  CheckCircle,
  XCircle,
  ToggleLeft,
  ToggleRight,
  Clock,
  Zap,
} from 'lucide-react'
import { AutomationRule } from '@/types'

const eventLabels: Record<string, string> = {
  'task.moved': 'Task Moved',
  'task.completed': 'Task Completed',
  'task.created': 'Task Created',
  'task.unblocked': 'Task Unblocked',
  'webhook.received': 'Webhook Received',
  'output.received': 'Output Received',
}

export function AutomationPanel() {
  const { rules, executionLog, deleteRule, toggleRule } = useAutomationStore()
  const [showEditor, setShowEditor] = useState(false)
  const [editingRule, setEditingRule] = useState<AutomationRule | undefined>()

  const activeRules = rules.filter(r => r.enabled)
  const recentLog = executionLog.slice(0, 20)

  const handleEdit = (rule: AutomationRule) => {
    setEditingRule(rule)
    setShowEditor(true)
  }

  const handleCreate = () => {
    setEditingRule(undefined)
    setShowEditor(true)
  }

  const handleCloseEditor = () => {
    setShowEditor(false)
    setEditingRule(undefined)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Workflow className="h-6 w-6 text-amber-600" />
            Automation Rules Engine
            <Badge variant="outline" className="ml-auto">
              {activeRules.length} Active
            </Badge>
          </CardTitle>
          <CardDescription>
            Configure rules that automatically trigger actions when events occur on your board
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Rule
          </Button>
        </CardContent>
      </Card>

      {/* Rules List */}
      {rules.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground px-1">Rules ({rules.length})</h3>
          {rules.map(rule => (
            <Card key={rule.id} className={cn(!rule.enabled && 'opacity-60')}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium truncate">{rule.name}</h4>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {eventLabels[rule.trigger.event] || rule.trigger.event}
                      </Badge>
                    </div>
                    {rule.description && (
                      <p className="text-sm text-muted-foreground mb-2">{rule.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{rule.trigger.conditions.length} condition(s)</span>
                      <span>{rule.actions.length} action(s)</span>
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        {rule.triggerCount} triggers
                      </span>
                      {rule.lastTriggeredAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last: {formatTime(rule.lastTriggeredAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => toggleRule(rule.id)}
                      title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                    >
                      {rule.enabled ? (
                        <ToggleRight className="h-5 w-5 text-green-500" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(rule)}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => deleteRule(rule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Workflow className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground mb-1">No automation rules yet</p>
              <p className="text-xs text-muted-foreground mb-4">
                Create rules to automate task workflows
              </p>
              <Button variant="outline" onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Rule
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Execution Log */}
      {recentLog.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground px-1">
            Execution Log (Last 20)
          </h3>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y max-h-80 overflow-y-auto">
                {recentLog.map(entry => (
                  <div key={entry.id} className="flex items-start gap-3 p-3">
                    {entry.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium truncate">{entry.ruleName}</span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {eventLabels[entry.triggerEvent] || entry.triggerEvent}
                        </Badge>
                      </div>
                      {entry.taskTitle && (
                        <p className="text-xs text-muted-foreground">Task: {entry.taskTitle}</p>
                      )}
                      {entry.actionsExecuted.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {entry.actionsExecuted.join(', ')}
                        </p>
                      )}
                      {entry.error && (
                        <p className="text-xs text-red-500">Error: {entry.error}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatTime(entry.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Rule Editor Modal */}
      {showEditor && (
        <RuleEditor
          rule={editingRule}
          onClose={handleCloseEditor}
        />
      )}
    </div>
  )
}
