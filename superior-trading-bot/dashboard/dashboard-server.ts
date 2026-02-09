/**
 * Dashboard Server - Layer 7 of Superior Trading Bot
 * 
 * Purpose: Real-time transparency dashboard showing all decision-making processes
 * 
 * Features:
 * - Live event stream visualization
 * - Pattern discovery dashboard
 * - Bot fingerprinting and archetype analysis
 * - Trade attribution breakdowns
 * - System health monitoring
 * - Phase transition controls
 */

import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { MemorySystem } from '../core/memory-system';
import { Logger } from '../core/logger';

// ===================== DASHBOARD SERVER =====================

export class DashboardServer {
  private config: any;
  private memory: MemorySystem;
  private logger: Logger;
  
  private app: express.Application;
  private server: http.Server;
  private io: SocketIOServer;
  private port: number;
  
  private isRunning = false;
  private connectedClients = 0;
  
  // Real-time data broadcasting
  private broadcastInterval: NodeJS.Timeout | null = null;
  private readonly BROADCAST_INTERVAL_MS = 2000; // 2 second updates
  
  constructor(config: any, memory: MemorySystem, logger: Logger) {
    this.config = config;
    this.memory = memory;
    this.logger = new Logger('DASHBOARD');
    this.port = config.dashboardPort || 9001;
    
    // Initialize Express app
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.setupRoutes();
    this.setupSocketHandlers();
  }
  
  // ===================== LIFECYCLE =====================
  
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.logger.info(`🖥️ Starting Dashboard Server on port ${this.port}`);
      
      this.server.listen(this.port, () => {
        this.isRunning = true;
        
        // Start broadcasting updates
        this.broadcastInterval = setInterval(() => {
          this.broadcastUpdate();
        }, this.BROADCAST_INTERVAL_MS);
        
        this.logger.success(`✅ Dashboard Server online - http://localhost:${this.port}`);
        resolve();
      });
      
