'use client';

import { useEffect } from 'react';

// Setup global channel name
const CHANNEL_NAME = 'medhub-realtime';

let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined') {
  broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
}

/**
 * Broadcasts an event to all open tabs/windows on the same origin,
 * and also dispatches a local custom event in the current window.
 */
export function broadcastUpdate(event: string) {
  if (typeof window === 'undefined') return;

  // 1. Dispatch custom event locally (for same tab updates)
  const customEvent = new CustomEvent(event);
  window.dispatchEvent(customEvent);

  // 2. Broadcast to other tabs
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: event });
    } catch (err) {
      console.error('Failed to post message to BroadcastChannel:', err);
    }
  }
}

/**
 * React hook to listen to a specific realtime update event.
 * Triggers the callback when the event is received locally or via BroadcastChannel.
 */
export function useRealtimeEvent(event: string, callback: () => void) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Handler for local window CustomEvent
    const handleLocalEvent = () => {
      callback();
    };

    // Handler for BroadcastChannel messages
    const handleChannelMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === event) {
        callback();
      }
    };

    // Add listeners
    window.addEventListener(event, handleLocalEvent);
    
    // Setup temporary tab-to-tab channel if not global
    const localChannel = new BroadcastChannel(CHANNEL_NAME);
    localChannel.addEventListener('message', handleChannelMessage);

    return () => {
      window.removeEventListener(event, handleLocalEvent);
      localChannel.removeEventListener('message', handleChannelMessage);
      localChannel.close();
    };
  }, [event, callback]);
}
