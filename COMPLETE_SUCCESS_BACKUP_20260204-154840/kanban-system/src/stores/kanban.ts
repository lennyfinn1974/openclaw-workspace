import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Board, Column, Task, Comment, KanbanState, TaskOutput } from '@/types'
import { generateId } from '@/lib/utils'

interface KanbanActions {
  // Board actions
  createBoard: (name: string, description?: string) => void
  updateBoard: (id: string, updates: Partial<Board>) => void
  deleteBoard: (id: string) => void
  setSelectedBoard: (boardId: string) => void

  // Column actions
  createColumn: (boardId: string, name: string) => void
  updateColumn: (id: string, updates: Partial<Column>) => void
  deleteColumn: (id: string) => void

  // Task actions
  createTask: (columnId: string, title: string, description?: string) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  deleteTask: (id: string) => void
  moveTask: (taskId: string, targetColumnId: string, newPosition: number) => void
  setSelectedTask: (taskId?: string) => void

  // Comment actions
  addComment: (taskId: string, content: string, authorName: string) => void
  deleteComment: (id: string) => void

  // Archive actions
  getCompletedTasks: (columnId: string, limit?: number) => Task[]
  archiveOldCompletedTasks: (columnId: string, limit?: number) => void

  // Utility actions
  setLoading: (loading: boolean) => void
  setError: (error?: string) => void
  clearDuplicates: () => void
  
  // Dependency actions
  addDependency: (taskId: string, dependsOnTaskId: string) => void
  removeDependency: (taskId: string, dependsOnTaskId: string) => void
  unblockDependentTasks: (completedTaskId: string) => void

  // Output actions
  setTaskOutput: (taskId: string, output: TaskOutput) => void
  forwardOutputToTask: (sourceId: string, targetId: string) => void

  // Bulk data actions
  setLiveData: (data: { boards: Board[], columns: Column[], tasks: Task[] }) => void
}

