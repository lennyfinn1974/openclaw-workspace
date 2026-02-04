import React, { useState, useCallback, useEffect } from 'react'
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd'
import { useKanbanStore } from '@/stores/kanban'
import { useOpenClawStore } from '@/stores/openclaw'
import { useNexusStore } from '@/stores/nexus'
import { useActivityStore, activityHelpers } from '@/stores/activity'
import { TaskDetailModal } from './TaskDetailModal'
import { ArchivedTasks } from './ArchivedTasks'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Plus,
  MoreHorizontal,
  Calendar,
  GripVertical,
  Loader2,
  Trash2,
  Flag,
  MessageSquare,
  Zap,
  Activity,
  Archive,
  Eye,
  ChevronRight,
  Brain
} from 'lucide-react'
import { Task, Column } from '@/types'

const columnColors: Record<string, string> = {
  'To Do': 'bg-column-todo',
  'In Progress': 'bg-column-progress',
  'Review': 'bg-column-review',
  'Done': 'bg-column-done',
}

const priorityColors: Record<string, string> = {
  low: 'bg-priority-low',
  medium: 'bg-priority-medium',
  high: 'bg-priority-high',
  urgent: 'bg-priority-urgent',
}

export function KanbanBoard() {
  const {
    boards,
    columns,
    tasks,
    selectedBoard,
    selectedTask,
    isLoading,
    createTask,
    updateTask,
    deleteTask,
    moveTask,
    setSelectedTask,
    getCompletedTasks,
    archiveOldCompletedTasks,
  } = useKanbanStore()

  const { agents, isConnected } = useOpenClawStore()
  const { isConnected: isNexusConnected } = useNexusStore()
  const { addActivity } = useActivityStore()

  const [addingToColumn, setAddingToColumn] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [showTaskDetail, setShowTaskDetail] = useState<string | null>(null)
  const [showArchivedTasks, setShowArchivedTasks] = useState(false)

  const board = boards.find(b => b.id === selectedBoard)
  const boardColumns = columns
    .filter(col => col.boardId === selectedBoard)
    .sort((a, b) => a.position - b.position)
  const boardTasks = tasks.filter(task => 
    task.boardId === selectedBoard && task.status !== 'archived'
  )

  // Auto-archive completed tasks when Done column gets too full
  useEffect(() => {
    const doneColumn = boardColumns.find(col => col.name.toLowerCase() === 'done')
    if (doneColumn) {
      const completedTasks = boardTasks.filter(t => t.columnId === doneColumn.id)
      if (completedTasks.length > 10) {
        archiveOldCompletedTasks(doneColumn.id, 10)
      }
    }
  }, [boardTasks, boardColumns, archiveOldCompletedTasks])

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return

    const { draggableId, destination, source } = result
    const task = boardTasks.find(t => t.id === draggableId)
    const sourceColumn = boardColumns.find(col => col.id === source.droppableId)
    const destColumn = boardColumns.find(col => col.id === destination.droppableId)
    
    if (task && sourceColumn && destColumn) {
      // Add activity for task movement
      if (sourceColumn.id !== destColumn.id) {
        addActivity(activityHelpers.taskMoved(
          task.title,
          sourceColumn.name,
          destColumn.name
        ))
      }
      
      moveTask(draggableId, destination.droppableId, destination.index)
    }
  }, [moveTask, boardTasks, boardColumns, addActivity])

  const handleAddTask = useCallback(async (columnId: string) => {
    if (!newTaskTitle.trim()) return

    createTask(columnId, newTaskTitle.trim())
    
    // Add activity
    addActivity(activityHelpers.taskCreated(newTaskTitle.trim()))
    
    setNewTaskTitle('')
    setAddingToColumn(null)
  }, [createTask, newTaskTitle, addActivity])

  const handleTaskUpdate = useCallback((taskId: string, updates: Partial<Task>) => {
    const task = boardTasks.find(t => t.id === taskId)
    if (!task) return

    updateTask(taskId, updates)

    // Add activity for significant updates
    if (updates.title && updates.title !== task.title) {
      addActivity(activityHelpers.taskUpdated(task.title, 'title', task.title, updates.title))
    }
    if (updates.priority && updates.priority !== task.priority) {
      addActivity(activityHelpers.taskUpdated(task.title, 'priority', task.priority, updates.priority))
    }
  }, [updateTask, boardTasks, addActivity])

  const handleTaskClick = useCallback((task: Task) => {
    setShowTaskDetail(task.id)
  }, [])

  const handleDeleteTask = useCallback((taskId: string) => {
    const task = boardTasks.find(t => t.id === taskId)
    if (task) {
      deleteTask(taskId)
      addActivity(activityHelpers.taskArchived(task.title))
    }
  }, [deleteTask, boardTasks, addActivity])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!board) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Board not found
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Board Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{board.name}</h1>
            {isConnected && (
              <Badge variant="default" className="flex items-center gap-1 bg-blue-500 hover:bg-blue-600">
                <Zap className="h-3 w-3" />
                Aries Connected
              </Badge>
            )}
            {isNexusConnected && (
              <Badge variant="default" className="flex items-center gap-1 bg-purple-500 hover:bg-purple-600">
                <Brain className="h-3 w-3" />
                Nexus Connected
              </Badge>
            )}
          </div>
          {board.description && (
            <p className="text-sm text-muted-foreground">{board.description}</p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Archived Tasks Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowArchivedTasks(true)}
            className="flex items-center gap-2"
          >
            <Archive className="h-4 w-4" />
            Archived Tasks
          </Button>
          
          {/* Active Agents Counter */}
          {isConnected && agents.length > 0 && (
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-openclaw-primary" />
              <span className="text-sm text-muted-foreground">
                {agents.filter(a => a.status === 'active').length} active agents
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="flex-1 overflow-x-auto p-6">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 h-full">
            {boardColumns.map((column) => {
              const columnTasks = boardTasks
                .filter(t => t.columnId === column.id)
                .sort((a, b) => a.position - b.position)

              return (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  tasks={columnTasks}
                  isAddingTask={addingToColumn === column.id}
                  newTaskTitle={newTaskTitle}
                  onStartAddTask={() => setAddingToColumn(column.id)}
                  onCancelAddTask={() => {
                    setAddingToColumn(null)
                    setNewTaskTitle('')
                  }}
                  onNewTaskTitleChange={setNewTaskTitle}
                  onAddTask={() => handleAddTask(column.id)}
                  onTaskClick={handleTaskClick}
                  onDeleteTask={handleDeleteTask}
                  isOpenClawConnected={isConnected}
                  isNexusConnected={isNexusConnected}
                />
              )
            })}
          </div>
        </DragDropContext>
      </div>

      {/* Task Detail Modal */}
      {showTaskDetail && (
        <TaskDetailModal
          taskId={showTaskDetail}
          isOpen={true}
          onClose={() => setShowTaskDetail(null)}
        />
      )}

      {/* Archived Tasks Modal */}
      <ArchivedTasks
        isOpen={showArchivedTasks}
        onClose={() => setShowArchivedTasks(false)}
      />
    </div>
  )
}

interface KanbanColumnProps {
  column: Column
  tasks: Task[]
  isAddingTask: boolean
  newTaskTitle: string
  onStartAddTask: () => void
  onCancelAddTask: () => void
  onNewTaskTitleChange: (value: string) => void
  onAddTask: () => void
  onTaskClick: (task: Task) => void
  onDeleteTask: (taskId: string) => void
  isOpenClawConnected: boolean
  isNexusConnected: boolean
}

function KanbanColumn({
  column,
  tasks,
  isAddingTask,
  newTaskTitle,
  onStartAddTask,
  onCancelAddTask,
  onNewTaskTitleChange,
  onAddTask,
  onTaskClick,
  onDeleteTask,
  isOpenClawConnected,
  isNexusConnected,
}: KanbanColumnProps) {
  const bgColor = columnColors[column.name] || 'bg-secondary'
  const ariesTasks = tasks.filter(t => t.isAutomated && t.openclawTaskId)
  const nexusTasks = tasks.filter(t => t.isAutomated && t.nexusTaskId)
  const isDoneColumn = column.name.toLowerCase() === 'done'

  return (
    <div className="flex w-72 flex-shrink-0 flex-col rounded-lg">
      {/* Column Header */}
      <div
        className={cn(
          'flex items-center justify-between rounded-t-lg px-3 py-2',
          bgColor
        )}
      >
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{column.name}</h3>
          <Badge variant="secondary" className="rounded-full text-xs">
            {tasks.length}
          </Badge>
          {ariesTasks.length > 0 && isOpenClawConnected && (
            <Badge variant="default" className="rounded-full text-xs flex items-center gap-1 bg-blue-500 hover:bg-blue-600">
              <Zap className="h-3 w-3" />
              {ariesTasks.length}
            </Badge>
          )}
          {nexusTasks.length > 0 && isNexusConnected && (
            <Badge variant="default" className="rounded-full text-xs flex items-center gap-1 bg-purple-500 hover:bg-purple-600">
              <Brain className="h-3 w-3" />
              {nexusTasks.length}
            </Badge>
          )}
          {isDoneColumn && tasks.length >= 8 && (
            <Badge variant="warning" className="rounded-full text-xs" title="Column getting full">
              ⚠️
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onStartAddTask}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Tasks Drop Zone */}
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              'flex-1 space-y-2 rounded-b-lg p-2 transition-colors min-h-[200px]',
              bgColor,
              snapshot.isDraggingOver && 'bg-primary/10'
            )}
          >
            {tasks.map((task, index) => (
              <Draggable key={task.id} draggableId={task.id} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={cn(
                      snapshot.isDragging && 'kanban-card-dragging'
                    )}
                  >
                    <TaskCard
                      task={task}
                      dragHandleProps={provided.dragHandleProps}
                      onClick={() => onTaskClick(task)}
                      onDelete={() => onDeleteTask(task.id)}
                      isOpenClawConnected={isConnected}
                      isNexusConnected={isNexusConnected}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}

            {/* Add Task Form */}
            {isAddingTask && (
              <Card className="p-2">
                <Input
                  placeholder="Task title..."
                  value={newTaskTitle}
                  onChange={(e) => onNewTaskTitleChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onAddTask()
                    if (e.key === 'Escape') onCancelAddTask()
                  }}
                  autoFocus
                />
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={onAddTask}>
                    Add
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onCancelAddTask}>
                    Cancel
                  </Button>
                </div>
              </Card>
            )}

            {/* Done Column Footer - Show Archive Option */}
            {isDoneColumn && tasks.length > 8 && (
              <div className="mt-2 p-2 rounded border border-warning/20 bg-warning/5">
                <p className="text-xs text-muted-foreground text-center mb-2">
                  Column getting full ({tasks.length}/10)
                </p>
                <p className="text-xs text-muted-foreground text-center">
                  Older completed tasks will be auto-archived
                </p>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  )
}

interface TaskCardProps {
  task: Task
  dragHandleProps: any
  onClick: () => void
  onDelete: () => void
  isOpenClawConnected: boolean
  isNexusConnected: boolean
}

function TaskCard({ 
  task, 
  dragHandleProps, 
  onClick,
  onDelete,
  isOpenClawConnected,
  isNexusConnected 
}: TaskCardProps) {
  const priorityColor = priorityColors[task.priority]
  const isAriesTask = task.isAutomated && task.openclawTaskId
  const isNexusTask = task.isAutomated && task.nexusTaskId

  return (
    <Card 
      className={cn(
        "group cursor-pointer bg-card p-3 shadow-soft hover:shadow-elevated transition-all duration-200",
        isAriesTask && isOpenClawConnected && "border-blue-300/50 bg-blue-50/30 dark:border-blue-700/50 dark:bg-blue-950/30",
        isNexusTask && isNexusConnected && "border-purple-300/50 bg-purple-50/30 dark:border-purple-700/50 dark:bg-purple-950/30",
        "hover:scale-[1.02]"
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <div
          {...dragHandleProps}
          className="mt-1 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium leading-snug flex-1">{task.title}</p>
            <div className="flex items-center gap-1 flex-shrink-0">
              {isAriesTask && isOpenClawConnected && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50">
                  <Zap className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Aries</span>
                </div>
              )}
              {isNexusTask && isNexusConnected && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50">
                  <Brain className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">Nexus</span>
                </div>
              )}
              <Eye className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {task.description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {task.description}
            </p>
          )}

          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {/* Priority */}
            <div
              className={cn(
                'flex items-center gap-1 rounded-full px-2 py-0.5',
                priorityColor
              )}
            >
              <Flag className="h-3 w-3 text-white" />
              <span className="text-[10px] font-medium text-white capitalize">
                {task.priority}
              </span>
            </div>

            {/* Due Date */}
            {task.dueDate && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {new Date(task.dueDate).toLocaleDateString()}
              </div>
            )}

            {/* Tags */}
            {task.tags.slice(0, 2).map(tag => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {task.tags.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{task.tags.length - 2}
              </Badge>
            )}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </div>
    </Card>
  )
}