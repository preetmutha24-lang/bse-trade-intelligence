import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { env } from '../config/env.js';
import { generateSeedTrades } from '../services/mockExchangeService.js';

const dbPath = env.dbPath;
const dbDirectory = path.dirname(dbPath);
fs.mkdirSync(dbDirectory, { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_id TEXT UNIQUE NOT NULL,
    client TEXT NOT NULL,
    symbol TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    timestamp TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pull_jobs (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK(status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED')),
    started_at TEXT,
    completed_at TEXT,
    duration_ms INTEGER DEFAULT 0,
    records_imported INTEGER DEFAULT 0,
    error_message TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
  CREATE INDEX IF NOT EXISTS idx_trades_client ON trades(client);
  CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);
  CREATE INDEX IF NOT EXISTS idx_pull_jobs_status ON pull_jobs(status);
  CREATE INDEX IF NOT EXISTS idx_pull_jobs_started_at ON pull_jobs(started_at);
`);

export function initializeDatabase() {
  seedInitialTradesIfNeeded();
  cleanupStaleRunningJobs();
}

export function seedInitialTradesIfNeeded() {
  const existingCount = db.prepare('SELECT COUNT(*) AS total FROM trades').get().total;
  if (existingCount > 0) {
    return existingCount;
  }

  const records = generateSeedTrades(3000);
  const insertStatement = db.prepare(`
    INSERT OR IGNORE INTO trades (trade_id, client, symbol, quantity, price, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((rows) => {
    for (const row of rows) {
      insertStatement.run(row.tradeId, row.client, row.symbol, row.quantity, row.price, row.timestamp);
    }
  });

  transaction(records);
  return records.length;
}

export function cleanupStaleRunningJobs() {
  db.prepare(`
    UPDATE pull_jobs
    SET status = 'FAILED',
        completed_at = CURRENT_TIMESTAMP,
        duration_ms = CASE WHEN started_at IS NOT NULL THEN (strftime('%s', 'now') - strftime('%s', started_at)) * 1000 ELSE 0 END,
        error_message = 'Server restarted before completion.'
    WHERE status = 'RUNNING'
  `).run();
}

export function createPullJob() {
  const id = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO pull_jobs (id, status, started_at, duration_ms, records_imported, error_message)
    VALUES (?, 'QUEUED', ?, 0, 0, NULL)
  `).run(id, startedAt);

  return getPullJobById(id);
}

export function getCurrentActiveJob() {
  return db.prepare(`
    SELECT * FROM pull_jobs
    WHERE status IN ('QUEUED', 'RUNNING')
    ORDER BY started_at DESC
    LIMIT 1
  `).get();
}

export function getPullJobById(jobId) {
  return db.prepare(`SELECT * FROM pull_jobs WHERE id = ?`).get(jobId);
}

export function setJobRunning(jobId) {
  db.prepare(`
    UPDATE pull_jobs
    SET status = 'RUNNING', started_at = COALESCE(started_at, ?)
    WHERE id = ?
  `).run(new Date().toISOString(), jobId);

  return getPullJobById(jobId);
}

export function updatePullJob(jobId, updates) {
  const existing = getPullJobById(jobId);
  if (!existing) {
    return null;
  }

  const current = {
    status: updates.status ?? existing.status,
    completed_at: updates.completedAt ?? existing.completed_at,
    duration_ms: updates.durationMs ?? existing.duration_ms,
    records_imported: updates.recordsImported ?? existing.records_imported,
    error_message: updates.errorMessage ?? existing.error_message,
  };

  db.prepare(`
    UPDATE pull_jobs
    SET status = ?, completed_at = ?, duration_ms = ?, records_imported = ?, error_message = ?
    WHERE id = ?
  `).run(
    current.status,
    current.completed_at,
    current.duration_ms,
    current.records_imported,
    current.error_message,
    jobId,
  );

  return getPullJobById(jobId);
}

export function importTrades(trades) {
  if (!Array.isArray(trades) || trades.length === 0) {
    return 0;
  }

  const insertStatement = db.prepare(`
    INSERT OR IGNORE INTO trades (trade_id, client, symbol, quantity, price, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((rows) => {
    let inserted = 0;
    for (const row of rows) {
      const result = insertStatement.run(row.tradeId, row.client, row.symbol, row.quantity, row.price, row.timestamp);
      if (result.changes > 0) {
        inserted += 1;
      }
    }
    return inserted;
  });

  return transaction(trades);
}

export function getTrades({
  search = '',
  client = '',
  symbol = '',
  limit = 50,
  page = 1,
  sortBy = 'timestamp',
  sortDir = 'DESC',
  dateFrom = '',
  dateTo = '',
} = {}) {
  const safeLimit = Number(limit) > 0 ? Number(limit) : 50;
  const safePage = Number(page) > 0 ? Number(page) : 1;
  const offset = (safePage - 1) * safeLimit;
  const sortColumns = new Set(['trade_id', 'client', 'symbol', 'quantity', 'price', 'timestamp']);
  const normalizedSortBy = sortColumns.has(sortBy) ? sortBy : 'timestamp';
  const normalizedSortDir = sortDir === 'ASC' ? 'ASC' : 'DESC';

  const clauses = [];
  const params = [];

  if (search) {
    clauses.push('(trade_id LIKE ? OR client LIKE ? OR symbol LIKE ?)');
    const searchValue = `%${search}%`;
    params.push(searchValue, searchValue, searchValue);
  }

  if (client) {
    clauses.push('client = ?');
    params.push(client);
  }

  if (symbol) {
    clauses.push('symbol = ?');
    params.push(symbol);
  }

  if (dateFrom) {
    clauses.push('timestamp >= ?');
    params.push(dateFrom);
  }

  if (dateTo) {
    clauses.push('timestamp <= ?');
    params.push(dateTo);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) AS total FROM trades ${whereClause}`).get(...params).total;
  const rows = db.prepare(`
    SELECT trade_id AS tradeId, client, symbol, quantity, price, timestamp
    FROM trades
    ${whereClause}
    ORDER BY ${normalizedSortBy} ${normalizedSortDir}
    LIMIT ? OFFSET ?
  `).all(...params, safeLimit, offset);

  return { total, rows, page: safePage, limit: safeLimit };
}

export function getDashboardStats() {
  const totalTrades = db.prepare('SELECT COUNT(*) AS value FROM trades').get().value;
  const uniqueClients = db.prepare('SELECT COUNT(DISTINCT client) AS value FROM trades').get().value;
  const activeSymbols = db.prepare('SELECT COUNT(DISTINCT symbol) AS value FROM trades').get().value;
  const latestSuccessfulPull = db.prepare(`
    SELECT started_at, records_imported FROM pull_jobs
    WHERE status = 'COMPLETED'
    ORDER BY completed_at DESC
    LIMIT 1
  `).get();

  const latestJob = db.prepare(`
    SELECT status, records_imported, started_at, completed_at
    FROM pull_jobs
    ORDER BY completed_at DESC, started_at DESC
    LIMIT 1
  `).get();

  return {
    totalTrades,
    uniqueClients,
    activeSymbols,
    latestSuccessfulPull: latestSuccessfulPull ? latestSuccessfulPull.started_at : null,
    recordsImportedLastPull: latestSuccessfulPull ? latestSuccessfulPull.records_imported : 0,
    latestJob: latestJob ?? null,
  };
}

export function getRecentPullJobs(limit = 12) {
  return db.prepare(`
    SELECT * FROM pull_jobs
    ORDER BY started_at DESC
    LIMIT ?
  `).all(limit);
}

export function getHealthStatus() {
  const totalSuccessful = db.prepare("SELECT COUNT(*) AS total FROM pull_jobs WHERE status = 'COMPLETED'").get().total;
  const totalFailed = db.prepare("SELECT COUNT(*) AS total FROM pull_jobs WHERE status = 'FAILED'").get().total;
  const latestSuccessfulPull = db.prepare(`
    SELECT started_at, completed_at, records_imported FROM pull_jobs
    WHERE status = 'COMPLETED'
    ORDER BY completed_at DESC
    LIMIT 1
  `).get();

  return {
    totalSuccessful,
    totalFailed,
    latestSuccessfulPull: latestSuccessfulPull ? { started_at: latestSuccessfulPull.started_at, completed_at: latestSuccessfulPull.completed_at, records_imported: latestSuccessfulPull.records_imported } : null,
  };
}

export function getTradeSummaryBySymbol() {
  return db.prepare(`
    SELECT symbol, COUNT(*) AS trade_count, ROUND(SUM(quantity * price), 2) AS value
    FROM trades
    GROUP BY symbol
    ORDER BY trade_count DESC, value DESC
    LIMIT 8
  `).all();
}

export function getRecentTrades(limit = 12) {
  return db.prepare(`
    SELECT trade_id AS tradeId, client, symbol, quantity, price, timestamp
    FROM trades
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(limit);
}

export function getSymbolVolumeOverview() {
  return db.prepare(`
    SELECT symbol, SUM(quantity * price) AS volume
    FROM trades
    GROUP BY symbol
    ORDER BY volume DESC
    LIMIT 10
  `).all();
}

export function getTradeDistributionData() {
  return db.prepare(`
    SELECT symbol, COUNT(*) AS trades
    FROM trades
    GROUP BY symbol
    ORDER BY trades DESC
  `).all();
}
