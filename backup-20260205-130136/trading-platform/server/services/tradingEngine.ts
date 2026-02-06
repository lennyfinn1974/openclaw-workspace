// Core Trading Engine - Handles order execution, position management, P&L calculation
import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';
import type { Order, OrderSide, OrderType, TimeInForce, Position, Portfolio, Trade } from '../../src/types/trading';

export class TradingEngine {
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

  // Place a new order
  placeOrder(params: {
    symbol: string;
    side: OrderSide;
    type: OrderType;
    quantity: number;
    price?: number;
    stopPrice?: number;
    timeInForce?: TimeInForce;
  }): Order {
    const order: Order = {
      id: uuidv4(),
      symbol: params.symbol.toUpperCase(),
      side: params.side,
      type: params.type,
      quantity: params.quantity,
      filledQuantity: 0,
      price: params.price,
      stopPrice: params.stopPrice,
      timeInForce: params.timeInForce || 'day',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Validate order
    const validation = this.validateOrder(order);
    if (!validation.valid) {
      order.status = 'rejected';
      this.saveOrder(order);
      throw new Error(validation.reason);
    }

    // Save order to database
    this.saveOrder(order);

    // Try to execute immediately for market orders
    if (order.type === 'market') {
      this.executeMarketOrder(order);
    }

    return this.getOrder(order.id)!;
  }

  private validateOrder(order: Order): { valid: boolean; reason?: string } {
    const portfolio = this.getPortfolio();
    const currentPrice = this.getPrice(order.symbol);

    if (currentPrice <= 0) {
      return { valid: false, reason: 'Unable to get current price for symbol' };
    }

    if (order.quantity <= 0) {
      return { valid: false, reason: 'Quantity must be positive' };
    }

    if (order.side === 'buy') {
      const estimatedCost = order.quantity * (order.price || currentPrice);
      if (estimatedCost > portfolio.buyingPower) {
        return { valid: false, reason: `Insufficient buying power. Required: $${estimatedCost.toFixed(2)}, Available: $${portfolio.buyingPower.toFixed(2)}` };
      }
    } else {
      // Sell order - check if we have the position
      const position = this.getPosition(order.symbol);
      if (!position || position.quantity < order.quantity) {
        return { valid: false, reason: `Insufficient shares. Required: ${order.quantity}, Available: ${position?.quantity || 0}` };
      }
    }

    return { valid: true };
  }

  private executeMarketOrder(order: Order): void {
    const currentPrice = this.getPrice(order.symbol);
    if (currentPrice <= 0) return;

    // Simulate small slippage for realism
    const slippage = order.side === 'buy' ? 1.0001 : 0.9999;
    const fillPrice = currentPrice * slippage;

    this.fillOrder(order.id, order.quantity, fillPrice);
  }

  fillOrder(orderId: string, quantity: number, price: number): Trade | null {
    const order = this.getOrder(orderId);
    if (!order || order.status === 'filled' || order.status === 'cancelled') {
      return null;
    }

    const fillQuantity = Math.min(quantity, order.quantity - order.filledQuantity);
    if (fillQuantity <= 0) return null;

    // Create trade record
    const trade: Trade = {
      id: uuidv4(),
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      quantity: fillQuantity,
      price: price,
      total: fillQuantity * price,
      commission: 0, // Free trades for paper trading
      timestamp: new Date(),
    };

    // Update portfolio and position
    this.updatePositionFromTrade(trade);

    // Update order
    const newFilledQuantity = order.filledQuantity + fillQuantity;
    const newStatus = newFilledQuantity >= order.quantity ? 'filled' : 'partial';
    const avgFillPrice = order.avgFillPrice
      ? (order.avgFillPrice * order.filledQuantity + price * fillQuantity) / newFilledQuantity
      : price;

    const stmt = this.db.prepare(`
      UPDATE orders
      SET filled_quantity = ?, status = ?, avg_fill_price = ?, updated_at = datetime('now'), filled_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(newFilledQuantity, newStatus, avgFillPrice, orderId);

    // Save trade
    const tradeStmt = this.db.prepare(`
      INSERT INTO trades (id, order_id, symbol, side, quantity, price, total, commission, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    tradeStmt.run(trade.id, trade.orderId, trade.symbol, trade.side, trade.quantity, trade.price, trade.total, trade.commission, trade.timestamp.toISOString());

    return trade;
  }

  private updatePositionFromTrade(trade: Trade): void {
    const position = this.getPosition(trade.symbol);
    const portfolio = this.getPortfolio();

    if (trade.side === 'buy') {
      // Deduct cash
      const cost = trade.total + trade.commission;
      this.db.prepare('UPDATE portfolio SET cash = cash - ?, updated_at = datetime(\'now\') WHERE id = 1').run(cost);

      if (position) {
        // Update existing position - calculate new average cost
        const totalShares = position.quantity + trade.quantity;
        const totalCost = (position.quantity * position.avgCost) + trade.total;
        const newAvgCost = totalCost / totalShares;

        this.db.prepare(`
          UPDATE positions SET quantity = ?, avg_cost = ?, updated_at = datetime('now')
          WHERE symbol = ?
        `).run(totalShares, newAvgCost, trade.symbol);
      } else {
        // Create new position
        this.db.prepare(`
          INSERT INTO positions (symbol, quantity, avg_cost, realized_pnl)
          VALUES (?, ?, ?, 0)
        `).run(trade.symbol, trade.quantity, trade.price);
      }
    } else {
      // Sell - calculate realized P&L
      if (!position) return;

      const proceeds = trade.total - trade.commission;
      const costBasis = trade.quantity * position.avgCost;
      const realizedPnL = proceeds - costBasis;

      // Add proceeds to cash
      this.db.prepare('UPDATE portfolio SET cash = cash + ?, updated_at = datetime(\'now\') WHERE id = 1').run(proceeds);

      const newQuantity = position.quantity - trade.quantity;
      if (newQuantity <= 0) {
        // Close position
        this.db.prepare('DELETE FROM positions WHERE symbol = ?').run(trade.symbol);
      } else {
        // Update position
        this.db.prepare(`
          UPDATE positions
          SET quantity = ?, realized_pnl = realized_pnl + ?, updated_at = datetime('now')
          WHERE symbol = ?
        `).run(newQuantity, realizedPnL, trade.symbol);
      }
    }
  }

  cancelOrder(orderId: string): Order | null {
    const order = this.getOrder(orderId);
    if (!order || order.status === 'filled') {
      return null;
    }

    this.db.prepare(`
      UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?
    `).run(orderId);

    return this.getOrder(orderId);
  }

  private saveOrder(order: Order): void {
    const stmt = this.db.prepare(`
      INSERT INTO orders (id, symbol, side, type, quantity, filled_quantity, price, stop_price, time_in_force, status, avg_fill_price, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      order.id,
      order.symbol,
      order.side,
      order.type,
      order.quantity,
      order.filledQuantity,
      order.price,
      order.stopPrice,
      order.timeInForce,
      order.status,
      order.avgFillPrice,
      order.createdAt.toISOString(),
      order.updatedAt.toISOString()
    );
  }

  getOrder(orderId: string): Order | null {
    const row = this.db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToOrder(row);
  }

  getOrders(status?: string): Order[] {
    let query = 'SELECT * FROM orders';
    const params: string[] = [];
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    query += ' ORDER BY created_at DESC LIMIT 100';

    const rows = this.db.prepare(query).all(...params) as Record<string, unknown>[];
    return rows.map(row => this.rowToOrder(row));
  }

  private rowToOrder(row: Record<string, unknown>): Order {
    return {
      id: row.id as string,
      symbol: row.symbol as string,
      side: row.side as OrderSide,
      type: row.type as OrderType,
      quantity: row.quantity as number,
      filledQuantity: row.filled_quantity as number,
      price: row.price as number | undefined,
      stopPrice: row.stop_price as number | undefined,
      timeInForce: row.time_in_force as TimeInForce,
      status: row.status as Order['status'],
      avgFillPrice: row.avg_fill_price as number | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      filledAt: row.filled_at ? new Date(row.filled_at as string) : undefined,
    };
  }

  getPosition(symbol: string): Position | null {
    const row = this.db.prepare('SELECT * FROM positions WHERE symbol = ?').get(symbol.toUpperCase()) as Record<string, unknown> | undefined;
    if (!row) return null;

    const currentPrice = this.getPrice(row.symbol as string);
    return this.rowToPosition(row, currentPrice);
  }

  getPositions(): Position[] {
    const rows = this.db.prepare('SELECT * FROM positions WHERE quantity > 0').all() as Record<string, unknown>[];
    return rows.map(row => {
      const currentPrice = this.getPrice(row.symbol as string);
      return this.rowToPosition(row, currentPrice);
    });
  }

  private rowToPosition(row: Record<string, unknown>, currentPrice: number): Position {
    const quantity = row.quantity as number;
    const avgCost = row.avg_cost as number;
    const marketValue = quantity * currentPrice;
    const costBasis = quantity * avgCost;
    const unrealizedPnL = marketValue - costBasis;
    const unrealizedPnLPercent = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;

    return {
      symbol: row.symbol as string,
      quantity,
      avgCost,
      currentPrice,
      marketValue,
      unrealizedPnL,
      unrealizedPnLPercent,
      realizedPnL: row.realized_pnl as number,
      dayPnL: 0, // Would need previous close to calculate
      dayPnLPercent: 0,
    };
  }

  getPortfolio(): Portfolio {
    const portfolioRow = this.db.prepare('SELECT * FROM portfolio WHERE id = 1').get() as Record<string, unknown>;
    const positions = this.getPositions();

    const totalPositionValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
    const cash = portfolioRow.cash as number;
    const totalValue = cash + totalPositionValue;
    const initialBalance = portfolioRow.initial_balance as number;

    const totalPnL = totalValue - initialBalance;
    const totalPnLPercent = (totalPnL / initialBalance) * 100;

    // Calculate day P&L (simplified - would need previous day's close)
    const dayPnL = positions.reduce((sum, p) => sum + p.dayPnL, 0);
    const dayPnLPercent = totalValue > 0 ? (dayPnL / totalValue) * 100 : 0;

    return {
      cash,
      buyingPower: cash, // Simplified - no margin
      totalValue,
      dayPnL,
      dayPnLPercent,
      totalPnL,
      totalPnLPercent,
      positions,
    };
  }

  getTrades(symbol?: string, limit: number = 50): Trade[] {
    let query = 'SELECT * FROM trades';
    const params: (string | number)[] = [];
    if (symbol) {
      query += ' WHERE symbol = ?';
      params.push(symbol.toUpperCase());
    }
    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(query).all(...params) as Record<string, unknown>[];
    return rows.map(row => ({
      id: row.id as string,
      orderId: row.order_id as string,
      symbol: row.symbol as string,
      side: row.side as OrderSide,
      quantity: row.quantity as number,
      price: row.price as number,
      total: row.total as number,
      commission: row.commission as number,
      timestamp: new Date(row.timestamp as string),
    }));
  }

  // Check and execute pending limit/stop orders
  checkPendingOrders(symbol: string, currentPrice: number): Trade[] {
    const trades: Trade[] = [];
    const pendingOrders = this.db.prepare(`
      SELECT * FROM orders WHERE symbol = ? AND status IN ('pending', 'partial')
    `).all(symbol.toUpperCase()) as Record<string, unknown>[];

    for (const row of pendingOrders) {
      const order = this.rowToOrder(row);
      let shouldFill = false;
      let fillPrice = currentPrice;

      switch (order.type) {
        case 'limit':
          if (order.side === 'buy' && currentPrice <= (order.price || Infinity)) {
            shouldFill = true;
            fillPrice = order.price!;
          } else if (order.side === 'sell' && currentPrice >= (order.price || 0)) {
            shouldFill = true;
            fillPrice = order.price!;
          }
          break;

        case 'stop':
          if (order.side === 'buy' && currentPrice >= (order.stopPrice || Infinity)) {
            shouldFill = true;
          } else if (order.side === 'sell' && currentPrice <= (order.stopPrice || 0)) {
            shouldFill = true;
          }
          break;

        case 'stop_limit':
          if (order.side === 'buy' && currentPrice >= (order.stopPrice || Infinity) && currentPrice <= (order.price || Infinity)) {
            shouldFill = true;
            fillPrice = order.price!;
          } else if (order.side === 'sell' && currentPrice <= (order.stopPrice || 0) && currentPrice >= (order.price || 0)) {
            shouldFill = true;
            fillPrice = order.price!;
          }
          break;
      }

      if (shouldFill) {
        const trade = this.fillOrder(order.id, order.quantity - order.filledQuantity, fillPrice);
        if (trade) trades.push(trade);
      }
    }

    return trades;
  }

  // Reset portfolio to initial state
  resetPortfolio(initialBalance: number = 100000): void {
    // Delete in correct order to respect foreign key constraints
    this.db.exec(`
      DELETE FROM trades;
      DELETE FROM orders;
      DELETE FROM positions;
      UPDATE portfolio SET cash = ${initialBalance}, initial_balance = ${initialBalance}, updated_at = datetime('now') WHERE id = 1;
    `);
  }
}
