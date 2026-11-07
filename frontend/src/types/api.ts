// Standard API response envelope matching backend sendSuccess and sendError utilities
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message?: string;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: Record<string, string[]>;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// Realtime Server-Sent Events contract payloads matching backend /api/sse/monitors
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
  incidentId: string;
  monitorId: string;
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

export type SseServerEvent = SseConnectedEvent | SseMonitorPingEvent | SseIncidentAlertEvent;
