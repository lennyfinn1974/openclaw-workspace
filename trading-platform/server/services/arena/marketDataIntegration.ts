// Arena Market Data Integration - Shows how MarketDataHub connects to tournament system
// This replaces the current scattered EODHD connections with centralized distribution

import { ArenaMarketDataHub } from './marketDataHub';
import type { TournamentManager } from './tournamentManager';
import type { Bot } from './types';
import type { MarketQuote } from '../brokers/types';

export class ArenaMarketDataIntegration {
  private marketHub: ArenaMarketDataHub;
  private tournamentManager: TournamentManager;
  private activeBotSubscriptions: Map<string, string[]> = new Map(); // botId → symbols[]

  constructor(eodhdApiKey: string, tournamentManager: TournamentManager) {
    this.marketHub = new ArenaMarketDataHub(eodhdApiKey);
    this.tournamentManager = tournamentManager;
    
    // Listen for market data events
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Monitor data distribution
    this.marketHub.on('quote', ({ symbol, quote, subscribedBots, latency }) => {
      console.log(`[Arena] Real data: ${symbol} $${quote.last} → ${subscribedBots} bots (${latency}ms)`);
    });

    // Tournament lifecycle integration
    this.marketHub.on('started', () => {
      console.log('[Arena] Market Data Hub: Real-time distribution started');
    });
  }

  // Called when tournament starts - register all active bots
  async startTournament(bots: Bot[]): Promise<void> {
    console.log('[Arena] Registering bots for synchronized real data...');
    
    for (const bot of bots) {
      await this.subscribeBotToRealData(bot);
    }

    // Start centralized data polling
    await this.marketHub.start();
    
    console.log(`[Arena] Tournament started with ${bots.length} bots getting real-time data`);
  }

  // Subscribe individual bot to its trading symbol(s)
  private async subscribeBotToRealData(bot: Bot): Promise<void> {
    const symbols = [bot.symbol]; // Each Arena bot trades one primary symbol
    
    // Register bot with market data hub
    this.marketHub.subscribeBotToSymbols(
      bot.id,
      symbols,
      this.createBotDataCallback(bot)
    );
    
    // Track subscription for cleanup
    this.activeBotSubscriptions.set(bot.id, symbols);
    
    console.log(`[Arena] Bot ${bot.name} (${bot.id}) → ${bot.symbol} real data feed`);
  }

  // Create real-time data callback for a specific bot
  private createBotDataCallback(bot: Bot) {
    return (symbol: string, quote: MarketQuote) => {
      // Real-time price update - bot gets immediate authentic market data
      this.updateBotPrice(bot, symbol, quote);
      
      // Trigger bot strategy evaluation with real data
      this.evaluateBotStrategy(bot, quote);
      
      // Log for monitoring (optional)
      console.log(`[Bot ${bot.name}] ${symbol}: $${quote.last} (source: eodhd)`);
    };
  }

  // Update bot's internal price tracking
  private updateBotPrice(bot: Bot, symbol: string, quote: MarketQuote): void {
    // Update tournament manager's trading engine with real price
    // Note: price updates flow through MarketDataSimulator → BotEngine.evaluateBot()
    // this.tournamentManager.updateBotPrice(bot.id, symbol, quote.last);
    void bot; void symbol; void quote;
    
    // Bot's internal state update would happen here
    // bot.onPriceUpdate(symbol, quote);
  }

  // Evaluate bot trading strategy with real market data
  private evaluateBotStrategy(bot: Bot, quote: MarketQuote): void {
    // This would trigger the bot's strategy evaluation
    // Using real market data for authentic decision making
    
    // Example: Bot checks if conditions are met for trade entry/exit
    // if (bot.shouldTrade(quote)) {
    //   const order = bot.generateTradeSignal(quote);
    //   this.tournamentManager.placeBotOrder(bot.id, order);
    // }
  }

  // Called when tournament ends - cleanup subscriptions
  async stopTournament(): Promise<void> {
    console.log('[Arena] Stopping tournament and cleaning up data subscriptions...');
    
    // Unsubscribe all bots
    for (const botId of this.activeBotSubscriptions.keys()) {
      this.marketHub.unsubscribeBot(botId);
    }
    
    // Clear tracking
    this.activeBotSubscriptions.clear();
    
    // Stop market data hub
    this.marketHub.stop();
    
    console.log('[Arena] Tournament stopped, real data feeds disconnected');
  }

  // Add new bot mid-tournament (evolution, mutation)
  async addBot(bot: Bot): Promise<void> {
    await this.subscribeBotToRealData(bot);
    console.log(`[Arena] New bot ${bot.name} added to real data feed`);
  }

  // Remove bot mid-tournament
  removeBot(botId: string): void {
    this.marketHub.unsubscribeBot(botId);
    this.activeBotSubscriptions.delete(botId);
    console.log(`[Arena] Bot ${botId} removed from real data feed`);
  }

  // Get current market data statistics
  getMarketDataStats() {
    const hubStats = this.marketHub.getStats();
    
    return {
      ...hubStats,
      arenaGroups: this.marketHub.getArenaGroups(),
      subscriptionStatus: Array.from(this.activeBotSubscriptions.entries()).map(([botId, symbols]) => ({
        botId,
        symbols,
        hasRealTimeData: symbols.every(symbol => this.marketHub.hasRealTimeData(symbol))
      }))
    };
  }

  // Check if all Arena bots have real-time data
  validateRealDataCoverage(): {
    isComplete: boolean;
    missingData: string[];
    summary: string;
  } {
    const stats = this.getMarketDataStats();
    const missingData: string[] = [];
    
    for (const subscription of stats.subscriptionStatus) {
      if (!subscription.hasRealTimeData) {
        missingData.push(...subscription.symbols);
      }
    }
    
    const isComplete = missingData.length === 0;
    const summary = isComplete 
      ? `✅ All ${stats.totalBots} bots have real-time data`
      : `⚠️ ${missingData.length} symbols missing real data: ${missingData.join(', ')}`;
    
    return { isComplete, missingData, summary };
  }
}

// Usage Example:
/*
// Initialize with EODHD API key
const dataIntegration = new ArenaMarketDataIntegration(
  process.env.EODHD_API_KEY!,
  tournamentManager
);

// Start tournament with synchronized real data
const arenaBots = await tournamentManager.createTournament(tournamentConfig);
await dataIntegration.startTournament(arenaBots);

// Monitor real data coverage
const validation = dataIntegration.validateRealDataCoverage();
console.log(validation.summary);

// Get stats
const stats = dataIntegration.getMarketDataStats();
console.log(`Active symbols: ${stats.activeSymbols}, Real-time bots: ${stats.totalBots}`);
*/