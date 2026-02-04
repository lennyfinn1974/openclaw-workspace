import { useActivityStore, activityHelpers } from '@/stores/activity'
import { useKanbanStore } from '@/stores/kanban'

// Function to populate sample activity data
export const populateSampleActivity = () => {
  const { addActivity } = useActivityStore.getState()
  const { tasks } = useKanbanStore.getState()

  // Generate some sample activities
  const sampleActivities = [
    activityHelpers.taskCreated("Design new dashboard layout", "Lenny"),
    activityHelpers.taskCreated("Implement user authentication", "Sarah"),
    activityHelpers.taskMoved("Fix header navigation", "To Do", "In Progress", "Mike"),
    activityHelpers.taskUpdated("Add search functionality", "priority", "medium", "high", "Lenny"),
    activityHelpers.taskCompleted("Setup development environment", "Sarah"),
    activityHelpers.commentAdded("Review code implementation", "Mike"),
    activityHelpers.openclawSync("Dashboard Enhancement Agent", "completed"),
    activityHelpers.openclawSync("Data Processing Agent", "started"),
    activityHelpers.taskCreated("Update documentation", "Lenny"),
    activityHelpers.taskMoved("Fix responsive layout", "In Progress", "Review", "Sarah"),
    activityHelpers.taskArchived("Old migration script", "System"),
    activityHelpers.taskUpdated("Optimize database queries", "description", "", "Added indexing strategy", "Mike"),
    activityHelpers.commentAdded("Looks good, approved for merge", "Lenny"),
    activityHelpers.taskCompleted("Setup CI/CD pipeline", "Sarah"),
    activityHelpers.openclawSync("Code Review Agent", "completed")
  ]

  // Add activities with realistic timestamps (spread over last 24 hours)
  sampleActivities.forEach((activity, index) => {
    const now = new Date()
    const hoursAgo = Math.floor(index * 1.5) // Spread activities over time
    const timestamp = new Date(now.getTime() - (hoursAgo * 60 * 60 * 1000)).toISOString()
    
    addActivity({
      ...activity,
      timestamp
    })
  })
}

// Function to create sample tasks with realistic data
export const populateSampleTasks = () => {
  const { createTask, updateTask, columns, tasks } = useKanbanStore.getState()
  
  // Don't populate if tasks already exist
  if (tasks.length > 0) return

  const todoColumn = columns.find(col => col.name === 'To Do')
  const progressColumn = columns.find(col => col.name === 'In Progress')
  const reviewColumn = columns.find(col => col.name === 'Review')
  const doneColumn = columns.find(col => col.name === 'Done')

  if (!todoColumn || !progressColumn || !reviewColumn || !doneColumn) return

  // Sample tasks for each column
  const sampleTasks = [
    // To Do
    {
      columnId: todoColumn.id,
      title: "Implement dark mode toggle",
      description: "Add a toggle button to switch between light and dark themes",
      priority: "medium" as const,
      tags: ["ui", "feature"]
    },
    {
      columnId: todoColumn.id,
      title: "Add export functionality",
      description: "Allow users to export their Kanban boards to JSON/CSV formats",
      priority: "low" as const,
      tags: ["feature", "export"]
    },
    {
      columnId: todoColumn.id,
      title: "Performance optimization",
      description: "Optimize the drag and drop performance for large boards",
      priority: "high" as const,
      tags: ["performance", "bug"]
    },

    // In Progress
    {
      columnId: progressColumn.id,
      title: "OpenClaw webhook integration",
      description: "Implement real-time webhook handling for OpenClaw events",
      priority: "urgent" as const,
      tags: ["integration", "openclaw"],
      isAutomated: true
    },
    {
      columnId: progressColumn.id,
      title: "Enhanced task details modal",
      description: "Add tabs for comments, history, and attachments",
      priority: "high" as const,
      tags: ["ui", "enhancement"]
    },

    // Review
    {
      columnId: reviewColumn.id,
      title: "Activity tracking system",
      description: "Track all user actions and display in activity feed",
      priority: "medium" as const,
      tags: ["feature", "tracking"]
    },
    {
      columnId: reviewColumn.id,
      title: "Archive management",
      description: "Implement archived tasks view and management",
      priority: "medium" as const,
      tags: ["feature", "archive"]
    },

    // Done
    {
      columnId: doneColumn.id,
      title: "Setup project structure",
      description: "Initialize React project with TypeScript and Tailwind",
      priority: "high" as const,
      tags: ["setup", "foundation"]
    },
    {
      columnId: doneColumn.id,
      title: "Create design system",
      description: "Extract and implement Lovable design system components",
      priority: "high" as const,
      tags: ["design", "ui"]
    },
    {
      columnId: doneColumn.id,
      title: "Basic Kanban functionality",
      description: "Implement drag & drop task management",
      priority: "urgent" as const,
      tags: ["core", "kanban"]
    }
  ]

  // Create sample tasks
  sampleTasks.forEach(taskData => {
    createTask(taskData.columnId, taskData.title, taskData.description)
    
    // Update with additional properties
    const createdTasks = useKanbanStore.getState().tasks
    const newTask = createdTasks[createdTasks.length - 1]
    
    if (newTask) {
      updateTask(newTask.id, {
        priority: taskData.priority,
        tags: taskData.tags,
        isAutomated: taskData.isAutomated || false,
        dueDate: taskData.priority === 'urgent' 
          ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Due tomorrow
          : undefined
      })
    }
  })
}

// Initialize sample data if needed
export const initializeSampleData = () => {
  const { tasks } = useKanbanStore.getState()
  const { activities } = useActivityStore.getState()

  // Only populate if no data exists
  if (tasks.length === 0) {
    populateSampleTasks()
  }
  
  if (activities.length === 0) {
    populateSampleActivity()
  }
}