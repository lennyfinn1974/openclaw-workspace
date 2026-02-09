// ============================================================
// Superior Trading Bot — Entry Point
// Layers 1-2: Observation Engine + Pattern Extraction
// OBSERVE ONLY — No trading actions
// ============================================================

import { ObservationEngine, ObservationEngineConfig } from './observation-engine';

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (name: string, fallback: string): string => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : fallback;
};

const config: Partial<ObservationEngineConfig> = {
  arenaUrl: getArg('url', 'http://localhost:3000'),
  tradeBufferSize: parseInt(getArg('buffer', '10000'), 10),
  snapshotIntervalMs: parseInt(getArg('snapshot-interval', '30000'), 10),
  clusteringIntervalMs: parseInt(getArg('cluster-interval', '120000'), 10),
  logLevel: getArg('log', 'normal') as 'quiet' | 'normal' | 'verbose',
};

const engine = new ObservationEngine(config);

// Graceful shutdown
const shutdown = async () => {
  console.log('\nShutting down...');
  await engine.stop();

  // Print final summary
  const status = engine.status;
  console.log('\n' + '='.repeat(60));
  console.log('FINAL OBSERVATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Uptime: ${(status.uptime / 60000).toFixed(1)} minutes`);
  console.log(`  Total trades observed: ${status.trades}`);
  console.log(`  Bots tracked: ${status.bots}`);

  const fingerprints = engine.getAllFingerprints();
  if (fingerprints.length > 0) {
    console.log('\n  Bot Fingerprints:');
    const sorted = [...fingerprints].sort((a, b) => b.totalPnL - a.totalPnL);
    for (const fp of sorted) {
      console.log(
        `    ${fp.botName.padEnd(16)} (${fp.groupName}) — ` +
        `Trades: ${fp.totalTrades} | ` +
        `Win: ${(fp.winRate * 100).toFixed(0)}% | ` +
        `P&L: $${fp.totalPnL.toFixed(2)} | ` +
        `PF: ${fp.profitFactor === Infinity ? '∞' : fp.profitFactor.toFixed(2)} | ` +
        `Aggr: ${fp.aggressiveness.toFixed(2)}`
      );
    }
  }

  const patterns = engine.getPatterns();
  if (patterns.length > 0) {
    console.log(`\n  Discovered Patterns: ${patterns.length}`);
    const top = patterns.slice(0, 5);
    for (const p of top) {
      console.log(
        `    ${p.name} — ` +
        `Conf: ${(p.confidence * 100).toFixed(0)}% | ` +
        `Avg P&L: $${p.profitability.toFixed(2)} | ` +
        `Samples: ${p.sampleCount}`
      );
    }
  }

  const attributions = engine.getAttributions();
  if (attributions.length > 0) {
    console.log('\n  Shapley Value Attribution (Top 5):');
    for (const attr of attributions.slice(0, 5)) {
      const fp = engine.getBotFingerprint(attr.botId);
      const name = fp?.botName || attr.botId.slice(0, 8);
      console.log(
        `    #${attr.rank} ${name.padEnd(16)} — ` +
        `Signal: ${attr.contributions.signalQuality.toFixed(2)} | ` +
        `Timing: ${attr.contributions.timing.toFixed(2)} | ` +
        `Sizing: ${attr.contributions.sizing.toFixed(2)} | ` +
        `Exit: ${attr.contributions.exitQuality.toFixed(2)} | ` +
        `Regime: ${attr.contributions.regimeAlignment.toFixed(2)}`
      );
    }
  }

  console.log('\n' + '='.repeat(60));
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start
engine.start().catch((err) => {
  console.error('Failed to start observation engine:', err);
  process.exit(1);
});
