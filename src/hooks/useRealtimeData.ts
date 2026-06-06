'use client';

import { useEffect, useRef, useCallback } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

/**
 * useRealtimeData — Combines SWR polling with SSE for real-time updates.
 *
 * SSE pushes an event whenever server data changes → triggers an immediate SWR revalidation.
 * SWR polls every 30s as a fallback (catches any missed SSE events).
 *
 * When you add the retailer app later, just call broadcastToWholesaler() from any
 * retailer-facing API route and all connected wholesaler dashboards will update instantly.
 */
export function useRealtimeData<T>(
  apiUrl: string | null,
  wholesalerId: string | null,
  options?: { fallbackData?: T }
) {
  const { data, error, isLoading, mutate } = useSWR<T>(
    apiUrl,
    fetcher,
    {
      refreshInterval: 30000,       // Fallback polling every 30s
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      fallbackData: options?.fallbackData,
    }
  );

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!wholesalerId || typeof window === 'undefined') return;

    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/events?wholesalerId=${wholesalerId}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const { type } = JSON.parse(event.data);
        if (type === 'CONNECTED') return; // Just a handshake
        // Any data-change event → immediately revalidate
        mutate();
      } catch {}
    };

    es.onerror = () => {
      es.close();
      // Reconnect after 5 seconds
      reconnectTimerRef.current = setTimeout(connect, 5000);
    };
  }, [wholesalerId, mutate]);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [connect]);

  return { data, error, isLoading, refresh: mutate };
}

/**
 * Lightweight version — SSE only, no SWR. Use for triggering a full page refresh
 * callback when a specific event fires.
 */
export function useSSEListener(
  wholesalerId: string | null,
  onEvent: (type: string, payload: unknown) => void
) {
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  useEffect(() => {
    if (!wholesalerId || typeof window === 'undefined') return;

    let es: EventSource;
    let retryTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      es = new EventSource(`/api/events?wholesalerId=${wholesalerId}`);
      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type !== 'CONNECTED') {
            cbRef.current(parsed.type, parsed.payload);
          }
        } catch {}
      };
      es.onerror = () => {
        es.close();
        retryTimer = setTimeout(connect, 5000);
      };
    };

    connect();
    return () => {
      es?.close();
      clearTimeout(retryTimer);
    };
  }, [wholesalerId]);
}
