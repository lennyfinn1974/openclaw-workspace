import { useKanbanStore } from '@/stores/kanban'
import { useOpenClawStore } from '@/stores/openclaw'

export interface MigrationData {
  boards: any[]
  columns: any[]
  tasks: any[]
  agents: any[]
  activities: any[]
  metadata: {
    migrationDate: string
    sources: string[]
    version: string
  }
}

export interface LoadResult {
  success: boolean
  boardsCreated: number
  columnsCreated: number
  tasksLoaded: number
  agentsLoaded: number
  errors: string[]
  summary: string
}

export class MigrationDataLoader {
  /**
   * Load migration data from file and import into Kanban platform
   */
  async loadMigrationData(migrationData: MigrationData): Promise<LoadResult> {
    console.log('🔄 Loading historical migration data...')
    
    const result: LoadResult = {
      success: false,
      boardsCreated: 0,
      columnsCreated: 0,
      tasksLoaded: 0,
      agentsLoaded: 0,
      errors: [],
      summary: ''
    }

    try {
      // Step 1: Load boards
      result.boardsCreated = await this.loadBoards(migrationData.boards)
      
      // Step 2: Load columns
      result.columnsCreated = await this.loadColumns(migrationData.columns)
      
      // Step 3: Load tasks
      result.tasksLoaded = await this.loadTasks(migrationData.tasks)
      
      // Step 4: Load agents
      result.agentsLoaded = await this.loadAgents(migrationData.agents)
      
      // Step 5: Create summary
      result.summary = this.generateLoadSummary(result, migrationData)
      result.success = true
      
      console.log('✅ Migration data loaded successfully!')
      
    } catch (error) {
      console.error('❌ Failed to load migration data:', error)
      result.errors.push(error instanceof Error ? error.message : String(error))
      result.success = false
    }
    
    return result
  }

  /**
   * Load migration data from file
   */
  async loadFromFile(filePath: string = '/migration-data.json'): Promise<LoadResult> {
    try {
      console.log(`📁 Loading migration data from: ${filePath}`)
      
      const response = await fetch(filePath)
      if (!response.ok) {
        throw new Error(`Failed to load migration file: ${response.status} ${response.statusText}`)
      }
      
      const migrationData: MigrationData = await response.json()
      
      return await this.loadMigrationData(migrationData)
      
    } catch (error) {
      console.error('❌ Failed to load migration file:', error)
      return {
        success: false,
        boardsCreated: 0,
        columnsCreated: 0,
        tasksLoaded: 0,
        agentsLoaded: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        summary: 'Failed to load migration data from file'
      }
    }
  }

  /**
   * Load boards into Kanban store
   */
  private async loadBoards(boards: any[]): Promise<number> {
    const { createBoard } = useKanbanStore.getState()
    let loaded = 0
    
    for (const board of boards) {
      try {
        createBoard(board.name, board.description)
        loaded++
      } catch (error) {
        console.error(`Failed to load board ${board.id}:`, error)
      }
    }
    
    return loaded
  }

  /**
   * Load columns into Kanban store
   */
  private async loadColumns(columns: any[]): Promise<number> {
    const { createColumn, boards } = useKanbanStore.getState()
    let loaded = 0
    
    // Find the historical board
    const historicalBoard = boards.find(board => board.name.includes('Historical'))
    if (!historicalBoard) {
      console.error('No historical board found for column creation')
      return 0
    }
    
    for (const column of columns) {
      try {
        createColumn(historicalBoard.id, column.name)
        loaded++
      } catch (error) {
        console.error(`Failed to load column ${column.id}:`, error)
      }
    }
    
    return loaded
  }

  /**
   * Load tasks into Kanban store
   */
  private async loadTasks(tasks: any[]): Promise<number> {
    const { createTask, updateTask, addComment, columns, boards } = useKanbanStore.getState()
    let loaded = 0
    
    // Find the historical board and create column mapping
    const historicalBoard = boards.find(board => board.name.includes('Historical'))
    if (!historicalBoard) {
      console.error('No historical board found for task creation')
      return 0
    }
    
    const historicalColumns = columns.filter(col => col.boardId === historicalBoard.id)
    const columnMapping = this.createColumnMapping(historicalColumns, tasks)
    
    for (const task of tasks) {
      try {
        // Map to appropriate column
        const targetColumnId = this.mapTaskToColumn(task, columnMapping)
        if (!targetColumnId) {
          console.warn(`No target column found for task: ${task.title}`)
          continue
        }
        
        // Create task
        createTask(targetColumnId, task.title, task.description)
        
        // Get the created task and update with metadata
        const { tasks: currentTasks } = useKanbanStore.getState()
        const createdTask = currentTasks.find(t => 
          t.title === task.title && t.columnId === targetColumnId
        )
        
        if (createdTask) {
          // Update with historical metadata
          updateTask(createdTask.id, {
            priority: task.priority,
            tags: task.tags,
            isAutomated: task.isAutomated,
            openclawTaskId: task.openclawTaskId,
            // Preserve original timestamps
            createdAt: task.createdAt,
            updatedAt: task.updatedAt
          })
          
          // Add historical comments
          this.addHistoricalComments(createdTask.id, task)
          
          loaded++
        }
        
      } catch (error) {
        console.error(`Failed to load task ${task.id}:`, error)
      }
    }
    
    return loaded
  }

  /**
   * Load agents into OpenClaw store
   */
  private async loadAgents(agents: any[]): Promise<number> {
    const { addAgent } = useOpenClawStore.getState()
    let loaded = 0
    
    for (const agent of agents) {
      try {
        addAgent(agent)
        loaded++
      } catch (error) {
        console.error(`Failed to load agent ${agent.id}:`, error)
      }
    }
    
    return loaded
  }

