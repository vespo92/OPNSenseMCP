import { useEffect, useState, useCallback } from 'react';

export interface SSEEvent {
  id: string;
  type: string;
  timestamp: Date;
  pluginId: string;
  severity: string;
  source?: string;
  data: any;
}

export function useSSE(url: string, filter?: { types?: string[]; severity?: string[] }) {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Build URL with query parameters
    const params = new URLSearchParams();
    if (filter?.types) {
      filter.types.forEach(type => params.append('types', type));
    }
    if (filter?.severity) {
      filter.severity.forEach(sev => params.append('severity', sev));
    }

    const fullUrl = params.toString() ? `${url}?${params}` : url;
    const eventSource = new EventSource(fullUrl);

    eventSource.onopen = () => {
      setConnected(true);
      setError(null);
    };

    eventSource.onerror = () => {
      setConnected(false);
      setError('Connection lost');
    };

    // Listen for all event types
    const handleEvent = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const event: SSEEvent = {
          id: data.id || e.lastEventId,
          type: e.type,
          timestamp: new Date(data.timestamp),
          pluginId: data.pluginId,
          severity: data.severity,
          source: data.source,
          data: data.data,
        };

        setEvents(prev => [event, ...prev].slice(0, 1000)); // Keep last 1000 events
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    // Listen to all possible event types
    eventSource.addEventListener('message', handleEvent);
    eventSource.addEventListener('firewall.rule.created', handleEvent);
    eventSource.addEventListener('firewall.rule.updated', handleEvent);
    eventSource.addEventListener('vpn.tunnel.connected', handleEvent);
    eventSource.addEventListener('ids.alert', handleEvent);
    eventSource.addEventListener('connected', handleEvent);

    return () => {
      eventSource.close();
      setConnected(false);
    };
  }, [url, filter]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return { events, connected, error, clearEvents };
}
