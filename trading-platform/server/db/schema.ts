// SQLite Database Schema for Trading Platform
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'trading.db');

export function initializeDatabase(): Database.Database {
  const db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    -- Portfolio table
    CREATE TABLE IF NOT EXISTS portfolio (
      id INTEGER PRIMARY KEY DEFAULT 1,
      cash REAL NOT NULL DEFAULT 100000,
      initial_balance REAL NOT NULL DEFAULT 100000,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Positions table
    CREATE TABLE IF NOT EXISTS positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL UNIQUE,
      quantity REAL NOT NULL DEFAULT 0,
      avg_cost REAL NOT NULL DEFAULT 0,
      realized_pnl REAL NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Orders table
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL CHECK(side IN ('buy', 'sell')),
      type TEXT NOT NULL CHECK(type IN ('market', 'limit', 'stop', 'stop_limit')),
      quantity REAL NOT NULL,
      filled_quantity REAL NOT NULL DEFAULT 0,
      price REAL,
      stop_price REAL,
      time_in_force TEXT NOT NULL DEFAULT 'day',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'filled', 'partial', 'cancelled', 'rejected')),
      avg_fill_price REAL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      filled_at TEXT
    );

    -- Trades table (executed fills)
    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL,
      quantity REAL NOT NULL,
      price REAL NOT NULL,
      total REAL NOT NULL,
      commission REAL NOT NULL DEFAULT 0,
      timestamp TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    -- Watchlists table
    CREATE TABLE IF NOT EXISTS watchlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      symbols TEXT NOT NULL DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Alerts table
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      condition TEXT NOT NULL,
      value REAL NOT NULL,
      triggered INTEGER NOT NULL DEFAULT 0,
      triggered_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Price history cache
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      time INTEGER NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      volume REAL NOT NULL,
      UNIQUE(symbol, timeframe, time)
    );

    -- Market structure analysis cache
    CREATE TABLE IF NOT EXISTS market_structure (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      analysis_type TEXT NOT NULL,
      data TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now')),
      UNIQUE(symbol, timeframe, analysis_type)
    );

    -- Risk settings
    CREATE TABLE IF NOT EXISTS risk_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      max_risk_per_trade REAL NOT NULL DEFAULT 0.005,
      max_daily_loss REAL NOT NULL DEFAULT 0.02,
      max_position_size REAL NOT NULL DEFAULT 0.25,
      max_open_positions INTEGER NOT NULL DEFAULT 10,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Initialize portfolio if not exists
    INSERT OR IGNORE INTO portfolio (id, cash, initial_balance) VALUES (1, 100000, 100000);

    -- Initialize risk settings if not exists
    INSERT OR IGNORE INTO risk_settings (id) VALUES (1);

    -- Create default watchlist
    INSERT OR IGNORE INTO watchlists (id, name, symbols)
    VALUES ('default', 'Default Watchlist', '["AAPL","MSFT","GOOGL","AMZN","NVDA","TSLA","META","SPY","QQQ","AMD"]');

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
    CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);
    CREATE INDEX IF NOT EXISTS idx_price_history_lookup ON price_history(symbol, timeframe, time);

    -- ===================== ARENA TABLES =====================

    -- Bots table
    CREATE TABLE IF NOT EXISTS bots (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      group_name TEXT NOT NULL CHECK(group_name IN ('Alpha', 'Beta', 'Gamma')),
      symbol TEXT NOT NULL,
      dna TEXT NOT NULL,
      generation INTEGER NOT NULL DEFAULT 0,
      parent_ids TEXT NOT NULL DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Bot portfolios (per tournament)
    CREATE TABLE IF NOT EXISTS bot_portfolios (
      bot_id TEXT NOT NULL,
      tournament_id TEXT NOT NULL,
      cash REAL NOT NULL DEFAULT 5000,
      initial_balance REAL NOT NULL DEFAULT 5000,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (bot_id, tournament_id)
    );

    -- Bot positions (per tournament)
    CREATE TABLE IF NOT EXISTS bot_positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id TEXT NOT NULL,
      tournament_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      avg_cost REAL NOT NULL DEFAULT 0,
      realized_pnl REAL NOT NULL DEFAULT 0,
      UNIQUE(bot_id, tournament_id, symbol)
    );

    -- Bot orders
    CREATE TABLE IF NOT EXISTS bot_orders (
      id TEXT PRIMARY KEY,
      bot_id TEXT NOT NULL,
      tournament_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL CHECK(side IN ('buy', 'sell')),
      type TEXT NOT NULL CHECK(type IN ('market', 'limit', 'stop')),
      quantity REAL NOT NULL,
      price REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'filled', 'cancelled')),
      reason TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      filled_at TEXT
    );

    -- Bot trades
    CREATE TABLE IF NOT EXISTS bot_trades (
      id TEXT PRIMARY KEY,
      bot_id TEXT NOT NULL,
      tournament_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL,
      quantity REAL NOT NULL,
      price REAL NOT NULL,
      total REAL NOT NULL,
      pnl REAL NOT NULL DEFAULT 0,
      reason TEXT NOT NULL DEFAULT '',
      timestamp TEXT DEFAULT (datetime('now'))
    );

    -- Tournaments
    CREATE TABLE IF NOT EXISTS tournaments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      generation INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'paused', 'completed')),
      current_round INTEGER NOT NULL DEFAULT 0,
      total_rounds INTEGER NOT NULL DEFAULT 10,
      round_duration_ms INTEGER NOT NULL DEFAULT 300000,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Tournament rounds
    CREATE TABLE IF NOT EXISTS tournament_rounds (
      id TEXT PRIMARY KEY,
      tournament_id TEXT NOT NULL,
      round_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed')),
      started_at TEXT,
      completed_at TEXT,
      UNIQUE(tournament_id, round_number)
    );

    -- Leaderboard snapshots
    CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
      id TEXT PRIMARY KEY,
      tournament_id TEXT NOT NULL,
      round_number INTEGER NOT NULL,
      entries TEXT NOT NULL DEFAULT '[]',
      timestamp TEXT DEFAULT (datetime('now'))
    );

    -- DNA history
    CREATE TABLE IF NOT EXISTS dna_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id TEXT NOT NULL,
      generation INTEGER NOT NULL,
      dna TEXT NOT NULL,
      fitness REAL NOT NULL DEFAULT 0,
      timestamp TEXT DEFAULT (datetime('now'))
    );

    -- Master bot syntheses
    CREATE TABLE IF NOT EXISTS master_bot_syntheses (
      id TEXT PRIMARY KEY,
      dna TEXT NOT NULL,
      source_bot_ids TEXT NOT NULL DEFAULT '[]',
      source_weights TEXT NOT NULL DEFAULT '[]',
      generation INTEGER NOT NULL DEFAULT 0,
      synthesized_at TEXT DEFAULT (datetime('now'))
    );

    -- Bot equity snapshots (for performance charts)
    CREATE TABLE IF NOT EXISTS bot_equity_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id TEXT NOT NULL,
      tournament_id TEXT NOT NULL,
      round_number INTEGER NOT NULL,
      total_value REAL NOT NULL,
      cash REAL NOT NULL,
      position_value REAL NOT NULL,
      pnl_percent REAL NOT NULL,
      timestamp TEXT DEFAULT (datetime('now'))
    );

    -- ===================== ADVANCED GENETICS TABLES =====================

    -- Hall of Fame (best bots ever observed)
    CREATE TABLE IF NOT EXISTS hall_of_fame (
      id TEXT PRIMARY KEY,
      bot_id TEXT NOT NULL,
      bot_name TEXT NOT NULL,
      group_name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      dna TEXT NOT NULL,
      personality TEXT NOT NULL DEFAULT '{}',
      fitness REAL NOT NULL,
      generation INTEGER NOT NULL,
      tournament_id TEXT NOT NULL,
      metrics TEXT NOT NULL DEFAULT '{}',
      inducted_at TEXT DEFAULT (datetime('now'))
    );

    -- Generation analytics (per-generation per-group stats)
    CREATE TABLE IF NOT EXISTS generation_analytics (
      id TEXT PRIMARY KEY,
      generation INTEGER NOT NULL,
      group_name TEXT NOT NULL,
      avg_fitness REAL NOT NULL DEFAULT 0,
      best_fitness REAL NOT NULL DEFAULT 0,
      worst_fitness REAL NOT NULL DEFAULT 0,
      fitness_std_dev REAL NOT NULL DEFAULT 0,
      diversity_metrics TEXT NOT NULL DEFAULT '{}',
      species_clusters TEXT NOT NULL DEFAULT '[]',
      pareto_front TEXT NOT NULL DEFAULT '{}',
      top_genes TEXT NOT NULL DEFAULT '[]',
      crossover_method TEXT NOT NULL DEFAULT 'uniform',
      selection_method TEXT NOT NULL DEFAULT 'tournament',
      mutation_method TEXT NOT NULL DEFAULT 'gaussian',
      effective_mutation_rate REAL NOT NULL DEFAULT 0.1,
      timestamp TEXT DEFAULT (datetime('now'))
    );

    -- Personality history (track archetype changes over generations)
    CREATE TABLE IF NOT EXISTS personality_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id TEXT NOT NULL,
      generation INTEGER NOT NULL,
      archetype TEXT NOT NULL,
      traits TEXT NOT NULL DEFAULT '{}',
      dominant_signals TEXT NOT NULL DEFAULT '[]',
      timestamp TEXT DEFAULT (datetime('now'))
    );

    -- Evolution config history (track which settings produced best results)
    CREATE TABLE IF NOT EXISTS evolution_config_history (
      id TEXT PRIMARY KEY,
      generation INTEGER NOT NULL,
      config TEXT NOT NULL DEFAULT '{}',
      avg_fitness_improvement REAL NOT NULL DEFAULT 0,
      diversity_change REAL NOT NULL DEFAULT 0,
      timestamp TEXT DEFAULT (datetime('now'))
    );

    -- Arena indexes
    CREATE INDEX IF NOT EXISTS idx_bots_group ON bots(group_name);
    CREATE INDEX IF NOT EXISTS idx_bot_portfolios_tournament ON bot_portfolios(tournament_id);
    CREATE INDEX IF NOT EXISTS idx_bot_positions_bot ON bot_positions(bot_id, tournament_id);
    CREATE INDEX IF NOT EXISTS idx_bot_orders_bot ON bot_orders(bot_id, tournament_id);
    CREATE INDEX IF NOT EXISTS idx_bot_orders_status ON bot_orders(status);
    CREATE INDEX IF NOT EXISTS idx_bot_trades_bot ON bot_trades(bot_id, tournament_id);
    CREATE INDEX IF NOT EXISTS idx_bot_trades_timestamp ON bot_trades(timestamp);
    CREATE INDEX IF NOT EXISTS idx_tournament_rounds_tournament ON tournament_rounds(tournament_id);
    CREATE INDEX IF NOT EXISTS idx_leaderboard_tournament ON leaderboard_snapshots(tournament_id, round_number);
    CREATE INDEX IF NOT EXISTS idx_dna_history_bot ON dna_history(bot_id, generation);
    CREATE INDEX IF NOT EXISTS idx_equity_snapshots_bot ON bot_equity_snapshots(bot_id, tournament_id);
    CREATE INDEX IF NOT EXISTS idx_equity_snapshots_tournament ON bot_equity_snapshots(tournament_id, timestamp);

    -- Advanced genetics indexes
    CREATE INDEX IF NOT EXISTS idx_hall_of_fame_fitness ON hall_of_fame(fitness DESC);
    CREATE INDEX IF NOT EXISTS idx_hall_of_fame_group ON hall_of_fame(group_name);
    CREATE INDEX IF NOT EXISTS idx_generation_analytics_gen ON generation_analytics(generation, group_name);
    CREATE INDEX IF NOT EXISTS idx_personality_history_bot ON personality_history(bot_id, generation);
    CREATE INDEX IF NOT EXISTS idx_evolution_config_gen ON evolution_config_history(generation);
  `);

  return db;
}

export function getDatabase(): Database.Database {
  return new Database(DB_PATH);
}