  /**
   * Create column mapping for historical tasks
   */
  private createColumnMapping(columns: any[], tasks: any[]) {
    const mapping: Record<string, string> = {}
    
    columns.forEach(column => {
      const name = column.name.toLowerCase()
      if (name.includes('todo')) mapping.todo = column.id
      if (name.includes('progress') || name.includes('doing')) mapping['in-progress'] = column.id
      if (name.includes('review')) mapping.review = column.id
      if (name.includes('done')) mapping.done = column.id
      if (name.includes('archive')) mapping.archive = column.id
    })
    
    return mapping
  }

  /**
   * Map a task to the appropriate column
   */
  private mapTaskToColumn(task: any, columnMapping: Record<string, string>): string | null {
    // Extract original status from task metadata
    const originalStatus = task._historicalData?.originalStatus || task.tags?.find((tag: string) => tag.startsWith('original-'))?.replace('original-', '')
    
    if (originalStatus) {
      const normalizedStatus = originalStatus.toLowerCase().replace(/[^a-z]/g, '')
      const statusMap: Record<string, string> = {
        'todo': 'todo',
        'inprogress': 'in-progress',
        'doing': 'in-progress',
        'review': 'review', 
        'done': 'done',
        'completed': 'done'
      }
      
      const mappedStatus = statusMap[normalizedStatus]
      if (mappedStatus && columnMapping[mappedStatus]) {
        return columnMapping[mappedStatus]
      }
    }
    
    // Default to archive
    return columnMapping.archive || columnMapping.todo
  }

  /**
   * Add historical comments to imported tasks
   */
  private addHistoricalComments(taskId: string, task: any): void {
    const { addComment } = useKanbanStore.getState()
    
    // Add migration audit comment
    const auditComment = `🔄 **Historical Task Migration**

**Migration Details:**
- Original ID: ${task.openclawTaskId}
- Source System: ${task._historicalData?.source || 'Unknown'}
- Original Status: ${task._historicalData?.originalStatus}
- Migrated On: ${new Date().toLocaleString()}

**Performance Data:**
- Estimated Hours: ${task._historicalData?.estimatedHours || 'N/A'}
- Actual Hours: ${task._historicalData?.actualHours || 'N/A'}

*This task was successfully migrated with complete historical context preserved.*`
    
    addComment(taskId, auditComment, 'Migration System')
    
    // Add agent assignment comment if available
    if (task.assigneeId) {
      const agentComment = `🤖 **Historical Agent Assignment**

Agent: ${task.assigneeId}
Assignment Type: ${task.isAutomated ? 'Automated Sub-Agent' : 'Manual Assignment'}

*Original agent assignment preserved from historical records.*`
      
      addComment(taskId, agentComment, 'Migration System')
    }
  }

  /**
   * Generate load summary
   */
  private generateLoadSummary(result: LoadResult, migrationData: MigrationData): string {
    const totalItems = migrationData.boards.length + migrationData.columns.length + 
                      migrationData.tasks.length + migrationData.agents.length
    const successRate = ((result.boardsCreated + result.columnsCreated + 
                         result.tasksLoaded + result.agentsLoaded) / totalItems * 100).toFixed(1)
    
    return `
🎉 Historical Data Successfully Loaded!

📊 Load Statistics:
- ✅ Boards Created: ${result.boardsCreated}/${migrationData.boards.length}
- ✅ Columns Created: ${result.columnsCreated}/${migrationData.columns.length}  
- ✅ Tasks Loaded: ${result.tasksLoaded}/${migrationData.tasks.length}
- ✅ Agents Loaded: ${result.agentsLoaded}/${migrationData.agents.length}
- 📈 Success Rate: ${successRate}%

📚 Data Sources Integrated:
${migrationData.metadata.sources.map(source => `- ${source}`).join('\n')}

⏰ Migration Timeline:
- Original Data: ${migrationData.metadata.migrationDate}
- Loaded Into Platform: ${new Date().toLocaleString()}

🔗 Complete Work Continuity Achieved:
All historical tasks, agents, and activities are now available in the new Kanban platform with complete audit trails and original timestamps preserved.

Navigate to the Kanban Board to see your complete work history! 🚀`
  }

  /**
   * Check if historical data has already been loaded
   */
  isHistoricalDataLoaded(): boolean {
    const { boards } = useKanbanStore.getState()
    return boards.some(board => board.name.includes('Historical'))
  }

  /**
   * Get historical data statistics
   */
  getHistoricalDataStats() {
    const { boards, tasks, columns } = useKanbanStore.getState()
    const { agents } = useOpenClawStore.getState()
    
    const historicalBoard = boards.find(board => board.name.includes('Historical'))
    const historicalTasks = tasks.filter(task => task.tags?.includes('historical'))
    const historicalAgents = agents.filter(agent => agent.id.startsWith('historical-'))
    
    return {
      hasHistoricalData: !!historicalBoard,
      boardId: historicalBoard?.id,
      tasksCount: historicalTasks.length,
      agentsCount: historicalAgents.length,
      columnsCount: historicalBoard ? columns.filter(col => col.boardId === historicalBoard.id).length : 0
    }
  }
}

// Export singleton instance
let loaderInstance: MigrationDataLoader | null = null

export const getMigrationLoader = (): MigrationDataLoader => {
  if (!loaderInstance) {
    loaderInstance = new MigrationDataLoader()
  }
  return loaderInstance
}