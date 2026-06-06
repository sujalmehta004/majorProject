import { NextRequest } from 'next/server';

// SSE broadcast registry - maps wholesalerId → set of writer functions
const subscribers = new Map<string, Set<(data: string) => void>>();

// Called by any mutation API to push updates to all connected clients
export function broadcastToWholesaler(wholesalerId: string, eventType: string, payload?: object) {
  const subs = subscribers.get(wholesalerId);
  if (!subs || subs.size === 0) return;
  const message = `data: ${JSON.stringify({ type: eventType, payload, ts: Date.now() })}\n\n`;
  subs.forEach(send => {
    try { send(message); } catch {}
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wholesalerId = searchParams.get('wholesalerId');

  if (!wholesalerId) {
    return new Response('Missing wholesalerId', { status: 400 });
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
      if (!subscribers.has(wholesalerId)) {
        subscribers.set(wholesalerId, new Set());
      }
      subscribers.get(wholesalerId)!.add(send);

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
        subscribers.get(wholesalerId)?.delete(send);
        if (subscribers.get(wholesalerId)?.size === 0) {
          subscribers.delete(wholesalerId);
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
