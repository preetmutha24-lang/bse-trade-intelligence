import { getPullDurationMs } from '../config/env.js';
import { broadcastEvent } from '../events/sseManager.js';
import { createPullJob, getCurrentActiveJob, getPullJobById, importTrades, setJobRunning, updatePullJob } from '../database/db.js';
import { fetchTrades } from './mockExchangeService.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function startBackgroundPull() {
  const activeJob = getCurrentActiveJob();
  if (activeJob) {
    throw new Error('A pull job is already in progress. Please wait for the active job to finish.');
  }

  const job = createPullJob();

  broadcastEvent('pull_started', {
    jobId: job.id,
    status: job.status,
    startedAt: job.started_at,
    message: 'Background pull queued.',
  });

  queueMicrotask(() => processBackgroundPull(job.id));
  return job;
}

async function processBackgroundPull(jobId) {
  const job = getPullJobById(jobId);
  if (!job) {
    return;
  }

  setJobRunning(jobId);

  const runningJob = getPullJobById(jobId);
  broadcastEvent('pull_started', {
    jobId,
    status: runningJob.status,
    startedAt: runningJob.started_at,
    message: 'Trade retrieval is running in the background.',
  });

  try {
    const simulatedDuration = getPullDurationMs();
    await sleep(simulatedDuration);

    const { trades } = await fetchTrades({ count: 3000, delayMs: 350 });
    const insertedCount = importTrades(trades);

    const startedAt = new Date(runningJob.started_at);
    const completedAt = new Date();
    const durationMs = Math.max(0, completedAt.getTime() - startedAt.getTime());

    updatePullJob(jobId, {
      status: 'COMPLETED',
      completedAt: completedAt.toISOString(),
      durationMs,
      recordsImported: insertedCount,
      errorMessage: null,
    });

    const finalJob = getPullJobById(jobId);
    broadcastEvent('pull_completed', {
      jobId,
      status: finalJob.status,
      completedAt: finalJob.completed_at,
      recordsImported: finalJob.records_imported,
      durationMs: finalJob.duration_ms,
      message: 'New trade data has been imported successfully.',
    });
  } catch (error) {
    const failedAt = new Date().toISOString();
    const current = getPullJobById(jobId);
    const startedAt = current?.started_at ? new Date(current.started_at) : null;
    const durationMs = startedAt ? Date.now() - startedAt.getTime() : 0;

    updatePullJob(jobId, {
      status: 'FAILED',
      completedAt: failedAt,
      durationMs,
      recordsImported: 0,
      errorMessage: error.message || 'Unknown pull failure.',
    });

    broadcastEvent('pull_failed', {
      jobId,
      status: 'FAILED',
      failedAt,
      error: error.message || 'Unknown pull failure.',
    });
  }
}
