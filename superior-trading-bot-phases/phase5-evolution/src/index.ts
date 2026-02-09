import { ArenaClient } from './utils/ArenaClient';
import { StateStore } from './utils/StateStore';
import { StrategyLifecycle } from './lifecycle/StrategyLifecycle';
import { NoveltySearch } from './novelty/NoveltySearch';
import { RedQueenEngine } from './red-queen/RedQueenEngine';
import { AntifragilityLayer } from './antifragility/AntifragilityLayer';
import { MetaLearner } from './metalearning/MetaLearner';
import { CompetitiveMode } from './competitive/CompetitiveMode';

const ARENA_URL = process.env.ARENA_URL || 'http://localhost:3000';

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('  Phase 5: Autonomous Evolution & Anti-Fragility');
  console.log('  Superior Trading Bot — Competitive Mode');
  console.log('='.repeat(60));
  console.log();

  // 1. Initialize StateStore (load persisted state)
  console.log('[Boot] 1/9 Initializing state store...');
  const store = new StateStore();
  store.initialize();

  // 2. Connect ArenaClient
  console.log('[Boot] 2/9 Connecting to arena...');
  const arenaClient = new ArenaClient(ARENA_URL);
  arenaClient.connect();

  // 3. Initialize StrategyLifecycle
  console.log('[Boot] 3/9 Initializing strategy lifecycle...');
  const lifecycle = new StrategyLifecycle(store);
  lifecycle.initialize();

  // 4. Initialize NoveltySearch
  console.log('[Boot] 4/9 Initializing novelty search...');
  const novelty = new NoveltySearch(store);
  novelty.initialize();

  // 5. Initialize RedQueenEngine
  console.log('[Boot] 5/9 Initializing Red Queen engine...');
  const redQueen = new RedQueenEngine(lifecycle, store);
  redQueen.initialize();

  // 6. Initialize AntifragilityLayer
  console.log('[Boot] 6/9 Initializing antifragility layer...');
  const antifragility = new AntifragilityLayer(store);
  antifragility.initialize();

  // 7. Initialize MetaLearner
  console.log('[Boot] 7/9 Initializing meta-learner...');
  const metaLearner = new MetaLearner(store);
  metaLearner.initialize();

  // 8. Initialize CompetitiveMode (wire everything together)
  console.log('[Boot] 8/9 Initializing competitive mode...');
  const competitive = new CompetitiveMode(
    arenaClient,
    store,
    lifecycle,
    novelty,
    redQueen,
    antifragility,
    metaLearner,
  );

  // 9. Start the system
  console.log('[Boot] 9/9 Starting competitive mode...');
  await competitive.start();

  console.log();
  console.log('='.repeat(60));
  console.log('  Phase 5 ONLINE');
  console.log(`  Arena:     ${ARENA_URL}`);
  console.log(`  Dashboard: http://localhost:8085`);
  console.log(`  Strategies: ${lifecycle.getPopulationSize()} active`);
  console.log('='.repeat(60));
  console.log();

  // Lifecycle event logging
  lifecycle.on('strategy:promoted', ({ strategy, transition }) => {
    console.log(`[EVENT] PROMOTED: ${strategy.id.slice(0, 8)} ${transition.from} → ${transition.to}`);
  });

  lifecycle.on('strategy:retired', ({ strategy, transition }) => {
    console.log(`[EVENT] RETIRED: ${strategy.id.slice(0, 8)} — ${transition.reason}`);
  });

  lifecycle.on('strategy:resurrected', (strategy) => {
    console.log(`[EVENT] RESURRECTED: ${strategy.id.slice(0, 8)}`);
  });

  redQueen.on('assessment:complete', ({ threats, countersGenerated }) => {
    console.log(`[EVENT] Red Queen: ${threats} threats assessed, ${countersGenerated} counter-strategies generated`);
  });

  antifragility.on('chaos:updated', (chaosIndex: number) => {
    if (chaosIndex > 0.7) {
      console.log(`[EVENT] CHAOS ALERT: index=${chaosIndex.toFixed(2)} — hedges boosted`);
    }
  });

  metaLearner.on('tuned', ({ fitness, perturbation }) => {
    console.log(`[EVENT] MetaLearner: fitness=${fitness.toFixed(4)}, perturbed ${perturbation.parameter}`);
  });

  // Periodic status report
  setInterval(() => {
    const status = competitive.getCompetitiveStatus();
    console.log(`[Status] Rank: #${status.rank} | PnL: ${status.pnl.toFixed(2)} | Active: ${status.activeStrategies} | Retired: ${status.retiredStrategies} | Gen: ${status.generation} | Chaos: ${status.chaosIndex.toFixed(2)}`);
  }, 120000); // Every 2 minutes

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[Shutdown] Graceful shutdown initiated...');
    await competitive.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[Fatal] Startup failed:', err);
  process.exit(1);
});
