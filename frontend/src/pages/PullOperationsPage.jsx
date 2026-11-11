import { useEffect, useMemo, useState } from 'react';
import { Activity, Clock3, RefreshCcw } from 'lucide-react';
import { api, formatDate, formatNumber } from '../services/api';

export default function PullOperationsPage({ liveEvent }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const response = await api.getPulls({ limit: 12 });
      setJobs(response.jobs || []);
    } finally {
      setLoading(false);
    }
  };

  const activeJob = useMemo(() => jobs.find((job) => job.status === 'QUEUED' || job.status === 'RUNNING') || null, [jobs]);

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    if (liveEvent && ['pull_started', 'pull_completed', 'pull_failed'].includes(liveEvent.type)) {
      loadJobs();
    }
  }, [liveEvent]);

  const handleStartPull = async () => {
    if (activeJob) {
      setSubmitError('An active pull job is already running.');
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);
      await api.startPull({ count: 3000, delayMs: 0 });
      await loadJobs();
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-stack">
      <section className="panel operations-header">
        <div>
          <p className="eyebrow">Background operations</p>
          <h3>Trade retrieval workflow</h3>
        </div>
        <button type="button" onClick={handleStartPull} disabled={!!activeJob || submitting} className="primary-button">
          {submitting ? 'Submitting...' : activeJob ? 'Pull active' : 'Start New Pull'}
        </button>
      </section>

      {submitError && <div className="error-banner">{submitError}</div>}

      <section className="content-row two-up">
        <div className="panel">
          <div className="panel-header row-between">
            <h3>Current active job</h3>
            <Activity size={18} />
          </div>
          {!activeJob ? (
            <div className="empty-state">
              <div className="spinner" />
              <h4>No running pull job</h4>
            </div>
          ) : (
            <div className="job-detail">
              <div className="job-header">
                <span className="mono">{activeJob.id}</span>
                <span className={`badge ${activeJob.status.toLowerCase()}`}>{activeJob.status}</span>
              </div>
              <div className="job-metrics">
                <div>
                  <label>Start time</label>
                  <strong>{formatDate(activeJob.started_at)}</strong>
                </div>
                <div>
                  <label>Elapsed</label>
                  <strong>
                    {activeJob.started_at ? `${Math.max(0, Math.round((Date.now() - new Date(activeJob.started_at).getTime()) / 1000))}s` : '—'}
                  </strong>
                </div>
                <div>
                  <label>Imported</label>
                  <strong>{formatNumber(activeJob.records_imported ?? 0)}</strong>
                </div>
              </div>
              <div className="progress-indicator">
                <span className="pulse" />
                <span>Processing in background</span>
              </div>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header row-between">
            <h3>Latest pull history</h3>
            <Clock3 size={18} />
          </div>
          <ul className="timeline">
            {jobs.map((job) => (
              <li key={job.id}>
                <div className="timeline-point" />
                <div>
                  <div className="job-header compact">
                    <span className="mono small">{job.id.slice(0, 10)}</span>
                    <span className={`badge ${job.status.toLowerCase()}`}>{job.status}</span>
                  </div>
                  <p>{formatDate(job.started_at)} • {job.records_imported ?? 0} imported</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel panel-table">
        <div className="panel-header">
          <h3>Pull jobs</h3>
        </div>
        {loading ? (
          <div className="empty-state">Loading pulls...</div>
        ) : (
          <table className="data-table compact">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Start time</th>
                <th>Completion time</th>
                <th>Records imported</th>
                <th>Status</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="mono small">{job.id.slice(0, 10)}</td>
                  <td className="mono small">{formatDate(job.started_at)}</td>
                  <td className="mono small">{formatDate(job.completed_at)}</td>
                  <td>{formatNumber(job.records_imported ?? 0)}</td>
                  <td><span className={`badge ${job.status.toLowerCase()}`}>{job.status}</span></td>
                  <td>{job.error_message || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
