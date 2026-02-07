// Market Data Hub - Centralized real-time data distribution for Arena bots
// Single EODHD connection per symbol → synchronized distribution to all bots

import { EventEmitter } from 'events';
import type { MarketQuote } from '../brokers/types';
import { EODHDRestAdapter } from '../brokers/eodhd';

interface SymbolSubscription {
  symbol: string;
  botIds: Set<string>;
  lastQuote: MarketQuote | null;
  lastUpdate: number;
  isActive: boolean;
}

interface BotSubscription {
  botId: string;
  symbols: Set<string>;
  callback: (symbol: string, quote: MarketQuote) => void;
}

export class ArenaMarketDataHub extends EventEmitter {
  private eodhdAdapter: EODHDRestAdapter;
  private subscriptions: Map<string, SymbolSubscription> = new Map();
  private botSubscriptions: Map<string, BotSubscription> = new Map();
  private pollingInterval: NodeJS.Timeout | null = null;
  private updateInterval: number = 1000; // 1 second updates

  // Arena symbol groups for organized data flow
  private readonly ARENA_SYMBOLS = {
    Alpha: ['GBP/JPY', 'USD/TRY', 'USD/ZAR', 'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD'], // FX
    Beta: ['NVDA', 'TSLA', 'AMD', 'COIN', 'ROKU', 'PLTR', 'MSTR'], // Stocks  
    Gamma: ['GC=F', 'SI=F', 'CL=F', 'NG=F', 'HG=F', 'LTHM'] // Commodities
  };

  constructor(apiKey: string) {
    super();
    this.eodhdAdapter = new EODHDRestAdapter(apiKey);
    
    // Initialize subscriptions for all Arena symbols
    this.initializeArenaSymbols();
  }

  private initializeArenaSymbols(): void {
    const allSymbols = [
      ...this.ARENA_SYMBOLS.Alpha,
      ...this.ARENA_SYMBOLS.Beta, 
      ...this.ARENA_SYMBOLS.Gamma
    ];

    for (const symbol of allSymbols) {
      this.subscriptions.set(symbol, {
        symbol,
        botIds: new Set(),
        lastQuote: null,
        lastUpdate: 0,
        isActive: false
      });
    }
  }

  // Register a bot for real-time data on specific symbols
  subscribeBotToSymbols(
    botId: string, 
    symbols: string[], 
    callback: (symbol: string, quote: MarketQuote) => void
  ): void {
    // Remove existing subscription if any
    this.unsubscribeBot(botId);

    // Create new bot subscription
    const botSub: BotSubscription = {
      botId,
      symbols: new Set(symbols),
      callback
    };
    
    this.botSubscriptions.set(botId, botSub);

    // Add bot to symbol subscriptions
    for (const symbol of symbols) {
      const subscription = this.subscriptions.get(symbol);
      if (subscription) {
        subscription.botIds.add(botId);
        subscription.isActive = true;
        
        // Send last known quote immediately if available
        if (subscription.lastQuote) {
          callback(symbol, subscription.lastQuote);
        }
      }
    }

    console.log(`[MarketDataHub] Bot ${botId} subscribed to ${symbols.length} symbols:`, symbols);
  }

  // Remove bot from all subscriptions
  unsubscribeBot(botId: string): void {
    const botSub = this.botSubscriptions.get(botId);
    if (!botSub) return;

    // Remove from symbol subscriptions
    for (const symbol of botSub.symbols) {
      const subscription = this.subscriptions.get(symbol);
      if (subscription) {
        subscription.botIds.delete(botId);
        // Deactivate if no bots are subscribed
        if (subscription.botIds.size === 0) {
          subscription.isActive = false;
        }
      }
    }

    this.botSubscriptions.delete(botId);
    console.log(`[MarketDataHub] Bot ${botId} unsubscribed`);
  }

  // Start the centralized data polling system
  async start(): Promise<void> {
    if (this.pollingInterval) return;

    console.log('[MarketDataHub] Starting centralized Arena data distribution...');
    
    // Start polling for active symbols
    this.pollingInterval = setInterval(async () => {
      await this.updateActiveSymbols();
    }, this.updateInterval);

    // Initial update
    await this.updateActiveSymbols();
    
    this.emit('started');
  }

  // Stop the data hub
  stop(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    console.log('[MarketDataHub] Stopped');
    this.emit('stopped');
  }

  // Update all symbols that have active bot subscriptions
  private async updateActiveSymbols(): Promise<void> {
    const activeSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => sub.isActive && sub.botIds.size > 0);

    if (activeSubscriptions.length === 0) return;

    // Batch fetch quotes from EODHD (rate limit friendly)
    const promises = activeSubscriptions.map(async (subscription) => {
      try {
        const result = await this.eodhdAdapter.getQuote(subscription.symbol);
        
        if (result.success && result.data) {
          const quote = result.data;
          const now = Date.now();
          
          // Update subscription
          subscription.lastQuote = quote;
          subscription.lastUpdate = now;
          
          // Distribute to all subscribed bots synchronously
          for (const botId of subscription.botIds) {
            const botSub = this.botSubscriptions.get(botId);
            if (botSub) {
              botSub.callback(subscription.symbol, quote);
            }
          }
          
          // Emit for logging/monitoring
          this.emit('quote', {
            symbol: subscription.symbol,
            quote,
            subscribedBots: subscription.botIds.size,
            latency: result.latencyMs
          });
          
        } else {
          console.warn(`[MarketDataHub] Failed to get quote for ${subscription.symbol}:`, result.error);
        }
        
      } catch (error) {
        console.error(`[MarketDataHub] Error updating ${subscription.symbol}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  // Get current subscription stats
  getStats(): {
    totalSymbols: number;
    activeSymbols: number;
    totalBots: number;
    subscriptionDetails: Array<{
      symbol: string;
      botCount: number;
      lastUpdate: number;
      isActive: boolean;
    }>;
  } {
    const activeSymbols = Array.from(this.subscriptions.values())
      .filter(sub => sub.isActive);

    return {
      totalSymbols: this.subscriptions.size,
      activeSymbols: activeSymbols.length,
      totalBots: this.botSubscriptions.size,
      subscriptionDetails: Array.from(this.subscriptions.values()).map(sub => ({
        symbol: sub.symbol,
        botCount: sub.botIds.size,
        lastUpdate: sub.lastUpdate,
        isActive: sub.isActive
      }))
    };
  }

  // Get Arena symbol groups (useful for tournament organization)
  getArenaGroups(): typeof this.ARENA_SYMBOLS {
    return this.ARENA_SYMBOLS;
  }

  // Check if symbol has real-time data available
  hasRealTimeData(symbol: string): boolean {
    const subscription = this.subscriptions.get(symbol);
    return !!(subscription?.lastQuote && Date.now() - subscription.lastUpdate < 5000);
  }

  // Get last known quote for a symbol
  getLastQuote(symbol: string): MarketQuote | null {
    return this.subscriptions.get(symbol)?.lastQuote || null;
  }
}