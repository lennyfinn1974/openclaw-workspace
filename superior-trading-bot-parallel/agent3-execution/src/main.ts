#!/usr/bin/env ts-node
/**
 * Superior Trading Bot — Layers 5-7 Entry Point
 *
 * Launches:
 *   Layer 5: Capital Allocator (Thompson Sampling + Kelly + Correlation)
 *   Layer 6: Risk Governor (Circuit Breakers + Veto Power)
 *   Layer 7: Transparency Dashboard (Express + Socket.IO + Chart.js)
 *
 * Phase 1: DASHBOARD ONLY — no live trading.
 * Dashboard runs on http://localhost:9001
 */

import { CapitalAllocator } from './layer5-capital-allocator';
import { RiskGovernor } from './layer6-risk-governor';
import { Dashboard } from './layer7-dashboard-fixed';

const BANNER = `
  ╔══════════════════════════════════════════════════════════════╗
  ║  SUPERIOR TRADING BOT — Layers 5-7                         ║
  ║  Phase 1: OBSERVE & LEARN (No Trading)                     ║
  ║                                                            ║
  ║  L5  Capital Allocator   Thompson Sampling + Kelly         ║
  ║  L6  Risk Governor       Circuit Breakers + 5% DD Limit   ║
  ║  L7  Dashboard           http://localhost:9001             ║
  ╚══════════════════════════════════════════════════════════════╝
`;

async function main() {
  console.log(BANNER);

  // Layer 5: Capital Allocator
  console.log('[L5] Initializing Capital Allocator...');
  const allocator = new CapitalAllocator({
    totalCapital: 100000,
    rebalanceIntervalMs: 30000, // 30 second rebalance
  });
  allocator.start();
  console.log('[L5] Capital Allocator online — 6 strategy arms, Thompson Sampling active');

  // Layer 6: Risk Governor
  console.log('[L6] Initializing Risk Governor...');
  const riskGovernor = new RiskGovernor({
    initialEquity: 100000,
    limits: {
      maxDailyDrawdown: 0.05,    // 5% max daily drawdown
      maxWeeklyDrawdown: 0.10,   // 10% max weekly drawdown
      maxSingleTradeRisk: 0.02,  // 2% per trade
      maxOpenPositions: 10,
      maxCorrelationExposure: 0.7,
      maxSectorExposure: 0.3,
      emergencyShutdownThreshold: 0.08,
    },
    checkIntervalMs: 5000,
  });
  riskGovernor.start();
  console.log('[L6] Risk Governor online — 6 circuit breakers armed, 5% daily DD limit');

  // Wire events
  allocator.on('allocation:updated', (decision) => {
    console.log(`[L5] Rebalanced: ${decision.method} | confidence=${(decision.confidence * 100).toFixed(1)}% | regime=${decision.regime}`);
  });

  riskGovernor.on('veto', (veto) => {
    console.log(`[L6] VETO: ${veto.severity.toUpperCase()} — ${veto.reason}`);
  });

  // Layer 7: Dashboard
  console.log('[L7] Initializing Dashboard...');
  const dashboard = new Dashboard({
    port: 9001,
    allocator,
    riskGovernor,
  });

  await dashboard.start();
  console.log('[L7] Dashboard online\n');
  console.log('  Open http://localhost:9001 in your browser\n');

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');
    allocator.stop();
    riskGovernor.stop();
    await dashboard.stop();
    console.log('All layers stopped.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
