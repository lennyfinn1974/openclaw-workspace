import { EventEmitter } from 'events';
import { PythonBridge } from '../ipc/PythonBridge';
import { MessageRouter } from '../ipc/MessageRouter';
import { ArenaDataCollector } from '../arena/ArenaDataCollector';
import { FingerprintEngine } from './FingerprintEngine';
import { ShapleyCoordinator } from './ShapleyCoordinator';
import { PatternCoordinator } from './PatternCoordinator';
import { CompetitiveCoordinator } from './CompetitiveCoordinator';
import { IntelligenceStatus, ArenaTrade } from '../types/intelligence';

export class IntelligenceOrchestrator extends EventEmitter {
  private bridge: PythonBridge;
  private router: MessageRouter;
  private collector: ArenaDataCollector;
  private fingerprints: FingerprintEngine;
  private shapley: ShapleyCoordinator;
  private patterns: PatternCoordinator;
  private competitive: CompetitiveCoordinator;

  private startTime = 0;
  private totalTradesProcessed = 0;

  constructor(opts?: { arenaUrl?: string; pythonPath?: string }) {
    super();

    this.bridge = new PythonBridge({ pythonPath: opts?.pythonPath });
    this.router = new MessageRouter(this.bridge);
    this.collector = new ArenaDataCollector({ arenaUrl: opts?.arenaUrl });
    this.fingerprints = new FingerprintEngine();
    this.shapley = new ShapleyCoordinator(this.router, this.collector);
    this.patterns = new PatternCoordinator(this.router, this.collector);
    this.competitive = new CompetitiveCoordinator(
      this.router, this.collector, this.patterns, this.fingerprints
    );
  }

  async start(): Promise<void> {
    this.startTime = Date.now();
    console.log('[Orchestrator] Starting Phase 2 Intelligence System...');

    // 1. Start Python bridge
    console.log('[Orchestrator] Starting Python ML Engine...');
    this.bridge.on('log', (msg: string) => console.log(`[Python] ${msg}`));
    this.bridge.on('error', (err: Error) => console.error(`[Python Error] ${err.message}`));
    await this.bridge.start();
    console.log('[Orchestrator] Python ML Engine connected');

    // 2. Wire up ALL trade listeners BEFORE connecting (so bootstrap trades are captured)
    this.collector.on('trade', (trade: ArenaTrade) => {
      this.totalTradesProcessed++;
      this.fingerprints.processTrade(trade);
      this.emit('trade', trade);
    });

    // 3. Start intelligence systems (registers their collector listeners) BEFORE arena connect
    this.shapley.start();
    this.patterns.start();
    this.competitive.start();

    // Forward events
    this.shapley.on('batch_complete', (attrs) => this.emit('attribution', attrs));
    this.patterns.on('clustered', (result) => this.emit('archetypes', result));
    this.competitive.on('predictions', (preds) => this.emit('predictions', preds));
    this.competitive.on('crowding', (alerts) => this.emit('crowding', alerts));
    this.competitive.on('niches', (map) => this.emit('niches', map));

    // Error forwarding
    for (const component of [this.shapley, this.patterns, this.competitive]) {
      component.on('error', (err: any) => {
        console.error(`[Intelligence Error] ${err.message || err}`);
        this.emit('error', err);
      });
    }

    // 4. NOW connect to Arena — bootstrap trades will hit all registered listeners
    console.log('[Orchestrator] Connecting to Arena...');
    await this.collector.start();
    console.log(`[Orchestrator] Arena connected, ${this.collector.getTradeCount()} initial trades`);

    console.log('[Orchestrator] All intelligence systems started');
  }

  getStatus(): IntelligenceStatus {
    return {
      uptime: Date.now() - this.startTime,
      arenaConnected: this.collector.isConnected(),
      pythonBridgeConnected: this.bridge.isConnected(),
      totalTradesProcessed: this.totalTradesProcessed,
      lastAttributionRun: this.shapley.getLastRunTimestamp() || null,
      lastClusteringRun: this.patterns.getLastRunTimestamp() || null,
      lastPredictionRun: this.competitive.getLastPredictionTimestamp() || null,
      activeCrowdingAlerts: this.competitive.getCrowdingAlerts().length,
      archetypeCount: this.patterns.getArchetypes().length,
      botCount: this.collector.getBotIds().length
    };
  }

  // Expose subsystem getters for the dashboard
  getCollector(): ArenaDataCollector { return this.collector; }
  getFingerprints(): FingerprintEngine { return this.fingerprints; }
  getShapley(): ShapleyCoordinator { return this.shapley; }
  getPatterns(): PatternCoordinator { return this.patterns; }
  getCompetitive(): CompetitiveCoordinator { return this.competitive; }
  getRouter(): MessageRouter { return this.router; }

  async stop(): Promise<void> {
    console.log('[Orchestrator] Shutting down...');
    this.shapley.stop();
    this.patterns.stop();
    this.competitive.stop();
    this.collector.stop();
    await this.bridge.stop();
    console.log('[Orchestrator] Shutdown complete');
  }
}
