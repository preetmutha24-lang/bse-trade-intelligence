import { useEffect, useMemo, useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BarChart3,
  BellRing,
  Database,
  Gauge,
  Layers3,
  ShieldCheck,
  TrendingUp,
  Zap,
} from 'lucide-react';
import OverviewPage from './pages/OverviewPage';
import AllTradesPage from './pages/AllTradesPage';
import PullOperationsPage from './pages/PullOperationsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SystemHealthPage from './pages/SystemHealthPage';
import { api } from './services/api';
import { useSSE } from './hooks/useSSE';

const navigation = [
  { to: '/', label: 'Overview', icon: Layers3 },
  { to: '/trades', label: 'All Trades', icon: BarChart3 },
  { to: '/operations', label: 'Pull Operations', icon: Activity },
  { to: '/analytics', label: 'Analytics', icon: TrendingUp },
  { to: '/health', label: 'System Health', icon: Gauge },
];

function AppLayout() {
  const location = useLocation();
  const currentPage = navigation.find((item) => item.to === location.pathname) ?? navigation[0];
  const [health, setHealth] = useState({ backend: 'checking', database: 'checking', worker: 'checking' });
  const [toast, setToast] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  const { connected: sseConnected, lastEvent } = useSSE((eventName, payload) => {
    const message = payload?.message || payload?.error || 'Live update received';
    setToast({ eventName, message, time: new Date().toISOString() });
    setConnectionStatus('connected');
  });

  useEffect(() => {
    setConnectionStatus(sseConnected ? 'connected' : 'connecting');
  }, [sseConnected]);

  useEffect(() => {
    let ignore = false;

    async function fetchHealth() {
      try {
        const response = await api.getHealth();
        if (ignore) return;
        setHealth({
          backend: response.backend === 'available' ? 'online' : 'offline',
          database: response.database === 'connected' ? 'online' : 'offline',
          worker: response.worker === 'available' ? 'online' : 'offline',
        });
      } catch (error) {
        if (!ignore) {
          setHealth({ backend: 'offline', database: 'offline', worker: 'offline' });
        }
      }
    }

    fetchHealth();
    return () => {
      ignore = true;
    };
  }, [lastEvent]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timeout);
  }, [toast]);

  const currentDate = useMemo(() => new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }), []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">BT</div>
          <div>
            <div className="brand-name">BSE Trade</div>
            <div className="brand-name brand-name-sub">Intelligence</div>
          </div>
        </div>

        <nav className="nav-list" aria-label="Primary navigation">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="status-chip status-chip-success">
            <ShieldCheck size={14} />
            <span>Operational</span>
          </div>
          <div className="mini-metric">
            <span>Live</span>
            <strong>{connectionStatus === 'connected' ? 'SSE on' : 'connecting'}</strong>
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Real-time Trade Operations & Data Monitoring</p>
            <h1>{currentPage.label}</h1>
          </div>
          <div className="toolbar">
            <div className="toolbar-clock">{currentDate}</div>
            <div className={`toolbar-badge ${health.backend === 'online' ? 'online' : 'offline'}`}>
              <Database size={14} />
              <span>{health.backend === 'online' ? 'Backend online' : 'Backend offline'}</span>
            </div>
            <div className={`toolbar-badge ${connectionStatus === 'connected' ? 'online' : 'offline'}`}>
              <Zap size={14} />
              <span>{connectionStatus === 'connected' ? 'Live SSE' : 'Connecting'}</span>
            </div>
          </div>
        </header>

        <div className="status-strip">
          <div className="status-item">
            <span className="status-label">Exchange API</span>
            <span className={`status-value ${health.backend === 'online' ? 'status-success' : 'status-danger'}`}>
              {health.backend === 'online' ? 'Online' : 'Unavailable'}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">Database</span>
            <span className={`status-value ${health.database === 'online' ? 'status-success' : 'status-danger'}`}>
              {health.database === 'online' ? 'Connected' : 'Offline'}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">Background worker</span>
            <span className={`status-value ${health.worker === 'online' ? 'status-success' : 'status-danger'}`}>
              {health.worker === 'online' ? 'Ready' : 'Unreachable'}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">Real-time connection</span>
            <span className={`status-value ${connectionStatus === 'connected' ? 'status-success' : 'status-warning'}`}>
              {connectionStatus === 'connected' ? 'Live' : 'Reconnecting'}
            </span>
          </div>
        </div>

        <Routes>
          <Route path="/" element={<OverviewPage liveEvent={lastEvent} />} />
          <Route path="/trades" element={<AllTradesPage liveEvent={lastEvent} />} />
          <Route path="/operations" element={<PullOperationsPage liveEvent={lastEvent} />} />
          <Route path="/analytics" element={<AnalyticsPage liveEvent={lastEvent} />} />
          <Route path="/health" element={<SystemHealthPage liveEvent={lastEvent} />} />
        </Routes>
      </main>

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <BellRing size={15} />
          <div>
            <strong>{toast.eventName}</strong>
            <span>{toast.message}</span>
          </div>
          <ArrowRight size={15} />
        </div>
      )}
    </div>
  );
}

export default function App() {
  return <AppLayout />;
}
