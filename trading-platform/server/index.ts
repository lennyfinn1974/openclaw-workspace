// Main Server - Express API + WebSocket for Trading Platform
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { initializeDatabase } from './db/schema';
import { TradingEngine } from './services/tradingEngine';
import { MarketDataSimulator } from './services/marketDataSimulator';
import { TechnicalAnalysis } from './services/technicalAnalysis';

const PORT = process.env.PORT || 8101;

// Initialize components
const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:8101'],
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
const db = initializeDatabase();
const tradingEngine = new TradingEngine(db);
const marketData = new MarketDataSimulator();
const technicalAnalysis = new TechnicalAnalysis();

// Start market data simulation
marketData.start();

// Update trading engine prices
marketData.on('quote', (quote) => {
  tradingEngine.updatePrice(quote.symbol, quote.last);

  // Check pending orders
  const trades = tradingEngine.checkPendingOrders(quote.symbol, quote.last);

  // Broadcast quote to all clients
  io.emit('quote', quote);

  // Broadcast executed trades
  for (const trade of trades) {
    io.emit('trade', trade);
    io.emit('position', tradingEngine.getPosition(trade.symbol));
    io.emit('portfolio', tradingEngine.getPortfolio());
  }
});

marketData.on('candle', ({ symbol, timeframe, candle }) => {
  io.emit('candle', { symbol, timeframe, candle });
});

// ===================== REST API ROUTES =====================

