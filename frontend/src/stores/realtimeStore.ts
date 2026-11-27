import { create } from 'zustand';
import { API_BASE_URL } from '../config/constants';
import { SseIncidentAlertEvent, SseMonitorPingEvent } from '../types/api';
import { toast } from './toastStore';

type PingSubscriber = (event: SseMonitorPingEvent) => void;
type IncidentSubscriber = (event: SseIncidentAlertEvent) => void;

interface RealtimeState {
  isConnected: boolean;
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

    // Listen for named MONITOR_PING events emitted by backend SSE stream
    es.addEventListener('MONITOR_PING', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as SseMonitorPingEvent;
        pingSubscribers.forEach((cb) => {
          try {
            cb(payload);
          } catch (err) {
            console.error('[Realtime SSE] Error in ping subscriber callback:', err);
          }
        });
      } catch (err) {
        console.error('[Realtime SSE] Failed to parse MONITOR_PING payload:', err);
      }
    });

    // Listen for named INCIDENT_ALERT events emitted by backend SSE stream
    es.addEventListener('INCIDENT_ALERT', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as SseIncidentAlertEvent;
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
        incidentSubscribers.forEach((cb) => {
          try {
            cb(payload);
          } catch (err) {
            console.error('[Realtime SSE] Error in incident subscriber callback:', err);
          }
        });
      } catch (err) {
        console.error('[Realtime SSE] Failed to parse INCIDENT_ALERT payload:', err);
      }
    });

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
    set({ isConnected: false });
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

