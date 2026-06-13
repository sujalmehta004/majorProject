import { NextRequest } from 'next/server';

// SSE broadcast registry - maps targetId (wholesalerId or retailerId) → set of writer functions
const subscribers = new Map<string, Set<(data: string) => void>>();

// Called by any mutation API to push updates to all connected wholesaler clients
export function broadcastToWholesaler(wholesalerId: string, eventType: string, payload?: object) {
  const subs = subscribers.get(wholesalerId);
  if (!subs || subs.size === 0) return;
  const message = `data: ${JSON.stringify({ type: eventType, payload, ts: Date.now() })}\n\n`;
  subs.forEach(send => {
    try { send(message); } catch {}
  });
}

// Called by any mutation API to push updates to all connected retailer clients
export function broadcastToRetailer(retailerId: string, eventType: string, payload?: object) {
  const subs = subscribers.get(retailerId);
  if (!subs || subs.size === 0) return;
  const message = `data: ${JSON.stringify({ type: eventType, payload, ts: Date.now() })}\n\n`;
  subs.forEach(send => {
    try { send(message); } catch {}
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wholesalerId = searchParams.get('wholesalerId');
  const retailerId = searchParams.get('retailerId');
  const targetId = wholesalerId || retailerId;

  if (!targetId) {
    return new Response('Missing targetId (wholesalerId or retailerId)', { status: 400 });
  }

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
      send(`data: ${JSON.stringify({ type: 'CONNECTED', ts: Date.now() })}\n\n`);

      // Keep-alive heartbeat every 15s
      const heartbeat = setInterval(() => {
        if (closed) { clearInterval(heartbeat); return; }
        try { send(`: heartbeat\n\n`); } catch {}
      }, 15000);

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
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    },
  });
}

