import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { generateId } from '@/lib/utils'
import {
  AutomationRule,
  AutomationLogEntry,
  AutomationTriggerEvent,
  AutomationCondition,
  AutomationActionConfig,
  Task,
} from '@/types'
import { useKanbanStore } from './kanban'
import { useActivityStore, activityHelpers } from './activity'

interface AutomationState {
  rules: AutomationRule[]
  executionLog: AutomationLogEntry[]
  isProcessing: boolean
}

interface AutomationActions {
  createRule: (rule: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt' | 'triggerCount'>) => void
  updateRule: (id: string, updates: Partial<AutomationRule>) => void
  deleteRule: (id: string) => void
  toggleRule: (id: string) => void
  evaluateRules: (event: AutomationTriggerEvent, context: Record<string, any>) => void
  addLogEntry: (entry: Omit<AutomationLogEntry, 'id' | 'timestamp'>) => void
  clearLog: () => void
}

export const useAutomationStore = create<AutomationState & AutomationActions>()(
  persist(
    (set, get) => ({
      rules: [],
      executionLog: [],
      isProcessing: false,

      createRule: (rule) => {
        const now = new Date().toISOString()
        const newRule: AutomationRule = {
          ...rule,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
          triggerCount: 0,
        }
        set(state => ({
          rules: [...state.rules, newRule]
        }))
      },

      updateRule: (id, updates) => {
        set(state => ({
          rules: state.rules.map(rule =>
            rule.id === id
              ? { ...rule, ...updates, updatedAt: new Date().toISOString() }
              : rule
          )
        }))
      },

      deleteRule: (id) => {
        set(state => ({
          rules: state.rules.filter(rule => rule.id !== id)
        }))
      },

      toggleRule: (id) => {
        set(state => ({
          rules: state.rules.map(rule =>
            rule.id === id
              ? { ...rule, enabled: !rule.enabled, updatedAt: new Date().toISOString() }
              : rule
          )
        }))
      },

      evaluateRules: (event, context) => {
        const state = get()
        if (state.isProcessing) return

        set({ isProcessing: true })

        const matchingRules = state.rules.filter(
          rule => rule.enabled && rule.trigger.event === event
        )

        for (const rule of matchingRules) {
          try {
            const conditionsMet = checkConditions(rule.trigger.conditions, context)
            if (!conditionsMet) continue

            const actionsExecuted = executeActions(rule, context)

            // Update rule stats
            set(state => ({
              rules: state.rules.map(r =>
                r.id === rule.id
                  ? {
                      ...r,
                      triggerCount: r.triggerCount + 1,
                      lastTriggeredAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    }
                  : r
              )
            }))

            get().addLogEntry({
              ruleId: rule.id,
              ruleName: rule.name,
              triggerEvent: event,
              taskId: context.taskId,
              taskTitle: context.task?.title,
              actionsExecuted,
              success: true,
            })
          } catch (error) {
            get().addLogEntry({
              ruleId: rule.id,
              ruleName: rule.name,
              triggerEvent: event,
              taskId: context.taskId,
              taskTitle: context.task?.title,
              actionsExecuted: [],
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            })
          }
        }

        set({ isProcessing: false })
      },

      addLogEntry: (entry) => {
        const newEntry: AutomationLogEntry = {
          ...entry,
          id: generateId(),
          timestamp: new Date().toISOString(),
        }
        set(state => ({
          executionLog: [newEntry, ...state.executionLog].slice(0, 100)
        }))
      },

      clearLog: () => {
        set({ executionLog: [] })
      },
    }),
    {
      name: 'automation-storage',
      partialize: (state) => ({
        rules: state.rules,
        executionLog: state.executionLog,
      }),
    }
  )
)

function checkConditions(conditions: AutomationCondition[], context: Record<string, any>): boolean {
  if (conditions.length === 0) return true

  return conditions.every(condition => {
    const fieldValue = getNestedValue(context, condition.field)
    const condValue = condition.value

    switch (condition.operator) {
      case 'equals':
        return String(fieldValue) === condValue
      case 'not_equals':
        return String(fieldValue) !== condValue
      case 'contains':
        return String(fieldValue).toLowerCase().includes(condValue.toLowerCase())
      case 'not_contains':
        return !String(fieldValue).toLowerCase().includes(condValue.toLowerCase())
      case 'greater_than':
        return Number(fieldValue) > Number(condValue)
      case 'less_than':
        return Number(fieldValue) < Number(condValue)
      default:
        return false
    }
  })
}

function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

function executeActions(rule: AutomationRule, context: Record<string, any>): string[] {
  const kanbanStore = useKanbanStore.getState()
  const activityStore = useActivityStore.getState()
  const executed: string[] = []

  for (const action of rule.actions) {
    switch (action.type) {
      case 'move_task': {
        if (context.taskId && action.config.columnId) {
          kanbanStore.moveTask(context.taskId, action.config.columnId, 0)
          executed.push(`Moved task to column ${action.config.columnId}`)
        }
        break
      }
      case 'create_task': {
        const columnId = action.config.columnId || context.targetColumn
        if (columnId && action.config.title) {
          kanbanStore.createTask(columnId, action.config.title)
          executed.push(`Created task: ${action.config.title}`)
        }
        break
      }
      case 'change_priority': {
        if (context.taskId && action.config.priority) {
          kanbanStore.updateTask(context.taskId, { priority: action.config.priority })
          executed.push(`Changed priority to ${action.config.priority}`)
        }
        break
      }
      case 'add_tag': {
        if (context.taskId && action.config.tag) {
          const task = kanbanStore.tasks.find((t: Task) => t.id === context.taskId)
          if (task && !task.tags.includes(action.config.tag)) {
            kanbanStore.updateTask(context.taskId, { tags: [...task.tags, action.config.tag] })
            executed.push(`Added tag: ${action.config.tag}`)
          }
        }
        break
      }
      case 'forward_output': {
        if (context.taskId && action.config.targetTaskId) {
          kanbanStore.forwardOutputToTask(context.taskId, action.config.targetTaskId)
          executed.push(`Forwarded output to task ${action.config.targetTaskId}`)
        }
        break
      }
      case 'unblock_dependents': {
        if (context.taskId) {
          kanbanStore.unblockDependentTasks(context.taskId)
          executed.push('Unblocked dependent tasks')
        }
        break
      }
      case 'send_webhook': {
        if (action.config.url) {
          fetch(action.config.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rule: rule.name,
              event: rule.trigger.event,
              task: context.task,
              timestamp: new Date().toISOString(),
            }),
          }).catch(err => console.error('Webhook send failed:', err))
          executed.push(`Sent webhook to ${action.config.url}`)
        }
        break
      }
    }
  }

  return executed
}
