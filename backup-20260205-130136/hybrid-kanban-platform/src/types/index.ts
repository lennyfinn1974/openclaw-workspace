// Core Kanban types
export interface Board {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
}

export interface Column {
  id: string
  boardId: string
  name: string
  position: number
  color?: string
  createdAt: string
  updatedAt: string
}

export interface Task {
  id: string
  columnId: string
  boardId: string
  title: string
  description?: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'active' | 'completed' | 'archived'
  assigneeId?: string
  dueDate?: string
  position: number
  tags: string[]
  createdAt: string
  updatedAt: string
  // OpenClaw specific fields
  openclawTaskId?: string
  isAutomated?: boolean
  webhookUrl?: string
  // Nexus specific fields
  nexusTaskId?: string
  nexusCommand?: string
  // Dependencies (Feature 1)
  dependsOn: string[]
  blocks: string[]
  parentTaskId?: string
  isBlocked?: boolean
  // Agent output (Feature 2)
  output?: TaskOutput
}

export interface TaskArtifact {
  type: 'code' | 'file' | 'log' | 'report' | 'config'
  name: string
  content: string
  language?: string
  createdAt: string
}

export interface TaskOutput {
  summary?: string
  artifacts: TaskArtifact[]
  logs: string[]
  completedAt?: string
  agentId?: string
  forwardedFrom?: string
}

export interface Comment {
  id: string
  taskId: string
  content: string
  authorId: string
  authorName: string
  createdAt: string
  updatedAt: string
}

// OpenClaw integration types
export interface OpenClawAgent {
  id: string
  sessionId: string
  label: string
  status: 'active' | 'completed' | 'failed' | 'paused'
  startTime: string
  endTime?: string
  parentSessionId?: string
  model: string
  tokensUsed?: number
  lastActivity: string
}

export interface OpenClawWebhook {
  id: string
  url: string
  events: OpenClawWebhookEvent[]
  isActive: boolean
  createdAt: string
}

export type OpenClawWebhookEvent = 
  | 'agent.created'
  | 'agent.started'
  | 'agent.completed'
  | 'agent.failed'
  | 'agent.paused'
  | 'task.created'
  | 'task.updated'
  | 'task.completed'

export interface OpenClawTaskEvent {
  type: OpenClawWebhookEvent
  agentId: string
  sessionId: string
  taskId?: string
  data: any
  timestamp: string
}

// UI State types
export interface KanbanState {
  boards: Board[]
  columns: Column[]
  tasks: Task[]
  comments: Comment[]
  selectedBoard?: string
  selectedTask?: string
  isLoading: boolean
  error?: string
}

export interface OpenClawState {
  agents: OpenClawAgent[]
  webhooks: OpenClawWebhook[]
  isConnected: boolean
  isConnecting: boolean
  lastSyncTime?: string
  error?: string
}

// Nexus integration types
export interface NexusAgent {
  id: string
  sessionId: string
  label: string
  status: 'active' | 'completed' | 'failed' | 'paused'
  startTime: string
  endTime?: string
  parentSessionId?: string
  model: string
  tokensUsed?: number
  lastActivity: string
  command: string // e.g., "/learn", "research", "skill_development"
  taskType: 'learn' | 'research' | 'skill' | 'general'
  currentTask?: string // What the agent is currently working on
  progress?: number // Progress percentage (0-100)
}

export interface NexusWebhook {
  id: string
  url: string
  events: NexusWebhookEvent[]
  isActive: boolean
  createdAt: string
}

export type NexusWebhookEvent = 
  | 'agent.created'
  | 'agent.started'
  | 'agent.completed'
  | 'agent.failed'
  | 'agent.paused'
  | 'research.started'
  | 'research.progress'
  | 'research.completed'
  | 'learn.started'
  | 'learn.progress'
  | 'learn.completed'
  | 'skill.development'
  | 'task.created'
  | 'task.updated'
  | 'task.completed'

export interface NexusTaskEvent {
  type: NexusWebhookEvent
  agentId: string
  sessionId: string
  taskId?: string
  data: any
  timestamp: string
}

export interface NexusActivities {
  research_tasks: ResearchTask[]
  learn_commands: LearnCommand[]
  skill_developments: SkillDevelopment[]
}

export interface ResearchTask {
  id: string
  topic: string
  status: 'active' | 'completed' | 'failed'
  progress: number
  agentId: string
  startedAt: string
  completedAt?: string
}

export interface LearnCommand {
  id: string
  topic: string
  progress: number
  agentId: string
  startedAt: string
  completedAt?: string
}

export interface SkillDevelopment {
  id: string
  skill: string
  status: 'in_progress' | 'completed' | 'failed'
  progress: number
  agentId: string
  startedAt: string
  completedAt?: string
}

export interface NexusState {
  agents: NexusAgent[]
  activities: NexusActivities
  webhooks: NexusWebhook[]
  isConnected: boolean
  lastSyncTime?: string
  error?: string
}

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasNext: boolean
  hasPrev: boolean
}

// Drag and Drop types
export interface DragResult {
  draggableId: string
  type: string
  source: {
    droppableId: string
    index: number
  }
  destination?: {
    droppableId: string
    index: number
  }
}

export interface DropdownItem {
  id: string
  label: string
  icon?: string
  action: () => void
  destructive?: boolean
}

// Automation types (Feature 3)
export type AutomationTriggerEvent =
  | 'task.moved'
  | 'task.completed'
  | 'task.created'
  | 'task.unblocked'
  | 'webhook.received'
  | 'output.received'

export interface AutomationCondition {
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than'
  value: string
}

export type AutomationActionType =
  | 'move_task'
  | 'create_task'
  | 'send_webhook'
  | 'change_priority'
  | 'add_tag'
  | 'forward_output'
  | 'unblock_dependents'

export interface AutomationActionConfig {
  type: AutomationActionType
  config: Record<string, any>
}

export interface AutomationRule {
  id: string
  name: string
  description?: string
  trigger: {
    event: AutomationTriggerEvent
    conditions: AutomationCondition[]
  }
  actions: AutomationActionConfig[]
  enabled: boolean
  createdAt: string
  updatedAt: string
  lastTriggeredAt?: string
  triggerCount: number
}

export interface AutomationLogEntry {
  id: string
  ruleId: string
  ruleName: string
  triggerEvent: AutomationTriggerEvent
  taskId?: string
  taskTitle?: string
  actionsExecuted: string[]
  success: boolean
  error?: string
  timestamp: string
}