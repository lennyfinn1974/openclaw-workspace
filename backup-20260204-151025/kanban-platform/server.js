#!/usr/bin/env node

/**
 * Kanban Platform Backend Server
 * 
 * Express server that serves the React frontend and provides API endpoints
 * for webhook integration and real-time updates.
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class KanbanBackendServer {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"],
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type"]
      }
    });
    
    this.port = process.env.PORT || 3002;
    this.migrationDataPath = path.join(__dirname, 'public', 'migration-data.json');
    this.liveTicketsPath = path.join(__dirname, 'data', 'live-tickets.json');
    this.automationRulesPath = path.join(__dirname, 'data', 'automation-rules.json');
    
    // Ensure data directory exists
    this.ensureDataDirectory();
    
    // Initialize live tickets storage
    this.liveTickets = {
      boards: [],
      columns: [],
      tasks: [],
      agents: [],
      activities: []
    };
    
    this.automationRules = { rules: [], log: [] };

    this.loadLiveTickets();
    this.loadAutomationRules();
  }

  async ensureDataDirectory() {
    try {
      await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });
    } catch (error) {
      console.log('Data directory exists or error creating:', error.message);
    }
  }

  async loadLiveTickets() {
    try {
      const data = await fs.readFile(this.liveTicketsPath, 'utf8');
      this.liveTickets = JSON.parse(data);
      console.log('✅ Loaded existing live tickets data');
    } catch (error) {
      console.log('📝 No existing live tickets file, starting fresh');
      await this.saveLiveTickets();
    }
  }

  async saveLiveTickets() {
    try {
      await fs.writeFile(this.liveTicketsPath, JSON.stringify(this.liveTickets, null, 2));
    } catch (error) {
      console.error('❌ Error saving live tickets:', error);
    }
  }

  async loadAutomationRules() {
    try {
      const data = await fs.readFile(this.automationRulesPath, 'utf8');
      this.automationRules = JSON.parse(data);
      console.log('✅ Loaded existing automation rules');
    } catch (error) {
      console.log('📝 No existing automation rules file, starting fresh');
      await this.saveAutomationRules();
    }
  }

  async saveAutomationRules() {
    try {
      await fs.writeFile(this.automationRulesPath, JSON.stringify(this.automationRules, null, 2));
    } catch (error) {
      console.error('❌ Error saving automation rules:', error);
    }
  }

  setupMiddleware() {
    // CORS
    this.app.use(cors({
      origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // JSON parsing
    this.app.use(express.json());

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      next();
    });

    // Serve static files from public directory
    this.app.use(express.static(path.join(__dirname, 'public')));
    
    // Serve built React app (for production)
    this.app.use(express.static(path.join(__dirname, 'dist')));
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('🔗 Client connected to WebSocket');
      
      // Send current live data to new client
      socket.emit('live-data-update', {
        type: 'full-sync',
        data: this.liveTickets
      });

      socket.on('disconnect', () => {
        console.log('🔌 Client disconnected from WebSocket');
      });
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        server: 'kanban-backend',
        port: this.port
      });
    });

    // OpenClaw webhook endpoint - This is the main fix!
    this.app.post('/api/webhooks/openclaw', async (req, res) => {
      try {
        const webhookData = req.body;
        console.log('🎯 OpenClaw webhook received:', {
          type: webhookData.type,
          agentId: webhookData.agentId,
          timestamp: webhookData.timestamp
        });

        // Process webhook and create/update tickets
        const result = await this.processOpenClawWebhook(webhookData);
        
        // Broadcast to connected clients
        this.io.emit('live-data-update', {
          type: 'webhook-processed',
          webhook: webhookData,
          result: result,
          data: this.liveTickets
        });

        res.json({
          success: true,
          message: 'Webhook processed successfully',
          ticketId: result.ticketId,
          action: result.action
        });

      } catch (error) {
        console.error('❌ Webhook processing error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API to get combined migration + live data
    this.app.get('/api/data/combined', async (req, res) => {
      try {
        // Load migration data
        const migrationData = JSON.parse(await fs.readFile(this.migrationDataPath, 'utf8'));
        
        // Combine with live data
        const combined = {
          boards: [...migrationData.boards, ...this.liveTickets.boards],
          columns: [...migrationData.columns, ...this.liveTickets.columns], 
          tasks: [...migrationData.tasks, ...this.liveTickets.tasks],
          agents: [...migrationData.agents, ...this.liveTickets.agents],
          activities: [...migrationData.activities, ...this.liveTickets.activities]
        };

        res.json(combined);
      } catch (error) {
        console.error('❌ Error fetching combined data:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // API to get only live tickets
    this.app.get('/api/data/live', (req, res) => {
      res.json(this.liveTickets);
    });

    // API to get migration data
    this.app.get('/api/data/migration', async (req, res) => {
      try {
        const data = await fs.readFile(this.migrationDataPath, 'utf8');
        res.json(JSON.parse(data));
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Test webhook endpoint
    this.app.post('/api/test/webhook', async (req, res) => {
      const testWebhook = {
        type: 'subagent.spawned',
        agentId: 'test-agent-' + Math.random().toString(36).substr(2, 8),
        sessionId: 'test-session-' + Date.now(),
        data: {
          objective: req.body.objective || 'Test webhook integration',
          priority: req.body.priority || 'medium'
        },
        timestamp: new Date().toISOString(),
        metadata: {
          source: 'test-endpoint',
          label: req.body.label || 'test-task'
        }
      };

      // Process the test webhook
      const result = await this.processOpenClawWebhook(testWebhook);
      
      // Broadcast to clients
      this.io.emit('live-data-update', {
        type: 'test-webhook',
        webhook: testWebhook,
        result: result,
        data: this.liveTickets
      });

      res.json({
        success: true,
        webhook: testWebhook,
        result: result
      });
    });

    // Automation Rules API
    this.app.get('/api/automation/rules', (req, res) => {
      res.json({ success: true, rules: this.automationRules.rules });
    });

    this.app.post('/api/automation/rules', async (req, res) => {
      try {
        const rule = {
          ...req.body,
          id: 'rule-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          triggerCount: 0
        };
        this.automationRules.rules.push(rule);
        await this.saveAutomationRules();
        res.json({ success: true, rule });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.put('/api/automation/rules/:id', async (req, res) => {
      try {
        const index = this.automationRules.rules.findIndex(r => r.id === req.params.id);
        if (index === -1) {
          return res.status(404).json({ success: false, error: 'Rule not found' });
        }
        this.automationRules.rules[index] = {
          ...this.automationRules.rules[index],
          ...req.body,
          updatedAt: new Date().toISOString()
        };
        await this.saveAutomationRules();
        res.json({ success: true, rule: this.automationRules.rules[index] });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.delete('/api/automation/rules/:id', async (req, res) => {
      try {
        this.automationRules.rules = this.automationRules.rules.filter(r => r.id !== req.params.id);
        await this.saveAutomationRules();
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/automation/log', (req, res) => {
      res.json({ success: true, log: this.automationRules.log || [] });
    });

    // Catch-all handler: send back React's index.html file for SPA routing
    this.app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  async processOpenClawWebhook(webhook) {
    const { type, agentId, sessionId, data, timestamp, metadata } = webhook;
    
    // Ensure we have a live board
    if (this.liveTickets.boards.length === 0) {
      await this.createLiveBoard();
    }

    const liveBoardId = this.liveTickets.boards[0].id;
    
    // Process different webhook types
    switch (type) {
      case 'subagent.spawned':
        return await this.handleSubagentSpawned(webhook, liveBoardId);
      
      case 'subagent.completed':
        return await this.handleSubagentCompleted(webhook);
        
      case 'task.created':
        return await this.handleTaskCreated(webhook, liveBoardId);
        
      case 'task.updated':
        return await this.handleTaskUpdated(webhook);
        
      default:
        console.log('🤷 Unknown webhook type:', type);
        return { action: 'ignored', reason: 'Unknown webhook type' };
    }
  }

  async createLiveBoard() {
    const boardId = 'live-board-' + Date.now();
    const now = new Date().toISOString();
    
    // Create live board
    this.liveTickets.boards.push({
      id: boardId,
      name: '🔴 Live OpenClaw Tasks',
      description: 'Real-time tasks from OpenClaw agent sessions',
      createdAt: now,
      updatedAt: now,
      isHistorical: false
    });

    // Create default columns
    const columns = [
      { name: 'New Tasks', color: '#3b82f6', position: 0 },
      { name: 'In Progress', color: '#f59e0b', position: 1 },
      { name: 'Completed', color: '#10b981', position: 2 },
      { name: 'Agent Pool', color: '#8b5cf6', position: 3 }
    ];

    columns.forEach(col => {
      this.liveTickets.columns.push({
        id: `live-column-${col.position}`,
        boardId: boardId,
        name: col.name,
        position: col.position,
        color: col.color,
        createdAt: now,
        updatedAt: now
      });
    });

    await this.saveLiveTickets();
  }

  async handleSubagentSpawned(webhook, liveBoardId) {
    const { agentId, sessionId, data, timestamp, metadata } = webhook;
    const taskId = 'live-task-' + agentId;
    const now = new Date().toISOString();
    
    // Add to agent pool (column 3)
    const columnId = 'live-column-3';
    
    const task = {
      id: taskId,
      columnId: columnId,
      boardId: liveBoardId,
      title: `🤖 ${metadata?.label || 'Untitled Task'}`,
      description: `## 🔴 Live OpenClaw Task
      
**Agent ID:** ${agentId}
**Session ID:** ${sessionId}
**Objective:** ${data?.objective || 'No objective specified'}
**Priority:** ${data?.priority || 'medium'}

### 📊 Task Details
- **Spawned:** ${timestamp}
- **Status:** Active
- **Type:** Live Agent Task

*This is a real-time task created from OpenClaw webhook events*`,
      priority: data?.priority || 'medium',
      status: 'active',
      assigneeId: agentId,
      position: this.liveTickets.tasks.filter(t => t.columnId === columnId).length,
      tags: ['live', 'agent-task', `priority-${data?.priority || 'medium'}`],
      createdAt: now,
      updatedAt: now,
      isAutomated: true,
      openclawTaskId: agentId,
      openclawSessionId: sessionId
    };

    this.liveTickets.tasks.push(task);

    // Add agent
    const agent = {
      id: agentId,
      sessionId: sessionId,
      label: metadata?.label || 'Unknown Agent',
      status: 'active',
      startTime: now,
      endTime: null,
      model: metadata?.model || 'unknown',
      tokensUsed: 0,
      lastActivity: now,
      _liveData: {
        spawnedAt: timestamp,
        objective: data?.objective,
        priority: data?.priority
      }
    };

    this.liveTickets.agents.push(agent);

    // Add activity
    const activity = {
      id: `live-activity-${agentId}-spawned`,
      timestamp: now,
      message: `Agent spawned: ${metadata?.label || 'Unknown'}`,
      type: 'agent_spawn',
      level: 'info',
      source: 'OpenClaw Webhook',
      sessionId: sessionId,
      details: {
        agentId,
        objective: data?.objective,
        priority: data?.priority
      }
    };

    this.liveTickets.activities.push(activity);

    await this.saveLiveTickets();
    
    console.log(`✅ Created live task for agent: ${agentId}`);
    return { action: 'created', ticketId: taskId, agentId: agentId };
  }

  async handleSubagentCompleted(webhook) {
    const { agentId, data } = webhook;

    // Find and update the task
    const taskIndex = this.liveTickets.tasks.findIndex(t => t.openclawTaskId === agentId);
    if (taskIndex >= 0) {
      const task = this.liveTickets.tasks[taskIndex];

      // Move to completed column
      task.columnId = 'live-column-2';
      task.status = 'completed';
      task.updatedAt = new Date().toISOString();

      // Update description with completion details
      task.description += `\n\n## ✅ Task Completed\n**Completed:** ${new Date().toISOString()}\n**Result:** ${data?.result || 'No result provided'}`;

      // Capture agent output if present
      if (data?.output) {
        task.output = {
          summary: data.output.summary || data.result || null,
          artifacts: Array.isArray(data.output.artifacts) ? data.output.artifacts : [],
          logs: Array.isArray(data.output.logs) ? data.output.logs : [],
          completedAt: new Date().toISOString(),
          agentId: agentId
        };
      }

      // Resolve dependencies - unblock downstream tasks
      if (task.blocks && task.blocks.length > 0) {
        for (const blockedTaskId of task.blocks) {
          const blockedTask = this.liveTickets.tasks.find(t => t.id === blockedTaskId);
          if (blockedTask && blockedTask.dependsOn) {
            const allDepsCompleted = blockedTask.dependsOn.every(depId => {
              const depTask = this.liveTickets.tasks.find(t => t.id === depId);
              return depTask && depTask.status === 'completed';
            });
            if (allDepsCompleted) {
              blockedTask.isBlocked = false;
              blockedTask.updatedAt = new Date().toISOString();
              // Move unblocked task to "New Tasks" column
              const newTasksColumn = this.liveTickets.columns.find(c => c.name === 'New Tasks');
              if (newTasksColumn && blockedTask.columnId !== newTasksColumn.id) {
                blockedTask.columnId = newTasksColumn.id;
              }
              console.log(`🔓 Unblocked task: ${blockedTask.title}`);

              // Forward output to downstream task
              if (task.output) {
                blockedTask.output = {
                  ...task.output,
                  forwardedFrom: task.id
                };
              }
            }
          }
        }
      }

      await this.saveLiveTickets();

      console.log(`✅ Marked task as completed: ${agentId}`);
      return { action: 'completed', ticketId: task.id, agentId: agentId };
    }

    return { action: 'not_found', agentId: agentId };
  }

  async handleTaskCreated(webhook, liveBoardId) {
    // Similar to subagent spawned but for general tasks
    return this.handleSubagentSpawned(webhook, liveBoardId);
  }

  async handleTaskUpdated(webhook) {
    // Similar to subagent completed but for general task updates
    return this.handleSubagentCompleted(webhook);
  }

  async start() {
    this.setupMiddleware();
    this.setupSocketHandlers();
    this.setupRoutes();

    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log('🚀 Kanban Backend Server started!');
        console.log(`📡 Server: http://localhost:${this.port}`);
        console.log(`🔗 Webhook endpoint: http://localhost:${this.port}/api/webhooks/openclaw`);
        console.log(`📊 API endpoints:`);
        console.log(`   - GET /api/data/combined - Migration + live data`);
        console.log(`   - GET /api/data/live - Live tickets only`);
        console.log(`   - GET /api/data/migration - Historical data only`);
        console.log(`   - POST /api/test/webhook - Test webhook`);
        console.log(`   - GET  /api/automation/rules - List automation rules`);
        console.log(`   - POST /api/automation/rules - Create automation rule`);
        console.log(`   - PUT  /api/automation/rules/:id - Update automation rule`);
        console.log(`   - DELETE /api/automation/rules/:id - Delete automation rule`);
        console.log(`   - GET  /api/automation/log - Automation execution log`);
        console.log(`🏥 Health check: http://localhost:${this.port}/health`);
        console.log('');
        console.log('✨ Ready to receive OpenClaw webhooks!');
        console.log('');
        resolve();
      });
    });
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new KanbanBackendServer();
  
  server.start().catch(error => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });
}

export default KanbanBackendServer;