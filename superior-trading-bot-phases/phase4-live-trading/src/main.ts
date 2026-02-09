/**
 * Phase 4: Live Trading — Entry Point
 *
 * Startup sequence:
 * 1. Parse config (defaults: paper mode, $5000 capital, port 9002)
 * 2. Create and connect ArenaConnector
 * 3. Create CapitalAllocator with 6 strategy arms
 * 4. Create RiskGovernor (5% daily DD, 2% per trade, 8% emergency)
 * 5. Create ExecutionEngine in paper mode
 * 6. Create StrategyRouter with 6 strategies
 * 7. Create PerformanceMonitor
 * 8. Create DashboardServer
 * 9. Wire all event connections between components
 * 10. Start everything, print banner
 */

import {
  Phase4Config, TradingMode, StrategyArm, MarketRegime, RegimePerformance
} from './types';
import { ArenaConnector } from './arena-connector';
import { MarketDataCache } from './market-data-cache';
import { CapitalAllocator } from './capital-allocator';
import { RiskGovernor } from './risk-governor';
import { ExecutionEngine } from './execution-engine';
import { StrategyRouter } from './strategy-router';
import { PerformanceMonitor } from './performance-monitor';
import { DashboardServer } from './dashboard-server';

// ===================== CONFIG =====================

function loadConfig(): Phase4Config {
  return {
    mode: (process.env.TRADING_MODE as TradingMode) || 'paper',
    arenaUrl: process.env.ARENA_URL || 'http://localhost:8101',
    dashboardPort: parseInt(process.env.DASHBOARD_PORT || '9002'),
    initialCapital: parseFloat(process.env.INITIAL_CAPITAL || '5000'),
    maxRiskPerTrade: parseFloat(process.env.MAX_RISK_PER_TRADE || '0.02'),
    maxDailyDrawdown: parseFloat(process.env.MAX_DAILY_DRAWDOWN || '0.05'),
    maxWeeklyDrawdown: parseFloat(process.env.MAX_WEEKLY_DRAWDOWN || '0.10'),
    emergencyDrawdown: parseFloat(process.env.EMERGENCY_DRAWDOWN || '0.08'),
    maxOpenPositions: parseInt(process.env.MAX_OPEN_POSITIONS || '10'),
    maxCorrelation: parseFloat(process.env.MAX_CORRELATION || '0.7'),
    signalIntervalMs: parseInt(process.env.SIGNAL_INTERVAL_MS || '15000'),
    rebalanceIntervalMs: parseInt(process.env.REBALANCE_INTERVAL_MS || '60000'),
    riskCheckIntervalMs: parseInt(process.env.RISK_CHECK_INTERVAL_MS || '5000'),
    equitySampleIntervalMs: parseInt(process.env.EQUITY_SAMPLE_INTERVAL_MS || '10000'),
    killSwitchConsecutiveLosses: parseInt(process.env.KILL_SWITCH_LOSSES || '3'),
    killSwitchDrawdownPercent: parseFloat(process.env.KILL_SWITCH_DRAWDOWN || '0.08'),
  };
}

// ===================== STRATEGY ARMS =====================

