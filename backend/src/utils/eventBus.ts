import { EventEmitter } from 'events';

export const PING_EVENTS = {
  PING_COMPLETED: 'ping:completed',
} as const;

export interface PingCompletedEvent {
  monitorId: string;
  userId: string;
  statusCode: number;
  latency: number;
  isUp: boolean;
  timestamp: string;
  error?: string;
}

// Global application event bus facilitating decoupled communication across modules
class AppEventBus extends EventEmitter {
  constructor() {
    super();
    // Increase listener threshold to support multiple subscribers (SSE, Incidents, Logging)
    this.setMaxListeners(50);
  }

  // Type-safe emitter for ping completion events
  emitPingCompleted(payload: PingCompletedEvent): boolean {
    return this.emit(PING_EVENTS.PING_COMPLETED, payload);
  }

  // Type-safe subscriber for ping completion events
  onPingCompleted(listener: (payload: PingCompletedEvent) => void): this {
    return this.on(PING_EVENTS.PING_COMPLETED, listener);
  }
}

export const eventBus = new AppEventBus();

