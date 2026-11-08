import { create } from 'zustand';
import { API_BASE_URL } from '../config/constants';
import { SseIncidentAlertEvent, SseMonitorPingEvent, SseServerEvent } from '../types/api';
import { toast } from './toastStore';

type PingSubscriber = (event: SseMonitorPingEvent) => void;
type IncidentSubscriber = (event: SseIncidentAlertEvent) => void;

interface RealtimeState {
  isConnected: boolean;
  lastPingEvent: SseMonitorPingEvent | null;
  lastIncidentEvent: SseIncidentAlertEvent | null;
  connect: (accessToken: string) => void;
  disconnect: () => void;
  subscribePing: (cb: PingSubscriber) => () => void;
  subscribeIncident: (cb: IncidentSubscriber) => () => void;
}

let eventSourceInstance: EventSource | null = null;
let currentToken: string | null = null;
const pingSubscribers = new Set<PingSubscriber>();
const incidentSubscribers = new Set<IncidentSubscriber>();

// Central Zustand store managing the single background SSE EventSource socket and event fan-out
export const useRealtimeStore = create<RealtimeState>((set) => ({
  isConnected: false,
  lastPingEvent: null,
  lastIncidentEvent: null,

  connect: (accessToken: string) => {
    // Avoid re-establishing identical active connection on component re-renders
    if (
      eventSourceInstance &&
      eventSourceInstance.readyState !== EventSource.CLOSED &&
      currentToken === accessToken
    ) {
      return;
    }

    // Close existing connection if any
    if (eventSourceInstance) {
      eventSourceInstance.close();
      eventSourceInstance = null;
    }

    currentToken = accessToken;
    const sseUrl = `${API_BASE_URL}/sse/monitors?token=${encodeURIComponent(accessToken)}`;
    const es = new EventSource(sseUrl);
    eventSourceInstance = es;

    es.onopen = () => {
      set({ isConnected: true });
    };

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as SseServerEvent;

        if (payload.type === 'MONITOR_PING') {
          set({ lastPingEvent: payload });
          // Notify all ping subscribers
          pingSubscribers.forEach((cb) => {
            try {
              cb(payload);
            } catch (err) {
              console.error('[Realtime SSE] Error in ping subscriber callback:', err);
            }
          });
        } else if (payload.type === 'INCIDENT_ALERT') {
          set({ lastIncidentEvent: payload });
          // Show toast notification based on incident status
          if (payload.status === 'ongoing') {
            toast.error(
              payload.errorMessage ?? 'Service disruption detected on monitored endpoint.',
              'Incident Alert'
            );
          } else if (payload.status === 'resolved') {
            toast.success(
              'Monitored endpoint has fully recovered.',
              'Incident Resolved'
            );
          }
          // Notify all incident subscribers
          incidentSubscribers.forEach((cb) => {
            try {
              cb(payload);
            } catch (err) {
              console.error('[Realtime SSE] Error in incident subscriber callback:', err);
            }
          });
        }
      } catch {
        // Discard heartbeat comments and non-JSON data safely
      }
    };

    es.onerror = () => {
      set({ isConnected: false });
    };
  },

  // Disconnect from SSE and clear state when user logs out
  disconnect: () => {
    if (eventSourceInstance) {
      eventSourceInstance.close();
      eventSourceInstance = null;
    }
    currentToken = null;
    set({ isConnected: false, lastPingEvent: null, lastIncidentEvent: null });
  },

  // Allow components to subscribe to ping events
  subscribePing: (cb: PingSubscriber) => {
    pingSubscribers.add(cb);
    // Return a cleanup function
    return () => {
      pingSubscribers.delete(cb);
    };
  },

  // Allow components to subscribe to incident events
  subscribeIncident: (cb: IncidentSubscriber) => {
    incidentSubscribers.add(cb);
    return () => {
      incidentSubscribers.delete(cb);
    };
  },
}));

