import { useRealtimeStore } from '../../../src/stores/realtimeStore';
import { toast } from '../../../src/stores/toastStore';
import { SseMonitorPingEvent, SseIncidentAlertEvent } from '../../../src/types/api';

interface TestEventSourceConstructor {
  latestInstance: {
    emitNamedEvent: (type: string, payload: unknown) => void;
  } | null;
}

// Unit tests for real-time SSE subscriber store
describe('realtimeStore', () => {
  beforeEach(() => {
    useRealtimeStore.getState().disconnect();
    vi.clearAllMocks();
  });

  it('should establish EventSource connection and update isConnected on open', () => {
    vi.useFakeTimers();
    useRealtimeStore.getState().connect('test-jwt-token');

    expect(useRealtimeStore.getState().isConnected).toBe(false);

    vi.advanceTimersByTime(20);
    expect(useRealtimeStore.getState().isConnected).toBe(true);

    vi.useRealTimers();
  });

  it('should avoid creating redundant connection if same token is provided while active', () => {
    const originalEventSource = global.EventSource;
    const constructorSpy = vi.fn();
    // @ts-expect-error Mocking constructor
    global.EventSource = class extends originalEventSource {
      constructor(url: string) {
        super(url);
        constructorSpy(url);
      }
    };

    useRealtimeStore.getState().connect('same-token');
    useRealtimeStore.getState().connect('same-token');

    expect(constructorSpy).toHaveBeenCalledTimes(1);
    global.EventSource = originalEventSource;
  });

  it('should fan-out named MONITOR_PING events to subscribed listeners', () => {
    vi.useFakeTimers();
    useRealtimeStore.getState().connect('test-token');
    vi.advanceTimersByTime(20);

    const pingListener = vi.fn();
    const unsub = useRealtimeStore.getState().subscribePing(pingListener);

    const mockPingEvent: SseMonitorPingEvent = {
      type: 'MONITOR_PING',
      monitorId: 'mon-123',
      userId: 'usr-123',
      statusCode: 200,
      latency: 45,
      isUp: true,
      timestamp: new Date().toISOString(),
    };

    const esCtor = global.EventSource as unknown as TestEventSourceConstructor;
    esCtor.latestInstance?.emitNamedEvent('MONITOR_PING', mockPingEvent);

    expect(pingListener).toHaveBeenCalledTimes(1);
    expect(pingListener).toHaveBeenCalledWith(mockPingEvent);

    unsub();
    esCtor.latestInstance?.emitNamedEvent('MONITOR_PING', mockPingEvent);
    expect(pingListener).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('should unsubscribe listeners cleanly when unsub function is called', () => {
    const listener = vi.fn();
    const unsub = useRealtimeStore.getState().subscribeIncident(listener);

    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('should trigger system toast notification and notify subscribers on named INCIDENT_ALERT event', () => {
    vi.useFakeTimers();
    const toastSpy = vi.spyOn(toast, 'error').mockImplementation(() => {});
    const incidentListener = vi.fn();
    const unsub = useRealtimeStore.getState().subscribeIncident(incidentListener);

    useRealtimeStore.getState().connect('incident-token');
    vi.advanceTimersByTime(20);

    const mockIncidentEvent: SseIncidentAlertEvent = {
      type: 'INCIDENT_ALERT',
      incidentId: 'inc-1',
      monitorId: 'mon-1',
      userId: 'user-1',
      status: 'ongoing',
      startedAt: new Date().toISOString(),
      errorMessage: '502 Bad Gateway',
    };

    const esCtor = global.EventSource as unknown as TestEventSourceConstructor;
    esCtor.latestInstance?.emitNamedEvent('INCIDENT_ALERT', mockIncidentEvent);

    expect(toastSpy).toHaveBeenCalledWith('502 Bad Gateway', 'Incident Alert');
    expect(incidentListener).toHaveBeenCalledTimes(1);
    expect(incidentListener).toHaveBeenCalledWith(mockIncidentEvent);

    unsub();
    vi.useRealTimers();
  });
});
