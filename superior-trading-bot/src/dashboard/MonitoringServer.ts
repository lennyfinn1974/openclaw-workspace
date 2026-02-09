/**
 * Live Monitoring Dashboard Server
 * Real-time display of Observation Engine status and events
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { ObservationEngine } from '../observation/ObservationEngine';
import { ObservationEvent } from '../types/core';

interface DashboardConfig {
  port?: number;
  staticPath?: string;
}

export class MonitoringServer {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;
  private observationEngine: ObservationEngine;
  private config: DashboardConfig;
  
  private connectedClients = 0;
  private lastEventBroadcast = 0;
  private eventBuffer: ObservationEvent[] = [];

  constructor(observationEngine: ObservationEngine, config: DashboardConfig = {}) {
    this.observationEngine = observationEngine;
    this.config = {
      port: config.port || 8083,
      staticPath: config.staticPath || './dashboard'
    };

    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
    this.setupObservationEngineListeners();
  }

  /**
   * Start the monitoring server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, () => {
        console.log(`📊 Monitoring Dashboard running at http://localhost:${this.config.port}`);
        resolve();
      });

      this.server.on('error', (error: Error) => {
        console.error('❌ Dashboard server error:', error);
        reject(error);
      });
    });
  }

  /**
   * Stop the monitoring server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        console.log('⏹️ Monitoring Dashboard stopped');
        resolve();
      });
    });
  }

  // Private methods

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(this.config.staticPath!));
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: Date.now(),
        connectedClients: this.connectedClients 
      });
    });

    // Engine statistics
    this.app.get('/api/stats', (req, res) => {
      const stats = this.observationEngine.getStats();
      res.json(stats);
    });

    // Recent events
    this.app.get('/api/events/recent/:count', (req, res) => {
      const count = parseInt(req.params.count || '50');
      const events = this.observationEngine.getLatestEvents(count);
      res.json(events);
    });
    
    this.app.get('/api/events/recent', (req, res) => {
      const count = parseInt(req.query.count as string || '50');
      const events = this.observationEngine.getLatestEvents(count);
      res.json(events);
    });

    // Query events
    this.app.post('/api/events/query', (req, res) => {
      const query = req.body;
      const events = this.observationEngine.queryEvents(query);
      res.json(events);
    });

    // Bot strategy fingerprint
    this.app.get('/api/bots/:botId/fingerprint', (req, res) => {
      const { botId } = req.params;
      const hours = parseInt(req.query.hours as string || '24');
      const fingerprint = this.observationEngine.generateStrategyFingerprint(botId, hours);
      res.json(fingerprint);
    });

    // Market indicators for a symbol
    this.app.get('/api/indicators/:symbol', (req, res) => {
      const { symbol } = req.params;
      const snapshot = this.observationEngine.getIndicatorSnapshot(symbol);
      const summary = this.observationEngine.getMarketSummary(symbol);
      res.json({ snapshot, summary });
    });

    // Serve main dashboard
    this.app.get('/', (req, res) => {
      res.send(this.generateDashboardHTML());
    });
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      this.connectedClients++;
      console.log(`🔗 Dashboard client connected (${this.connectedClients} total)`);

      // Send initial data
      socket.emit('stats', this.observationEngine.getStats());
      socket.emit('recent_events', this.observationEngine.getLatestEvents(20));

      socket.on('disconnect', () => {
        this.connectedClients--;
        console.log(`🔌 Dashboard client disconnected (${this.connectedClients} total)`);
      });

      // Handle real-time queries
      socket.on('query_events', (query) => {
        const events = this.observationEngine.queryEvents(query);
        socket.emit('query_result', events);
      });

      socket.on('get_bot_fingerprint', ({ botId, hours = 24 }) => {
        const fingerprint = this.observationEngine.generateStrategyFingerprint(botId, hours);
        socket.emit('bot_fingerprint', { botId, fingerprint });
      });
    });
  }

  private setupObservationEngineListeners(): void {
    // Forward events to connected clients
    this.observationEngine.on('event', (event: ObservationEvent) => {
      this.eventBuffer.push(event);
      
      // Throttle broadcasts to avoid overwhelming clients (max 10/second)
      const now = Date.now();
      if (now - this.lastEventBroadcast > 100) {
        this.io.emit('new_events', this.eventBuffer);
        this.eventBuffer = [];
        this.lastEventBroadcast = now;
      }
    });

    // Broadcast stats updates every 5 seconds
    setInterval(() => {
      if (this.connectedClients > 0) {
        this.io.emit('stats', this.observationEngine.getStats());
      }
    }, 5000);

    // Forward leaderboard updates
    this.observationEngine.on('leaderboard', (leaderboard) => {
      this.io.emit('leaderboard', leaderboard);
    });

    // Forward engine status changes
    this.observationEngine.on('started', () => {
      this.io.emit('engine_status', { status: 'running', timestamp: Date.now() });
    });

    this.observationEngine.on('stopped', () => {
      this.io.emit('engine_status', { status: 'stopped', timestamp: Date.now() });
    });

    this.observationEngine.on('error', (error) => {
      this.io.emit('engine_error', { 
        error: error.message, 
        timestamp: Date.now() 
      });
    });
  }

  private generateDashboardHTML(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Superior Trading Bot - Observation Engine Dashboard</title>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #0a0a0a;
            color: #e0e0e0;
            line-height: 1.6;
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { 
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            border: 1px solid #333;
        }
        .header h1 { color: #00ff88; font-size: 2em; margin-bottom: 5px; }
        .header .subtitle { color: #888; font-size: 1.1em; }
        
        .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        
        .card {
            background: linear-gradient(135deg, #1a1a1a, #2a2a2a);
            border: 1px solid #444;
            border-radius: 10px;
            padding: 20px;
        }
        
        .card h3 { 
            color: #00ff88; 
            margin-bottom: 15px; 
            font-size: 1.2em;
            border-bottom: 1px solid #333;
            padding-bottom: 5px;
        }
        
        .status { 
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 0.9em;
        }
        
        .status.running { background: #00ff88; color: #000; }
        .status.error { background: #ff4444; color: #fff; }
        .status.stopped { background: #888; color: #fff; }
        
        .metric { 
            display: flex; 
            justify-content: space-between; 
            padding: 5px 0;
            border-bottom: 1px solid #333;
        }
        
        .metric:last-child { border-bottom: none; }
        .metric .label { color: #aaa; }
        .metric .value { 
            color: #00ff88; 
            font-weight: bold;
        }
        
        .events-log {
            grid-column: 1 / -1;
            max-height: 400px;
            overflow-y: auto;
            background: #0f0f0f;
            border: 1px solid #333;
            border-radius: 10px;
            padding: 15px;
        }
        
        .event {
            margin-bottom: 10px;
            padding: 10px;
            border-radius: 5px;
            background: #1a1a1a;
            border-left: 4px solid #00ff88;
            font-family: monospace;
            font-size: 0.9em;
        }
        
        .event .timestamp { color: #888; }
        .event .source { color: #ffaa00; font-weight: bold; }
        .event .type { color: #00aaff; }
        .event .details { color: #ccc; }
        
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Superior Trading Bot</h1>
            <div class="subtitle">Layer 1 Observation Engine - Real-time Arena Intelligence</div>
        </div>

        <div class="grid">
            <div class="card">
                <h3>🎯 Engine Status</h3>
                <div id="engine-status">
                    <div class="metric">
                        <span class="label">Status:</span>
                        <span class="value"><span class="status" id="status-indicator">Starting</span></span>
                    </div>
                    <div class="metric">
                        <span class="label">Uptime:</span>
                        <span class="value" id="uptime">--</span>
                    </div>
                    <div class="metric">
                        <span class="label">Events Processed:</span>
                        <span class="value" id="events-processed">0</span>
                    </div>
                    <div class="metric">
                        <span class="label">Connection:</span>
                        <span class="value" id="connection-status">--</span>
                    </div>
                </div>
            </div>

            <div class="card">
                <h3>📊 Performance Metrics</h3>
                <div id="performance-metrics">
                    <div class="metric">
                        <span class="label">Events/sec:</span>
                        <span class="value" id="events-per-second">0</span>
                    </div>
                    <div class="metric">
                        <span class="label">Avg Enrichment:</span>
                        <span class="value" id="avg-enrichment">0ms</span>
                    </div>
                    <div class="metric">
                        <span class="label">Buffer Usage:</span>
                        <span class="value" id="buffer-usage">0%</span>
                    </div>
                    <div class="metric">
                        <span class="label">Enrichment Errors:</span>
                        <span class="value" id="enrichment-errors">0</span>
                    </div>
                </div>
            </div>

            <div class="card">
                <h3>🏆 Arena Intelligence</h3>
                <div id="arena-stats">
                    <div class="metric">
                        <span class="label">Active Bots:</span>
                        <span class="value" id="active-bots">--</span>
                    </div>
                    <div class="metric">
                        <span class="label">Total Events:</span>
                        <span class="value" id="total-events">0</span>
                    </div>
                    <div class="metric">
                        <span class="label">Trades Today:</span>
                        <span class="value" id="trades-today">0</span>
                    </div>
                    <div class="metric">
                        <span class="label">Last Event:</span>
                        <span class="value" id="last-event">--</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="card events-log">
            <h3>📡 Live Event Stream</h3>
            <div id="events-container"></div>
        </div>
    </div>

    <script>
        const socket = io();
        let eventCount = 0;

        // Connect to WebSocket and handle events
        socket.on('connect', () => {
            console.log('Connected to dashboard server');
        });

        socket.on('stats', (stats) => {
            updateDashboard(stats);
        });

        socket.on('new_events', (events) => {
            events.forEach(event => {
                addEventToLog(event);
                eventCount++;
            });
        });

        socket.on('engine_status', (status) => {
            updateEngineStatus(status);
        });

        socket.on('engine_error', (error) => {
            console.error('Engine error:', error);
        });

        function updateDashboard(stats) {
            // Engine status
            document.getElementById('status-indicator').textContent = stats.status;
            document.getElementById('status-indicator').className = 'status ' + stats.status;
            document.getElementById('uptime').textContent = formatUptime(stats.uptime);
            document.getElementById('events-processed').textContent = stats.eventsProcessed.toLocaleString();
            document.getElementById('connection-status').textContent = stats.connectionStats.connected ? '🟢 Connected' : '🔴 Disconnected';

            // Performance metrics
            document.getElementById('events-per-second').textContent = stats.performanceMetrics.eventsPerSecond.toFixed(1);
            document.getElementById('avg-enrichment').textContent = stats.performanceMetrics.avgEnrichmentTime.toFixed(1) + 'ms';
            document.getElementById('buffer-usage').textContent = stats.bufferStats.bufferUtilization.toFixed(1) + '%';
            document.getElementById('enrichment-errors').textContent = stats.enrichmentErrors.toLocaleString();

            // Arena stats
            document.getElementById('total-events').textContent = stats.bufferStats.totalEvents.toLocaleString();
            document.getElementById('last-event').textContent = stats.bufferStats.newestEvent ? 
                new Date(stats.bufferStats.newestEvent).toLocaleTimeString() : '--';
        }

        function addEventToLog(event) {
            const container = document.getElementById('events-container');
            const eventDiv = document.createElement('div');
            eventDiv.className = 'event';
            
            const timestamp = new Date(event.timestamp).toLocaleTimeString();
            const payload = JSON.stringify(event.payload, null, 2);
            
            eventDiv.innerHTML = \`
                <div class="timestamp">\${timestamp}</div>
                <div class="source">Source: \${event.source}</div>
                <div class="type">Type: \${event.eventType}</div>
                <div class="details">\${formatEventPayload(event)}</div>
            \`;
            
            container.insertBefore(eventDiv, container.firstChild);
            
            // Keep only last 20 events
            while (container.children.length > 20) {
                container.removeChild(container.lastChild);
            }
        }

        function formatEventPayload(event) {
            const payload = event.payload;
            switch (event.eventType) {
                case 'trade':
                    return \`Bot: \${payload.botId}, \${payload.direction.toUpperCase()} \${payload.quantity} \${payload.symbol} @ \${payload.price}\`;
                case 'fitness_change':
                    return \`Bot: \${payload.botId}, Fitness: \${payload.oldFitness.toFixed(2)} → \${payload.newFitness.toFixed(2)}\`;
                default:
                    return \`Bot: \${payload.botId || 'N/A'}\`;
            }
        }

        function formatUptime(uptime) {
            if (!uptime) return '--';
            const seconds = Math.floor(uptime / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            return \`\${hours}h \${minutes % 60}m \${seconds % 60}s\`;
        }

        function updateEngineStatus(status) {
            const indicator = document.getElementById('status-indicator');
            indicator.textContent = status.status;
            indicator.className = 'status ' + status.status;
            
            if (status.status === 'running') {
                indicator.classList.add('pulse');
            } else {
                indicator.classList.remove('pulse');
            }
        }

        // Auto-refresh every 30 seconds
        setInterval(() => {
            fetch('/api/stats')
                .then(r => r.json())
                .then(stats => updateDashboard(stats))
                .catch(e => console.error('Failed to fetch stats:', e));
        }, 30000);
    </script>
</body>
</html>`;
  }
}