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
      const interval = Math.max(5000, Math.round(bot.dna.timing.decisionIntervalMs));

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
        const interval = Math.max(5000, Math.round(bot.dna.timing.decisionIntervalMs));
        setTimeout(() => {
          if (!this.isRunning) return;
          const timer = setInterval(() => {
            if (!this.isRunning) return;
            this.evaluateBot(bot);
          }, interval);
          this.intervals.set(bot.id, timer);
        }, delay);
        delay += 200;
      }
    }
  }

  // Force close all positions for all bots (round end)
  forceCloseAll(): void {
    for (const bot of this.bots) {
      this.tradingEngine.forceCloseAll(bot.id, this.tournamentId);
    }
  }

  private evaluateBot(bot: Bot): void {
    try {
      // Check market session — skip if market is closed for this symbol
      const session = getSymbolSession(bot.symbol, bot.groupName);
      if (!session.canTrade) return;

      // Update price in trading engine
      const price = this.marketData.getArenaPrice(bot.symbol);
      if (price <= 0) return;
      this.tradingEngine.updatePrice(bot.symbol, price);

      // Get candles for analysis
      const candles = this.getCandles(bot.symbol);
      if (candles.length < 30) return;

      // Get current portfolio and position
      const portfolio = this.tradingEngine.getPortfolio(bot.id, this.tournamentId);
      if (!portfolio) return;

      const position = this.tradingEngine.getPosition(bot.id, this.tournamentId, bot.symbol);
      const currentPosition = position?.quantity || 0;

      // Evaluate strategy
      const signal = this.evaluator.evaluate({
        dna: bot.dna,
        symbol: bot.symbol,
        candles,
        currentPrice: price,
        cash: portfolio.cash,
        currentPosition,
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
      // First try real candles from the simulator's OHLCV cache
      // (populated by live EODHD ticks or simulation updates)
      const realCandles = this.marketData.getStoredCandles(symbol, '5m');
      if (realCandles && realCandles.length >= 30) {
        return realCandles;
      }

      // Fall back to synthetic candles from current price
      const quote = this.marketData.getArenaQuote(symbol);
      if (!quote) return [];
      return this.generateSyntheticCandles(symbol, quote.last);
    } catch {
      return [];
    }
  }

  // Synthetic candle cache
  private syntheticCandles: Map<string, { candles: OHLCV[]; lastUpdate: number }> = new Map();

  private generateSyntheticCandles(symbol: string, currentPrice: number): OHLCV[] {
    const cached = this.syntheticCandles.get(symbol);
    const now = Math.floor(Date.now() / 1000);

    if (cached && now - cached.lastUpdate < 5) {
      // Update the last candle with current price
      const lastCandle = cached.candles[cached.candles.length - 1];
      lastCandle.close = currentPrice;
      lastCandle.high = Math.max(lastCandle.high, currentPrice);
      lastCandle.low = Math.min(lastCandle.low, currentPrice);
      return cached.candles;
    }

    // Generate 100 candles of 5-min data
    const candles: OHLCV[] = [];
    let price = currentPrice * (0.97 + Math.random() * 0.06);

    for (let i = 99; i >= 0; i--) {
      const time = now - i * 300;
      const vol = 0.002;
      const change = (Math.random() - 0.5 + (currentPrice - price) / currentPrice * 0.1) * vol * price;
      const open = price;
      const close = price + change;
      const wick = Math.abs(change) * 0.5 * Math.random();

      candles.push({
        time,
        open: Number(open.toFixed(6)),
        high: Number((Math.max(open, close) + wick).toFixed(6)),
        low: Number((Math.min(open, close) - wick).toFixed(6)),
        close: Number(close.toFixed(6)),
        volume: Math.floor(10000 + Math.random() * 50000),
      });

      price = close;
    }

    // Last candle uses actual current price
    candles[candles.length - 1].close = currentPrice;

    this.syntheticCandles.set(symbol, { candles, lastUpdate: now });
    return candles;
  }
}
