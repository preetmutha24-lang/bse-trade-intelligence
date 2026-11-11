import { useEffect, useRef, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000';

export function useSSE(onEvent) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const latestCallbackRef = useRef(onEvent);

  useEffect(() => {
    latestCallbackRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const existing = window.__bseEventSource;

    const handleIncoming = (event) => {
      const payload = JSON.parse(event.data || '{}');
      const nextEvent = { type: event.type || 'event', payload };
      setLastEvent(nextEvent);
      latestCallbackRef.current?.(nextEvent.type, nextEvent.payload);
    };

    if (existing) {
      setConnected(existing.readyState === EventSource.OPEN);
      existing.addEventListener('connected', handleIncoming);
      existing.addEventListener('pull_started', handleIncoming);
      existing.addEventListener('pull_completed', handleIncoming);
      existing.addEventListener('pull_failed', handleIncoming);

      return () => {
        existing.removeEventListener('connected', handleIncoming);
        existing.removeEventListener('pull_started', handleIncoming);
        existing.removeEventListener('pull_completed', handleIncoming);
        existing.removeEventListener('pull_failed', handleIncoming);
      };
    }

    const source = new EventSource(`${API_BASE}/api/events`);
    window.__bseEventSource = source;

    source.addEventListener('connected', handleIncoming);
    source.addEventListener('pull_started', handleIncoming);
    source.addEventListener('pull_completed', handleIncoming);
    source.addEventListener('pull_failed', handleIncoming);

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);

    return () => {
      source.removeEventListener('connected', handleIncoming);
      source.removeEventListener('pull_started', handleIncoming);
      source.removeEventListener('pull_completed', handleIncoming);
      source.removeEventListener('pull_failed', handleIncoming);
      source.close();
      delete window.__bseEventSource;
    };
  }, []);

  return { connected, lastEvent };
}
