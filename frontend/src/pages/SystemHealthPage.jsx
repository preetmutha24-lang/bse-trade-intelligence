import { useEffect, useState } from 'react';
import { Activity, Database, Server, Wifi } from 'lucide-react';
import { api, formatDate, formatNumber } from '../services/api';

export default function SystemHealthPage({ liveEvent }) {
  const [health, setHealth] = useState({
    backend: 'available',
    database: 'connected',
    worker: 'available',
    activeSseConnections: 0,
    totalSuccessful: 0,
    totalFailed: 0,
    latestSuccessfulPull: null,
    uptime: 0,
    timestamp: null,
  });

  const loadHealth = async () => {
    const response = await api.getHealth();
    setHealth({
      backend: response.backend,
      database: response.database,
      worker: response.worker,
      activeSseConnections: response.activeSseConnections ?? 0,
      totalSuccessful: response.totalSuccessful ?? 0,
      totalFailed: response.totalFailed ?? 0,
      latestSuccessfulPull: response.latestSuccessfulPull,
      uptime: response.uptime ?? 0,
      timestamp: response.timestamp,
    });
  };

  useEffect(() => {
    loadHealth();
  }, []);

  useEffect(() => {
    if (liveEvent && ['pull_started', 'pull_completed', 'pull_failed'].includes(liveEvent.type)) {
      loadHealth();
    }
  }, [liveEvent]);

  return (
    <div className="page-stack">
      <section className="overview-grid">
        <div className="metric-card">
          <div className="metric-icon blue"><Server size={18} /></div>
          <div>
            <p>Backend availability</p>
            <h3>{health.backend === 'available' ? 'Available' : 'Unreachable'}</h3>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon green"><Database size={18} /></div>
          <div>
            <p>Database connectivity</p>
            <h3>{health.database === 'connected' ? 'Connected' : 'Disconnected'}</h3>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon amber"><Activity size={18} /></div>
          <div>
            <p>Worker availability</p>
            <h3>{health.worker === 'available' ? 'Ready' : 'Unavailable'}</h3>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon muted"><Wifi size={18} /></div>
          <div>
            <p>Active SSE connections</p>
            <h3>{formatNumber(health.activeSseConnections)}</h3>
          </div>
        </div>
      </section>

      <section className="panel health-grid">
        <div className="health-card">
          <span>Total successful pulls</span>
          <strong>{health.totalSuccessful}</strong>
        </div>
        <div className="health-card">
          <span>Total failed pulls</span>
          <strong>{health.totalFailed}</strong>
        </div>
        <div className="health-card">
          <span>Latest successful pull</span>
          <strong>{health.latestSuccessfulPull ? formatDate(health.latestSuccessfulPull.completed_at || health.latestSuccessfulPull.started_at) : 'None'}</strong>
        </div>
        <div className="health-card">
          <span>Application uptime</span>
          <strong>{Math.round(health.uptime / 60)} min</strong>
        </div>
      </section>
    </div>
  );
}
