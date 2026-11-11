import { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { api, formatCurrency, formatNumber } from '../services/api';

export default function AnalyticsPage({ liveEvent }) {
  const [analytics, setAnalytics] = useState({ distribution: [], volume: [], recentTrades: [] });
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await api.getAnalytics();
      setAnalytics(response);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (liveEvent && ['pull_completed', 'pull_started', 'pull_failed'].includes(liveEvent.type)) {
      loadData();
    }
  }, [liveEvent]);

  const aggregated = analytics.volume.map((point) => ({
    name: point.symbol,
    value: Number(point.volume),
  }));

  return (
    <div className="page-stack">
      <section className="overview-grid">
        <div className="metric-card">
          <div className="metric-icon muted" />
          <div>
            <p>Trade count</p>
            <h3>{loading ? '…' : formatNumber(analytics.distribution.reduce((sum, item) => sum + Number(item.trades), 0))}</h3>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon blue" />
          <div>
            <p>Symbols tracked</p>
            <h3>{loading ? '…' : analytics.volume.length}</h3>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon green" />
          <div>
            <p>Volume tracked</p>
            <h3>{loading ? '…' : formatCurrency(aggregated.reduce((sum, point) => sum + point.value, 0))}</h3>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Volume by symbol</h3>
        </div>
        <div className="chart-wrap large">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={aggregated} margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(value) => `₹${Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`} />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Bar dataKey="value" fill="#1d4ed8" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
