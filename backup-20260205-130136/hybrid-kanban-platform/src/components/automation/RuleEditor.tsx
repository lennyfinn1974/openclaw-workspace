import React, { useState } from 'react'
import { useAutomationStore } from '@/stores/automation'
import { useKanbanStore } from '@/stores/kanban'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  AutomationRule,
  AutomationTriggerEvent,
  AutomationCondition,
  AutomationActionConfig,
  AutomationActionType,
} from '@/types'
import { X, Plus, Trash2 } from 'lucide-react'

interface RuleEditorProps {
  rule?: AutomationRule
  onClose: () => void
}

const triggerEvents: { value: AutomationTriggerEvent; label: string }[] = [
  { value: 'task.moved', label: 'Task Moved' },
  { value: 'task.completed', label: 'Task Completed' },
  { value: 'task.created', label: 'Task Created' },
  { value: 'task.unblocked', label: 'Task Unblocked' },
  { value: 'webhook.received', label: 'Webhook Received' },
  { value: 'output.received', label: 'Output Received' },
]

const actionTypes: { value: AutomationActionType; label: string }[] = [
  { value: 'move_task', label: 'Move Task' },
  { value: 'create_task', label: 'Create Task' },
  { value: 'send_webhook', label: 'Send Webhook' },
  { value: 'change_priority', label: 'Change Priority' },
  { value: 'add_tag', label: 'Add Tag' },
  { value: 'forward_output', label: 'Forward Output' },
  { value: 'unblock_dependents', label: 'Unblock Dependents' },
]

const operators = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Not Contains' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
]