// Portfolio endpoints
app.get('/api/portfolio', (_req, res) => {
  try {
    const portfolio = tradingEngine.getPortfolio();
    res.json(portfolio);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/portfolio/reset', (req, res) => {
  try {
    const { balance = 100000 } = req.body;
    tradingEngine.resetPortfolio(balance);
    res.json({ success: true, portfolio: tradingEngine.getPortfolio() });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Position endpoints
app.get('/api/positions', (_req, res) => {
  try {
    const positions = tradingEngine.getPositions();
    res.json(positions);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/positions/:symbol', (req, res) => {
  try {
    const position = tradingEngine.getPosition(req.params.symbol);
    if (!position) {
      return res.status(404).json({ error: 'Position not found' });
    }
    res.json(position);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Order endpoints
app.get('/api/orders', (req, res) => {
  try {
    const { status } = req.query;
    const orders = tradingEngine.getOrders(status as string);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/orders/:id', (req, res) => {
  try {
    const order = tradingEngine.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/orders', (req, res) => {
  try {
    const { symbol, side, type, quantity, price, stopPrice, timeInForce } = req.body;

    if (!symbol || !side || !type || !quantity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const order = tradingEngine.placeOrder({
      symbol,
      side,
      type,
      quantity: Number(quantity),
      price: price ? Number(price) : undefined,
      stopPrice: stopPrice ? Number(stopPrice) : undefined,
      timeInForce,
    });

    // Broadcast order and portfolio updates
    io.emit('order', order);
    io.emit('portfolio', tradingEngine.getPortfolio());
    if (order.status === 'filled') {
      io.emit('position', tradingEngine.getPosition(symbol));
    }

    res.json(order);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.delete('/api/orders/:id', (req, res) => {
  try {
    const order = tradingEngine.cancelOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found or already filled' });
    }
    io.emit('order', order);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Trade history
app.get('/api/trades', (req, res) => {
  try {
    const { symbol, limit } = req.query;
    const trades = tradingEngine.getTrades(symbol as string, limit ? Number(limit) : 50);
    res.json(trades);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Market data endpoints
app.get('/api/quote/:symbol', (req, res) => {
  try {
    const quote = marketData.getQuote(req.params.symbol.toUpperCase());
    if (!quote) {
      return res.status(404).json({ error: 'Symbol not found' });
    }
    res.json(quote);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/quotes', (_req, res) => {
  try {
    const symbols = marketData.getSymbols();
    const quotes = symbols.map(s => marketData.getQuote(s)).filter(Boolean);
    res.json(quotes);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/orderbook/:symbol', (req, res) => {
  try {
    const { levels = '10' } = req.query;
    const orderBook = marketData.getOrderBook(req.params.symbol.toUpperCase(), Number(levels));
    if (!orderBook) {
      return res.status(404).json({ error: 'Symbol not found' });
    }
    res.json(orderBook);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/candles/:symbol', (req, res) => {
  try {
    const { timeframe = '1m' } = req.query;
    const candles = marketData.getCandles(req.params.symbol.toUpperCase(), timeframe as any);
    res.json(candles);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/symbols', (_req, res) => {
  res.json(marketData.getSymbols());
});

app.get('/api/market/session', (_req, res) => {
  res.json({
    session: marketData.getMarketSession(),
    killZone: marketData.isInKillZone(),
  });
});

// Technical analysis endpoints
app.get('/api/analysis/:symbol/indicators', (req, res) => {
  try {
    const { timeframe = '1h' } = req.query;
    const candles = marketData.getCandles(req.params.symbol.toUpperCase(), timeframe as any);

    if (candles.length < 30) {
      return res.status(400).json({ error: 'Insufficient data for analysis' });
    }

    const rsi = technicalAnalysis.calculateRSI(candles);
    const macd = technicalAnalysis.calculateMACD(candles);
    const ma = technicalAnalysis.calculateMovingAverages(candles);

    res.json({
      rsi: rsi[rsi.length - 1],
      macd: macd[macd.length - 1],
      movingAverages: ma,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/analysis/:symbol/ict', (req, res) => {
  try {
    const { timeframe = '1h' } = req.query;
    const candles = marketData.getCandles(req.params.symbol.toUpperCase(), timeframe as any);

    if (candles.length < 50) {
      return res.status(400).json({ error: 'Insufficient data for ICT analysis' });
    }

    const orderBlocks = technicalAnalysis.findOrderBlocks(candles);
    const fvgs = technicalAnalysis.findFairValueGaps(candles);
    const liquidity = technicalAnalysis.findLiquidityLevels(candles);
    const structure = technicalAnalysis.analyzeMarketStructure(candles);

    res.json({
      orderBlocks,
      fairValueGaps: fvgs,
      liquidityLevels: liquidity,
      marketStructure: structure,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/analysis/:symbol/qullamaggie', (req, res) => {
  try {
    const candles = marketData.getCandles(req.params.symbol.toUpperCase(), '1d');
    const setups = technicalAnalysis.findQullamagieSetups(candles, req.params.symbol.toUpperCase());
    res.json(setups);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/analysis/position-size', (req, res) => {
  try {
    const { portfolioValue, riskPercent, entryPrice, stopLoss } = req.body;

    if (!portfolioValue || !riskPercent || !entryPrice || !stopLoss) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const calculation = technicalAnalysis.calculatePositionSize({
      portfolioValue: Number(portfolioValue),
      riskPercent: Number(riskPercent),
      entryPrice: Number(entryPrice),
      stopLoss: Number(stopLoss),
    });

    res.json(calculation);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Risk settings
app.get('/api/risk-settings', (_req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM risk_settings WHERE id = 1').get();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.put('/api/risk-settings', (req, res) => {
  try {
    const { maxRiskPerTrade, maxDailyLoss, maxPositionSize, maxOpenPositions } = req.body;

    db.prepare(`
      UPDATE risk_settings
      SET max_risk_per_trade = COALESCE(?, max_risk_per_trade),
          max_daily_loss = COALESCE(?, max_daily_loss),
          max_position_size = COALESCE(?, max_position_size),
          max_open_positions = COALESCE(?, max_open_positions),
          updated_at = datetime('now')
      WHERE id = 1
    `).run(maxRiskPerTrade, maxDailyLoss, maxPositionSize, maxOpenPositions);

    const settings = db.prepare('SELECT * FROM risk_settings WHERE id = 1').get();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Watchlists
app.get('/api/watchlists', (_req, res) => {
  try {
    const watchlists = db.prepare('SELECT * FROM watchlists').all();
    res.json(watchlists.map((w: any) => ({ ...w, symbols: JSON.parse(w.symbols) })));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/watchlists', (req, res) => {
  try {
    const { id, name, symbols } = req.body;
    db.prepare(`
      INSERT OR REPLACE INTO watchlists (id, name, symbols, updated_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(id, name, JSON.stringify(symbols));
    res.json({ id, name, symbols });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ===================== WEBSOCKET HANDLERS =====================

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send initial data
  socket.emit('portfolio', tradingEngine.getPortfolio());
  socket.emit('positions', tradingEngine.getPositions());

  // Subscribe to symbol updates
  socket.on('subscribe', (symbols: string[]) => {
    for (const symbol of symbols) {
      socket.join(`symbol:${symbol.toUpperCase()}`);
      const quote = marketData.getQuote(symbol.toUpperCase());
      if (quote) socket.emit('quote', quote);
    }
  });

  socket.on('unsubscribe', (symbols: string[]) => {
    for (const symbol of symbols) {
      socket.leave(`symbol:${symbol.toUpperCase()}`);
    }
  });

  // Handle order placement via WebSocket
  socket.on('placeOrder', (orderParams, callback) => {
    try {
      const order = tradingEngine.placeOrder(orderParams);
      callback({ success: true, order });
      io.emit('order', order);
      io.emit('portfolio', tradingEngine.getPortfolio());
    } catch (error) {
      callback({ success: false, error: (error as Error).message });
    }
  });

  socket.on('cancelOrder', (orderId: string, callback) => {
    try {
      const order = tradingEngine.cancelOrder(orderId);
      callback({ success: true, order });
      if (order) io.emit('order', order);
    } catch (error) {
      callback({ success: false, error: (error as Error).message });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 Trading Platform Server running on http://localhost:${PORT}`);
  console.log(`📊 WebSocket server ready`);
  console.log(`💹 Market data simulation active`);
});
