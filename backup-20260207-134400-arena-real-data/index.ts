// Main Server - Express API + WebSocket for Trading Platform
import { config } from 'dotenv';
config({ path: '.env.local' });

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { initializeDatabase } from './db/schema';
import { TradingEngine } from './services/tradingEngine';
import { MarketDataSimulator } from './services/marketDataSimulator';
import { TechnicalAnalysis } from './services/technicalAnalysis';
import { TournamentManager } from './services/arena';
import { getLatestMasterBot, getMasterBotHistory } from './services/arena/masterBotSynthesis';
import type { BotGroupName } from './services/arena/types';
import { BOT_GROUPS } from './services/arena/types';

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
const enableLiveData = process.env.ENABLE_LIVE_DATA !== 'false'; // Default to enabled
const marketData = new MarketDataSimulator(enableLiveData);
const technicalAnalysis = new TechnicalAnalysis();

// Start market data (async - includes live data initialization)
(async () => {
  await marketData.start();
})();

// Update trading engine prices - ARENA REAL DATA ENFORCEMENT
marketData.on('quote', (quote) => {
  // 🚨 CRITICAL: Arena bots MUST have real data only
  // Validate quote source - reject simulated data for Arena symbols
  const isArenaSymbol = quote.symbol && (
    // Alpha Group (FX)
    ['GBP/JPY', 'USD/TRY', 'USD/ZAR', 'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD'].includes(quote.symbol) ||
    // Beta Group (Stocks) 
    ['NVDA', 'TSLA', 'AMD', 'COIN', 'ROKU', 'PLTR', 'MSTR'].includes(quote.symbol) ||
    // Gamma Group (Commodities)
    ['GC=F', 'SI=F', 'CL=F', 'NG=F', 'HG=F', 'LTHM'].includes(quote.symbol)
  );

  // For Arena symbols, only accept quotes from real sources
  if (isArenaSymbol && quote.source === 'simulated') {
    console.log(`🚨 [ARENA] Rejected simulated data for ${quote.symbol} - Arena requires REAL DATA ONLY`);
    return; // Skip simulated data for Arena symbols
  }

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

app.get('/api/orderbook/:symbol', async (req, res) => {
  try {
    const { levels = '10' } = req.query;
    const orderBook = await marketData.getOrderBook(req.params.symbol.toUpperCase(), Number(levels));
    if (!orderBook) {
      return res.status(404).json({ error: 'Symbol not found' });
    }
    res.json(orderBook);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/candles/:symbol', async (req, res) => {
  try {
    const { timeframe = '1m' } = req.query;
    const candles = await marketData.getCandles(req.params.symbol.toUpperCase(), timeframe as any);
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

// Data source status endpoint - shows which symbols are using live data
app.get('/api/market/sources', (_req, res) => {
  try {
    const status = marketData.getDataSourceStatus();
    const providerStats = marketData.getProviderStats();
    res.json({
      ...status,
      enableLiveData,
      eodhdConfigured: !!process.env.EODHD_API_KEY,
      providerStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Technical analysis endpoints
app.get('/api/analysis/:symbol/indicators', async (req, res) => {
  try {
    const { timeframe = '1h' } = req.query;
    const candles = await marketData.getCandles(req.params.symbol.toUpperCase(), timeframe as any);

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

app.get('/api/analysis/:symbol/ict', async (req, res) => {
  try {
    const { timeframe = '1h' } = req.query;
    const candles = await marketData.getCandles(req.params.symbol.toUpperCase(), timeframe as any);

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

app.get('/api/analysis/:symbol/qullamaggie', async (req, res) => {
  try {
    const candles = await marketData.getCandles(req.params.symbol.toUpperCase(), '1d');
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

// ===================== ARENA INITIALIZATION =====================

const arena = new TournamentManager(db, marketData);

// Recover any interrupted tournament from previous session
if (arena.recoverTournament()) {
  console.log('[Arena] Recovered tournament from previous session (paused - use /api/arena/tournament/resume to continue)');
}

// Forward arena events to WebSocket (scoped to 'arena' room subscribers only)
arena.on('bot:trade', (event) => {
  io.to('arena').emit('arena:bot:trade', event);
});

arena.on('leaderboard', (event) => {
  io.to('arena').emit('arena:leaderboard', event);
});

arena.on('tournament', (event) => {
  io.to('arena').emit('arena:tournament', event);
});

arena.on('evolution', (event) => {
  io.to('arena').emit('arena:evolution', event);
});

// ===================== ARENA REST API ROUTES =====================

// -- Status --
app.get('/api/arena/status', (_req, res) => {
  try {
    res.json(arena.getStatus());
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/arena/symbols', (_req, res) => {
  res.json(BOT_GROUPS);
});

// -- Tournaments --
app.get('/api/arena/tournaments', (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    res.json(arena.getTournamentHistory(limit));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/arena/tournament/current', (_req, res) => {
  try {
    const tournament = arena.getCurrentTournament();
    if (!tournament) return res.json(null);
    res.json(tournament);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/arena/tournament/create', (req, res) => {
  try {
    const { totalRounds, roundDurationMs } = req.body || {};
    const tournament = arena.createTournament({ totalRounds, roundDurationMs });
    res.json(tournament);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/arena/tournament/start', async (_req, res) => {
  try {
    await arena.startTournament();
    res.json({ success: true, tournament: arena.getCurrentTournament() });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/arena/tournament/pause', (_req, res) => {
  try {
    arena.pauseTournament();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/arena/tournament/resume', (_req, res) => {
  try {
    arena.resumeTournament();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/arena/tournament/stop', (_req, res) => {
  try {
    arena.stopTournament();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// -- Bots --
app.get('/api/arena/bots', (_req, res) => {
  try {
    res.json(arena.getBots());
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/arena/bots/group/:groupName', (req, res) => {
  try {
    const groupName = req.params.groupName as BotGroupName;
    res.json(arena.getBotsByGroup(groupName));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Bot comparison (must be before :botId to avoid matching "compare" as a botId)
app.get('/api/arena/bots/compare', (req, res) => {
  try {
    const ids = (req.query.ids as string || '').split(',').filter(Boolean);
    if (ids.length < 2) return res.status(400).json({ error: 'Provide at least 2 bot IDs via ?ids=id1,id2' });
    res.json(arena.compareBots(ids));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/arena/bots/:botId', (req, res) => {
  try {
    const bot = arena.getBot(req.params.botId);
    if (!bot) return res.status(404).json({ error: 'Bot not found' });
    res.json(bot);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/arena/bots/:botId/portfolio', (req, res) => {
  try {
    const tournament = arena.getCurrentTournament();
    if (!tournament) return res.json(null);
    const te = arena.getBotEngine().getTradingEngine();
    res.json(te.getPortfolio(req.params.botId, tournament.id));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/arena/bots/:botId/positions', (req, res) => {
  try {
    const tournament = arena.getCurrentTournament();
    if (!tournament) return res.json([]);
    const te = arena.getBotEngine().getTradingEngine();
    res.json(te.getPositions(req.params.botId, tournament.id));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/arena/bots/:botId/trades', (req, res) => {
  try {
    const tournament = arena.getCurrentTournament();
    if (!tournament) return res.json([]);
    const te = arena.getBotEngine().getTradingEngine();
    const limit = Number(req.query.limit) || 50;
    res.json(te.getTrades(req.params.botId, tournament.id, limit));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/arena/bots/:botId/dna-history', (req, res) => {
  try {
    res.json(arena.getDNAHistory(req.params.botId));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// -- Leaderboard --
app.get('/api/arena/leaderboard', (_req, res) => {
  try {
    res.json(arena.calculateLeaderboard());
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/arena/leaderboard/group/:groupName', (req, res) => {
  try {
    const all = arena.calculateLeaderboard();
    res.json(all.filter(e => e.groupName === req.params.groupName));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/arena/leaderboard/history/:tournamentId', (req, res) => {
  try {
    res.json(arena.getLeaderboardHistory(req.params.tournamentId));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// -- Evolution --
app.post('/api/arena/evolve', (_req, res) => {
  try {
    const results = arena.triggerEvolution();
    res.json({ success: true, generation: arena.getGeneration(), results });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// -- Master Bot --
app.get('/api/arena/master-bot', (_req, res) => {
  try {
    res.json(getLatestMasterBot(db));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/arena/master-bot/synthesize', (_req, res) => {
  try {
    const result = arena.synthesizeMasterBot();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/arena/master-bot/history', (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    res.json(getMasterBotHistory(db, limit));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// -- All arena trades (activity feed) --
app.get('/api/arena/trades', (req, res) => {
  try {
    const tournament = arena.getCurrentTournament();
    if (!tournament) return res.json([]);
    const te = arena.getBotEngine().getTradingEngine();
    const limit = Number(req.query.limit) || 100;
    res.json(te.getAllTrades(tournament.id, limit));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// -- Equity Curves --
app.get('/api/arena/bots/:botId/equity-curve', (req, res) => {
  try {
    const tournamentId = req.query.tournamentId as string | undefined;
    res.json(arena.getEquityCurve(req.params.botId, tournamentId));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/arena/equity-curves', (req, res) => {
  try {
    const tournamentId = req.query.tournamentId as string | undefined;
    res.json(arena.getAllEquityCurves(tournamentId));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// -- Generation Stats --
app.get('/api/arena/generations/stats', (_req, res) => {
  try {
    res.json(arena.getGenerationStats());
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// -- Bot Performance History --
app.get('/api/arena/bots/:botId/performance', (req, res) => {
  try {
    res.json(arena.getBotPerformanceHistory(req.params.botId));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ===================== ADVANCED GENETICS API =====================

// -- Evolution Config --
app.get('/api/arena/evolution/config', (_req, res) => {
  try {
    res.json(arena.getEvolutionConfig());
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.put('/api/arena/evolution/config', (req, res) => {
  try {
    const config = arena.setEvolutionConfig(req.body);
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// -- Advanced Evolution --
app.post('/api/arena/evolve/advanced', (_req, res) => {
  try {
    const result = arena.triggerAdvancedEvolution();
    res.json({
      success: true,
      generation: arena.getGeneration(),
      ...result,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// -- Bot Personalities --
app.get('/api/arena/personalities', (_req, res) => {
  try {
    res.json(arena.getAllPersonalities());
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/arena/personalities/distribution', (_req, res) => {
  try {
    res.json(arena.getPersonalityDistribution());
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/arena/bots/:botId/personality', (req, res) => {
  try {
    const personality = arena.getBotPersonality(req.params.botId);
    if (!personality) return res.status(404).json({ error: 'Bot not found' });
    res.json(personality);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/arena/bots/:botId/personality-history', (req, res) => {
  try {
    res.json(arena.getPersonalityHistory(req.params.botId));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/arena/breeding-compatibility', (req, res) => {
  try {
    const { bot1, bot2 } = req.query;
    if (!bot1 || !bot2) return res.status(400).json({ error: 'Provide bot1 and bot2 query params' });
    const compatibility = arena.getBreedingCompatibility(bot1 as string, bot2 as string);
    res.json({ bot1, bot2, compatibility });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// -- Hall of Fame --
app.get('/api/arena/hall-of-fame', (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    res.json(arena.getHallOfFame(limit));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/arena/hall-of-fame/group/:groupName', (req, res) => {
  try {
    res.json(arena.getHallOfFameByGroup(req.params.groupName as BotGroupName));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/arena/hall-of-fame/best', (_req, res) => {
  try {
    res.json(arena.getBestEverBot());
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// -- Generation Analytics --
app.get('/api/arena/analytics/generations', (req, res) => {
  try {
    const groupName = req.query.group as BotGroupName | undefined;
    const limit = Number(req.query.limit) || 20;
    res.json(arena.getGenerationAnalytics(groupName, limit));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/arena/analytics/summary', (_req, res) => {
  try {
    res.json(arena.getEvolutionSummary());
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// -- Advanced Master Bot Synthesis --
app.post('/api/arena/master-bot/synthesize-advanced', (req, res) => {
  try {
    const method = (req.body?.method || 'weighted_average') as string;
    const result = arena.synthesizeAdvancedMasterBot(method as any);
    res.json(result);
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

  // Arena WebSocket events
  socket.on('arena:subscribe', () => {
    socket.join('arena');
    // Send current status
    socket.emit('arena:status', arena.getStatus());
  });

  socket.on('arena:unsubscribe', () => {
    socket.leave('arena');
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
const eodhdConfigured = !!process.env.EODHD_API_KEY;
httpServer.listen(PORT, () => {
  console.log(`🚀 Trading Platform Server running on http://localhost:${PORT}`);
  console.log(`📊 WebSocket server ready`);
  console.log(`💹 Live data: ${enableLiveData ? 'ENABLED' : 'DISABLED (simulation mode)'}`);
  if (enableLiveData) {
    if (eodhdConfigured) {
      console.log(`   📡 EODHD: CONNECTED (WebSocket + REST)`);
      console.log(`      FX: 7 pairs via /ws/forex (real-time)`);
      console.log(`      Stocks: 7 symbols via /ws/us-quote (real-time)`);
      console.log(`      Crypto: BTC via /ws/crypto (real-time)`);
      console.log(`      Gold/Silver: via /ws/forex as XAUUSD/XAGUSD`);
      console.log(`      Oil/Gas/Copper: REST polling every 15s`);
    } else {
      console.log(`   ⚠️  EODHD: NOT CONFIGURED (set EODHD_API_KEY for live FX/commodity data)`);
    }
    console.log(`   📈 Stocks: ${eodhdConfigured ? 'EODHD (primary)' : 'Yahoo Finance'} / Alpaca (if configured)`);
    console.log(`   💰 Crypto: Binance (primary) / ${eodhdConfigured ? 'EODHD (fallback)' : 'no fallback'}`);
    console.log(`   💱 FX: ${eodhdConfigured ? 'EODHD (live)' : 'Simulator (simulated)'}`);
    console.log(`   🏭 Commodities: ${eodhdConfigured ? 'EODHD (live/polled)' : 'Simulator (simulated)'}`);
  }
});

// Graceful shutdown - pause tournament before exit
const gracefulShutdown = (signal: string) => {
  console.log(`\n[Server] ${signal} received, shutting down gracefully...`);
  const tournament = arena.getCurrentTournament();
  if (tournament && tournament.status === 'running') {
    arena.pauseTournament();
    console.log('[Server] Tournament paused for recovery on next startup');
  }
  marketData.stop();
  httpServer.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
  // Force exit after 5s if graceful close hangs
  setTimeout(() => process.exit(1), 5000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
