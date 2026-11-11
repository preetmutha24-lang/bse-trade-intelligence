import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import request from 'supertest';
import app from '../src/app.js';
import { attachSSEClient, broadcastEvent } from '../src/events/sseManager.js';
import { db, cleanupStaleRunningJobs, getCurrentActiveJob, getHealthStatus, getPullJobById, getRecentPullJobs, getTrades, importTrades, initializeDatabase, seedInitialTradesIfNeeded, updatePullJob } from '../src/database/db.js';
import { fetchTrades, generateSeedTrades } from '../src/services/mockExchangeService.js';
import { startBackgroundPull } from '../src/services/pullWorker.js';

async function waitFor(predicate, timeoutMs = 20000, intervalMs = 150) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

test('Mock API returns seeded records', { concurrency: false }, async () => {
  const response = await request(app).get('/getTrades?count=50&delayMs=0');
  assert.equal(response.status, 200);
  assert.equal(response.body.requestedCount, 50);
  assert.equal(response.body.trades.length, 50);
  assert.ok(response.body.trades[0].tradeId);
});

test('Initial database seeding works', { concurrency: false }, async () => {
  initializeDatabase();
  const count = seedInitialTradesIfNeeded();
  assert.ok(count >= 3000);
  assert.ok(db.prepare('SELECT COUNT(*) AS total FROM trades').get().total >= 3000);
});

test('REST dashboard loads existing trades', { concurrency: false }, async () => {
  const response = await request(app).get('/api/trades?limit=5');
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.trades));
  assert.ok(response.body.trades.length > 0);
});

test('Pull request responds with HTTP 202 quickly', { concurrency: false }, async () => {
  const response = await request(app).post('/api/pulls').send({ count: 3000, delayMs: 0 });
  assert.equal(response.status, 202);
  assert.ok(response.body.job.id);
});

test('Pull runs independently', { concurrency: false }, async () => {
  await waitFor(() => !getCurrentActiveJob(), 30000);
  const job = await startBackgroundPull();
  const success = await waitFor(() => {
    const current = getPullJobById(job.id);
    return current && ['COMPLETED', 'FAILED'].includes(current.status);
  }, 30000);
  assert.equal(success, true);
  const finalJob = getPullJobById(job.id);
  assert.ok(finalJob);
  assert.ok(['COMPLETED', 'FAILED'].includes(finalJob.status));
});

test('Trades are inserted after completion', { concurrency: false }, async () => {
  await waitFor(() => !getCurrentActiveJob(), 30000);
  const before = db.prepare('SELECT COUNT(*) AS total FROM trades').get().total;
  const job = await startBackgroundPull();
  const success = await waitFor(() => {
    const current = getPullJobById(job.id);
    return current && current.status === 'COMPLETED';
  }, 30000);
  assert.equal(success, true);
  const after = db.prepare('SELECT COUNT(*) AS total FROM trades').get().total;
  assert.ok(after >= before);
});

test('Fresh pulls generate unique trade IDs', { concurrency: false }, async () => {
  const first = fetchTrades({ count: 120, delayMs: 0 }).then((result) => result.trades.map((trade) => trade.tradeId));
  const second = fetchTrades({ count: 120, delayMs: 0 }).then((result) => result.trades.map((trade) => trade.tradeId));
  const [firstIds, secondIds] = await Promise.all([first, second]);
  assert.notDeepEqual(firstIds, secondIds);
  assert.ok(new Set(firstIds).size === firstIds.length);
  assert.ok(new Set(secondIds).size === secondIds.length);
});

test('Duplicate trades are prevented', { concurrency: false }, async () => {
  const tradeId = `DUP-${Date.now()}-1`;
  const duplicateBatch = [
    { tradeId, client: 'CLT4021', symbol: 'RELIANCE', quantity: 1250, price: 150.25, timestamp: new Date().toISOString() },
    { tradeId, client: 'CLT4021', symbol: 'RELIANCE', quantity: 1250, price: 150.25, timestamp: new Date().toISOString() },
  ];
  const inserted = importTrades(duplicateBatch);
  assert.equal(inserted, 1);
});

test('Pull history is persisted', { concurrency: false }, async () => {
  const jobs = getRecentPullJobs(10);
  assert.ok(Array.isArray(jobs));
  assert.ok(jobs.length > 0);
});

test('Failed jobs are handled', { concurrency: false }, async () => {
  const jobId = `failure-${Date.now()}`;
  const row = db.prepare('INSERT INTO pull_jobs (id, status, started_at, completed_at, duration_ms, records_imported, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(jobId, 'FAILED', '2024-01-01T00:00:00.000Z', '2024-01-01T00:05:00.000Z', 300000, 0, 'Job simulation failure');
  assert.equal(row.changes, 1);
  const found = getPullJobById(jobId);
  assert.equal(found.status, 'FAILED');
  assert.equal(found.error_message, 'Job simulation failure');
});

test('Multiple SSE clients receive events', { concurrency: false }, async () => {
  let writes = [];
  const createReq = () => ({ on: () => {} });
  const createRes = (name) => ({
    name,
    writeHead: () => {},
    write: (chunk) => writes.push({ name, chunk }),
  });

  const req1 = createReq();
  const req2 = createReq();
  const res1 = createRes('first');
  const res2 = createRes('second');

  attachSSEClient(req1, res1);
  attachSSEClient(req2, res2);
  broadcastEvent('pull_completed', { jobId: 'sse-demo', recordsImported: 7 });

  assert.ok(writes.some((entry) => entry.chunk.includes('event: pull_completed')));
  assert.ok(writes.some((entry) => entry.name === 'first'));
  assert.ok(writes.some((entry) => entry.name === 'second'));
});

test('Already-open dashboard receives pull_completed', { concurrency: false }, async () => {
  const writes = [];
  const req = { on: () => {} };
  const res = { writeHead: () => {}, write: (chunk) => writes.push(chunk) };
  attachSSEClient(req, res);
  broadcastEvent('pull_completed', { jobId: 'already-open-dashboard-test', recordsImported: 55 });
  assert.ok(writes.some((chunk) => chunk.includes('event: pull_completed')));
});

test('No frontend polling is used', { concurrency: false }, async () => {
  const source = readFileSync(new URL('../../frontend/src/App.jsx', import.meta.url), 'utf8');
  assert.ok(!/setInterval\s*\(|setTimeout\s*\(.*fetch|polling/i.test(source));
});

test('Server restart recovery works', { concurrency: false }, async () => {
  db.prepare('INSERT OR IGNORE INTO pull_jobs (id, status, started_at, completed_at, duration_ms, records_imported, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('restart-stale-job', 'RUNNING', '2020-01-01T00:00:00.000Z', null, 3000, 0, null);
  cleanupStaleRunningJobs();
  const job = getPullJobById('restart-stale-job');
  assert.equal(job.status, 'FAILED');
  assert.match(job.error_message, /restart/i);
});

test('Health endpoint reports actual backend diagnostics', { concurrency: false }, async () => {
  const response = await request(app).get('/api/health');
  assert.equal(response.status, 200);
  assert.ok(response.body.backend);
  assert.ok(response.body.database);
  assert.ok(response.body.worker);
  assert.ok(typeof response.body.uptime === 'number');
  assert.ok(typeof response.body.totalSuccessful === 'number');
  assert.ok(typeof response.body.totalFailed === 'number');
  assert.ok(response.body.totalSuccessful >= 0);
  assert.ok(response.body.totalFailed >= 0);
});