export function RuleEditor({ rule, onClose }: RuleEditorProps) {
  const { createRule, updateRule } = useAutomationStore()
  const { columns, tasks } = useKanbanStore()

  const [name, setName] = useState(rule?.name || '')
  const [description, setDescription] = useState(rule?.description || '')
  const [triggerEvent, setTriggerEvent] = useState<AutomationTriggerEvent>(
    rule?.trigger.event || 'task.moved'
  )
  const [conditions, setConditions] = useState<AutomationCondition[]>(
    rule?.trigger.conditions || []
  )
  const [actions, setActions] = useState<AutomationActionConfig[]>(
    rule?.actions || []
  )

  const addCondition = () => {
    setConditions([...conditions, { field: 'task.priority', operator: 'equals', value: '' }])
  }

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index))
  }

  const updateCondition = (index: number, updates: Partial<AutomationCondition>) => {
    setConditions(conditions.map((c, i) => (i === index ? { ...c, ...updates } : c)))
  }

  const addAction = () => {
    setActions([...actions, { type: 'move_task', config: {} }])
  }

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index))
  }

  const updateAction = (index: number, updates: Partial<AutomationActionConfig>) => {
    setActions(actions.map((a, i) => (i === index ? { ...a, ...updates } : a)))
  }

  const updateActionConfig = (index: number, key: string, value: string) => {
    setActions(
      actions.map((a, i) =>
        i === index ? { ...a, config: { ...a.config, [key]: value } } : a
      )
    )
  }

  const handleSave = () => {
    if (!name.trim() || actions.length === 0) return

    const ruleData = {
      name: name.trim(),
      description: description.trim() || undefined,
      trigger: {
        event: triggerEvent,
        conditions,
      },
      actions,
      enabled: rule?.enabled ?? true,
    }

    if (rule) {
      updateRule(rule.id, ruleData)
    } else {
      createRule(ruleData)
    }

    onClose()
  }

  const renderActionConfig = (action: AutomationActionConfig, index: number) => {
    switch (action.type) {
      case 'move_task':
        return (
          <select
            value={action.config.columnId || ''}
            onChange={(e) => updateActionConfig(index, 'columnId', e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select column...</option>
            {columns.map(col => (
              <option key={col.id} value={col.id}>{col.name}</option>
            ))}
          </select>
        )
      case 'create_task':
        return (
          <div className="space-y-2">
            <Input
              placeholder="Task title"
              value={action.config.title || ''}
              onChange={(e) => updateActionConfig(index, 'title', e.target.value)}
            />
            <select
              value={action.config.columnId || ''}
              onChange={(e) => updateActionConfig(index, 'columnId', e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select column...</option>
              {columns.map(col => (
                <option key={col.id} value={col.id}>{col.name}</option>
              ))}
            </select>
            <select
              value={action.config.priority || 'medium'}
              onChange={(e) => updateActionConfig(index, 'priority', e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        )
      case 'send_webhook':
        return (
          <Input
            placeholder="Webhook URL"
            value={action.config.url || ''}
            onChange={(e) => updateActionConfig(index, 'url', e.target.value)}
          />
        )
      case 'change_priority':
        return (
          <select
            value={action.config.priority || ''}
            onChange={(e) => updateActionConfig(index, 'priority', e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select priority...</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        )
      case 'add_tag':
        return (
          <Input
            placeholder="Tag name"
            value={action.config.tag || ''}
            onChange={(e) => updateActionConfig(index, 'tag', e.target.value)}
          />
        )
      case 'forward_output':
        return (
          <select
            value={action.config.targetTaskId || ''}
            onChange={(e) => updateActionConfig(index, 'targetTaskId', e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select target task...</option>
            {tasks.map(t => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        )
      case 'unblock_dependents':
        return (
          <p className="text-xs text-muted-foreground">
            Automatically unblocks all tasks that depend on the triggering task.
          </p>
        )
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background border rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">
            {rule ? 'Edit Rule' : 'Create Automation Rule'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Name & Description */}
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Rule Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Auto-complete on Done"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                rows={2}
                className="mt-1"
              />
            </div>
          </div>

          {/* Trigger Event */}
          <div>
            <label className="text-sm font-medium">Trigger Event</label>
            <select
              value={triggerEvent}
              onChange={(e) => setTriggerEvent(e.target.value as AutomationTriggerEvent)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
            >
              {triggerEvents.map(event => (
                <option key={event.value} value={event.value}>{event.label}</option>
              ))}
            </select>
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Conditions</label>
              <Button variant="outline" size="sm" onClick={addCondition}>
                <Plus className="h-3 w-3 mr-1" />
                Add Condition
              </Button>
            </div>
            {conditions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No conditions - rule will trigger on every matching event
              </p>
            ) : (
              <div className="space-y-2">
                {conditions.map((condition, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder="Field (e.g., task.priority)"
                      value={condition.field}
                      onChange={(e) => updateCondition(index, { field: e.target.value })}
                      className="flex-1"
                    />
                    <select
                      value={condition.operator}
                      onChange={(e) => updateCondition(index, { operator: e.target.value as any })}
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {operators.map(op => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                      ))}
                    </select>
                    <Input
                      placeholder="Value"
                      value={condition.value}
                      onChange={(e) => updateCondition(index, { value: e.target.value })}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive"
                      onClick={() => removeCondition(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Actions</label>
              <Button variant="outline" size="sm" onClick={addAction}>
                <Plus className="h-3 w-3 mr-1" />
                Add Action
              </Button>
            </div>
            {actions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Add at least one action for this rule
              </p>
            ) : (
              <div className="space-y-3">
                {actions.map((action, index) => (
                  <div key={index} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={action.type}
                        onChange={(e) =>
                          updateAction(index, {
                            type: e.target.value as AutomationActionType,
                            config: {},
                          })
                        }
                        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {actionTypes.map(at => (
                          <option key={at.value} value={at.value}>{at.label}</option>
                        ))}
                      </select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-destructive"
                        onClick={() => removeAction(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {renderActionConfig(action, index)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-6 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || actions.length === 0}>
            {rule ? 'Save Changes' : 'Create Rule'}
          </Button>
        </div>
      </div>
    </div>
  )
}