      this.server.on('error', (error) => {
        this.logger.error('❌ Dashboard Server failed to start', error);
        reject(error);
      });
    });
  }
  
  async stop(): Promise<void> {
    this.logger.info('🛑 Stopping Dashboard Server...');
    
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }
    
    return new Promise((resolve) => {
      this.server.close(() => {
        this.isRunning = false;
        this.logger.success('✅ Dashboard Server stopped');
        resolve();
      });
    });
  }
  
  // ===================== EXPRESS ROUTES =====================
  
  private setupRoutes(): void {
    // Serve static files
    this.app.use(express.static(path.join(__dirname, 'public')));
    this.app.use(express.json());
    
    // Main dashboard
    this.app.get('/', (req, res) => {
      res.send(this.generateDashboardHTML());
    });
    
    // API endpoints
    this.app.get('/api/status', (req, res) => {
      res.json(this.getSystemStatus());
    });
    
    this.app.get('/api/events/recent', (req, res) => {
      const count = parseInt(req.query.count as string) || 100;
      const events = this.memory.getRecentEvents(count);
      res.json(events);
    });
    
    this.app.get('/api/patterns', (req, res) => {
      const patterns = this.memory.getTopPatterns(20);
      res.json(patterns);
    });
    
    this.app.get('/api/fingerprints', (req, res) => {
      const fingerprints = this.memory.getAllFingerprints();
      res.json(fingerprints);
    });
    
    this.app.get('/api/stats', (req, res) => {
      res.json(this.memory.getStats());
    });
    
    // Bot-specific endpoints
    this.app.get('/api/bots/:botId/events', (req, res) => {
      const botId = req.params.botId;
      const count = parseInt(req.query.count as string) || 50;
      const events = this.memory.getEventsByBotId(botId, count);
      res.json(events);
    });
    
    this.app.get('/api/bots/:botId/fingerprint', (req, res) => {
      const botId = req.params.botId;
      const fingerprint = this.memory.getBotFingerprint(botId);
      res.json(fingerprint);
    });
    
    // Pattern-specific endpoints
    this.app.get('/api/patterns/:type', (req, res) => {
      const type = req.params.type;
      const patterns = this.memory.getPatternsByType(type);
      res.json(patterns);
    });
    
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      });
    });
  }
  
  // ===================== WEBSOCKET HANDLERS =====================
  
  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      this.connectedClients++;
      this.logger.info(`🔌 Dashboard client connected (${this.connectedClients} total)`);
      
      // Send initial data
      socket.emit('system:status', this.getSystemStatus());
      socket.emit('events:recent', this.memory.getRecentEvents(50));
      socket.emit('patterns:top', this.memory.getTopPatterns(10));
      
      // Handle client requests
      socket.on('request:events', (data) => {
        const { type, count = 50 } = data;
        const events = type 
          ? this.memory.getEventsByType(type, count)
          : this.memory.getRecentEvents(count);
        socket.emit('events:data', events);
      });
      
      socket.on('request:bot-details', (data) => {
        const { botId } = data;
        const fingerprint = this.memory.getBotFingerprint(botId);
        const events = this.memory.getEventsByBotId(botId, 100);
        
        socket.emit('bot:details', {
          botId,
          fingerprint,
          recentEvents: events,
        });
      });
      
      socket.on('request:pattern-details', (data) => {
        const { patternId } = data;
        const pattern = this.memory.getPattern(patternId);
        socket.emit('pattern:details', pattern);
      });
      
      socket.on('disconnect', () => {
        this.connectedClients--;
        this.logger.info(`🔌 Dashboard client disconnected (${this.connectedClients} total)`);
      });
    });
  }
  
  // ===================== REAL-TIME BROADCASTING =====================
  
  private broadcastUpdate(): void {
    if (this.connectedClients === 0) return;
    
    try {
      // Broadcast system status
      this.io.emit('system:status', this.getSystemStatus());
      
      // Broadcast recent events (last 10)
      const recentEvents = this.memory.getRecentEvents(10);
      if (recentEvents.length > 0) {
        this.io.emit('events:update', recentEvents);
      }
      
      // Broadcast pattern updates
      const topPatterns = this.memory.getTopPatterns(5);
      this.io.emit('patterns:update', topPatterns);
      
      // Broadcast memory stats
      this.io.emit('stats:update', this.memory.getStats());
      
    } catch (error) {
      this.logger.warn('⚠️ Error broadcasting updates', { error: error.message });
    }
  }
  
  // ===================== DATA AGGREGATION =====================
  
  private getSystemStatus() {
    const events = this.memory.getRecentEvents(1000);
    const patterns = this.memory.getTopPatterns(20);
    const fingerprints = this.memory.getAllFingerprints();
    
    // Aggregate statistics
    const eventsByType = events.reduce((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const botActivity = fingerprints.slice(0, 10).map(fp => ({
      botId: fp.botId,
      tradeFrequency: fp.tradeFrequency,
      directionBias: fp.directionBias,
      preferredRegimes: fp.preferredRegimes,
      lastUpdated: fp.lastUpdated,
    }));
    
    const patternSummary = patterns.map(p => ({
      id: p.id,
      type: p.type,
      confidence: p.confidence,
      profitability: p.profitability,
      frequency: p.frequency,
    }));
    
    return {
      system: {
        isRunning: this.isRunning,
        uptime: process.uptime() * 1000,
        phase: this.config.phase,
        tradingEnabled: this.config.tradingEnabled,
        connectedClients: this.connectedClients,
      },
      memory: this.memory.getStats(),
      events: {
        total: events.length,
        byType: eventsByType,
        latest: events.slice(0, 5).map(e => ({
          id: e.id,
          timestamp: e.timestamp,
          type: e.eventType,
          botId: e.botId,
          source: e.source,
        })),
      },
      intelligence: {
        patterns: patternSummary,
        bots: botActivity,
        archetypes: [], // TODO: Add archetype data
      },
      performance: {
        eventsPerSecond: this.calculateEventRate(events),
        memoryUsage: process.memoryUsage(),
        averageProcessingTime: 0, // TODO: Track processing times
      },
    };
  }
  
  private calculateEventRate(events: any[]): number {
    if (events.length < 2) return 0;
    
    const timeSpan = events[0].timestamp - events[events.length - 1].timestamp;
    const seconds = timeSpan / 1000;
    
    return seconds > 0 ? events.length / seconds : 0;
  }
  
  // ===================== HTML DASHBOARD =====================
  
  private generateDashboardHTML(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Superior Trading Bot - Command Center</title>
    <script src="https://cdn.socket.io/4.7.4/socket.io.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Monaco', 'Consolas', monospace;
            background: #0a0a0a;
            color: #00ff00;
            font-size: 12px;
            overflow-x: auto;
        }
        
        .header {
            background: #111;
            border-bottom: 2px solid #00ff00;
            padding: 10px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .title {
            font-size: 18px;
            font-weight: bold;
            color: #00ffff;
        }
        
        .status {
            display: flex;
            gap: 20px;
            align-items: center;
        }
        
        .status-item {
            padding: 5px 10px;
            border: 1px solid #333;
            border-radius: 4px;
        }
        
        .status-online { color: #00ff00; border-color: #00ff00; }
        .status-phase { color: #ffff00; border-color: #ffff00; }
        .status-clients { color: #ff00ff; border-color: #ff00ff; }
        
        .container {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 20px;
            padding: 20px;
            height: calc(100vh - 80px);
        }
        
        .panel {
            background: #111;
            border: 1px solid #333;
            border-radius: 6px;
            padding: 15px;
            overflow-y: auto;
        }
        
        .panel-header {
            color: #00ffff;
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 1px solid #333;
        }
        
        .event-stream {
            grid-row: span 2;
        }
        
        .event-item {
            margin-bottom: 8px;
            padding: 6px;
            background: #0f0f0f;
            border-left: 3px solid #555;
            font-size: 11px;
        }
        
        .event-trade { border-left-color: #00ff00; }
        .event-evolution { border-left-color: #ff00ff; }
        .event-leaderboard { border-left-color: #ffff00; }
        
        .event-timestamp {
            color: #666;
            font-size: 10px;
        }
        
        .event-details {
            color: #ccc;
            margin-top: 3px;
        }
        
        .pattern-item {
            margin-bottom: 10px;
            padding: 8px;
            background: #0f0f0f;
            border: 1px solid #333;
            border-radius: 4px;
        }
        
        .pattern-confidence {
            color: #00ff00;
            font-weight: bold;
        }
        
        .pattern-profit {
            color: #ffff00;
        }
        
        .bot-item {
            margin-bottom: 8px;
            padding: 6px;
            background: #0f0f0f;
            border-left: 3px solid #666;
        }
        
        .bot-active { border-left-color: #00ff00; }
        .bot-moderate { border-left-color: #ffff00; }
        .bot-quiet { border-left-color: #ff6600; }
        
        .stats-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 15px;
        }
        
        .stat-item {
            text-align: center;
            padding: 10px;
            background: #0f0f0f;
            border: 1px solid #333;
            border-radius: 4px;
        }
        
        .stat-value {
            font-size: 16px;
            font-weight: bold;
            color: #00ffff;
        }
        
        .stat-label {
            font-size: 10px;
            color: #666;
            margin-top: 3px;
        }
        
        .scrollbar {
            scrollbar-width: thin;
            scrollbar-color: #333 #111;
        }
        
        .scrollbar::-webkit-scrollbar {
            width: 6px;
        }
        
        .scrollbar::-webkit-scrollbar-track {
            background: #111;
        }
        
        .scrollbar::-webkit-scrollbar-thumb {
            background: #333;
            border-radius: 3px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">🧠 SUPERIOR TRADING BOT - COMMAND CENTER</div>
        <div class="status">
            <div class="status-item status-online" id="status-system">ONLINE</div>
            <div class="status-item status-phase" id="status-phase">PHASE 1</div>
            <div class="status-item status-clients" id="status-clients">0 CLIENTS</div>
            <div class="status-item" id="status-uptime">00:00:00</div>
        </div>
    </div>
    
    <div class="container">
        <!-- Event Stream Panel -->
        <div class="panel event-stream scrollbar">
            <div class="panel-header">📊 LIVE EVENT STREAM</div>
            <div id="event-stream"></div>
        </div>
        
        <!-- Pattern Discovery Panel -->
        <div class="panel scrollbar">
            <div class="panel-header">🎯 PATTERN DISCOVERY</div>
            <div id="pattern-list"></div>
        </div>
        
        <!-- Bot Intelligence Panel -->
        <div class="panel scrollbar">
            <div class="panel-header">👤 BOT INTELLIGENCE</div>
            <div id="bot-intelligence"></div>
        </div>
        
        <!-- System Stats Panel -->
        <div class="panel">
            <div class="panel-header">⚡ SYSTEM PERFORMANCE</div>
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-value" id="stat-events">0</div>
                    <div class="stat-label">EVENTS</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value" id="stat-patterns">0</div>
                    <div class="stat-label">PATTERNS</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value" id="stat-bots">0</div>
                    <div class="stat-label">BOTS</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value" id="stat-rate">0.0</div>
                    <div class="stat-label">EVENTS/SEC</div>
                </div>
            </div>
            <div id="memory-stats"></div>
        </div>
        
        <!-- Architecture Status Panel -->
        <div class="panel scrollbar">
            <div class="panel-header">🏗️ 7-LAYER ARCHITECTURE</div>
            <div id="architecture-status"></div>
        </div>
    </div>

    <script>
        const socket = io();
        
        // DOM elements
        const eventStream = document.getElementById('event-stream');
        const patternList = document.getElementById('pattern-list');
        const botIntelligence = document.getElementById('bot-intelligence');
        const architectureStatus = document.getElementById('architecture-status');
        
        // Stats elements
        const statElements = {
            events: document.getElementById('stat-events'),
            patterns: document.getElementById('stat-patterns'),
            bots: document.getElementById('stat-bots'),
            rate: document.getElementById('stat-rate'),
        };
        
        const statusElements = {
            system: document.getElementById('status-system'),
            phase: document.getElementById('status-phase'),
            clients: document.getElementById('status-clients'),
            uptime: document.getElementById('status-uptime'),
        };
        
        // Socket event handlers
        socket.on('system:status', (status) => {
            updateSystemStatus(status);
            updateStats(status);
            updateArchitectureStatus(status);
        });
        
        socket.on('events:update', (events) => {
            addEventsToStream(events);
        });
        
        socket.on('patterns:update', (patterns) => {
            updatePatternList(patterns);
        });
        
        function updateSystemStatus(status) {
            statusElements.system.textContent = status.system.isRunning ? 'ONLINE' : 'OFFLINE';
            statusElements.phase.textContent = \`PHASE \${status.system.phase}\`;
            statusElements.clients.textContent = \`\${status.system.connectedClients} CLIENTS\`;
            
            const uptime = new Date(status.system.uptime);
            const hours = String(uptime.getUTCHours()).padStart(2, '0');
            const minutes = String(uptime.getUTCMinutes()).padStart(2, '0');
            const seconds = String(uptime.getUTCSeconds()).padStart(2, '0');
            statusElements.uptime.textContent = \`\${hours}:\${minutes}:\${seconds}\`;
        }
        
        function updateStats(status) {
            statElements.events.textContent = status.events.total;
            statElements.patterns.textContent = status.intelligence.patterns.length;
            statElements.bots.textContent = status.intelligence.bots.length;
            statElements.rate.textContent = status.performance.eventsPerSecond.toFixed(1);
        }
        
        function addEventsToStream(events) {
            events.forEach(event => {
                const eventDiv = document.createElement('div');
                eventDiv.className = \`event-item event-\${event.eventType}\`;
                
                const timestamp = new Date(event.timestamp).toLocaleTimeString();
                const botInfo = event.botId ? \`[\${event.botId.substring(0, 8)}]\` : '[SYSTEM]';
                
                eventDiv.innerHTML = \`
                    <div class="event-timestamp">\${timestamp} \${botInfo}</div>
                    <div class="event-details">\${formatEventDetails(event)}</div>
                \`;
                
                eventStream.insertBefore(eventDiv, eventStream.firstChild);
            });
            
            // Keep only last 50 events
            while (eventStream.children.length > 50) {
                eventStream.removeChild(eventStream.lastChild);
            }
        }
        
        function formatEventDetails(event) {
            switch (event.eventType) {
                case 'trade':
                    const payload = event.payload;
                    const pnl = payload.pnl ? \`P&L: \${payload.pnl.toFixed(2)}\` : '';
                    return \`\${payload.side.toUpperCase()} \${payload.symbol} @ \${payload.price} \${pnl}\`;
                case 'evolution':
                    return \`Generation \${event.payload.generation} - \${event.payload.type}\`;
                case 'leaderboard':
                    return \`Round \${event.payload.roundNumber} - \${event.payload.entries.length} bots\`;
                default:
                    return event.eventType;
            }
        }
        
        function updatePatternList(patterns) {
            patternList.innerHTML = patterns.map(pattern => \`
                <div class="pattern-item">
                    <div>Type: \${pattern.type}</div>
                    <div class="pattern-confidence">Confidence: \${(pattern.confidence * 100).toFixed(1)}%</div>
                    <div class="pattern-profit">Profit: \${pattern.profitability.toFixed(4)}</div>
                    <div>Frequency: \${pattern.frequency.toFixed(1)}/day</div>
                </div>
            \`).join('');
        }
        
        function updateArchitectureStatus(status) {
            const layers = [
                { name: 'Layer 1: Observation Engine', status: status.memory.totalEvents > 0 ? 'ACTIVE' : 'STANDBY' },
                { name: 'Layer 2: Pattern Extraction', status: status.intelligence.patterns.length > 0 ? 'LEARNING' : 'STANDBY' },
                { name: 'Layer 3: Strategy Synthesis', status: 'PHASE 2' },
                { name: 'Layer 4: Competitive Intelligence', status: 'PHASE 2' },
                { name: 'Layer 5: Capital Allocator', status: 'PHASE 3' },
                { name: 'Layer 6: Risk Governor', status: 'PHASE 4' },
                { name: 'Layer 7: Dashboard', status: 'ONLINE' },
            ];
            
            architectureStatus.innerHTML = layers.map((layer, index) => {
                const statusClass = layer.status === 'ACTIVE' || layer.status === 'ONLINE' || layer.status === 'LEARNING'
                    ? 'status-online' 
                    : layer.status.startsWith('PHASE') ? 'status-phase' : 'status-clients';
                
                return \`
                    <div class="bot-item">
                        <div>\${layer.name}</div>
                        <div class="\${statusClass}" style="font-size: 10px; margin-top: 3px;">\${layer.status}</div>
                    </div>
                \`;
            }).join('');
        }
        
        // Connection status
        socket.on('connect', () => {
            console.log('Connected to Superior Trading Bot');
        });
        
        socket.on('disconnect', () => {
            console.log('Disconnected from Superior Trading Bot');
        });
    </script>
</body>
</html>
    `;
  }
  
  // ===================== STATUS =====================
  
  isRunning(): boolean {
    return this.isRunning;
  }
  
  getConnectedClients(): number {
    return this.connectedClients;
  }
}