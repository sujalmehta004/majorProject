import { Server as SocketIOServer } from 'socket.io';

/**
 * Emit real-time WebSocket event to all connected Socket.IO clients across any room or channel.
 */
export function emitWebSocketEvent(event: string, payload?: any) {
  const io: SocketIOServer | undefined = (global as any).io;
  if (io) {
    io.emit(event, payload);
    console.log(`[WebSocket Broadcast] Emitted event "${event}" with payload:`, payload);
  }
}
