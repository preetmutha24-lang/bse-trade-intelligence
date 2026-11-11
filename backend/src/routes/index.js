import express from 'express';
import { env } from '../config/env.js';
import {
  getDashboardStats,
  getHealthStatus,
  getRecentPullJobs,
  getRecentTrades,
  getSymbolVolumeOverview,
  getTradeDistributionData,
  getTrades
} from '../database/db.js';
import { attachSSEClient, getSSEConnectionCount } from '../events/sseManager.js';
import { fetchTrades } from '../services/mockExchangeService.js';
import { startBackgroundPull } from '../services/pullWorker.js';

const router = express.Router();

function buildHealthResponse() {
  const health = getHealthStatus();
  return {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    backend: 'available',
    database: 'connected',
    worker: 'available',
    activeSseConnections: getSSEConnectionCount(),
    ...health,
  };
}

router.get('/health', (req, res) => {
  res.json(buildHealthResponse());
});

router.get('/api/health', (req, res) => {
  res.json(buildHealthResponse());
});

router.get('/getTrades', async (req, res, next) => {
  try {
    const count = Number(req.query.count ?? 3000);
    const delayMs = Number(req.query.delayMs ?? 0);

    if (!Number.isFinite(count) || count <= 0) {
      return res.status(400).json({ error: 'count must be a positive integer.' });
    }

    const data = await fetchTrades({ count, delayMs });
    return res.json(data);
  } catch (error) {
    return next(error);
  }
});

router.get('/api/trades', (req, res) => {
  const search = String(req.query.search ?? '');
  const client = String(req.query.client ?? '');
  const symbol = String(req.query.symbol ?? '');
  const sortBy = String(req.query.sortBy ?? 'timestamp');
  const sortDir = String(req.query.sortDir ?? 'DESC');
  const dateFrom = String(req.query.dateFrom ?? '');
  const dateTo = String(req.query.dateTo ?? '');
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 50);

  const data = getTrades({
    search,
    client,
    symbol,
    sortBy,
    sortDir,
    dateFrom,
    dateTo,
    page,
    limit,
  });

  res.json({
    pagination: {
      page: data.page,
      limit: data.limit,
      total: data.total,
      totalPages: Math.max(1, Math.ceil(data.total / data.limit)),
    },
    trades: data.rows,
  });
});

router.get('/api/stats', (req, res) => {
  const stats = getDashboardStats();
  res.json({
    totalTrades: stats.totalTrades,
    uniqueClients: stats.uniqueClients,
    activeSymbols: stats.activeSymbols,
    latestSuccessfulPull: stats.latestSuccessfulPull,
    recordsImportedLastPull: stats.recordsImportedLastPull,
  });
});

router.get('/api/pulls', (req, res) => {
  const limit = Number(req.query.limit ?? 12);
  const jobs = getRecentPullJobs(limit);
  res.json({ jobs });
});

router.post('/api/pulls', async (req, res, next) => {
  try {
    const { count = 3000, delayMs = 0 } = req.body ?? {};
    if (count !== undefined && (!Number.isFinite(Number(count)) || Number(count) <= 0)) {
      return res.status(400).json({ error: 'count must be a positive integer.' });
    }

    if (delayMs !== undefined && (!Number.isFinite(Number(delayMs)) || Number(delayMs) < 0)) {
      return res.status(400).json({ error: 'delayMs must be a non-negative integer.' });
    }

    const job = await startBackgroundPull({ count, delayMs });
    return res.status(202).json({
      accepted: true,
      job,
      message: 'Pull started in the background.',
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/api/events', (req, res) => {
  attachSSEClient(req, res);
});

router.get('/api/analytics', (req, res) => {
  res.json({
    distribution: getTradeDistributionData(),
    volume: getSymbolVolumeOverview(),
    recentTrades: getRecentTrades(12),
  });
});

router.get('/api/health-status', (req, res) => {
  res.json({
    uptime: process.uptime(),
    backend: 'available',
    database: 'connected',
    worker: 'available',
    env: env.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

router.get('/api/dashboard', (req, res) => {
  const stats = getDashboardStats();
  const recentTrades = getRecentTrades(15);
  const recentJobs = getRecentPullJobs(8);

  res.json({
    stats,
    recentTrades,
    recentJobs,
    distribution: getTradeDistributionData(),
    volume: getSymbolVolumeOverview(),
  });
});

export default router;