function createStrategyArms(): StrategyArm[] {
  const defaultRegimePerf = (): Record<MarketRegime, RegimePerformance> => ({
    TRENDING: { trades: 0, winRate: 0.5, avgReturn: 0, sharpeRatio: 0 },
    RANGING: { trades: 0, winRate: 0.5, avgReturn: 0, sharpeRatio: 0 },
    VOLATILE: { trades: 0, winRate: 0.5, avgReturn: 0, sharpeRatio: 0 },
    BREAKOUT: { trades: 0, winRate: 0.5, avgReturn: 0, sharpeRatio: 0 },
    EVENT: { trades: 0, winRate: 0.5, avgReturn: 0, sharpeRatio: 0 },
    QUIET: { trades: 0, winRate: 0.5, avgReturn: 0, sharpeRatio: 0 },
  });

  return [
    {
      id: 'momentum', name: 'Momentum Breakout',
      alpha: 1, beta: 1, totalTrades: 0, wins: 0, losses: 0,
      totalPnL: 0, avgReturn: 0, sharpeRatio: 0, maxDrawdown: 0,
      kellyFraction: 0.01, winRate: 0.5, avgWinSize: 0, avgLossSize: 0,
      currentAllocation: 1/6, targetAllocation: 1/6,
      performanceByRegime: defaultRegimePerf(),
    },
    {
      id: 'mean-reversion', name: 'Mean Reversion',
      alpha: 1, beta: 1, totalTrades: 0, wins: 0, losses: 0,
      totalPnL: 0, avgReturn: 0, sharpeRatio: 0, maxDrawdown: 0,
      kellyFraction: 0.01, winRate: 0.5, avgWinSize: 0, avgLossSize: 0,
      currentAllocation: 1/6, targetAllocation: 1/6,
      performanceByRegime: defaultRegimePerf(),
    },
    {
      id: 'trend-follow', name: 'Trend Following',
      alpha: 1, beta: 1, totalTrades: 0, wins: 0, losses: 0,
      totalPnL: 0, avgReturn: 0, sharpeRatio: 0, maxDrawdown: 0,
      kellyFraction: 0.01, winRate: 0.5, avgWinSize: 0, avgLossSize: 0,
      currentAllocation: 1/6, targetAllocation: 1/6,
      performanceByRegime: defaultRegimePerf(),
    },
    {
      id: 'volatility-arb', name: 'Volatility Arbitrage',
      alpha: 1, beta: 1, totalTrades: 0, wins: 0, losses: 0,
      totalPnL: 0, avgReturn: 0, sharpeRatio: 0, maxDrawdown: 0,
      kellyFraction: 0.01, winRate: 0.5, avgWinSize: 0, avgLossSize: 0,
      currentAllocation: 1/6, targetAllocation: 1/6,
      performanceByRegime: defaultRegimePerf(),
    },
    {
      id: 'ict-smart-money', name: 'ICT Smart Money',
      alpha: 1, beta: 1, totalTrades: 0, wins: 0, losses: 0,
      totalPnL: 0, avgReturn: 0, sharpeRatio: 0, maxDrawdown: 0,
      kellyFraction: 0.01, winRate: 0.5, avgWinSize: 0, avgLossSize: 0,
      currentAllocation: 1/6, targetAllocation: 1/6,
      performanceByRegime: defaultRegimePerf(),
    },
    {
      id: 'regime-adaptive', name: 'Regime Adaptive',
      alpha: 1, beta: 1, totalTrades: 0, wins: 0, losses: 0,
      totalPnL: 0, avgReturn: 0, sharpeRatio: 0, maxDrawdown: 0,
      kellyFraction: 0.01, winRate: 0.5, avgWinSize: 0, avgLossSize: 0,
      currentAllocation: 1/6, targetAllocation: 1/6,
      performanceByRegime: defaultRegimePerf(),
    },
  ];
}

// ===================== MAIN =====================

