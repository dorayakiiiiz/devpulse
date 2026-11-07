import { useState, useEffect, useCallback } from 'react';
import { monitorService } from '../services/monitorService';
import {
  MonitorResponseDto,
  CreateMonitorPayload,
  UpdateMonitorPayload,
} from '../types/monitor';
import { SseIncidentAlertEvent, SseMonitorPingEvent } from '../types/api';
import { getApiErrorMessage } from '../lib/apiError';
import { toast } from '../stores/toastStore';
import { useRealtimeStore } from '../stores/realtimeStore';

// Central custom hook managing monitor targets, lifecycle operations, and instant check cooldowns
export function useMonitors() {
  const [monitors, setMonitors] = useState<MonitorResponseDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Cooldown tracker storing remaining countdown seconds per monitor ID to prevent network socket flooding
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});

  const fetchMonitors = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await monitorService.getMonitors();
      setMonitors(data);
    } catch (err) {
      toast.error(getApiErrorMessage(err), 'Failed to load monitors');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMonitors();
  }, [fetchMonitors]);

  // Handle live ping telemetry events pushed through the SSE streaming socket
  const handleRealtimePing = useCallback((event: SseMonitorPingEvent) => {
    setMonitors((prev) =>
      prev.map((m) =>
        m.id === event.monitorId
          ? {
            ...m,
            status: event.isUp ? 'up' : 'down',
            lastCheckedAt: event.timestamp,
          }
          : m
      )
    );
  }, []);

  // Handle live incident state transitions pushed through the SSE streaming socket
  const handleRealtimeIncident = useCallback((event: SseIncidentAlertEvent) => {
    setMonitors((prev) =>
      prev.map((m) =>
        m.id === event.monitorId
          ? {
            ...m,
            status: event.status === 'ongoing' ? 'down' : 'up',
          }
          : m
      )
    );
  }, []);

  const subscribePing = useRealtimeStore((state) => state.subscribePing);
  const subscribeIncident = useRealtimeStore((state) => state.subscribeIncident);

  useEffect(() => {
    // Subscribe to ping and incident events
    const unsubPing = subscribePing(handleRealtimePing);
    const unsubIncident = subscribeIncident(handleRealtimeIncident);
    return () => {
      unsubPing();
      unsubIncident();
    };
  }, [handleRealtimePing, handleRealtimeIncident, subscribePing, subscribeIncident]);

  // Interval timer ticking down active cooldown counters every second until reaching zero
  useEffect(() => {
    const hasActiveCooldown = Object.values(cooldowns).some((seconds) => seconds > 0);
    if (!hasActiveCooldown) return;

    const intervalTimer = setInterval(() => {
      setCooldowns((prev) => {
        const next: Record<string, number> = {};
        for (const [id, count] of Object.entries(prev)) {
          if (count > 1) {
            next[id] = count - 1;
          }
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(intervalTimer);
  }, [cooldowns]);

  const createMonitor = useCallback(
    async (payload: CreateMonitorPayload): Promise<MonitorResponseDto> => {
      try {
        const created = await monitorService.createMonitor(payload);
        setMonitors((prev) => [created, ...prev]);
        toast.success(
          'The monitor was created and is waiting for its first check.',
          'Monitor created'
        );
        return created;
      } catch (err) {
        toast.error(getApiErrorMessage(err), 'Failed to create monitor');
        throw err;
      }
    },
    []
  );

  const updateMonitor = useCallback(
    async (id: string, payload: UpdateMonitorPayload): Promise<MonitorResponseDto> => {
      try {
        const updated = await monitorService.updateMonitor(id, payload);
        setMonitors((prev) => prev.map((m) => (m.id === id ? updated : m)));
        toast.success(`${updated.name} configuration was saved.`, 'Monitor updated');
        return updated;
      } catch (err) {
        toast.error(getApiErrorMessage(err), 'Failed to update monitor');
        throw err;
      }
    },
    []
  );

  const toggleMonitor = useCallback(
    async (monitor: MonitorResponseDto): Promise<MonitorResponseDto | undefined> => {
      try {
        const updated = await monitorService.toggleMonitor(monitor.id);
        setMonitors((prev) => prev.map((m) => (m.id === monitor.id ? updated : m)));
        if (updated.status === 'paused') {
          toast.warning(`${monitor.name} has been paused.`, 'Monitor paused');
        } else {
          toast.info(`${monitor.name} resumed and is waiting for its first check.`, 'Monitor resumed');
        }
        return updated;
      } catch (err) {
        toast.error(getApiErrorMessage(err), 'Failed to toggle monitor');
      }
    },
    []
  );

  const deleteMonitor = useCallback(
    async (id: string, name: string): Promise<void> => {
      try {
        await monitorService.deleteMonitor(id);
        setMonitors((prev) => prev.filter((m) => m.id !== id));
        toast.error(`${name} was permanently removed.`, 'Monitor deleted');
      } catch (err) {
        toast.error(getApiErrorMessage(err), 'Failed to delete monitor');
        throw err;
      }
    },
    []
  );

  const instantPing = useCallback(
    async (monitor: MonitorResponseDto): Promise<void> => {
      // Set 15s debounce cooldown on the target monitor to prevent rapid ping spam
      setCooldowns((prev) => ({ ...prev, [monitor.id]: 15 }));
      toast.info(`An instant check was queued for ${monitor.name}.`, 'Ping requested');

      try {
        const result = await monitorService.triggerInstantPing(monitor.id);
        // Optimistically update monitor state immediately from response without waiting for SSE event
        setMonitors((prev) =>
          prev.map((m) =>
            m.id === result.monitorId
              ? {
                ...m,
                status: result.isUp ? 'up' : 'down',
                lastCheckedAt: result.checkedAt,
              }
              : m
          )
        );
        const msg = `${monitor.name} check completed with HTTP ${result.statusCode} (${result.latency} ms).`;
        if (result.isUp) {
          toast.success(msg, 'Ping response');
        } else {
          toast.error(msg, 'Ping response');
        }
      } catch (err) {
        toast.error(getApiErrorMessage(err), 'Instant ping failed');
      }
    },
    []
  );

  return {
    monitors,
    isLoading,
    cooldowns,
    fetchMonitors,
    createMonitor,
    updateMonitor,
    toggleMonitor,
    deleteMonitor,
    instantPing,
  };
}
