import { Response } from 'express';
import { eventBus, PingCompletedEvent, IncidentAlertEvent } from '../utils/eventBus.js';

export interface SseConnectedEvent {
  type: 'CONNECTED';
  userId: string;
  connectedAt: string;
}

export interface SseMonitorPingEvent {
  type: 'MONITOR_PING';
  monitorId: string;
  statusCode: number;
  latency: number;
  isUp: boolean;
  timestamp: string;
  error?: string;
}

export interface SseIncidentAlertEvent {
  type: 'INCIDENT_ALERT';
  monitorId: string;
  status: 'ongoing' | 'resolved';
  startedAt: string;
  resolvedAt?: string;
  summary?: string;
}

// In-memory Server-Sent Events service streaming live metrics and incident alerts to connected clients
export class RealtimeService {
  private connections: Map<string, Set<Response>> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private readonly heartbeatIntervalMs = 30000;

  constructor() {
    this.registerEventBusListeners();
    this.startHeartbeat();
  }

  // Register internal event bus subscriptions
  private registerEventBusListeners(): void {
    eventBus.onPingCompleted((payload: PingCompletedEvent) => {
      this.broadcastMonitorPing(payload);
    });

    eventBus.onIncidentAlert((payload: IncidentAlertEvent) => {
      this.broadcastIncidentAlert(payload);
    });
  }

  // Register new SSE response stream for authenticated user
  addConnection(userId: string, res: Response): void {
    let clientSet = this.connections.get(userId);
    if (!clientSet) {
      clientSet = new Set<Response>();
      this.connections.set(userId, clientSet);
    }
    clientSet.add(res);
  }

  // Remove disconnected SSE response stream and clean empty user sets
  removeConnection(userId: string, res: Response): void {
    const clientSet = this.connections.get(userId);
    if (!clientSet) {
      return;
    }

    clientSet.delete(res);
    if (clientSet.size === 0) {
      this.connections.delete(userId);
    }
  }

  // Broadcast monitor ping completion event to user's active SSE connections
  broadcastMonitorPing(payload: PingCompletedEvent): void {
    const clientSet = this.connections.get(payload.userId);
    if (!clientSet || clientSet.size === 0) {
      return;
    }

    const eventData: SseMonitorPingEvent = {
      type: 'MONITOR_PING',
      monitorId: payload.monitorId,
      statusCode: payload.statusCode,
      latency: payload.latency,
      isUp: payload.isUp,
      timestamp: payload.timestamp,
    };

    if (payload.error) {
      eventData.error = payload.error;
    }

    const message = `event: MONITOR_PING\ndata: ${JSON.stringify(eventData)}\n\n`;
    for (const res of clientSet) {
      if (!res.writableEnded) {
        res.write(message);
      }
    }
  }

  // Broadcast incident lifecycle alert event to user's active SSE connections
  broadcastIncidentAlert(payload: IncidentAlertEvent): void {
    const clientSet = this.connections.get(payload.userId);
    if (!clientSet || clientSet.size === 0) {
      return;
    }

    const eventData: SseIncidentAlertEvent = {
      type: 'INCIDENT_ALERT',
      monitorId: payload.monitorId,
      status: payload.status,
      startedAt: payload.startedAt,
    };

    if (payload.resolvedAt) {
      eventData.resolvedAt = payload.resolvedAt;
    }

    if (payload.summary) {
      eventData.summary = payload.summary;
    }

    const message = `event: INCIDENT_ALERT\ndata: ${JSON.stringify(eventData)}\n\n`;
    for (const res of clientSet) {
      if (!res.writableEnded) {
        res.write(message);
      }
    }
  }

  // Start periodic 30-second keep-alive heartbeat comment to prevent proxy timeout
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const heartbeat = ': heartbeat\n\n';
      for (const clientSet of this.connections.values()) {
        for (const res of clientSet) {
          if (!res.writableEnded) {
            res.write(heartbeat);
          }
        }
      }
    }, this.heartbeatIntervalMs);

    this.heartbeatTimer.unref();
  }

  // Terminate all active streams and clear connection state during graceful shutdown
  stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    for (const clientSet of this.connections.values()) {
      for (const res of clientSet) {
        if (!res.writableEnded) {
          res.end();
        }
      }
    }

    this.connections.clear();
  }

  // Return total count of active SSE streams across all connected users
  getActiveConnectionCount(): number {
    let count = 0;
    for (const clientSet of this.connections.values()) {
      count += clientSet.size;
    }
    return count;
  }

  // Return count of unique users with at least one active stream
  getActiveUserCount(): number {
    return this.connections.size;
  }
}

export const realtimeService = new RealtimeService();

