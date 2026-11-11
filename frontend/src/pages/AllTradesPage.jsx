import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api, formatCurrency, formatDate, formatNumber } from '../services/api';

const SYMBOLS = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'ITC', 'WIPRO', 'LT', 'TATAMOTORS', 'BHARTIARTL', 'AXISBANK'];

export default function AllTradesPage({ liveEvent }) {
  const [filters, setFilters] = useState({
    search: '',
    symbol: '',
    page: 1,
    limit: 10,
    sortBy: 'timestamp',
    sortDir: 'DESC',
  });
  const [result, setResult] = useState({ trades: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 1 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadTrades = async () => {
    try {
      setLoading(true);
      const data = await api.getTrades({
        search: filters.search,
        symbol: filters.symbol,
        page: filters.page,
        limit: filters.limit,
        sortBy: filters.sortBy,
        sortDir: filters.sortDir,
      });
      setResult(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrades();
  }, [filters.search, filters.symbol, filters.page, filters.limit, filters.sortBy, filters.sortDir]);

  useEffect(() => {
    if (liveEvent && ['pull_started', 'pull_completed', 'pull_failed'].includes(liveEvent.type)) {
      loadTrades();
    }
  }, [liveEvent]);

  return (
    <div className="page-stack">
      <section className="panel filter-panel">
        <div className="panel-header row-between">
          <h3>Trade explorer</h3>
          <span className="meta-pill">{formatNumber(result.pagination.total)} records</span>
        </div>

        <div className="filter-row">
          <label className="field">
            <span>Search</span>
            <div className="input-wrap">
              <Search size={14} />
              <input
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, page: 1 }))}
                placeholder="Trade ID, client or symbol"
              />
            </div>
          </label>

          <label className="field">
            <span>Symbol</span>
            <select value={filters.symbol} onChange={(event) => setFilters((current) => ({ ...current, symbol: event.target.value, page: 1 }))}>
              <option value="">All symbols</option>
              {SYMBOLS.map((symbol) => (
                <option key={symbol} value={symbol}>{symbol}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Sort</span>
            <select value={filters.sortBy} onChange={(event) => setFilters((current) => ({ ...current, sortBy: event.target.value }))}>
              <option value="timestamp">Timestamp</option>
              <option value="price">Price</option>
              <option value="quantity">Quantity</option>
              <option value="trade_id">Trade ID</option>
            </select>
          </label>

          <label className="field">
            <span>Direction</span>
            <select value={filters.sortDir} onChange={(event) => setFilters((current) => ({ ...current, sortDir: event.target.value }))}>
              <option value="DESC">Descending</option>
              <option value="ASC">Ascending</option>
            </select>
          </label>
        </div>
      </section>

      <section className="panel panel-table">
        {error ? (
          <div className="empty-state error">
            <h4>Trade feed unavailable</h4>
            <p>{error}</p>
          </div>
        ) : loading ? (
          <div className="empty-state">
            <h4>Loading trades...</h4>
          </div>
        ) : result.trades.length === 0 ? (
          <div className="empty-state">
            <h4>No trades match the current filters.</h4>
          </div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Trade ID</th>
                  <th>Client ID</th>
                  <th>Symbol</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Trade Value</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {result.trades.map((trade) => (
                  <tr key={trade.tradeId}>
                    <td className="mono">{trade.tradeId}</td>
                    <td>{trade.client}</td>
                    <td>{trade.symbol}</td>
                    <td>{formatNumber(trade.quantity)}</td>
                    <td>{formatCurrency(trade.price)}</td>
                    <td>{formatCurrency(Number(trade.quantity) * Number(trade.price))}</td>
                    <td className="mono small">{formatDate(trade.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pagination-row">
              <button
                type="button"
                onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}
                disabled={filters.page <= 1}
              >
                Previous
              </button>
              <span>Page {result.pagination.page} of {result.pagination.totalPages}</span>
              <button
                type="button"
                onClick={() => setFilters((current) => ({ ...current, page: Math.min(result.pagination.totalPages, current.page + 1) }))}
                disabled={filters.page >= result.pagination.totalPages}
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
