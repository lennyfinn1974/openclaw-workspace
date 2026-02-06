import React, { useState } from 'react'
import { useKanbanStore } from '@/stores/kanban'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Task } from '@/types'
import { cn } from '@/lib/utils'
import { formatDate, formatTime } from '@/lib/utils'
import {
  Archive,
  Search,
  Calendar,
  Flag,
  RotateCcw,
  Trash2,
  SortDesc,
  SortAsc,
  Filter,
  X
} from 'lucide-react'

interface ArchivedTasksProps {
  isOpen: boolean
  onClose: () => void
}

type SortField = 'title' | 'completedAt' | 'priority' | 'createdAt'
type SortDirection = 'asc' | 'desc'

export function ArchivedTasks({ isOpen, onClose }: ArchivedTasksProps) {
  const { tasks, columns, updateTask, deleteTask } = useKanbanStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('completedAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [filterPriority, setFilterPriority] = useState<string | null>(null)

  // Get archived tasks (completed tasks that are not in the visible "Done" column)
  const doneColumn = columns.find(col => col.name.toLowerCase() === 'done')
  const archivedTasks = tasks.filter(task => 
    task.status === 'archived' || 
    (task.status === 'completed' && task.columnId !== doneColumn?.id)
  )

  // Apply filters and search
  const filteredTasks = archivedTasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesPriority = !filterPriority || task.priority === filterPriority
    return matchesSearch && matchesPriority
  })

  // Apply sorting
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    let aValue: any
    let bValue: any

    switch (sortField) {
      case 'title':
        aValue = a.title.toLowerCase()
        bValue = b.title.toLowerCase()
        break
      case 'completedAt':
      case 'createdAt':
        aValue = new Date(a.updatedAt).getTime()
        bValue = new Date(b.updatedAt).getTime()
        break
      case 'priority':
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 }
        aValue = priorityOrder[a.priority]
        bValue = priorityOrder[b.priority]
        break
      default:
        return 0
    }

    if (sortDirection === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
    }
  })

  const handleRestoreTask = (taskId: string) => {
    const doneColumn = columns.find(col => col.name.toLowerCase() === 'done')
    if (doneColumn) {
      updateTask(taskId, {
        status: 'completed',
        columnId: doneColumn.id
      })
    }
  }

  const handleArchiveTask = (taskId: string) => {
    updateTask(taskId, { status: 'archived' })
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const priorityColors = {
    low: 'bg-priority-low',
    medium: 'bg-priority-medium',
    high: 'bg-priority-high',
    urgent: 'bg-priority-urgent'
  }

  const priorities = ['low', 'medium', 'high', 'urgent']

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background border rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Archive className="h-5 w-5 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold">Archived Tasks</h2>
              <p className="text-sm text-muted-foreground">
                {archivedTasks.length} completed and archived tasks
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Filters and Search */}
        <div className="p-6 border-b bg-muted/20">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search archived tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Priority Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={filterPriority || ''}
                onChange={(e) => setFilterPriority(e.target.value || null)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">All Priorities</option>
                {priorities.map(priority => (
                  <option key={priority} value={priority}>
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sort by:</span>
              <div className="flex gap-1">
                {[
                  { field: 'completedAt' as SortField, label: 'Date' },
                  { field: 'title' as SortField, label: 'Title' },
                  { field: 'priority' as SortField, label: 'Priority' }
                ].map(({ field, label }) => (
                  <Button
                    key={field}
                    variant={sortField === field ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSort(field)}
                    className="flex items-center gap-1"
                  >
                    {label}
                    {sortField === field && (
                      sortDirection === 'desc' ? 
                        <SortDesc className="h-3 w-3" /> : 
                        <SortAsc className="h-3 w-3" />
                    )}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Active Filters Display */}
          {(searchQuery || filterPriority) && (
            <div className="flex items-center gap-2 mt-4">
              <span className="text-sm text-muted-foreground">Active filters:</span>
              {searchQuery && (
                <Badge variant="secondary" className="gap-1">
                  Search: "{searchQuery}"
                  <button onClick={() => setSearchQuery('')}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {filterPriority && (
                <Badge variant="secondary" className="gap-1">
                  Priority: {filterPriority}
                  <button onClick={() => setFilterPriority(null)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('')
                  setFilterPriority(null)
                }}
                className="text-xs"
              >
                Clear All
              </Button>
            </div>
          )}
        </div>

        {/* Tasks List */}
        <div className="flex-1 overflow-auto p-6">
          {sortedTasks.length > 0 ? (
            <div className="space-y-3">
              {sortedTasks.map((task) => (
                <Card key={task.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium line-clamp-1">{task.title}</h3>
                          <div className={cn(
                            'flex items-center gap-1 rounded-full px-2 py-0.5',
                            priorityColors[task.priority]
                          )}>
                            <Flag className="h-3 w-3 text-white" />
                            <span className="text-xs font-medium text-white capitalize">
                              {task.priority}
                            </span>
                          </div>
                        </div>
                        
                        {task.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Completed: {formatDate(task.updatedAt)}
                          </div>
                          {task.dueDate && (
                            <div className="flex items-center gap-1">
                              <Flag className="h-3 w-3" />
                              Due: {formatDate(task.dueDate)}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            ID: {task.id.slice(-6)}
                          </div>
                        </div>

                        {task.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {task.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestoreTask(task.id)}
                          className="flex items-center gap-1"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Restore
                        </Button>
                        
                        {task.status !== 'archived' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleArchiveTask(task.id)}
                            className="flex items-center gap-1 text-muted-foreground"
                          >
                            <Archive className="h-3 w-3" />
                            Archive
                          </Button>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTask(task.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : archivedTasks.length === 0 ? (
            <div className="text-center py-12">
              <Archive className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Archived Tasks</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Completed tasks will appear here when archived
              </p>
              <p className="text-xs text-muted-foreground">
                Complete some tasks to see them in the archive
              </p>
            </div>
          ) : (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Tasks Found</h3>
              <p className="text-muted-foreground text-sm mb-4">
                No archived tasks match your current filters
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('')
                  setFilterPriority(null)
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>

        {/* Footer Stats */}
        <div className="border-t p-4 bg-muted/20">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              Showing {sortedTasks.length} of {archivedTasks.length} archived tasks
            </div>
            <div className="flex items-center gap-4">
              {priorities.map(priority => {
                const count = archivedTasks.filter(t => t.priority === priority).length
                return (
                  <div key={priority} className="flex items-center gap-1">
                    <div className={cn('w-2 h-2 rounded-full', priorityColors[priority])} />
                    <span className="capitalize">{priority}: {count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}