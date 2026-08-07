'use client';

import { useEffect, useRef } from 'react';
import { io as socketIO, Socket } from 'socket.io-client';

const CHANNEL_NAME = 'medhub-realtime';

let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined') {
  broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
}

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (!socketInstance && typeof window !== 'undefined') {
    socketInstance = socketIO({
      path: '/api/ws',
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return socketInstance!;
}

/**
 * Hook to listen to a WebSocket event client-side.
 */
export function useWebSocketEvent(event: string, callback: (data?: any) => void) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const socket = getSocket();

    const handler = (data: any) => {
      cbRef.current(data);
    };

    socket.on(event, handler);

    return () => {
      socket.off(event, handler);
    };
  }, [event]);
}

/**
 * Broadcasts an event locally (BroadcastChannel + CustomEvent).
 */
export function broadcastUpdate(event: string) {
  if (typeof window === 'undefined') return;

  const customEvent = new CustomEvent(event);
  window.dispatchEvent(customEvent);

  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: event });
    } catch (err) {
      console.error('Failed to post message to BroadcastChannel:', err);
    }
  }
}

/**
 * React hook to listen to a specific realtime update event (local + cross-tab).
 */
export function useRealtimeEvent(event: string, callback: () => void) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleLocalEvent = () => callback();
    const handleChannelMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === event) callback();
    };

    window.addEventListener(event, handleLocalEvent);
    const localChannel = new BroadcastChannel(CHANNEL_NAME);
    localChannel.addEventListener('message', handleChannelMessage);

    return () => {
      window.removeEventListener(event, handleLocalEvent);
      localChannel.removeEventListener('message', handleChannelMessage);
      localChannel.close();
    };
  }, [event, callback]);
}
