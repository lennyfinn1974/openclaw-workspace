import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { generateId } from '@/lib/utils'

export interface ActivityItem {
  id: string
  type: 'task_created' | 'task_updated' | 'task_moved' | 'task_completed' | 'task_archived' | 'comment_added' | 'openclaw_sync' | 'dependency_added' | 'dependency_removed' | 'task_unblocked'
  title: string
  description: string
  taskId?: string
  taskTitle?: string
  userId: string
  userName: string
  timestamp: string
  metadata?: {
    from?: string
    to?: string
    field?: string
    oldValue?: any
    newValue?: any
    agentId?: string
  }
}

interface ActivityState {
  activities: ActivityItem[]
  isLoading: boolean
}

interface ActivityActions {
  addActivity: (activity: Omit<ActivityItem, 'id' | 'timestamp'>) => void
  clearActivities: () => void
  getRecentActivities: (limit?: number) => ActivityItem[]
  getTaskActivities: (taskId: string) => ActivityItem[]
  setLoading: (loading: boolean) => void
}

export const useActivityStore = create<ActivityState & ActivityActions>()(
  persist(
    (set, get) => ({
      // Initial state
      activities: [],
      isLoading: false,

      // Actions
      addActivity: (activity: Omit<ActivityItem, 'id' | 'timestamp'>) => {
        const newActivity: ActivityItem = {
          ...activity,
          id: generateId(),
          timestamp: new Date().toISOString(),
        }
        
        set(state => ({
          activities: [newActivity, ...state.activities].slice(0, 1000) // Keep last 1000 activities
        }))
      },

      clearActivities: () => {
        set({ activities: [] })
      },

      getRecentActivities: (limit: number = 10) => {
        const { activities } = get()
        return activities.slice(0, limit)
      },

      getTaskActivities: (taskId: string) => {
        const { activities } = get()
        return activities.filter(activity => activity.taskId === taskId)
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading })
      }
    }),
    {
      name: 'activity-storage',
      partialize: (state) => ({ activities: state.activities })
    }
  )
)

// Helper functions for creating activity items
export const activityHelpers = {
  taskCreated: (taskTitle: string, userName: string = 'You'): Omit<ActivityItem, 'id' | 'timestamp'> => ({
    type: 'task_created',
    title: 'Task Created',
    description: `Created task "${taskTitle}"`,
    taskTitle,
    userId: 'current-user',
    userName
  }),

  taskUpdated: (taskTitle: string, field: string, oldValue: any, newValue: any, userName: string = 'You'): Omit<ActivityItem, 'id' | 'timestamp'> => ({
    type: 'task_updated',
    title: 'Task Updated',
    description: `Updated ${field} from "${oldValue}" to "${newValue}"`,
    taskTitle,
    userId: 'current-user',
    userName,
    metadata: { field, oldValue, newValue }
  }),

  taskMoved: (taskTitle: string, fromColumn: string, toColumn: string, userName: string = 'You'): Omit<ActivityItem, 'id' | 'timestamp'> => ({
    type: 'task_moved',
    title: 'Task Moved',
    description: `Moved "${taskTitle}" from ${fromColumn} to ${toColumn}`,
    taskTitle,
    userId: 'current-user',
    userName,
    metadata: { from: fromColumn, to: toColumn }
  }),

  taskCompleted: (taskTitle: string, userName: string = 'You'): Omit<ActivityItem, 'id' | 'timestamp'> => ({
    type: 'task_completed',
    title: 'Task Completed',
    description: `Completed task "${taskTitle}"`,
    taskTitle,
    userId: 'current-user',
    userName
  }),

  taskArchived: (taskTitle: string, userName: string = 'You'): Omit<ActivityItem, 'id' | 'timestamp'> => ({
    type: 'task_archived',
    title: 'Task Archived',
    description: `Archived task "${taskTitle}"`,
    taskTitle,
    userId: 'current-user',
    userName
  }),

  commentAdded: (taskTitle: string, userName: string = 'You'): Omit<ActivityItem, 'id' | 'timestamp'> => ({
    type: 'comment_added',
    title: 'Comment Added',
    description: `Added comment to "${taskTitle}"`,
    taskTitle,
    userId: 'current-user',
    userName
  }),

  openclawSync: (agentName: string, status: string): Omit<ActivityItem, 'id' | 'timestamp'> => ({
    type: 'openclaw_sync',
    title: 'OpenClaw Sync',
    description: `Agent "${agentName}" ${status}`,
    userId: 'openclaw-system',
    userName: 'OpenClaw',
    metadata: { agentId: agentName }
  }),

  dependencyAdded: (taskTitle: string, dependsOnTitle: string, userName: string = 'You'): Omit<ActivityItem, 'id' | 'timestamp'> => ({
    type: 'dependency_added',
    title: 'Dependency Added',
    description: `"${taskTitle}" now depends on "${dependsOnTitle}"`,
    taskTitle,
    userId: 'current-user',
    userName
  }),

  dependencyRemoved: (taskTitle: string, dependsOnTitle: string, userName: string = 'You'): Omit<ActivityItem, 'id' | 'timestamp'> => ({
    type: 'dependency_removed',
    title: 'Dependency Removed',
    description: `Removed dependency of "${taskTitle}" on "${dependsOnTitle}"`,
    taskTitle,
    userId: 'current-user',
    userName
  }),

  taskUnblocked: (taskTitle: string, userName: string = 'System'): Omit<ActivityItem, 'id' | 'timestamp'> => ({
    type: 'task_unblocked',
    title: 'Task Unblocked',
    description: `"${taskTitle}" is now unblocked and ready to work on`,
    taskTitle,
    userId: 'system',
    userName
  })
}

// Activity type styling helpers
export const getActivityIcon = (type: ActivityItem['type']): string => {
  switch (type) {
    case 'task_created': return '➕'
    case 'task_updated': return '✏️'
    case 'task_moved': return '🔄'
    case 'task_completed': return '✅'
    case 'task_archived': return '📦'
    case 'comment_added': return '💬'
    case 'openclaw_sync': return '🤖'
    case 'dependency_added': return '🔗'
    case 'dependency_removed': return '🔓'
    case 'task_unblocked': return '🟢'
    default: return '📝'
  }
}

export const getActivityColor = (type: ActivityItem['type']): string => {
  switch (type) {
    case 'task_created': return 'text-success'
    case 'task_updated': return 'text-info'
    case 'task_moved': return 'text-warning'
    case 'task_completed': return 'text-success'
    case 'task_archived': return 'text-muted-foreground'
    case 'comment_added': return 'text-primary'
    case 'openclaw_sync': return 'text-openclaw-primary'
    case 'dependency_added': return 'text-info'
    case 'dependency_removed': return 'text-warning'
    case 'task_unblocked': return 'text-success'
    default: return 'text-muted-foreground'
  }
}