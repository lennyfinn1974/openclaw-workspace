/**
 * Layer 7: Transparency Dashboard
 *
 * Real-time dashboard on localhost:9001.
 * Express + Socket.IO + Chart.js.
 * Displays: live event stream, pattern discovery, bot intelligence,
 *           7-layer architecture status, capital allocation, risk state.
 *
 * Phase 1: DASHBOARD ONLY - no trading.
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { EventEmitter } from 'events';
import { CapitalAllocator } from './layer5-capital-allocator';
import { RiskGovernor } from './layer6-risk-governor';
import {
  DashboardState, LayerStatus, ObservationEvent, PatternSummary,
  BotSummary, MarketRegime, StrategyArm, AllocationDecision
} from './types';

export class Dashboard extends EventEmitter {
  private app: express.Application;
  private server: ReturnType<typeof createServer>;
  private io: SocketIOServer;
  private port: number;
  private allocator: CapitalAllocator;
  private riskGovernor: RiskGovernor;

  private connectedClients = 0;
  private eventStream: ObservationEvent[] = [];
  private patterns: PatternSummary[] = [];
  private bots: Map<string, BotSummary> = new Map();
  private startTime = Date.now();
  private isRunning = false;
  private currentRegime: MarketRegime = 'QUIET';
  private simulationTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: {
    port?: number;
    allocator: CapitalAllocator;
    riskGovernor: RiskGovernor;
  }) {
    super();
    this.port = config.port || 9001;
    this.allocator = config.allocator;
    this.riskGovernor = config.riskGovernor;

    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
    });

    this.setupRoutes();
    this.setupSocketHandlers();
    this.setupLayerListeners();
    this.initializeDemoData();
  }

  // ===================== LIFECYCLE =====================

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, () => {
        this.isRunning = true;
        console.log(`\n  Dashboard live at http://localhost:${this.port}\n`);
        this.startSimulation();
        resolve();
      });
      this.server.on('error', reject);
    });
  }

  async stop(): Promise<void> {
    if (this.simulationTimer) clearInterval(this.simulationTimer);
    return new Promise((resolve) => {
      this.server.close(() => {
        this.isRunning = false;
        resolve();
      });
    });
  }

  // ===================== ROUTES =====================

  private setupRoutes(): void {
    this.app.use(express.json());

    this.app.get('/health', (_req, res) => {
      res.json({ status: 'ok', uptime: Date.now() - this.startTime, clients: this.connectedClients });
    });

    this.app.get('/api/state', (_req, res) => {
      res.json(this.getState());
    });

    this.app.get('/api/allocation', (_req, res) => {
      res.json({
        arms: this.allocator.getArms(),
        allocation: this.serializeAllocation(this.allocator.getAllocation()),
        correlationMatrix: this.allocator.getCorrelationMatrix(),
      });
    });

    this.app.get('/api/risk', (_req, res) => {
      res.json(this.riskGovernor.getRiskState());
    });

    this.app.get('/api/events', (_req, res) => {
      res.json(this.eventStream.slice(-100));
    });

    this.app.get('/', (_req, res) => {
      res.send(this.generateHTML());
    });
  }

  // ===================== SOCKET.IO =====================

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      this.connectedClients++;
      console.log(`  Client connected (${this.connectedClients} total)`);

      // Send initial state
      socket.emit('init', this.getState());

      socket.on('disconnect', () => {
        this.connectedClients--;
      });

      socket.on('reset_breaker', (data: { id: string }) => {
        this.riskGovernor.resetBreaker(data.id);
        this.broadcastRiskState();
      });
    });
  }

  private setupLayerListeners(): void {
    this.allocator.on('allocation:updated', (decision: AllocationDecision) => {
      this.io.emit('allocation', {
        arms: this.allocator.getArms(),
        decision: this.serializeAllocation(decision),
        correlationMatrix: this.allocator.getCorrelationMatrix(),
      });
    });

    this.riskGovernor.on('veto', (veto: any) => {
      this.io.emit('veto', veto);
      this.addEvent({
        id: veto.id,
        timestamp: veto.timestamp,
        source: 'risk_governor',
        eventType: 'risk_veto',
        payload: veto,
      });
    });

    this.riskGovernor.on('risk:update', (state: any) => {
      this.io.emit('risk_state', state);
    });
  }

  // ===================== STATE =====================

  private getState(): any {
    return {
      layers: this.getLayerStatuses(),
      allocation: {
        arms: this.allocator.getArms(),
        totalCapital: this.allocator.getTotalCapital(),
        lastAllocation: this.serializeAllocation(this.allocator.getAllocation()),
        correlationMatrix: this.allocator.getCorrelationMatrix(),
      },
      risk: this.riskGovernor.getRiskState(),
      events: this.eventStream.slice(-50),
      patterns: this.patterns,
      bots: Array.from(this.bots.values()),
      uptime: Date.now() - this.startTime,
      startTime: this.startTime,
      regime: this.currentRegime,
    };
  }

  private serializeAllocation(decision: AllocationDecision | null): any {
    if (!decision) return null;
    return {
      ...decision,
      allocations: Object.fromEntries(decision.allocations),
    };
  }

  private getLayerStatuses(): LayerStatus[] {
    return [
      { id: 1, name: 'Observation Engine', status: 'online', health: 95, eventsProcessed: this.eventStream.length, lastEvent: this.eventStream.length > 0 ? this.eventStream[this.eventStream.length - 1].timestamp : null, details: { ringBuffer: '10K events', enrichment: 'active' } },
      { id: 2, name: 'Pattern Extraction', status: 'online', health: 82, eventsProcessed: this.patterns.length, lastEvent: this.patterns.length > 0 ? this.patterns[this.patterns.length - 1].lastSeen : null, details: { patterns: this.patterns.length, shapley: 'active' } },
      { id: 3, name: 'Strategy Synthesis', status: 'degraded', health: 45, eventsProcessed: 0, lastEvent: null, details: { gp: 'stub', nmf: 'stub' } },
      { id: 4, name: 'Competitive Intelligence', status: 'degraded', health: 30, eventsProcessed: 0, lastEvent: null, details: { markov: 'stub', crowding: 'stub' } },
      { id: 5, name: 'Capital Allocator', status: 'online', health: 90, eventsProcessed: this.allocator.getArms().reduce((s, a) => s + a.totalTrades, 0), lastEvent: this.allocator.getAllocation()?.timestamp || null, details: { method: 'Thompson Sampling + Kelly', arms: this.allocator.getArms().length } },
      { id: 6, name: 'Risk Governor', status: 'online', health: 100, eventsProcessed: this.riskGovernor.getVetoes().length, lastEvent: this.riskGovernor.getVetoes().length > 0 ? this.riskGovernor.getVetoes().slice(-1)[0].timestamp : null, details: { breakers: this.riskGovernor.getCircuitBreakers().length, maxDD: '5%' } },
      { id: 7, name: 'Transparency Dashboard', status: 'online', health: 100, eventsProcessed: this.connectedClients, lastEvent: Date.now(), details: { port: this.port, clients: this.connectedClients } },
    ];
  }

  // ===================== EVENT STREAM =====================

  addEvent(event: ObservationEvent): void {
    this.eventStream.push(event);
    if (this.eventStream.length > 500) this.eventStream.shift();
    this.io.emit('event', event);
  }

  addPattern(pattern: PatternSummary): void {
    this.patterns.push(pattern);
    if (this.patterns.length > 100) this.patterns.shift();
    this.io.emit('pattern', pattern);
  }

  updateBot(bot: BotSummary): void {
    this.bots.set(bot.botId, bot);
    this.io.emit('bot_update', bot);
  }

  private broadcastRiskState(): void {
    this.io.emit('risk_state', this.riskGovernor.getRiskState());
  }

  // ===================== SIMULATION (Phase 1 Demo Data) =====================

  private initializeDemoData(): void {
    // Demo bots
    const botNames = [
      'Alpha-Momentum', 'Beta-MeanRev', 'Gamma-Trend',
      'Delta-Volatility', 'Epsilon-ICT', 'Zeta-Adaptive',
      'Eta-Breakout', 'Theta-Scalper', 'Iota-Swing'
    ];

    botNames.forEach((name, i) => {
      this.bots.set(name, {
        botId: name,
        fitness: 0.5 + Math.random() * 0.5,
        rank: i + 1,
        trades: Math.floor(Math.random() * 100) + 10,
        winRate: 0.4 + Math.random() * 0.3,
        pnl: (Math.random() - 0.3) * 5000,
        strategy: ['momentum', 'mean-reversion', 'trend-follow', 'volatility-arb', 'ict-smart-money', 'regime-adaptive'][i % 6],
        regime: 'TRENDING',
      });
    });

    // Demo patterns
    this.patterns = [
      { id: 'p1', type: 'regime_shift', confidence: 0.85, frequency: 12, profitability: 0.023, lastSeen: Date.now() - 60000, description: 'RSI divergence precedes regime shift by 3-5 bars' },
      { id: 'p2', type: 'momentum_cascade', confidence: 0.72, frequency: 8, profitability: 0.018, lastSeen: Date.now() - 120000, description: 'MACD crossover + volume spike triggers 2x momentum' },
      { id: 'p3', type: 'mean_reversion', confidence: 0.91, frequency: 25, profitability: 0.012, lastSeen: Date.now() - 30000, description: 'BB lower band touch + RSI<30 reversal within 4 bars' },
      { id: 'p4', type: 'crowding_signal', confidence: 0.68, frequency: 5, profitability: -0.008, lastSeen: Date.now() - 300000, description: '3+ bots same direction = crowding risk (fade signal)' },
      { id: 'p5', type: 'volatility_expansion', confidence: 0.79, frequency: 15, profitability: 0.031, lastSeen: Date.now() - 45000, description: 'ATR breakout from compression = directional opportunity' },
    ];
  }

  private startSimulation(): void {
    let eventCounter = 0;
    const regimes: MarketRegime[] = ['TRENDING', 'RANGING', 'VOLATILE', 'BREAKOUT', 'QUIET'];

    this.simulationTimer = setInterval(() => {
      eventCounter++;

      // Generate simulated events
      const eventTypes = ['trade', 'fitness_change', 'position_update', 'pattern_discovered'] as const;
      const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const botNames = Array.from(this.bots.keys());
      const botId = botNames[Math.floor(Math.random() * botNames.length)];

      const event: ObservationEvent = {
        id: `sim-${eventCounter}`,
        timestamp: Date.now(),
        source: 'arena_bot',
        eventType: type,
        payload: this.generatePayload(type, botId),
      };

      this.addEvent(event);

      // Periodic regime change
      if (eventCounter % 30 === 0) {
        this.currentRegime = regimes[Math.floor(Math.random() * regimes.length)];
        this.allocator.setRegime(this.currentRegime);
        this.riskGovernor.setRegime(this.currentRegime);
        this.io.emit('regime_change', this.currentRegime);
      }

      // Update equity with small random walk
      const equity = this.riskGovernor.getRiskState().currentEquity;
      const change = (Math.random() - 0.48) * 100; // Slight positive drift
      this.riskGovernor.updateEquity(equity + change);

      // Simulate occasional trade outcomes for allocator
      if (eventCounter % 5 === 0) {
        const arms = this.allocator.getArms();
        if (arms.length > 0) {
          const arm = arms[Math.floor(Math.random() * arms.length)];
          const isWin = Math.random() < arm.winRate;
          this.allocator.recordOutcome(arm.id, {
            pnl: isWin ? Math.random() * 200 : -Math.random() * 150,
            pnlPercentage: isWin ? Math.random() * 0.02 : -Math.random() * 0.015,
            holdingPeriodMinutes: Math.floor(Math.random() * 60) + 5,
            maxAdverseExcursion: Math.random() * 0.01,
            maxFavorableExcursion: Math.random() * 0.03,
            isWinner: isWin,
          });
        }
      }

      // Update bot stats
      if (botId) {
        const bot = this.bots.get(botId);
        if (bot) {
          bot.trades += 1;
          bot.pnl += (Math.random() - 0.45) * 50;
          bot.fitness = Math.max(0, Math.min(1, bot.fitness + (Math.random() - 0.5) * 0.02));
          bot.regime = this.currentRegime;
          this.bots.set(botId, bot);
        }
      }

      // Broadcast full state every 5 seconds
      if (eventCounter % 5 === 0) {
        this.io.emit('state_update', this.getState());
      }

    }, 2000); // Event every 2 seconds
  }

  private generatePayload(type: string, botId: string): any {
    switch (type) {
      case 'trade':
        return {
          botId,
          symbol: ['EURUSD', 'BTCUSD', 'AAPL', 'GBPUSD', 'XAUUSD'][Math.floor(Math.random() * 5)],
          direction: Math.random() > 0.5 ? 'buy' : 'sell',
          quantity: Math.floor(Math.random() * 1000) + 100,
          price: 100 + Math.random() * 100,
          confidence: Math.random(),
        };
      case 'fitness_change':
        return {
          botId,
          oldFitness: 0.5 + Math.random() * 0.3,
          newFitness: 0.5 + Math.random() * 0.3,
          rankChange: Math.floor(Math.random() * 5) - 2,
        };
      case 'pattern_discovered':
        return {
          patternType: ['regime_shift', 'momentum_cascade', 'mean_reversion'][Math.floor(Math.random() * 3)],
          confidence: 0.6 + Math.random() * 0.35,
          description: 'Auto-detected pattern in bot behavior cluster',
        };
      default:
        return { botId, timestamp: Date.now() };
    }
  }

  // ===================== HTML DASHBOARD =====================

  private generateHTML(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Superior Trading Bot - 7-Layer Dashboard</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<script src="/socket.io/socket.io.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'SF Mono','Fira Code','Cascadia Code',monospace;background:#0a0b0f;color:#c8ccd0;line-height:1.5;overflow-x:hidden}
.dashboard{display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:auto auto 1fr 1fr;gap:12px;padding:12px;min-height:100vh}

/* Header */
.header{grid-column:1/-1;background:linear-gradient(135deg,#0d1117,#161b22);border:1px solid #30363d;border-radius:8px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center}
.header h1{font-size:1.4em;color:#58a6ff;font-weight:600}
.header h1 span{color:#3fb950}
.header-right{display:flex;gap:20px;align-items:center;font-size:0.85em}
.regime-badge{padding:4px 12px;border-radius:12px;font-weight:600;font-size:0.8em;text-transform:uppercase}
.regime-TRENDING{background:#1f6feb33;color:#58a6ff;border:1px solid #1f6feb}
.regime-RANGING{background:#8b949e33;color:#8b949e;border:1px solid #8b949e}
.regime-VOLATILE{background:#f8514933;color:#f85149;border:1px solid #f85149}
.regime-BREAKOUT{background:#3fb95033;color:#3fb950;border:1px solid #3fb950}
.regime-QUIET{background:#484f5833;color:#8b949e;border:1px solid #484f58}
.regime-EVENT{background:#d2a82833;color:#d2a828;border:1px solid #d2a828}
.uptime{color:#8b949e}
.phase-badge{background:#1f6feb;color:#fff;padding:4px 10px;border-radius:12px;font-size:0.75em;font-weight:700}

/* 7-Layer Status Bar */
.layer-bar{grid-column:1/-1;display:flex;gap:8px;background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:12px}
.layer-pill{flex:1;text-align:center;padding:8px 4px;border-radius:6px;font-size:0.7em;font-weight:600;cursor:default;transition:all 0.2s}
.layer-pill.online{background:#0d1117;border:1px solid #3fb950;color:#3fb950}
.layer-pill.degraded{background:#0d1117;border:1px solid #d29922;color:#d29922}
.layer-pill.offline{background:#0d1117;border:1px solid #484f58;color:#484f58}
.layer-pill.not_implemented{background:#0d1117;border:1px solid #30363d;color:#484f58}
.layer-pill .health{font-size:0.85em;opacity:0.7;display:block;margin-top:2px}

/* Cards */
.card{background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:14px;overflow:hidden}
.card h3{color:#58a6ff;font-size:0.95em;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #21262d;display:flex;align-items:center;gap:8px}
.card h3 .icon{font-size:1.1em}

/* Thompson Sampling Chart */
.allocation-card{grid-column:1/3}
.chart-container{position:relative;height:220px}

/* Risk Governor */
.risk-card{}
.risk-metric{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #161b22;font-size:0.82em}
.risk-metric:last-child{border-bottom:none}
.risk-metric .label{color:#8b949e}
.risk-metric .value{font-weight:600}
.value.green{color:#3fb950}
.value.red{color:#f85149}
.value.yellow{color:#d29922}
.value.blue{color:#58a6ff}

/* Circuit Breakers */
.breaker{display:flex;justify-content:space-between;align-items:center;padding:5px 8px;margin:3px 0;border-radius:4px;font-size:0.75em}
.breaker.closed{background:#0d1117;border:1px solid #238636}
.breaker.open{background:#f8514915;border:1px solid #f85149;animation:pulse 1.5s infinite}
.breaker.half_open{background:#d2992215;border:1px solid #d29922}
.breaker-state{padding:2px 8px;border-radius:10px;font-weight:700;font-size:0.85em}
.breaker-state.closed{color:#3fb950}
.breaker-state.open{color:#f85149}
.breaker-state.half_open{color:#d29922}

/* Event Stream */
.event-stream-card{grid-column:1/3}
.event-list{max-height:280px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#30363d #0d1117}
.event-item{padding:6px 10px;margin:3px 0;border-radius:4px;font-size:0.75em;border-left:3px solid #30363d;background:#161b22;display:flex;gap:10px;align-items:center}
.event-item.trade{border-left-color:#58a6ff}
.event-item.fitness_change{border-left-color:#3fb950}
.event-item.risk_veto{border-left-color:#f85149}
.event-item.pattern_discovered{border-left-color:#d2a828}
.event-item.position_update{border-left-color:#8b949e}
.event-time{color:#484f58;min-width:70px}
.event-type{font-weight:600;min-width:110px}
.event-detail{color:#8b949e;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* Bot Intelligence */
.bot-table{width:100%;border-collapse:collapse;font-size:0.75em}
.bot-table th{text-align:left;color:#8b949e;padding:4px 6px;border-bottom:1px solid #21262d;font-weight:500}
.bot-table td{padding:4px 6px;border-bottom:1px solid #161b22}
.bot-table tr:hover{background:#161b22}
.pnl-pos{color:#3fb950}
.pnl-neg{color:#f85149}

/* Pattern Discovery */
.pattern-item{padding:6px 10px;margin:4px 0;border-radius:4px;background:#161b22;font-size:0.78em;border-left:3px solid #d2a828}
.pattern-header{display:flex;justify-content:space-between;margin-bottom:2px}
.pattern-type{color:#d2a828;font-weight:600;text-transform:uppercase}
.pattern-confidence{color:#8b949e}
.pattern-desc{color:#6e7681;font-size:0.9em}

/* Kelly Criterion Table */
.kelly-table{width:100%;border-collapse:collapse;font-size:0.75em}
.kelly-table th{text-align:left;color:#8b949e;padding:3px 5px;border-bottom:1px solid #21262d;font-weight:500}
.kelly-table td{padding:3px 5px;border-bottom:1px solid #161b22}

/* Animations */
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
@keyframes slideIn{from{transform:translateY(-8px);opacity:0}to{transform:translateY(0);opacity:1}}
.new-event{animation:slideIn 0.3s ease}

/* Equity Chart */
.equity-chart-container{position:relative;height:180px}

/* Scrollbar */
::-webkit-scrollbar{width:6px}
::-webkit-scrollbar-track{background:#0d1117}
::-webkit-scrollbar-thumb{background:#30363d;border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:#484f58}
</style>
</head>
<body>
<div class="dashboard">
  <!-- Header -->
  <div class="header">
    <div>
      <h1>SUPERIOR TRADING BOT <span>// 7-Layer Architecture</span></h1>
    </div>
    <div class="header-right">
      <span class="phase-badge">PHASE 1: OBSERVE ONLY</span>
      <span class="regime-badge regime-QUIET" id="regime-badge">QUIET</span>
      <span class="uptime" id="uptime">Uptime: --</span>
    </div>
  </div>

  <!-- 7-Layer Status Bar -->
  <div class="layer-bar" id="layer-bar"></div>

  <!-- Capital Allocation (Thompson Sampling) -->
  <div class="card allocation-card">
    <h3><span class="icon">L5</span> Capital Allocator — Thompson Sampling + Kelly Criterion</h3>
    <div class="chart-container">
      <canvas id="allocationChart"></canvas>
    </div>
  </div>

  <!-- Risk Governor -->
  <div class="card risk-card">
    <h3><span class="icon">L6</span> Risk Governor</h3>
    <div id="risk-metrics">
      <div class="risk-metric"><span class="label">Daily P&L:</span><span class="value green" id="daily-pnl">$0.00</span></div>
      <div class="risk-metric"><span class="label">Daily DD:</span><span class="value green" id="daily-dd">0.00%</span></div>
      <div class="risk-metric"><span class="label">DD from Peak:</span><span class="value green" id="peak-dd">0.00%</span></div>
      <div class="risk-metric"><span class="label">Equity:</span><span class="value blue" id="equity">$100,000</span></div>
      <div class="risk-metric"><span class="label">Weekly P&L:</span><span class="value green" id="weekly-pnl">$0.00</span></div>
      <div class="risk-metric"><span class="label">Positions:</span><span class="value blue" id="positions">0 / 10</span></div>
    </div>
    <h3 style="margin-top:12px"><span class="icon">CB</span> Circuit Breakers</h3>
    <div id="circuit-breakers"></div>
  </div>

  <!-- Event Stream -->
  <div class="card event-stream-card">
    <h3><span class="icon">EVT</span> Live Event Stream <span style="font-size:0.8em;color:#484f58;margin-left:auto" id="event-count">0 events</span></h3>
    <div class="event-list" id="event-list"></div>
  </div>

  <!-- Bot Intelligence -->
  <div class="card">
    <h3><span class="icon">BOT</span> Arena Bot Intelligence</h3>
    <table class="bot-table">
      <thead><tr><th>Bot</th><th>Fitness</th><th>Win%</th><th>P&L</th><th>Trades</th></tr></thead>
      <tbody id="bot-tbody"></tbody>
    </table>
  </div>

  <!-- Kelly Criterion / Allocation Details -->
  <div class="card">
    <h3><span class="icon">K</span> Kelly Criterion Position Sizing</h3>
    <table class="kelly-table">
      <thead><tr><th>Strategy</th><th>Kelly f*</th><th>Alloc%</th><th>Sharpe</th><th>Win%</th></tr></thead>
      <tbody id="kelly-tbody"></tbody>
    </table>
  </div>

  <!-- Pattern Discovery -->
  <div class="card">
    <h3><span class="icon">L2</span> Pattern Discovery</h3>
    <div id="patterns-list"></div>
  </div>

  <!-- Equity Curve -->
  <div class="card" style="grid-column:1/3">
    <h3><span class="icon">EQ</span> Portfolio Equity Curve (Simulated)</h3>
    <div class="equity-chart-container">
      <canvas id="equityChart"></canvas>
    </div>
  </div>

  <!-- Correlation Matrix -->
  <div class="card">
    <h3><span class="icon">COR</span> Strategy Correlation Matrix</h3>
    <div id="correlation-matrix" style="font-size:0.7em;overflow:auto"></div>
  </div>
</div>

<script>
const socket = io();
let allocationChart = null;
let equityChart = null;
let equityData = [];
let eventCount = 0;

// ===================== INIT =====================
socket.on('connect', () => console.log('Connected to dashboard'));

socket.on('init', (state) => {
  updateLayers(state.layers);
  updateAllocation(state.allocation);
  updateRisk(state.risk);
  updateBots(state.bots);
  updatePatterns(state.patterns);
  updateRegime(state.regime);
  state.events.forEach(e => addEvent(e, false));
  updateKelly(state.allocation.arms);
  updateCorrelation(state.allocation.correlationMatrix);
  updateUptime(state.uptime);
});

socket.on('state_update', (state) => {
  updateLayers(state.layers);
  updateRisk(state.risk);
  updateBots(state.bots);
  updateUptime(state.uptime);
  updateKelly(state.allocation.arms);
  updateEquityChart(state.risk.currentEquity);
});

socket.on('allocation', (data) => {
  updateAllocationChart(data.arms);
  updateKelly(data.arms);
  if (data.correlationMatrix) updateCorrelation(data.correlationMatrix);
});

socket.on('risk_state', (state) => updateRisk(state));
socket.on('event', (event) => addEvent(event, true));
socket.on('veto', (veto) => addEvent({ id: veto.id, timestamp: veto.timestamp, source: 'risk_governor', eventType: 'risk_veto', payload: veto }, true));
socket.on('pattern', (pattern) => addPattern(pattern));
socket.on('regime_change', (regime) => updateRegime(regime));
socket.on('bot_update', (bot) => updateSingleBot(bot));

// ===================== LAYER STATUS =====================
function updateLayers(layers) {
  const bar = document.getElementById('layer-bar');
  bar.innerHTML = layers.map(l =>
    '<div class="layer-pill ' + l.status + '">' +
    'L' + l.id + ': ' + l.name +
    '<span class="health">' + l.health + '%</span></div>'
  ).join('');
}

// ===================== ALLOCATION CHART =====================
function updateAllocation(data) {
  if (!data || !data.arms) return;
  updateAllocationChart(data.arms);
}

function updateAllocationChart(arms) {
  const ctx = document.getElementById('allocationChart');
  if (!ctx) return;

  const labels = arms.map(a => a.name);
  const allocData = arms.map(a => (a.currentAllocation * 100).toFixed(1));
  const kellyData = arms.map(a => (a.kellyFraction * 100).toFixed(1));
  const colors = ['#58a6ff','#3fb950','#d2a828','#f85149','#bc8cff','#79c0ff'];

  if (allocationChart) {
    allocationChart.data.labels = labels;
    allocationChart.data.datasets[0].data = allocData;
    allocationChart.data.datasets[1].data = kellyData;
    allocationChart.update('none');
    return;
  }

  allocationChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Thompson Sampling Allocation %', data: allocData, backgroundColor: colors.map(c => c + '99'), borderColor: colors, borderWidth: 1 },
        { label: 'Kelly Fraction %', data: kellyData, backgroundColor: colors.map(c => c + '33'), borderColor: colors.map(c => c + '88'), borderWidth: 1, borderDash: [3,3] }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8b949e', font: { size: 10 } } } },
      scales: {
        x: { ticks: { color: '#8b949e', font: { size: 9 } }, grid: { color: '#21262d' } },
        y: { ticks: { color: '#8b949e', font: { size: 9 }, callback: v => v + '%' }, grid: { color: '#21262d' }, beginAtZero: true }
      }
    }
  });
}

// ===================== EQUITY CHART =====================
function updateEquityChart(equity) {
  const ctx = document.getElementById('equityChart');
  if (!ctx) return;

  equityData.push({ x: Date.now(), y: equity });
  if (equityData.length > 200) equityData.shift();

  if (equityChart) {
    equityChart.data.datasets[0].data = equityData.map(d => d.y);
    equityChart.data.labels = equityData.map(d => new Date(d.x).toLocaleTimeString());
    equityChart.update('none');
    return;
  }

  equityChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: equityData.map(d => new Date(d.x).toLocaleTimeString()),
      datasets: [{
        label: 'Portfolio Equity',
        data: equityData.map(d => d.y),
        borderColor: '#58a6ff',
        backgroundColor: '#58a6ff15',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 1.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#484f58', font: { size: 8 }, maxTicksLimit: 10 }, grid: { color: '#21262d' } },
        y: { ticks: { color: '#8b949e', font: { size: 9 }, callback: v => '$' + v.toLocaleString() }, grid: { color: '#21262d' } }
      }
    }
  });
}

// ===================== RISK =====================
function updateRisk(state) {
  if (!state) return;
  const fmt = (v, prefix='$') => prefix + Math.abs(v).toFixed(2);
  const pct = (v) => (v * 100).toFixed(2) + '%';
  const cls = (v) => v >= 0 ? 'green' : 'red';

  setVal('daily-pnl', (state.dailyPnL >= 0 ? '+' : '-') + fmt(state.dailyPnL), cls(state.dailyPnL));
  setVal('weekly-pnl', (state.weeklyPnL >= 0 ? '+' : '-') + fmt(state.weeklyPnL), cls(state.weeklyPnL));
  setVal('daily-dd', pct(Math.abs(state.dailyPnLPercent)), state.dailyPnLPercent < -0.03 ? 'red' : state.dailyPnLPercent < -0.01 ? 'yellow' : 'green');
  setVal('peak-dd', pct(state.drawdownFromPeak), state.drawdownFromPeak > 0.05 ? 'red' : state.drawdownFromPeak > 0.02 ? 'yellow' : 'green');
  setVal('equity', '$' + state.currentEquity.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:0}), 'blue');
  setVal('positions', state.openPositions + ' / ' + state.maxOpenPositions, 'blue');

  // Circuit breakers
  const cbDiv = document.getElementById('circuit-breakers');
  if (state.activeCircuitBreakers) {
    cbDiv.innerHTML = state.activeCircuitBreakers.map(b =>
      '<div class="breaker ' + b.state + '">' +
      '<span>' + b.description.substring(0, 45) + '</span>' +
      '<span class="breaker-state ' + b.state + '">' + b.state.toUpperCase() + '</span>' +
      '</div>'
    ).join('');
  }
}

function setVal(id, text, colorClass) {
  const el = document.getElementById(id);
  if (el) { el.textContent = text; el.className = 'value ' + colorClass; }
}

// ===================== EVENT STREAM =====================
function addEvent(event, animate) {
  if (!event) return;
  eventCount++;
  document.getElementById('event-count').textContent = eventCount + ' events';

  const list = document.getElementById('event-list');
  const div = document.createElement('div');
  div.className = 'event-item ' + event.eventType + (animate ? ' new-event' : '');

  const time = new Date(event.timestamp).toLocaleTimeString();
  const detail = formatPayload(event);

  div.innerHTML =
    '<span class="event-time">' + time + '</span>' +
    '<span class="event-type">' + event.eventType.replace(/_/g, ' ') + '</span>' +
    '<span class="event-detail">' + detail + '</span>';

  list.insertBefore(div, list.firstChild);
  while (list.children.length > 50) list.removeChild(list.lastChild);
}

function formatPayload(event) {
  const p = event.payload;
  if (!p) return '';
  switch (event.eventType) {
    case 'trade': return (p.botId || '') + ' ' + (p.direction||'').toUpperCase() + ' ' + (p.quantity||0) + ' ' + (p.symbol||'') + ' @ ' + (p.price ? p.price.toFixed(2) : '');
    case 'fitness_change': return (p.botId||'') + ' ' + (p.oldFitness||0).toFixed(3) + ' → ' + (p.newFitness||0).toFixed(3) + ' (rank ' + (p.rankChange > 0 ? '+' : '') + (p.rankChange||0) + ')';
    case 'risk_veto': return p.reason || 'Veto issued';
    case 'pattern_discovered': return (p.patternType||'') + ' conf=' + ((p.confidence||0)*100).toFixed(0) + '%';
    default: return JSON.stringify(p).substring(0, 80);
  }
}

// ===================== BOTS =====================
function updateBots(bots) {
  if (!bots) return;
  bots.sort((a,b) => b.fitness - a.fitness);
  const tbody = document.getElementById('bot-tbody');
  tbody.innerHTML = bots.map(b =>
    '<tr><td>' + b.botId + '</td>' +
    '<td>' + b.fitness.toFixed(3) + '</td>' +
    '<td>' + (b.winRate*100).toFixed(1) + '%</td>' +
    '<td class="' + (b.pnl >= 0 ? 'pnl-pos' : 'pnl-neg') + '">$' + b.pnl.toFixed(0) + '</td>' +
    '<td>' + b.trades + '</td></tr>'
  ).join('');
}

function updateSingleBot(bot) {
  // Full refresh on next state_update
}

// ===================== KELLY TABLE =====================
function updateKelly(arms) {
  if (!arms) return;
  const tbody = document.getElementById('kelly-tbody');
  tbody.innerHTML = arms.map(a =>
    '<tr><td>' + a.name + '</td>' +
    '<td>' + (a.kellyFraction * 100).toFixed(2) + '%</td>' +
    '<td>' + (a.currentAllocation * 100).toFixed(1) + '%</td>' +
    '<td>' + a.sharpeRatio.toFixed(2) + '</td>' +
    '<td>' + (a.winRate * 100).toFixed(1) + '%</td></tr>'
  ).join('');
}

// ===================== PATTERNS =====================
function updatePatterns(patterns) {
  const list = document.getElementById('patterns-list');
  list.innerHTML = patterns.map(p =>
    '<div class="pattern-item">' +
    '<div class="pattern-header">' +
    '<span class="pattern-type">' + p.type + '</span>' +
    '<span class="pattern-confidence">Conf: ' + (p.confidence*100).toFixed(0) + '% | Freq: ' + p.frequency + '</span>' +
    '</div>' +
    '<div class="pattern-desc">' + p.description + '</div>' +
    '</div>'
  ).join('');
}

function addPattern(p) {
  const list = document.getElementById('patterns-list');
  const div = document.createElement('div');
  div.className = 'pattern-item new-event';
  div.innerHTML =
    '<div class="pattern-header"><span class="pattern-type">' + p.type + '</span>' +
    '<span class="pattern-confidence">Conf: ' + (p.confidence*100).toFixed(0) + '%</span></div>' +
    '<div class="pattern-desc">' + p.description + '</div>';
  list.insertBefore(div, list.firstChild);
  while (list.children.length > 10) list.removeChild(list.lastChild);
}

// ===================== CORRELATION MATRIX =====================
function updateCorrelation(matrix) {
  if (!matrix || !matrix.matrix) return;
  const div = document.getElementById('correlation-matrix');
  const ids = matrix.strategyIds.map(id => id.substring(0, 8));
  let html = '<table style="width:100%;border-collapse:collapse">';
  html += '<tr><th></th>' + ids.map(id => '<th style="color:#8b949e;padding:2px 3px;font-size:0.9em">' + id + '</th>').join('') + '</tr>';
  for (let i = 0; i < matrix.matrix.length; i++) {
    html += '<tr><td style="color:#8b949e;padding:2px 4px;font-weight:600">' + ids[i] + '</td>';
    for (let j = 0; j < matrix.matrix[i].length; j++) {
      const v = matrix.matrix[i][j];
      const color = v > 0.5 ? '#3fb950' : v > 0 ? '#3fb95066' : v > -0.5 ? '#f8514966' : '#f85149';
      html += '<td style="text-align:center;padding:2px 3px;color:' + color + '">' + v.toFixed(2) + '</td>';
    }
    html += '</tr>';
  }
  html += '</table>';
  div.innerHTML = html;
}

// ===================== REGIME =====================
function updateRegime(regime) {
  const badge = document.getElementById('regime-badge');
  badge.textContent = regime;
  badge.className = 'regime-badge regime-' + regime;
}

// ===================== UPTIME =====================
function updateUptime(ms) {
  const s = Math.floor(ms/1000);
  const m = Math.floor(s/60);
  const h = Math.floor(m/60);
  document.getElementById('uptime').textContent = 'Uptime: ' + h + 'h ' + (m%60) + 'm ' + (s%60) + 's';
}

// Refresh uptime every second
setInterval(() => {
  const el = document.getElementById('uptime');
  if (!el) return;
  const text = el.textContent;
  const match = text.match(/(\\d+)h (\\d+)m (\\d+)s/);
  if (match) {
    let s = parseInt(match[3]) + 1;
    let m = parseInt(match[2]);
    let h = parseInt(match[1]);
    if (s >= 60) { s = 0; m++; }
    if (m >= 60) { m = 0; h++; }
    el.textContent = 'Uptime: ' + h + 'h ' + m + 'm ' + s + 's';
  }
}, 1000);
</script>
</body>
</html>`;
  }
}
