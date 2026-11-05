import { Request, Response } from 'express';
import { realtimeService, SseConnectedEvent } from '../services/realtimeService.js';

// Establish persistent Server-Sent Events stream for authenticated client
export function subscribeMonitors(req: Request, res: Response): void {
  const userId = req.user!.id;

  // Set SSE response headers disabling caching and proxy buffering
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Prevent socket timeout on persistent stream
  req.socket.setKeepAlive(true);
  req.socket.setTimeout(0);

  // Immediately flush initial headers to establish stream
  res.flushHeaders();

  // Register client in in-memory connection pool
  realtimeService.addConnection(userId, res);

  // Send initial event confirming stream establishment
  const initialPayload: SseConnectedEvent = {
    type: 'CONNECTED',
    userId,
    connectedAt: new Date().toISOString(),
  };
  res.write(`event: CONNECTED\ndata: ${JSON.stringify(initialPayload)}\n\n`);

  // Remove client from connection pool when connection drops
  req.on('close', () => {
    realtimeService.removeConnection(userId, res);
  });
}

