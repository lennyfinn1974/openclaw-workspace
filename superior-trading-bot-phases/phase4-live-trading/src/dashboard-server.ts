/**
 * Dashboard Server — Status API on port 9002
 *
 * REST API:
 * - GET /api/status — full performance summary
 * - GET /api/equity-curve — equity curve data
 * - GET /api/leaderboard — 22-entry comparison
 * - GET /api/trades — recent trade history
 * - GET /api/risk — risk governor state
 * - POST /api/mode — toggle paper/live
 * - POST /api/kill-switch/reset — manual reset
 *
 * Socket.IO pushes:
 * - performance:snapshot, trade:executed, risk:veto, kill-switch:tripped
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { EventEmitter } from 'events';
import { ExecutionEngine } from './execution-engine';
import { PerformanceMonitor } from './performance-monitor';
import { RiskGovernor } from './risk-governor';
import { CapitalAllocator } from './capital-allocator';
import { StrategyRouter } from './strategy-router';
import { ArenaConnector } from './arena-connector';
import { TradingMode, FillReport, RiskVeto, KillSwitchState } from './types';

// ===================== DASHBOARD SERVER =====================

export class DashboardServer extends EventEmitter {
  private app: express.Application;
  private httpServer: ReturnType<typeof createServer>;
  private io: SocketIOServer;
  private port: number;

  private engine: ExecutionEngine;
  private perfMonitor: PerformanceMonitor;
  private riskGovernor: RiskGovernor;
  private allocator: CapitalAllocator;
  private strategyRouter: StrategyRouter;
  private arena: ArenaConnector;

  constructor(config: {
    port?: number;
    engine: ExecutionEngine;
    perfMonitor: PerformanceMonitor;
    riskGovernor: RiskGovernor;
    allocator: CapitalAllocator;
    strategyRouter: StrategyRouter;
    arena: ArenaConnector;
  }) {
    super();
    this.port = config.port || 9002;
    this.engine = config.engine;
    this.perfMonitor = config.perfMonitor;
    this.riskGovernor = config.riskGovernor;
    this.allocator = config.allocator;
    this.strategyRouter = config.strategyRouter;
    this.arena = config.arena;

    this.app = express();
    this.app.use(express.json());

    // CORS
    this.app.use((_req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      if (_req.method === 'OPTIONS') { res.sendStatus(200); return; }
      next();
    });

    this.httpServer = createServer(this.app);
    this.io = new SocketIOServer(this.httpServer, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
    });

    this.setupRoutes();
    this.setupSocketIO();
  }

  // ===================== REST ROUTES =====================

  private setupRoutes(): void {
    // GET /api/status — full performance summary
    this.app.get('/api/status', (_req, res) => {
      const snapshot = this.perfMonitor.getSnapshot();
      const riskState = this.riskGovernor.getRiskState();
      const killSwitch = this.engine.getKillSwitchState();
      const allocation = this.allocator.getAllocation();

      res.json({
        mode: this.engine.getMode(),
        connected: this.arena.isConnected(),
        snapshot,
        risk: riskState,
        killSwitch,
        allocation: allocation ? {
          method: allocation.method,
          confidence: allocation.confidence,
          regime: allocation.regime,
          timestamp: allocation.timestamp,
        } : null,
        positions: this.engine.getPositions(),
        uptime: process.uptime(),
      });
    });

    // GET /api/equity-curve
    this.app.get('/api/equity-curve', (_req, res) => {
      res.json(this.perfMonitor.getEquityCurve());
    });

    // GET /api/leaderboard
    this.app.get('/api/leaderboard', (_req, res) => {
      res.json(this.perfMonitor.getLeaderboard());
    });

    // GET /api/trades
    this.app.get('/api/trades', (req, res) => {
      const limit = parseInt(req.query.limit as string) || 50;
      res.json(this.engine.getRecentTrades(limit));
    });

    // GET /api/risk
    this.app.get('/api/risk', (_req, res) => {
      res.json({
        state: this.riskGovernor.getRiskState(),
        limits: this.riskGovernor.getLimits(),
        breakers: this.riskGovernor.getCircuitBreakers(),
        vetoes: this.riskGovernor.getVetoes().slice(-50),
      });
    });

    // GET /api/positions
    this.app.get('/api/positions', (_req, res) => {
      res.json(this.engine.getPositions());
    });

    // GET /api/strategies
    this.app.get('/api/strategies', (_req, res) => {
      res.json(this.allocator.getArms());
    });

    // POST /api/mode — toggle paper/live
    this.app.post('/api/mode', (req, res) => {
      const { mode } = req.body;
      if (mode !== 'paper' && mode !== 'live') {
        res.status(400).json({ error: 'Mode must be "paper" or "live"' });
        return;
      }
      this.engine.setMode(mode as TradingMode);
      res.json({ mode: this.engine.getMode(), message: `Switched to ${mode} mode` });
    });

    // POST /api/kill-switch/reset — manual reset
    this.app.post('/api/kill-switch/reset', (_req, res) => {
      this.engine.resetKillSwitch();
      res.json({ killSwitch: this.engine.getKillSwitchState(), message: 'Kill switch reset' });
    });

    // Health check
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'ok', uptime: process.uptime() });
    });
  }

  // ===================== SOCKET.IO =====================

  private setupSocketIO(): void {
    this.io.on('connection', (socket) => {
      console.log(`[DASHBOARD] Client connected: ${socket.id}`);

      // Send current state on connect
      socket.emit('performance:snapshot', this.perfMonitor.getSnapshot());

      socket.on('disconnect', () => {
        console.log(`[DASHBOARD] Client disconnected: ${socket.id}`);
      });
    });
  }

  wireEvents(): void {
    // Forward engine events to Socket.IO clients
    this.engine.on('trade:executed', (fill: FillReport) => {
      this.io.emit('trade:executed', fill);
    });

    this.engine.on('kill-switch:tripped', (state: KillSwitchState) => {
      this.io.emit('kill-switch:tripped', state);
    });

    this.engine.on('mode:changed', (change: any) => {
      this.io.emit('mode:changed', change);
    });

    this.riskGovernor.on('veto', (veto: RiskVeto) => {
      this.io.emit('risk:veto', veto);
    });

    this.perfMonitor.on('snapshot', (snapshot: any) => {
      this.io.emit('performance:snapshot', snapshot);
    });
  }

  // ===================== LIFECYCLE =====================

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.wireEvents();
      this.httpServer.listen(this.port, () => {
        console.log(`[DASHBOARD] Server running on http://localhost:${this.port}`);
        this.emit('started');
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.io.close();
      this.httpServer.close(() => {
        console.log('[DASHBOARD] Server stopped');
        this.emit('stopped');
        resolve();
      });
    });
  }
}
