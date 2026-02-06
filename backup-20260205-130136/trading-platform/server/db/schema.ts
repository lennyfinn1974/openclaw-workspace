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
  `);

  return db;
}

export function getDatabase(): Database.Database {
  return new Database(DB_PATH);
}
