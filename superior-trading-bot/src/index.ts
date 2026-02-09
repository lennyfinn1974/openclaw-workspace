/**
 * Superior Trading Bot - Layers 1-4 Entry Point
 * Meta-Cognitive Trading System
 *
 * Layer 1: Observation Engine (real-time event ingestion & enrichment)
 * Layer 2: Pattern Extraction (Shapley attribution, behavioral clustering)
 * Layer 3: Strategy Synthesis (GP, NMF, adversarial generation)
 * Layer 4: Competitive Intelligence (Markov chains, crowding, niche discovery)
 *
 * Phase 1: ANALYSIS ONLY — no live trading
 */

import { ObservationEngine } from './observation/ObservationEngine';
import { MonitoringServer } from './dashboard/MonitoringServer';
import { SynthesisEngine } from './synthesis/SynthesisEngine';
import { CompetitiveIntelligence } from './intelligence/CompetitiveIntelligence';

async function main() {
  console.log('=== SUPERIOR TRADING BOT - META-COGNITIVE SYSTEM ===');
  console.log('Phase 1: ANALYSIS ONLY - Observation + Intelligence');
  console.log('Layers: 1-Observation | 2-Patterns | 3-Synthesis | 4-Intelligence\n');

  try {
    // ===================== LAYER 1: OBSERVATION ENGINE =====================
    console.log('[Layer 1] Starting Observation Engine...');

    const observationEngine = new ObservationEngine({
      arenaUrl: 'ws://localhost:3000',
      bufferSize: 10000,
      enableEnrichment: true,
      cleanupInterval: 300000,
    });

    // ===================== LAYER 3: SYNTHESIS ENGINE =====================
    console.log('[Layer 3] Initializing Strategy Synthesis Engine...');

    const synthesisEngine = new SynthesisEngine({
      synthesisInterval: 30000,
      maxActiveStrategies: 20,
      minValidationScore: 0.5,
    });

    // ===================== LAYER 4: COMPETITIVE INTELLIGENCE =====================
    console.log('[Layer 4] Initializing Competitive Intelligence Engine...');

    const competitiveIntel = new CompetitiveIntelligence({
      predictionUpdateInterval: 10000,
      crowdingWindowMinutes: 5,
      markovOrder: 2,
      minTradesForPrediction: 10,
    });

    // ===================== DASHBOARD =====================
    const dashboard = new MonitoringServer(observationEngine, {
      port: 8083,
    });

    // ===================== EVENT WIRING =====================

    // Feed observation events to intelligence layers
    observationEngine.on('event', (event: any) => {
      // Feed to competitive intelligence
      competitiveIntel.processEvent(event);

      // Log significant events
      if (event.eventType === 'trade') {
        const trade = event.payload as any;
        console.log(`[Trade] ${trade.botId} ${(trade.direction || trade.side || '').toUpperCase()} ${trade.symbol} @ ${trade.price}`);
      }
    });

    // Synthesis engine events
    synthesisEngine.on('gp:generation', (stats: any) => {
      if (stats.generation % 10 === 0) {
        console.log(`[GP] Gen ${stats.generation} | Best: ${stats.bestFitness.toFixed(4)} | Avg: ${stats.avgFitness.toFixed(4)} | Diversity: ${stats.diversityIndex.toFixed(2)}`);
      }
    });

    synthesisEngine.on('gp:converged', (data: any) => {
      console.log(`[GP] CONVERGED at generation ${data.generation} with fitness ${data.fitness.toFixed(4)}`);
    });

    synthesisEngine.on('nmf:complete', (data: any) => {
      console.log(`[NMF] Factorization complete: ${data.factors} factors, error: ${data.error.toFixed(4)}, converged: ${data.converged}`);
    });

    synthesisEngine.on('adversarial:generated', (data: any) => {
      console.log(`[ADV] Generated ${data.count} adversarial counter-strategies`);
    });

    synthesisEngine.on('validation:complete', (data: any) => {
      console.log(`[VAL] Strategy ${data.strategyId} validated: score ${data.score.toFixed(3)}`);
    });

    // Competitive intelligence events
    competitiveIntel.on('crowding:detected', (alert: any) => {
      console.log(`[CROWD] ${alert.severity.toUpperCase()} crowding detected: ${alert.symbol} ${alert.direction} | ${alert.botsInvolved.length} bots | Rec: ${alert.recommendation}`);
    });

    competitiveIntel.on('niche:updated', (stats: any) => {
      console.log(`[NICHE] Map updated: ${stats.underexploited} underexploited, ${stats.overcrowded} overcrowded, ${stats.unexplored} unexplored`);
    });

    competitiveIntel.on('model:retrained', (info: any) => {
      console.log(`[ML] Model retrained for ${info.botId}: accuracy ${(info.accuracy * 100).toFixed(1)}%`);
    });

    // ===================== GRACEFUL SHUTDOWN =====================
    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}, shutting down gracefully...`);

      try {
        await synthesisEngine.stop();
        await competitiveIntel.stop();
        await dashboard.stop();
        await observationEngine.stop();
        console.log('Shutdown complete');
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // ===================== START ALL SYSTEMS =====================
    console.log('\nStarting all systems...');

    // Start Layer 1
    await observationEngine.start();
    console.log('[Layer 1] Observation Engine ONLINE');

    // Start Dashboard
    await dashboard.start();
    console.log('[Dashboard] Monitoring at http://localhost:8083');

    // Collect initial historical data, then start ML layers
    const initialData = observationEngine.getLatestEvents(1000);

    // Start Layer 3
    await synthesisEngine.start(initialData);
    console.log('[Layer 3] Synthesis Engine ONLINE');

    // Start Layer 4
    await competitiveIntel.start(initialData);
    console.log('[Layer 4] Competitive Intelligence ONLINE');

    // ===================== STATUS DISPLAY =====================
    console.log('\n=== ALL LAYERS OPERATIONAL ===');
    console.log('Arena Connection:    ws://localhost:3000');
    console.log('Dashboard:           http://localhost:8083');
    console.log('GP Population:       100 individuals');
    console.log('NMF Factors:         5 latent factors');
    console.log('Markov Order:        2nd-order chains');
    console.log('Crowding Window:     5 minutes');
    console.log('Mode:                ANALYSIS ONLY (Phase 1)');
    console.log('');

    // Periodic status report
    setInterval(() => {
      const synStatus = synthesisEngine.getStatus();
      const intelStatus = competitiveIntel.getStatus();

      console.log(`\n--- STATUS REPORT ---`);
      console.log(`[Synthesis] Gen: ${synStatus.generation} | Active: ${synStatus.activeStrategies} | Approved: ${synStatus.strategiesApproved}/${synStatus.strategiesValidated} | Best: ${synStatus.bestStrategyFitness.toFixed(4)}`);
      console.log(`[Intel] Bots: ${intelStatus.botsTracked} | Predictions: ${intelStatus.predictionsGenerated} | Accuracy: ${(intelStatus.predictionAccuracy * 100).toFixed(1)}% | Crowding: ${intelStatus.activeCrowdingAlerts} | Niches: ${intelStatus.underexploitedNiches} underexploited`);
      console.log(`[Smart Money] ${intelStatus.smartMoneyBots.length > 0 ? intelStatus.smartMoneyBots.join(', ') : 'Analyzing...'}`);
    }, 60000); // Every minute

    // Simulate market data for testing
    setInterval(() => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'];
      symbols.forEach(symbol => {
        const price = 50000 + Math.random() * 1000;
        observationEngine.addMarketData(
          symbol,
          price - 0.5,
          price + 0.5,
          100 + Math.random() * 500,
          100 + Math.random() * 500
        );
      });
    }, 5000);

  } catch (error) {
    console.error('Failed to start Superior Trading Bot:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main };
