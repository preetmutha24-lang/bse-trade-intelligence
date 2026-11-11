const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  getStats: () => request('/api/stats'),
  getTrades: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/trades${query ? `?${query}` : ''}`);
  },
  getPulls: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/pulls${query ? `?${query}` : ''}`);
  },
  getDashboard: () => request('/api/dashboard'),
  getAnalytics: () => request('/api/analytics'),
  getHealth: () => request('/api/health'),
  startPull: (payload = {}) => request('/api/pulls', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
};

export function formatCurrency(value) {
  const numericValue = Number(value ?? 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(numericValue);
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-IN').format(Number(value ?? 0));
}

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