async function main(): Promise<void> {
  const config = loadConfig();

  // 1. Print banner
  console.log('');
  console.log('='.repeat(70));
  console.log('  PHASE 4: LIVE TRADING & RISK MANAGEMENT');
  console.log('='.repeat(70));
  console.log(`  Mode:         ${config.mode.toUpperCase()}`);
  console.log(`  Capital:      $${config.initialCapital.toLocaleString()}`);
  console.log(`  Arena:        ${config.arenaUrl}`);
  console.log(`  Dashboard:    http://localhost:${config.dashboardPort}`);
  console.log(`  Max risk:     ${(config.maxRiskPerTrade * 100).toFixed(1)}% per trade`);
  console.log(`  Daily DD:     ${(config.maxDailyDrawdown * 100).toFixed(1)}% max`);
  console.log(`  Kill switch:  ${config.killSwitchConsecutiveLosses} losses / ${(config.killSwitchDrawdownPercent * 100).toFixed(1)}% drawdown`);
  console.log(`  Strategies:   6 (momentum, mean-rev, trend, vol-arb, ICT, regime)`);
  console.log('='.repeat(70));
  console.log('');

  // 2. Create ArenaConnector
  const arena = new ArenaConnector(config.arenaUrl);

  // 3. Create MarketDataCache
  const marketData = new MarketDataCache();

  // 4. Create CapitalAllocator with 6 strategy arms
  const allocator = new CapitalAllocator({
    totalCapital: config.initialCapital,
    rebalanceIntervalMs: config.rebalanceIntervalMs,
  });

  const arms = createStrategyArms();
  for (const arm of arms) {
    allocator.addArm(arm);
  }

  // 5. Create RiskGovernor
  const riskGovernor = new RiskGovernor({
    initialEquity: config.initialCapital,
    limits: {
      maxDailyDrawdown: config.maxDailyDrawdown,
      maxWeeklyDrawdown: config.maxWeeklyDrawdown,
      maxSingleTradeRisk: config.maxRiskPerTrade,
      maxOpenPositions: config.maxOpenPositions,
      maxCorrelationExposure: config.maxCorrelation,
      emergencyShutdownThreshold: config.emergencyDrawdown,
    },
    checkIntervalMs: config.riskCheckIntervalMs,
  });

  // 6. Create ExecutionEngine
  const engine = new ExecutionEngine({
    mode: config.mode,
    arena,
    marketData,
    allocator,
    riskGovernor,
    initialCapital: config.initialCapital,
    killSwitchConsecutiveLosses: config.killSwitchConsecutiveLosses,
    killSwitchDrawdownPercent: config.killSwitchDrawdownPercent,
  });

  // 7. Create StrategyRouter
  const strategyRouter = new StrategyRouter({
    marketData,
    allocator,
    signalIntervalMs: config.signalIntervalMs,
  });

  // 8. Create PerformanceMonitor
  const perfMonitor = new PerformanceMonitor({
    engine,
    riskGovernor,
    arena,
    initialCapital: config.initialCapital,
    sampleIntervalMs: config.equitySampleIntervalMs,
  });

  // 9. Create DashboardServer
  const dashboard = new DashboardServer({
    port: config.dashboardPort,
    engine,
    perfMonitor,
    riskGovernor,
    allocator,
    strategyRouter,
    arena,
  });

  // 10. Wire event connections

  // Arena → MarketDataCache (quotes)
  // Arena sends { symbol, bid, ask, last, volume, ... }
  arena.on('quote', (quote: any) => {
    marketData.update({
      symbol: quote.symbol,
      price: quote.last ?? quote.price ?? 0,
      bid: quote.bid,
      ask: quote.ask,
      volume: quote.volume,
    });
  });

  // Arena → MarketDataCache (trade prices as quotes)
  arena.on('trade', (trade: any) => {
    marketData.updateFromTrade({ symbol: trade.symbol, price: trade.price });
  });

  // Arena → StrategyRouter (bot trades for trend/ICT strategies)
  arena.on('trade', (trade: any) => {
    strategyRouter.onBotTrade({
      botId: trade.botId || trade.botName,
      symbol: trade.symbol,
      direction: trade.side as any,
      price: trade.price,
      timestamp: Date.now(),
    });
  });

  // Arena → StrategyRouter (leaderboard for smart money)
  arena.on('leaderboard', (event: any) => {
    if (event.entries) {
      strategyRouter.onLeaderboardUpdate(
        event.entries.map((e: any) => ({
          botId: e.botName,
          fitness: e.fitness,
          rank: e.rank,
          trades: e.totalTrades,
          winRate: e.winRate / 100,
          pnl: e.totalPnL,
          strategy: e.groupName,
          regime: 'QUIET' as MarketRegime,
        }))
      );
    }
  });

  // Arena → Regime detection → StrategyRouter + Allocator
  arena.on('arena:status', (status: any) => {
    const sessions = status.marketSessions || {};
    const openSessions = Object.values(sessions).filter((s: any) => s.canTrade);
    const openCount = openSessions.length;

    let regime: MarketRegime = 'QUIET';
    if (openCount > 0) {
      const avgVol = (openSessions as any[])
        .reduce((sum: number, s: any) => sum + s.volatilityMultiplier, 0) / openCount;
      if (avgVol > 1.2) regime = 'VOLATILE';
      else if (avgVol > 0.9) regime = 'TRENDING';
      else regime = 'RANGING';
    }

    strategyRouter.setRegime(regime);
    allocator.setRegime(regime);
    riskGovernor.setRegime(regime);
  });

  // StrategyRouter → ExecutionEngine (proposals)
  strategyRouter.on('proposal', async (proposal) => {
    await engine.executeProposal(proposal);
  });

  // ExecutionEngine position price updates (periodic)
  const positionUpdateInterval = setInterval(() => {
    engine.updatePositionPrices();
  }, 5000);

  // 11. Start everything
  arena.connect();
  allocator.start();
  riskGovernor.start();
  strategyRouter.start();
  perfMonitor.start();
  await dashboard.start();

  console.log('[MAIN] All systems online. Waiting for arena connection...');
  console.log('[MAIN] Press Ctrl+C to shut down gracefully.');
  console.log('');

  // ===================== GRACEFUL SHUTDOWN =====================

  const shutdown = async (signal: string) => {
    console.log(`\n[MAIN] ${signal} received. Shutting down gracefully...`);

    clearInterval(positionUpdateInterval);
    strategyRouter.stop();
    perfMonitor.stop();
    allocator.stop();
    riskGovernor.stop();
    arena.disconnect();
    await dashboard.stop();

    const snapshot = perfMonitor.getSnapshot();
    console.log('');
    console.log('='.repeat(50));
    console.log('  FINAL PERFORMANCE SUMMARY');
    console.log('='.repeat(50));
    console.log(`  Equity:       $${snapshot.equity.toFixed(2)}`);
    console.log(`  Total P&L:    $${snapshot.totalPnL.toFixed(2)} (${(snapshot.totalPnLPercent * 100).toFixed(2)}%)`);
    console.log(`  Trades:       ${snapshot.totalTrades}`);
    console.log(`  Win Rate:     ${(snapshot.winRate * 100).toFixed(1)}%`);
    console.log(`  Sharpe:       ${snapshot.sharpeRatio.toFixed(2)}`);
    console.log(`  Max Drawdown: ${(snapshot.maxDrawdown * 100).toFixed(2)}%`);
    console.log('='.repeat(50));
    console.log('');

    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// ===================== RUN =====================

main().catch((err) => {
  console.error('[MAIN] Fatal error:', err);
  process.exit(1);
});
