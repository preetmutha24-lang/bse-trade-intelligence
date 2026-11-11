import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BriefcaseBusiness, LineChart, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, formatCurrency, formatDate, formatNumber } from '../services/api';

const palette = ['#1d4ed8', '#0f172a', '#10b981', '#f59e0b', '#94a3b8', '#2dd4bf'];

export default function OverviewPage({ liveEvent }) {
  const [stats, setStats] = useState({ totalTrades: 0, uniqueClients: 0, activeSymbols: 0, latestSuccessfulPull: null, recordsImportedLastPull: 0 });
  const [distribution, setDistribution] = useState([]);
  const [volume, setVolume] = useState([]);
  const [recentTrades, setRecentTrades] = useState([]);
  const [recentJobs, setRecentJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadOverview = async () => {
    try {
      setLoading(true);
      const dashboard = await api.getDashboard();
      setStats({
        totalTrades: dashboard.stats.totalTrades,
        uniqueClients: dashboard.stats.uniqueClients,
        activeSymbols: dashboard.stats.activeSymbols,
        latestSuccessfulPull: dashboard.stats.latestSuccessfulPull,
        recordsImportedLastPull: dashboard.stats.recordsImportedLastPull,
      });
      setDistribution(dashboard.distribution || []);
      setVolume(dashboard.volume || []);
      setRecentTrades(dashboard.recentTrades || []);
      setRecentJobs(dashboard.recentJobs || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    if (liveEvent && ['pull_started', 'pull_completed', 'pull_failed'].includes(liveEvent.type)) {
      loadOverview();
    }
  }, [liveEvent]);

  const pieData = useMemo(() => distribution.slice(0, 8).map((item) => ({ name: item.symbol, value: Number(item.trades) })), [distribution]);
  const volumeData = useMemo(() => volume.map((item) => ({ name: item.symbol, value: Number(item.volume) })), [volume]);

  return (
    <div className="page-stack">
      <section className="overview-grid">
        <div className="metric-card">
          <div className="metric-icon muted">
            <BriefcaseBusiness size={18} />
          </div>
          <div>
            <p>Total Trades</p>
            <h3>{loading ? '…' : formatNumber(stats.totalTrades)}</h3>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon blue">
            <Users size={18} />
          </div>
          <div>
            <p>Unique Clients</p>
            <h3>{loading ? '…' : formatNumber(stats.uniqueClients)}</h3>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon green">
            <LineChart size={18} />
          </div>
          <div>
            <p>Active Symbols</p>
            <h3>{loading ? '…' : formatNumber(stats.activeSymbols)}</h3>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon amber">
            <ArrowUpRight size={18} />
          </div>
          <div>
            <p>Latest Successful Pull</p>
            <h3>{loading ? '…' : formatDate(stats.latestSuccessfulPull)}</h3>
          </div>
        </div>
      </section>

      <section className="content-row three-up">
        <div className="panel">
          <div className="panel-header">
            <h3>Trade distribution by symbol</h3>
          </div>
          <div className="chart-wrap medium">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={72} paddingAngle={2}>
                  {pieData.map((entry, index) => (
                    <Cell key={`${entry.name}-${index}`} fill={palette[index % palette.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [value, 'Trades']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>Trade volume overview</h3>
          </div>
          <div className="chart-wrap medium">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData.slice(0, 7)} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(value) => `₹${Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="value" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>Top traded symbols</h3>
          </div>
          <ul className="stack-list">
            {(volumeData.slice(0, 5)).map((item, index) => (
              <li key={item.name}>
                <span>{index + 1}. {item.name}</span>
                <strong>{formatCurrency(item.value)}</strong>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="content-row two-up">
        <div className="panel panel-table">
          <div className="panel-header row-between">
            <h3>Latest trades</h3>
            <a href="/trades" className="text-link">View All Trades</a>
          </div>
          <table className="data-table compact">
            <thead>
              <tr>
                <th>Trade ID</th>
                <th>Client</th>
                <th>Symbol</th>
                <th>Price</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {recentTrades.map((trade) => (
                <tr key={trade.tradeId}>
                  <td className="mono">{trade.tradeId}</td>
                  <td>{trade.client}</td>
                  <td>{trade.symbol}</td>
                  <td>{formatCurrency(trade.price)}</td>
                  <td className="mono small">{formatDate(trade.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel panel-table">
          <div className="panel-header">
            <h3>Recent operations</h3>
          </div>
          <table className="data-table compact">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Started</th>
                <th>Records</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentJobs.map((job) => (
                <tr key={job.id}>
                  <td className="mono small">{job.id.slice(0, 8)}</td>
                  <td className="mono small">{formatDate(job.started_at)}</td>
                  <td>{formatNumber(job.records_imported ?? 0)}</td>
                  <td>
                    <span className={`badge ${job.status.toLowerCase()}`}>{job.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