const initialBoard: Board = {
  id: 'default-board',
  name: 'My Kanban Board',
  description: 'Default board for task management',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

const initialColumns: Column[] = [
  {
    id: 'col-todo',
    boardId: 'default-board',
    name: 'To Do',
    position: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'col-progress',
    boardId: 'default-board',
    name: 'In Progress',
    position: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'col-review',
    boardId: 'default-board',
    name: 'Review',
    position: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'col-done',
    boardId: 'default-board',
    name: 'Done',
    position: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]

export const useKanbanStore = create<KanbanState & KanbanActions>()(
  persist(
    (set, get) => ({
      // Initial state
      boards: [initialBoard],
      columns: initialColumns,
      tasks: [],
      comments: [],
      selectedBoard: 'default-board',
      selectedTask: undefined,
      isLoading: false,
      error: undefined,

      // Board actions
      createBoard: (name: string, description?: string) => {
        const board: Board = {
          id: generateId(),
          name,
          description,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        set(state => ({
          boards: [...state.boards, board]
        }))
      },

      updateBoard: (id: string, updates: Partial<Board>) => {
        set(state => ({
          boards: state.boards.map(board =>
            board.id === id
              ? { ...board, ...updates, updatedAt: new Date().toISOString() }
              : board
          )
        }))
      },

      deleteBoard: (id: string) => {
        set(state => ({
          boards: state.boards.filter(board => board.id !== id),
          columns: state.columns.filter(column => column.boardId !== id),
          tasks: state.tasks.filter(task => task.boardId !== id)
        }))
      },

      setSelectedBoard: (boardId: string) => {
        set({ selectedBoard: boardId })
      },

      // Column actions
      createColumn: (boardId: string, name: string) => {
        const state = get()
        const boardColumns = state.columns.filter(col => col.boardId === boardId)
        const position = boardColumns.length

        const column: Column = {
          id: generateId(),
          boardId,
          name,
          position,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        set(state => ({
          columns: [...state.columns, column]
        }))
      },

      updateColumn: (id: string, updates: Partial<Column>) => {
        set(state => ({
          columns: state.columns.map(column =>
            column.id === id
              ? { ...column, ...updates, updatedAt: new Date().toISOString() }
              : column
          )
        }))
      },

      deleteColumn: (id: string) => {
        set(state => ({
          columns: state.columns.filter(column => column.id !== id),
          tasks: state.tasks.filter(task => task.columnId !== id)
        }))
      },

      // Task actions
      createTask: (columnId: string, title: string, description?: string) => {
        const state = get()
        const column = state.columns.find(col => col.id === columnId)
        if (!column) return

        const columnTasks = state.tasks.filter(task => task.columnId === columnId)
        const position = columnTasks.length

        const task: Task = {
          id: generateId(),
          columnId,
          boardId: column.boardId,
          title,
          description,
          priority: 'medium',
          status: 'active',
          position,
          tags: [],
          dependsOn: [],
          blocks: [],
          isBlocked: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        set(state => ({
          tasks: [...state.tasks, task]
        }))

        // Add to activity (will be imported later)
        // activityHelpers.taskCreated(title)
      },

      updateTask: (id: string, updates: Partial<Task>) => {
        set(state => ({
          tasks: state.tasks.map(task =>
            task.id === id
              ? { ...task, ...updates, updatedAt: new Date().toISOString() }
              : task
          )
        }))
      },

      deleteTask: (id: string) => {
        set(state => ({
          tasks: state.tasks.filter(task => task.id !== id),
          comments: state.comments.filter(comment => comment.taskId !== id)
        }))
      },

      moveTask: (taskId: string, targetColumnId: string, newPosition: number) => {
        const state = get()
        const task = state.tasks.find(t => t.id === taskId)
        if (!task) return

        const targetColumn = state.columns.find(col => col.id === targetColumnId)
        if (!targetColumn) return

        // Update task position and column
        const updatedTasks = state.tasks.map(t => {
          if (t.id === taskId) {
            return {
              ...t,
              columnId: targetColumnId,
              position: newPosition,
              updatedAt: new Date().toISOString()
            }
          }
          // Adjust positions of other tasks in the same column
          if (t.columnId === targetColumnId && t.position >= newPosition && t.id !== taskId) {
            return { ...t, position: t.position + 1 }
          }
          return t
        })

        set({ tasks: updatedTasks })
      },

      setSelectedTask: (taskId?: string) => {
        set({ selectedTask: taskId })
      },

      // Comment actions
      addComment: (taskId: string, content: string, authorName: string) => {
        const comment: Comment = {
          id: generateId(),
          taskId,
          content,
          authorId: 'user',
          authorName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        set(state => ({
          comments: [...state.comments, comment]
        }))
      },

      deleteComment: (id: string) => {
        set(state => ({
          comments: state.comments.filter(comment => comment.id !== id)
        }))
      },

      // Archive actions
      getCompletedTasks: (columnId: string, limit: number = 10) => {
        const state = get()
        return state.tasks
          .filter(task => task.columnId === columnId)
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, limit)
      },

      archiveOldCompletedTasks: (columnId: string, limit: number = 10) => {
        const state = get()
        const tasks = state.tasks.filter(task => task.columnId === columnId)
        const sortedTasks = tasks.sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
        
        if (sortedTasks.length > limit) {
          const tasksToArchive = sortedTasks.slice(limit)
          const updatedTasks = state.tasks.map(task => 
            tasksToArchive.find(t => t.id === task.id)
              ? { ...task, status: 'archived' as const, updatedAt: new Date().toISOString() }
              : task
          )
          
          set({ tasks: updatedTasks })
        }
      },

      // Utility actions
      setLoading: (loading: boolean) => {
        set({ isLoading: loading })
      },

      setError: (error?: string) => {
        set({ error })
      },

      clearDuplicates: () => {
        const state = get()
        
        // Remove duplicate tasks based on title and OpenClaw task ID
        const uniqueTasks = state.tasks.reduce((acc, task) => {
          const existingTask = acc.find(t => 
            t.id === task.id || 
            (t.openclawTaskId && task.openclawTaskId && t.openclawTaskId === task.openclawTaskId) ||
            (t.title === task.title && t.columnId === task.columnId && 
             Math.abs(new Date(t.createdAt).getTime() - new Date(task.createdAt).getTime()) < 60000) // Within 1 minute
          )
          
          if (!existingTask) {
            acc.push(task)
          } else {
            console.log(`🗑️ Removing duplicate task: ${task.title} (${task.id})`)
          }
          
          return acc
        }, [] as Task[])
        
        const removedCount = state.tasks.length - uniqueTasks.length
        
        if (removedCount > 0) {
          set({ tasks: uniqueTasks })
          console.log(`✅ Removed ${removedCount} duplicate tasks`)
        } else {
          console.log(`✅ No duplicates found`)
        }
      },

      // Dependency actions
      addDependency: (taskId: string, dependsOnTaskId: string) => {
        set(state => ({
          tasks: state.tasks.map(task => {
            if (task.id === taskId) {
              const dependsOn = task.dependsOn.includes(dependsOnTaskId)
                ? task.dependsOn
                : [...task.dependsOn, dependsOnTaskId]
              const upstreamTask = state.tasks.find(t => t.id === dependsOnTaskId)
              const isBlocked = dependsOn.some(depId => {
                const dep = state.tasks.find(t => t.id === depId)
                return dep && dep.status !== 'completed'
              })
              return { ...task, dependsOn, isBlocked, updatedAt: new Date().toISOString() }
            }
            if (task.id === dependsOnTaskId) {
              const blocks = task.blocks.includes(taskId)
                ? task.blocks
                : [...task.blocks, taskId]
              return { ...task, blocks, updatedAt: new Date().toISOString() }
            }
            return task
          })
        }))
      },

      removeDependency: (taskId: string, dependsOnTaskId: string) => {
        set(state => ({
          tasks: state.tasks.map(task => {
            if (task.id === taskId) {
              const dependsOn = task.dependsOn.filter(id => id !== dependsOnTaskId)
              const isBlocked = dependsOn.some(depId => {
                const dep = state.tasks.find(t => t.id === depId)
                return dep && dep.status !== 'completed'
              })
              return { ...task, dependsOn, isBlocked, updatedAt: new Date().toISOString() }
            }
            if (task.id === dependsOnTaskId) {
              const blocks = task.blocks.filter(id => id !== taskId)
              return { ...task, blocks, updatedAt: new Date().toISOString() }
            }
            return task
          })
        }))
      },

      unblockDependentTasks: (completedTaskId: string) => {
        const state = get()
        const completedTask = state.tasks.find(t => t.id === completedTaskId)
        if (!completedTask) return

        set(state => ({
          tasks: state.tasks.map(task => {
            if (completedTask.blocks.includes(task.id)) {
              const allDepsCompleted = task.dependsOn.every(depId => {
                const dep = state.tasks.find(t => t.id === depId)
                return dep && (dep.status === 'completed' || dep.id === completedTaskId)
              })
              if (allDepsCompleted) {
                return { ...task, isBlocked: false, updatedAt: new Date().toISOString() }
              }
            }
            return task
          })
        }))
      },

      // Output actions
      setTaskOutput: (taskId: string, output: TaskOutput) => {
        set(state => ({
          tasks: state.tasks.map(task =>
            task.id === taskId
              ? { ...task, output, updatedAt: new Date().toISOString() }
              : task
          )
        }))
      },

      forwardOutputToTask: (sourceId: string, targetId: string) => {
        const state = get()
        const sourceTask = state.tasks.find(t => t.id === sourceId)
        if (!sourceTask?.output) return

        const forwardedOutput: TaskOutput = {
          ...sourceTask.output,
          forwardedFrom: sourceId
        }

        set(state => ({
          tasks: state.tasks.map(task =>
            task.id === targetId
              ? { ...task, output: forwardedOutput, updatedAt: new Date().toISOString() }
              : task
          )
        }))
      },

      // Bulk data update with deduplication
      setLiveData: (data: { boards: Board[], columns: Column[], tasks: Task[] }) => {
        console.log('🔥 setLiveData called with:', { boards: data.boards.length, columns: data.columns.length, tasks: data.tasks.length })
        
        const state = get()
        
        // AGGRESSIVE MODE: If we have live data, completely replace existing data
        if (data.tasks.length > 0) {
          console.log('🎯 Live data detected - replacing all existing data')
          set({
            boards: data.boards,
            columns: data.columns,
            tasks: data.tasks,
            selectedBoard: data.boards[0]?.id,
            comments: state.comments // Keep existing comments
          })
          console.log('✅ Live data set - selected board:', data.boards[0]?.name)
          return
        }
        
        // Fallback to original deduplication logic
        const existingBoardIds = new Set(state.boards.map(b => b.id))
        const newBoards = data.boards.filter(board => !existingBoardIds.has(board.id))
        const deduplicatedBoards = [...state.boards, ...newBoards]
        
        // Deduplicate columns by ID
        const existingColumnIds = new Set(state.columns.map(c => c.id))
        const newColumns = data.columns.filter(column => !existingColumnIds.has(column.id))
        const deduplicatedColumns = [...state.columns, ...newColumns]
        
        // Deduplicate tasks by ID and OpenClaw task ID to prevent duplicates
        const existingTaskIds = new Set(state.tasks.map(t => t.id))
        const existingOpenClawTaskIds = new Set(
          state.tasks
            .filter(t => t.openclawTaskId)
            .map(t => t.openclawTaskId)
        )
        
        const migrateTask = (task: Task): Task => ({
          ...task,
          dependsOn: task.dependsOn || [],
          blocks: task.blocks || [],
          isBlocked: task.isBlocked || false
        })

        const newTasks = data.tasks.filter(task => {
          // Skip if we already have this exact task ID
          if (existingTaskIds.has(task.id)) return false

          // Skip if we already have this OpenClaw task ID
          if (task.openclawTaskId && existingOpenClawTaskIds.has(task.openclawTaskId)) return false

          return true
        }).map(migrateTask)

        const deduplicatedTasks = [...state.tasks.map(migrateTask), ...newTasks]
        
        // Prioritize the live board over historical board
        const liveBoard = deduplicatedBoards.find(board => !board.isHistorical) || deduplicatedBoards[0]
        const selectedBoardId = liveBoard ? liveBoard.id : (deduplicatedBoards.length > 0 ? deduplicatedBoards[0].id : 'default-board')
        
        // If we have live tasks coming in, switch to the live board
        const hasLiveTasks = newTasks.some(task => task.isAutomated || task.openclawTaskId)
        const shouldSwitchToLiveBoard = hasLiveTasks && liveBoard && liveBoard.id !== state.selectedBoard
        
        set({
          boards: deduplicatedBoards,
          columns: deduplicatedColumns,
          tasks: deduplicatedTasks,
          selectedBoard: shouldSwitchToLiveBoard ? liveBoard.id : (state.selectedBoard || selectedBoardId)
        })
        
        console.log(`🎯 Deduplicated data - Boards: ${deduplicatedBoards.length}, Columns: ${deduplicatedColumns.length}, Tasks: ${deduplicatedTasks.length}`)
        console.log(`🎯 Selected board: ${liveBoard?.name || 'default'} (${selectedBoardId})`)
        
        // Log duplicates that were filtered out
        const filteredTasks = data.tasks.length - newTasks.length
        if (filteredTasks > 0) {
          console.log(`🚫 Filtered out ${filteredTasks} duplicate tasks`)
          
          // Debug: Show what tasks were filtered out
          const filteredTaskTitles = data.tasks
            .filter(task => existingTaskIds.has(task.id) || (task.openclawTaskId && existingOpenClawTaskIds.has(task.openclawTaskId)))
            .map(task => `${task.title} (ID: ${task.id}, OpenClaw: ${task.openclawTaskId})`)
          console.log(`🔍 Filtered tasks:`, filteredTaskTitles)
        }
        
        // Log OpenClaw task mapping for debugging
        const openClawTasks = deduplicatedTasks.filter(t => t.openclawTaskId)
        if (openClawTasks.length > 0) {
          console.log(`🔗 OpenClaw task mapping:`, openClawTasks.map(t => ({
            title: t.title.slice(0, 30) + '...',
            id: t.id,
            openclawTaskId: t.openclawTaskId
          })))
        }
      }
    }),
    {
      name: 'kanban-storage',
      partialize: (state) => ({
        boards: state.boards,
        columns: state.columns,
        tasks: state.tasks,
        comments: state.comments
        // Temporarily exclude selectedBoard to allow live data to set it
      })
    }
  )
)