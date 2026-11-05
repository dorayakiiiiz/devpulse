import { EventEmitter } from 'events';

export const APP_EVENTS = {
  PING_COMPLETED: 'ping:completed',
  INCIDENT_ALERT: 'incident:alert',
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

export interface IncidentAlertEvent {
  incidentId: string;
  monitorId: string;
  userId: string;
  status: 'ongoing' | 'resolved';
  startedAt: string;
  resolvedAt?: string;
  errorMessage?: string;
  aiPostMortem?: {
    summary: string;
    rootCause: string;
    actionItems: string[];
    generatedAt: string;
  };
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
    return this.emit(APP_EVENTS.PING_COMPLETED, payload);
  }

  // Type-safe subscriber for ping completion events
  onPingCompleted(listener: (payload: PingCompletedEvent) => void): this {
    return this.on(APP_EVENTS.PING_COMPLETED, listener);
  }

  // Type-safe emitter for incident alert events
  emitIncidentAlert(payload: IncidentAlertEvent): boolean {
    return this.emit(APP_EVENTS.INCIDENT_ALERT, payload);
  }

  // Type-safe subscriber for incident alert events
  onIncidentAlert(listener: (payload: IncidentAlertEvent) => void): this {
    return this.on(APP_EVENTS.INCIDENT_ALERT, listener);
  }
}

export const eventBus = new AppEventBus();

