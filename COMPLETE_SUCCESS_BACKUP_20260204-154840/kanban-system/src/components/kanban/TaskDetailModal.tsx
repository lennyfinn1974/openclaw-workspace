import React, { useState, useEffect } from 'react'
import { useKanbanStore } from '@/stores/kanban'
import { useActivityStore, getActivityIcon, getActivityColor } from '@/stores/activity'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Task } from '@/types'
import { cn } from '@/lib/utils'
import { formatDate, formatTime } from '@/lib/utils'
import { ArtifactViewer } from './ArtifactViewer'
import {
  X,
  Edit3,
  Save,
  MessageSquare,
  History,
  Paperclip,
  Flag,
  Calendar,
  User,
  Zap,
  ChevronRight,
  Plus,
  Trash2,
  Clock,
  Eye,
  Terminal,
  Lock,
  ArrowDown,
  ArrowUp,
} from 'lucide-react'

interface TaskDetailModalProps {
  taskId: string
  isOpen: boolean
  onClose: () => void
}

type TabType = 'details' | 'comments' | 'history' | 'attachments' | 'output'

export function TaskDetailModal({ taskId, isOpen, onClose }: TaskDetailModalProps) {
  const { tasks, comments, updateTask, addComment, deleteComment, addDependency, removeDependency, forwardOutputToTask } = useKanbanStore()
  const { getTaskActivities } = useActivityStore()
  
  const [activeTab, setActiveTab] = useState<TabType>('details')
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Partial<Task>>({})
  const [newComment, setNewComment] = useState('')

  const task = tasks.find(t => t.id === taskId)
  const taskComments = comments.filter(c => c.taskId === taskId)
  const taskHistory = getTaskActivities(taskId)

  useEffect(() => {
    if (task) {
      setEditData({
        title: task.title,
        description: task.description || '',
        priority: task.priority,
        dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
        tags: task.tags.join(', ')
      })
    }
  }, [task])

  // Reset editing state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false)
      setActiveTab('details')
    }
  }, [isOpen])

  if (!isOpen || !task) return null

  const handleSave = () => {
    const updates: Partial<Task> = {
      ...editData,
      dueDate: editData.dueDate ? new Date(editData.dueDate).toISOString() : undefined,
      tags: editData.tags ? editData.tags.split(',').map(tag => tag.trim()).filter(Boolean) : []
    }
    
    updateTask(taskId, updates)
    setIsEditing(false)
  }

  const handleAddComment = () => {
    if (!newComment.trim()) return
    
    addComment(taskId, newComment.trim(), 'You')
    setNewComment('')
  }

  const priorityColors = {
    low: 'bg-priority-low',
    medium: 'bg-priority-medium', 
    high: 'bg-priority-high',
    urgent: 'bg-priority-urgent'
  }

  const tabs = [
    { id: 'details' as TabType, label: 'Details', icon: Edit3, count: null },
    { id: 'comments' as TabType, label: 'Comments', icon: MessageSquare, count: taskComments.length },
    { id: 'output' as TabType, label: 'Agent Output', icon: Terminal, count: task?.output ? 1 : 0 },
    { id: 'history' as TabType, label: 'History', icon: History, count: taskHistory.length },
    { id: 'attachments' as TabType, label: 'Attachments', icon: Paperclip, count: 0 }
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background border rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col m-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-3 h-3 rounded-full',
              task.isAutomated ? 'bg-openclaw-primary animate-pulse' : 'bg-muted'
            )} />
            <div>
              <h2 className="text-lg font-semibold line-clamp-1">
                {isEditing ? (
                  <Input
                    value={editData.title}
                    onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                    className="text-lg font-semibold -mt-1"
                  />
                ) : (
                  task.title
                )}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  ID: {task.id.slice(-6)}
                </Badge>
                {task.isAutomated && (
                  <Badge variant="openclaw" className="text-xs flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    Automated
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button variant="default" size="sm" onClick={handleSave}>
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit3 className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b">
          <nav className="flex px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {tab.count !== null && tab.count > 0 && (
                    <Badge variant="secondary" className="text-xs ml-1">
                      {tab.count}
                    </Badge>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="p-6 space-y-6">
              {/* Task Metadata */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Priority</label>
                  <div className="mt-1">
                    {isEditing ? (
                      <select
                        value={editData.priority}
                        onChange={(e) => setEditData({ ...editData, priority: e.target.value as any })}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    ) : (
                      <div className={cn(
                        'flex items-center gap-2 rounded-full px-3 py-1 w-fit',
                        priorityColors[task.priority]
                      )}>
                        <Flag className="h-3 w-3 text-white" />
                        <span className="text-xs font-medium text-white capitalize">
                          {task.priority}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Due Date</label>
                  <div className="mt-1">
                    {isEditing ? (
                      <Input
                        type="date"
                        value={editData.dueDate}
                        onChange={(e) => setEditData({ ...editData, dueDate: e.target.value })}
                      />
                    ) : task.dueDate ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {formatDate(task.dueDate)}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">No due date</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created</label>
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {formatDate(task.createdAt)}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Updated</label>
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <Edit3 className="h-4 w-4 text-muted-foreground" />
                    {formatTime(task.updatedAt)}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <div className="mt-2">
                  {isEditing ? (
                    <Textarea
                      value={editData.description}
                      onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                      rows={4}
                      placeholder="Add a description..."
                    />
                  ) : task.description ? (
                    <p className="text-sm leading-relaxed p-3 bg-muted/50 rounded-md">
                      {task.description}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No description provided</p>
                  )}
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">Tags</label>
                <div className="mt-2">
                  {isEditing ? (
                    <Input
                      value={editData.tags}
                      onChange={(e) => setEditData({ ...editData, tags: e.target.value })}
                      placeholder="Enter tags separated by commas"
                    />
                  ) : task.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {task.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No tags assigned</p>
                  )}
                </div>
              </div>

              {/* Dependencies */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">Dependencies</label>
                <div className="mt-2 space-y-3">
                  {/* Depends On */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <ArrowDown className="h-3.5 w-3.5 text-blue-500" />
                      <span className="text-xs font-medium">Depends On ({task.dependsOn?.length || 0})</span>
                    </div>
                    {task.dependsOn?.length > 0 ? (
                      <div className="space-y-1">
                        {task.dependsOn.map(depId => {
                          const depTask = tasks.find(t => t.id === depId)
                          return depTask ? (
                            <div key={depId} className="flex items-center justify-between p-2 rounded border text-sm">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  'w-2 h-2 rounded-full',
                                  depTask.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'
                                )} />
                                <span className="truncate">{depTask.title}</span>
                              </div>
                              {isEditing && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 shrink-0"
                                  onClick={() => removeDependency(task.id, depId)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          ) : null
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No upstream dependencies</p>
                    )}
                  </div>

                  {/* Blocks */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <ArrowUp className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-xs font-medium">Blocks ({task.blocks?.length || 0})</span>
                    </div>
                    {task.blocks?.length > 0 ? (
                      <div className="space-y-1">
                        {task.blocks.map(blockId => {
                          const blockedTask = tasks.find(t => t.id === blockId)
                          return blockedTask ? (
                            <div key={blockId} className="flex items-center gap-2 p-2 rounded border text-sm">
                              <div className={cn(
                                'w-2 h-2 rounded-full',
                                blockedTask.isBlocked ? 'bg-red-500' : 'bg-green-500'
                              )} />
                              <span className="truncate">{blockedTask.title}</span>
                              {blockedTask.isBlocked && (
                                <Lock className="h-3 w-3 text-red-500 shrink-0" />
                              )}
                            </div>
                          ) : null
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No downstream tasks blocked</p>
                    )}
                  </div>

                  {/* Add Dependency (edit mode) */}
                  {isEditing && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Add Dependency</label>
                      <select
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            addDependency(task.id, e.target.value)
                          }
                        }}
                      >
                        <option value="">Select a task...</option>
                        {tasks
                          .filter(t => t.id !== task.id && !task.dependsOn?.includes(t.id) && t.status !== 'archived')
                          .map(t => (
                            <option key={t.id} value={t.id}>{t.title}</option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Comments Tab */}
          {activeTab === 'comments' && (
            <div className="p-6 space-y-4">
              {/* Add Comment */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Textarea
                        placeholder="Add a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        rows={3}
                      />
                      <div className="flex justify-end">
                        <Button 
                          onClick={handleAddComment}
                          disabled={!newComment.trim()}
                          size="sm"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Comment
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Comments List */}
              {taskComments.length > 0 ? (
                <div className="space-y-3">
                  {taskComments.map((comment) => (
                    <Card key={comment.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-sm font-medium">
                            {comment.authorName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{comment.authorName}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatTime(comment.createdAt)}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteComment(comment.id)}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            <p className="text-sm leading-relaxed">{comment.content}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-sm text-muted-foreground">No comments yet</p>
                  <p className="text-xs text-muted-foreground">Be the first to add a comment</p>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="p-6">
              {taskHistory.length > 0 ? (
                <div className="space-y-3">
                  {taskHistory.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg border">
                      <span className="text-sm mt-1">{getActivityIcon(activity.type)}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{activity.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(activity.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{activity.description}</p>
                        {activity.metadata && (
                          <div className="mt-1">
                            {activity.metadata.from && activity.metadata.to && (
                              <Badge variant="outline" className="text-xs">
                                {activity.metadata.from} → {activity.metadata.to}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <History className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-sm text-muted-foreground">No activity history</p>
                  <p className="text-xs text-muted-foreground">Task activity will appear here</p>
                </div>
              )}
            </div>
          )}

          {/* Agent Output Tab */}
          {activeTab === 'output' && (
            <div className="p-6 space-y-4">
              {task.output ? (
                <>
                  {/* Summary */}
                  {task.output.summary && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Summary</label>
                      <p className="mt-1 text-sm leading-relaxed p-3 bg-muted/50 rounded-md">
                        {task.output.summary}
                      </p>
                    </div>
                  )}

                  {/* Forwarded From */}
                  {task.output.forwardedFrom && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        Forwarded from task {task.output.forwardedFrom.slice(-6)}
                      </Badge>
                    </div>
                  )}

                  {/* Artifacts */}
                  {task.output.artifacts.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-2 block">
                        Artifacts ({task.output.artifacts.length})
                      </label>
                      <div className="space-y-2">
                        {task.output.artifacts.map((artifact, i) => (
                          <ArtifactViewer key={i} artifact={artifact} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Logs */}
                  {task.output.logs.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground mb-2 block">
                        Logs ({task.output.logs.length})
                      </label>
                      <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs max-h-64 overflow-auto">
                        {task.output.logs.map((log, i) => (
                          <div key={i} className="whitespace-pre-wrap mb-1">{log}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Forward Output */}
                  {task.blocks && task.blocks.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Forward Output</label>
                      <select
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            forwardOutputToTask(task.id, e.target.value)
                          }
                        }}
                      >
                        <option value="">Forward to downstream task...</option>
                        {task.blocks.map(blockId => {
                          const blockedTask = tasks.find(t => t.id === blockId)
                          return blockedTask ? (
                            <option key={blockId} value={blockId}>{blockedTask.title}</option>
                          ) : null
                        })}
                      </select>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                    {task.output.agentId && (
                      <span>Agent: {task.output.agentId}</span>
                    )}
                    {task.output.completedAt && (
                      <span>Completed: {formatTime(task.output.completedAt)}</span>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Terminal className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-sm text-muted-foreground">No agent output yet</p>
                  <p className="text-xs text-muted-foreground">Agent output will appear here when tasks are completed</p>
                </div>
              )}
            </div>
          )}

          {/* Attachments Tab */}
          {activeTab === 'attachments' && (
            <div className="p-6">
              <div className="text-center py-8">
                <Paperclip className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground">Attachments coming soon</p>
                <p className="text-xs text-muted-foreground">File uploads will be available in a future update</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}