// Bot Trading Engine - Bot-scoped trading engine operating against bot_* tables
import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';
import type { BotPortfolio, BotPosition, BotOrder, BotTrade } from './types';

const INITIAL_BALANCE = 5000;

export class BotTradingEngine {
  private db: Database.Database;
  private priceCache: Map<string, number> = new Map();

  constructor(db: Database.Database) {
    this.db = db;
  }

  updatePrice(symbol: string, price: number): void {
    this.priceCache.set(symbol, price);
  }

  getPrice(symbol: string): number {
    return this.priceCache.get(symbol) || 0;
  }

  // Initialize portfolio for a bot in a tournament
  initializePortfolio(botId: string, tournamentId: string, balance: number = INITIAL_BALANCE): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO bot_portfolios (bot_id, tournament_id, cash, initial_balance, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(botId, tournamentId, balance, balance);
  }

  // Place a market order for a bot (atomic transaction)
  placeOrder(params: {
    botId: string;
    tournamentId: string;
    symbol: string;
    side: 'buy' | 'sell';
    quantity: number;
    reason: string;
  }): BotTrade | null {
    const { botId, tournamentId, symbol, side, quantity, reason } = params;
    const currentPrice = this.getPrice(symbol);
    if (currentPrice <= 0 || quantity <= 0) return null;

    // Validate
    const portfolio = this.getPortfolio(botId, tournamentId);
    if (!portfolio) return null;

    if (side === 'buy') {
      const cost = quantity * currentPrice;
      if (cost > portfolio.cash) return null; // insufficient funds
    } else {
      const position = this.getPosition(botId, tournamentId, symbol);
      if (!position || position.quantity < quantity) return null;
    }

    // Apply slippage
    const slippage = side === 'buy' ? 1.0002 : 0.9998;
    const fillPrice = currentPrice * slippage;
    const orderId = uuidv4();
    const tradeId = uuidv4();
    const total = quantity * fillPrice;

    // Execute entire order+trade as atomic transaction
    const executeTrade = this.db.transaction(() => {
      let pnl = 0;

      // Create order
      this.db.prepare(`
        INSERT INTO bot_orders (id, bot_id, tournament_id, symbol, side, type, quantity, price, status, reason, filled_at)
        VALUES (?, ?, ?, ?, ?, 'market', ?, ?, 'filled', ?, datetime('now'))
      `).run(orderId, botId, tournamentId, symbol, side, quantity, fillPrice, reason);

      if (side === 'buy') {
        // Deduct cash
        this.db.prepare('UPDATE bot_portfolios SET cash = cash - ?, updated_at = datetime(\'now\') WHERE bot_id = ? AND tournament_id = ?')
          .run(total, botId, tournamentId);

        // Update position
        const existing = this.db.prepare('SELECT quantity, avg_cost FROM bot_positions WHERE bot_id = ? AND tournament_id = ? AND symbol = ?')
          .get(botId, tournamentId, symbol) as { quantity: number; avg_cost: number } | undefined;

        if (existing && existing.quantity > 0) {
          const totalShares = existing.quantity + quantity;
          const totalCost = (existing.quantity * existing.avg_cost) + total;
          const newAvg = totalCost / totalShares;
          this.db.prepare('UPDATE bot_positions SET quantity = ?, avg_cost = ? WHERE bot_id = ? AND tournament_id = ? AND symbol = ?')
            .run(totalShares, newAvg, botId, tournamentId, symbol);
        } else {
          this.db.prepare('INSERT OR REPLACE INTO bot_positions (bot_id, tournament_id, symbol, quantity, avg_cost, realized_pnl) VALUES (?, ?, ?, ?, ?, 0)')
            .run(botId, tournamentId, symbol, quantity, fillPrice);
        }
      } else {
        // Sell
        const position = this.db.prepare('SELECT quantity, avg_cost FROM bot_positions WHERE bot_id = ? AND tournament_id = ? AND symbol = ?')
          .get(botId, tournamentId, symbol) as { quantity: number; avg_cost: number };
        pnl = (fillPrice - position.avg_cost) * quantity;

        // Add proceeds
        this.db.prepare('UPDATE bot_portfolios SET cash = cash + ?, updated_at = datetime(\'now\') WHERE bot_id = ? AND tournament_id = ?')
          .run(total, botId, tournamentId);

        const newQty = position.quantity - quantity;
        if (newQty <= 0.0001) {
          this.db.prepare('DELETE FROM bot_positions WHERE bot_id = ? AND tournament_id = ? AND symbol = ?')
            .run(botId, tournamentId, symbol);
        } else {
          this.db.prepare('UPDATE bot_positions SET quantity = ?, realized_pnl = realized_pnl + ? WHERE bot_id = ? AND tournament_id = ? AND symbol = ?')
            .run(newQty, pnl, botId, tournamentId, symbol);
        }
      }

      // Record trade
      this.db.prepare(`
        INSERT INTO bot_trades (id, bot_id, tournament_id, order_id, symbol, side, quantity, price, total, pnl, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(tradeId, botId, tournamentId, orderId, symbol, side, quantity, fillPrice, total, pnl, reason);

      return pnl;
    });

    try {
      const pnl = executeTrade();

      return {
        id: tradeId,
        botId,
        tournamentId,
        orderId,
        symbol,
        side,
        quantity,
        price: fillPrice,
        total,
        pnl: pnl ?? 0,
        reason,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[BotTradingEngine] Transaction failed for ${botId}:`, (error as Error).message);
      return null;
    }
  }

  // Force close all positions for a bot (round end)
  forceCloseAll(botId: string, tournamentId: string): BotTrade[] {
    const trades: BotTrade[] = [];
    const positions = this.getPositions(botId, tournamentId);

    for (const pos of positions) {
      if (pos.quantity > 0) {
        const trade = this.placeOrder({
          botId,
          tournamentId,
          symbol: pos.symbol,
          side: 'sell',
          quantity: pos.quantity,
          reason: 'Round end - force close',
        });
        if (trade) trades.push(trade);
      }
    }

    return trades;
  }

  getPortfolio(botId: string, tournamentId: string): BotPortfolio | null {
    const row = this.db.prepare('SELECT * FROM bot_portfolios WHERE bot_id = ? AND tournament_id = ?')
      .get(botId, tournamentId) as Record<string, unknown> | undefined;
    if (!row) return null;

    const cash = row.cash as number;
    const initialBalance = row.initial_balance as number;
    const positions = this.getPositions(botId, tournamentId);
    const positionValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
    const totalValue = cash + positionValue;
    const totalPnL = totalValue - initialBalance;

    return {
      botId,
      tournamentId,
      cash,
      initialBalance,
      totalValue,
      totalPnL,
      totalPnLPercent: (totalPnL / initialBalance) * 100,
    };
  }

  getPosition(botId: string, tournamentId: string, symbol: string): BotPosition | null {
    const row = this.db.prepare('SELECT * FROM bot_positions WHERE bot_id = ? AND tournament_id = ? AND symbol = ?')
      .get(botId, tournamentId, symbol) as Record<string, unknown> | undefined;
    if (!row) return null;

    const quantity = row.quantity as number;
    const avgCost = row.avg_cost as number;
    const currentPrice = this.getPrice(symbol);
    const marketValue = quantity * currentPrice;

    return {
      botId,
      tournamentId,
      symbol,
      quantity,
      avgCost,
      currentPrice,
      marketValue,
      unrealizedPnL: marketValue - (quantity * avgCost),
    };
  }

  getPositions(botId: string, tournamentId: string): BotPosition[] {
    const rows = this.db.prepare('SELECT * FROM bot_positions WHERE bot_id = ? AND tournament_id = ? AND quantity > 0')
      .all(botId, tournamentId) as Record<string, unknown>[];

    return rows.map(row => {
      const quantity = row.quantity as number;
      const avgCost = row.avg_cost as number;
      const symbol = row.symbol as string;
      const currentPrice = this.getPrice(symbol);
      const marketValue = quantity * currentPrice;

      return {
        botId,
        tournamentId,
        symbol,
        quantity,
        avgCost,
        currentPrice,
        marketValue,
        unrealizedPnL: marketValue - (quantity * avgCost),
      };
    });
  }

  getTrades(botId: string, tournamentId: string, limit: number = 50): BotTrade[] {
    const rows = this.db.prepare('SELECT * FROM bot_trades WHERE bot_id = ? AND tournament_id = ? ORDER BY timestamp DESC LIMIT ?')
      .all(botId, tournamentId, limit) as Record<string, unknown>[];

    return rows.map(row => ({
      id: row.id as string,
      botId: row.bot_id as string,
      tournamentId: row.tournament_id as string,
      orderId: row.order_id as string,
      symbol: row.symbol as string,
      side: row.side as 'buy' | 'sell',
      quantity: row.quantity as number,
      price: row.price as number,
      total: row.total as number,
      pnl: row.pnl as number,
      reason: row.reason as string,
      timestamp: row.timestamp as string,
    }));
  }

  getAllTrades(tournamentId: string, limit: number = 200): BotTrade[] {
    const rows = this.db.prepare('SELECT * FROM bot_trades WHERE tournament_id = ? ORDER BY timestamp DESC LIMIT ?')
      .all(tournamentId, limit) as Record<string, unknown>[];

    return rows.map(row => ({
      id: row.id as string,
      botId: row.bot_id as string,
      tournamentId: row.tournament_id as string,
      orderId: row.order_id as string,
      symbol: row.symbol as string,
      side: row.side as 'buy' | 'sell',
      quantity: row.quantity as number,
      price: row.price as number,
      total: row.total as number,
      pnl: row.pnl as number,
      reason: row.reason as string,
      timestamp: row.timestamp as string,
    }));
  }

  // Clean up all bot data for a tournament
  cleanupTournament(tournamentId: string): void {
    this.db.prepare('DELETE FROM bot_trades WHERE tournament_id = ?').run(tournamentId);
    this.db.prepare('DELETE FROM bot_orders WHERE tournament_id = ?').run(tournamentId);
    this.db.prepare('DELETE FROM bot_positions WHERE tournament_id = ?').run(tournamentId);
    this.db.prepare('DELETE FROM bot_portfolios WHERE tournament_id = ?').run(tournamentId);
  }
}
