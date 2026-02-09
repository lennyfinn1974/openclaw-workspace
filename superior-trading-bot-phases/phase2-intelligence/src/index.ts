import { IntelligenceOrchestrator } from './intelligence/IntelligenceOrchestrator';
import { IntelligenceDashboard } from './dashboard/IntelligenceDashboard';

const ARENA_URL = process.env.ARENA_URL || 'http://localhost:8101';
const DASHBOARD_PORT = parseInt(process.env.DASHBOARD_PORT || '8084', 10);
const PYTHON_PATH = process.env.PYTHON_PATH || undefined;

async function main() {
  console.log('=== Phase 2: Intelligence & Learning System ===');
  console.log(`Arena: ${ARENA_URL}`);
  console.log(`Dashboard: port ${DASHBOARD_PORT}`);
  console.log('');

  const orchestrator = new IntelligenceOrchestrator({
    arenaUrl: ARENA_URL,
    pythonPath: PYTHON_PATH
  });

  const dashboard = new IntelligenceDashboard(orchestrator, DASHBOARD_PORT);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');
    dashboard.stop();
    await orchestrator.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', () => { console.log('[SIGNAL] SIGTERM received'); shutdown(); });
  process.on('SIGHUP', () => { console.log('[SIGNAL] SIGHUP received — ignoring'); });
  process.on('uncaughtException', (err) => {
    console.error('[UNCAUGHT]', err.message, err.stack);
  });
  process.on('unhandledRejection', (err: any) => {
    console.error('[UNHANDLED]', err?.message || err, err?.stack || '');
  });
  process.on('beforeExit', (code) => {
    console.log(`[beforeExit] code=${code} — event loop drained`);
  });
  process.on('exit', (code) => {
    console.log(`[exit] code=${code}`);
  });

  try {
    await orchestrator.start();
    await dashboard.start();

    console.log('');
    console.log('Phase 2 Intelligence System is LIVE');
    console.log(`  Health:        http://localhost:${DASHBOARD_PORT}/health`);
    console.log(`  Status:        http://localhost:${DASHBOARD_PORT}/api/status`);
    console.log(`  Fingerprints:  http://localhost:${DASHBOARD_PORT}/api/fingerprints`);
    console.log(`  Attribution:   http://localhost:${DASHBOARD_PORT}/api/attribution`);
    console.log(`  Archetypes:    http://localhost:${DASHBOARD_PORT}/api/archetypes`);
    console.log(`  Predictions:   http://localhost:${DASHBOARD_PORT}/api/predictions`);
    console.log(`  Crowding:      http://localhost:${DASHBOARD_PORT}/api/crowding`);
    console.log(`  Niches:        http://localhost:${DASHBOARD_PORT}/api/niches`);
    console.log(`  Regime Matrix: http://localhost:${DASHBOARD_PORT}/api/regime-matrix`);
    console.log('');
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
}

main();
