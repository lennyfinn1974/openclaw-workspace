import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { IntelligenceOrchestrator } from '../intelligence/IntelligenceOrchestrator';

export class IntelligenceDashboard {
  private app: express.Application;
  private httpServer: ReturnType<typeof createServer>;
  private io: SocketIOServer;
  private orchestrator: IntelligenceOrchestrator;
  private port: number;

  constructor(orchestrator: IntelligenceOrchestrator, port = 8084) {
    this.orchestrator = orchestrator;
    this.port = port;

    this.app = express();
    this.app.use(cors());
    this.app.use(express.json());

    this.httpServer = createServer(this.app);
    this.io = new SocketIOServer(this.httpServer, {
      cors: { origin: '*', methods: ['GET', 'POST'] }
    });

    this.setupRoutes();
    this.setupSocketIO();
  }

  private setupRoutes(): void {
    // Health
    this.app.get('/health', (_req, res) => {
      const status = this.orchestrator.getStatus();
      res.json({
        status: 'ok',
        pythonBridge: status.pythonBridgeConnected,
        arenaConnected: status.arenaConnected,
        uptime: status.uptime,
        botCount: status.botCount,
        tradesProcessed: status.totalTradesProcessed
      });
    });

    // System status
    this.app.get('/api/status', (_req, res) => {
      res.json(this.orchestrator.getStatus());
    });

    // Shapley attribution for a bot
    this.app.get('/api/attribution/:botId', (req, res) => {
      const botId = req.params.botId;
      const shapley = this.orchestrator.getShapley();
      const attrs = shapley.getAttribution(botId);
      const summary = shapley.getSummary(botId);
      res.json({ botId, attributions: attrs, summary: summary || null });
    });

    // All attribution summaries
    this.app.get('/api/attribution', (_req, res) => {
      res.json(this.orchestrator.getShapley().getAllSummaries());
    });

    // Archetypes (clustering results)
    this.app.get('/api/archetypes', (_req, res) => {
      const clustering = this.orchestrator.getPatterns().getLatestClustering();
      res.json(clustering || { archetypes: [], embeddings: [], noise: [], silhouetteScore: 0 });
    });

    // UMAP embeddings
    this.app.get('/api/embedding', (_req, res) => {
      res.json(this.orchestrator.getPatterns().getEmbeddings());
    });

    // XGBoost predictions
    this.app.get('/api/predictions', (_req, res) => {
      res.json(this.orchestrator.getCompetitive().getPredictions());
    });

    // Crowding alerts
    this.app.get('/api/crowding', (_req, res) => {
      res.json(this.orchestrator.getCompetitive().getCrowdingAlerts());
    });

    // Niche opportunity map
    this.app.get('/api/niches', (_req, res) => {
      const nicheMap = this.orchestrator.getCompetitive().getNicheMap();
      res.json(nicheMap || { cells: [], timestamp: 0 });
    });

    // All 21 bot fingerprints
    this.app.get('/api/fingerprints', (_req, res) => {
      res.json(this.orchestrator.getFingerprints().getAllFingerprints());
    });

    // Single bot fingerprint
    this.app.get('/api/fingerprints/:botId', (req, res) => {
      const fp = this.orchestrator.getFingerprints().getFingerprint(req.params.botId);
      if (fp) {
        res.json(fp);
      } else {
        res.status(404).json({ error: 'Bot not found' });
      }
    });

    // Regime x archetype matrix
    this.app.get('/api/regime-matrix', async (req, res) => {
      try {
        const patterns = this.orchestrator.getPatterns();
        const clustering = patterns.getLatestClustering();
        if (!clustering || clustering.archetypes.length === 0) {
          res.json({ cells: [], archetypeCount: 0, regimeCount: 8 });
          return;
        }

        const fingerprints = this.orchestrator.getFingerprints();
        const botPerfByRegime: Record<string, Record<string, any>> = {};
        for (const botId of this.orchestrator.getCollector().getBotIds()) {
          const fp = fingerprints.getFingerprint(botId);
          if (fp) {
            botPerfByRegime[botId] = fp.performanceByRegime as any;
          }
        }

        const router = this.orchestrator.getRouter();
        const result = await router.send('fingerprint:regime_matrix', {
          archetypes: clustering.archetypes.map(a => ({
            id: a.id,
            memberBotIds: a.memberBotIds
          })),
          botPerformanceByRegime: botPerfByRegime
        });

        res.json({ ...result, timestamp: Date.now() });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // IPC stats
    this.app.get('/api/ipc-stats', (_req, res) => {
      res.json(this.orchestrator.getRouter().getStats());
    });
  }

  private setupSocketIO(): void {
    this.io.on('connection', (socket) => {
      console.log(`[Dashboard] Client connected: ${socket.id}`);

      // Send current state on connect
      socket.emit('intelligence:status', this.orchestrator.getStatus());

      socket.on('disconnect', () => {
        console.log(`[Dashboard] Client disconnected: ${socket.id}`);
      });
    });

    // Forward orchestrator events to all connected clients
    this.orchestrator.on('attribution', (data) => {
      this.io.emit('intelligence:attribution', data);
    });

    this.orchestrator.on('archetypes', (data) => {
      this.io.emit('intelligence:archetypes', data);
    });

    this.orchestrator.on('predictions', (data) => {
      this.io.emit('intelligence:predictions', data);
    });

    this.orchestrator.on('crowding', (data) => {
      this.io.emit('intelligence:crowding', data);
    });

    this.orchestrator.on('niches', (data) => {
      this.io.emit('intelligence:niches', data);
    });

    // Periodic status broadcast
    setInterval(() => {
      this.io.emit('intelligence:status', this.orchestrator.getStatus());
    }, 5000);
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.listen(this.port, () => {
        console.log(`[Dashboard] Intelligence Dashboard running on port ${this.port}`);
        resolve();
      });
    });
  }

  stop(): void {
    this.io.close();
    this.httpServer.close();
  }
}
