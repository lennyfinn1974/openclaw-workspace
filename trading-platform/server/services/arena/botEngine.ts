// Bot Engine - Core bot loop managing all 21 bots with staggered evaluation
import { EventEmitter } from 'events';
import type Database from 'better-sqlite3';
import type { Bot, BotGroupName, BOT_GROUPS, ArenaBotTradeEvent } from './types';
import { BotTradingEngine } from './botTradingEngine';
import { BotStrategyEvaluator } from './botStrategyEvaluator';
import { getSymbolSession } from './marketTiming';
import type { MarketDataSimulator } from '../marketDataSimulator';
import type { OHLCV } from '../../../src/types/trading';

export class BotEngine extends EventEmitter {
  private db: Database.Database;
  private tradingEngine: BotTradingEngine;
  private evaluator: BotStrategyEvaluator;
  private marketData: MarketDataSimulator;
  private bots: Bot[] = [];
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;
  private tournamentId: string = '';

  constructor(db: Database.Database, marketData: MarketDataSimulator) {
    super();
    this.db = db;
    this.tradingEngine = new BotTradingEngine(db);
    this.evaluator = new BotStrategyEvaluator();
    this.marketData = marketData;
  }

  getTradingEngine(): BotTradingEngine {
    return this.tradingEngine;
  }

  setBots(bots: Bot[]): void {
    this.bots = bots;
  }

  getBots(): Bot[] {
    return this.bots;
  }

  start(tournamentId: string): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.tournamentId = tournamentId;

    // Initialize portfolios
    for (const bot of this.bots) {
      this.tradingEngine.initializePortfolio(bot.id, tournamentId);
    }

    // Start staggered evaluation for each bot
    let delay = 0;
    for (const bot of this.bots) {
      const interval = Math.max(3000, Math.min(8000, Math.round(bot.dna.timing.decisionIntervalMs))); // capped for testing

      // Stagger start to avoid all bots evaluating simultaneously
      setTimeout(() => {
        if (!this.isRunning) return;
        const timer = setInterval(() => {
          if (!this.isRunning) return;
          this.evaluateBot(bot);
        }, interval);
        this.intervals.set(bot.id, timer);

        // First evaluation immediately
        this.evaluateBot(bot);
      }, delay);

      delay += 200; // 200ms stagger between bots
    }

    console.log(`[BotEngine] Started ${this.bots.length} bots for tournament ${tournamentId}`);
  }

  stop(): void {
    this.isRunning = false;
    for (const [botId, timer] of this.intervals) {
      clearInterval(timer);
    }
    this.intervals.clear();
    console.log('[BotEngine] Stopped all bots');
  }

  pause(): void {
    this.isRunning = false;
    for (const timer of this.intervals.values()) {
      clearInterval(timer);
    }
    this.intervals.clear();
  }

  resume(): void {
    if (this.tournamentId) {
      this.isRunning = true;
      let delay = 0;
      for (const bot of this.bots) {
        const interval = Math.max(3000, Math.min(8000, Math.round(bot.dna.timing.decisionIntervalMs))); // capped for testing
        setTimeout(() => {
          if (!this.isRunning) return;
          const timer = setInterval(() => {
            if (!this.isRunning) return;
            this.evaluateBot(bot);
          }, interval);
          this.intervals.set(bot.id, timer);
          // Evaluate immediately on resume (like start does)
          this.evaluateBot(bot);
        }, delay);
        delay += 100; // tighter stagger for faster trade generation
      }
    }
  }

  // Force close all positions for all bots (round end)
  forceCloseAll(): void {
    for (const bot of this.bots) {
      const trades = this.tradingEngine.forceCloseAll(bot.id, this.tournamentId);
      // Emit trade events so Socket.IO clients receive force-close sells with P&L
      for (const trade of trades) {
        const event: ArenaBotTradeEvent = {
          botId: bot.id,
          botName: bot.name,
          groupName: bot.groupName,
          symbol: trade.symbol,
          side: trade.side,
          quantity: trade.quantity,
          price: trade.price,
          reason: trade.reason,
          pnl: trade.pnl,
          timestamp: trade.timestamp,
        };
        this.emit('trade', event);
      }
    }
  }

  private evalCount = 0;
  private evaluateBot(bot: Bot): void {
    this.evalCount++;
    if (this.evalCount % 100 === 0) console.log(`[BotDebug] eval #${this.evalCount}: ${bot.name}`);
    try {
      // Check market session — only trade during real market hours
      const session = getSymbolSession(bot.symbol, bot.groupName);
      if (!session.canTrade) {
        if (this.evalCount <= 30) console.log(`[BotDebug] ${bot.name}: blocked by session canTrade=false`);
        return;
      }

      // Update price in trading engine
      const price = this.marketData.getArenaPrice(bot.symbol);
      if (price <= 0) {
        if (this.evalCount <= 30) console.log(`[BotDebug] ${bot.name}: price=${price} (invalid)`);
        return;
      }
      this.tradingEngine.updatePrice(bot.symbol, price);

      // Get candles for analysis
      const candles = this.getCandles(bot.symbol);
      if (candles.length < 10) {
        if (this.evalCount <= 30) console.log(`[BotDebug] ${bot.name}: only ${candles.length} candles`);
        return;
      }

      // Get current portfolio and position
      const portfolio = this.tradingEngine.getPortfolio(bot.id, this.tournamentId);
      if (!portfolio) return;

      const position = this.tradingEngine.getPosition(bot.id, this.tournamentId, bot.symbol);
      const currentPosition = position?.quantity || 0;
      const avgEntryPrice = position?.avgCost || 0;

      // Evaluate strategy
      const signal = this.evaluator.evaluate({
        dna: bot.dna,
        symbol: bot.symbol,
        candles,
        currentPrice: price,
        cash: portfolio.cash,
        currentPosition,
        avgEntryPrice,
        portfolioValue: portfolio.totalValue,
      });

      if (signal.action === 'hold' || signal.quantity <= 0) return;

      // Execute trade
      const trade = this.tradingEngine.placeOrder({
        botId: bot.id,
        tournamentId: this.tournamentId,
        symbol: bot.symbol,
        side: signal.action,
        quantity: signal.quantity,
        reason: signal.reason,
      });

      if (trade) {
        const event: ArenaBotTradeEvent = {
          botId: bot.id,
          botName: bot.name,
          groupName: bot.groupName,
          symbol: bot.symbol,
          side: trade.side,
          quantity: trade.quantity,
          price: trade.price,
          reason: trade.reason,
          pnl: trade.pnl,
          timestamp: trade.timestamp,
        };
        this.emit('trade', event);
      }
    } catch (error) {
      // Silent fail for individual bot evaluation
      console.error(`[BotEngine] Error evaluating bot ${bot.name}:`, (error as Error).message);
    }
  }

  private getCandles(symbol: string): OHLCV[] {
    try {
      const realCandles = this.marketData.getStoredCandles(symbol, '5m');
      if (realCandles && realCandles.length >= 30) return realCandles;
      return []; // no fake data — bot skips this round
    } catch { return []; }
  }
}
