import { NextRequest } from 'next/server';
import { emitWebSocketEvent } from '@/lib/ws';

// ─── Subscriber Registry ─────────────────────────────────────────────────────
// Maps targetId (wholesalerId | retailerId | 'SUPERADMIN') → set of send fns
const subscribers = new Map<string, Set<(data: string) => void>>();

// Special key for superadmin global channel
const SUPERADMIN_KEY = 'SUPERADMIN';

// ─── Internal Helpers ─────────────────────────────────────────────────────────
function broadcastTo(targetId: string, eventType: string, payload?: object) {
  const subs = subscribers.get(targetId);
  if (subs && subs.size > 0) {
    const message = `data: ${JSON.stringify({ type: eventType, payload, ts: Date.now() })}\n\n`;
    subs.forEach(send => {
      try { send(message); } catch {}
    });
  }
  // Also emit over Socket.IO WebSocket
  emitWebSocketEvent(eventType, { targetId, payload, ts: Date.now() });
}

// ─── Public Broadcast API ─────────────────────────────────────────────────────

/** Push event to all connected wholesaler clients */
export function broadcastToWholesaler(wholesalerId: string, eventType: string, payload?: object) {
  broadcastTo(wholesalerId, eventType, payload);
  emitWebSocketEvent('WHOLESALER_UPDATE', { wholesalerId, type: eventType, payload });
}

/** Push event to all connected retailer clients */
export function broadcastToRetailer(retailerId: string, eventType: string, payload?: object) {
  broadcastTo(retailerId, eventType, payload);
  emitWebSocketEvent('RETAILER_UPDATE', { retailerId, type: eventType, payload });
}

/** Push event to all connected superadmin clients */
export function broadcastToSuperadmin(eventType: string, payload?: object) {
  broadcastTo(SUPERADMIN_KEY, eventType, payload);
  emitWebSocketEvent('SUPERADMIN_UPDATE', { type: eventType, payload });
}

/** Push event to EVERY connected client (retailers + wholesalers + superadmin) */
export function broadcastToAll(eventType: string, payload?: object) {
  const message = `data: ${JSON.stringify({ type: eventType, payload, ts: Date.now() })}\n\n`;
  subscribers.forEach(subs => {
    subs.forEach(send => {
      try { send(message); } catch {}
    });
  });
  // Emit WebSocket event to ALL connected clients
  emitWebSocketEvent(eventType, payload);
  emitWebSocketEvent('GLOBAL_UPDATE', { type: eventType, payload });
}

// ─── SSE Endpoint ─────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wholesalerId = searchParams.get('wholesalerId');
  const retailerId   = searchParams.get('retailerId');
  const isSuperadmin = searchParams.get('superadmin') === 'true';

  const targetId = isSuperadmin ? SUPERADMIN_KEY : (wholesalerId || retailerId || 'GLOBAL');

  let send: (data: string) => void;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      send = (data: string) => {
        if (!closed) {
          try { controller.enqueue(new TextEncoder().encode(data)); } catch {}
        }
      };

      // Register subscriber
      if (!subscribers.has(targetId)) {
        subscribers.set(targetId, new Set());
      }
      subscribers.get(targetId)!.add(send);

      // Send initial connection event
      send(`data: ${JSON.stringify({ type: 'CONNECTED', targetId, ts: Date.now() })}\n\n`);

      // Keep-alive heartbeat every 20s
      const heartbeat = setInterval(() => {
        if (closed) { clearInterval(heartbeat); return; }
        try { send(`: heartbeat\n\n`); } catch {}
      }, 20000);

      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(heartbeat);
        subscribers.get(targetId)?.delete(send);
        if (subscribers.get(targetId)?.size === 0) {
          subscribers.delete(targetId);
        }
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
