import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { monitorService } from '../services/monitorService';
import { toast } from '../stores/toastStore';
import { useRealtimeStore } from '../stores/realtimeStore';
import { getApiErrorMessage } from '../lib/apiError';
import {
  MonitorResponseDto,
  MonitorMetricDto,
  UpdateMonitorPayload,
} from '../types/monitor';
import { IncidentResponseDto } from '../types/incident';
import { SseIncidentAlertEvent, SseMonitorPingEvent } from '../types/api';

// Custom hook encapsulating single monitor telemetry data, mutations, countdowns, and live SSE streaming
export function useMonitorDetail(id: string | undefined) {
  const navigate = useNavigate();

  const [monitor, setMonitor] = useState<MonitorResponseDto | null>(null);
  const [metrics, setMetrics] = useState<MonitorMetricDto[]>([]);
  const [incidents, setIncidents] = useState<IncidentResponseDto[]>([]);
  const [range, setRange] = useState<'1h' | '24h' | '7d'>('1h');
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Deletion lock ref preventing unmounted post-deletion query triggers and false 404 toasts
  const isDeletedRef = useRef(false);

  // Cooldown countdown timer reducing 1s every tick to prevent socket spam
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const loadData = useCallback(async () => {
    if (!id || isDeletedRef.current) return;
    try {
      const [monitorData, incidentsData] = await Promise.all([
        monitorService.getMonitorById(id),
        monitorService.getMonitorIncidents(id),
      ]);
      if (!isDeletedRef.current) {
        setMonitor(monitorData);
        setIncidents(incidentsData);
      }
    } catch (err) {
      if (!isDeletedRef.current) {
        toast.error(getApiErrorMessage(err), 'Failed to load monitor');
        navigate('/monitors');
      }
    } finally {
      if (!isDeletedRef.current) {
        setIsLoading(false);
      }
    }
  }, [id, navigate]);

  const loadMetrics = useCallback(async () => {
    if (!id || isDeletedRef.current) return;
    try {
      const metricsData = await monitorService.getMetrics(id, { range, limit: 30 });
      if (!isDeletedRef.current) {
        setMetrics(metricsData);
      }
    } catch (err) {
      if (!isDeletedRef.current) {
        toast.error(getApiErrorMessage(err), 'Failed to load metrics');
      }
    }
  }, [id, range]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  // Handle live streaming telemetry updates for this specific monitor with deduplication
  const handleRealtimePing = useCallback(
    (event: SseMonitorPingEvent) => {
      if (event.monitorId !== id || isDeletedRef.current) return;
      setMetrics((prev) => {
        const isDuplicate = prev.some(
          (m) => Math.abs(new Date(m.timestamp).getTime() - new Date(event.timestamp).getTime()) < 1000
        );
        if (isDuplicate) return prev;
        return [
          {
            id: crypto.randomUUID(),
            monitorId: event.monitorId,
            timestamp: event.timestamp,
            statusCode: event.statusCode,
            latency: event.latency,
            isUp: event.isUp,
            error: event.error ?? null,
          },
          ...prev.slice(0, 29),
        ];
      });
      setMonitor((prev) =>
        prev
          ? {
              ...prev,
              status: event.isUp ? 'up' : 'down',
              lastCheckedAt: event.timestamp,
            }
          : prev
      );
    },
    [id]
  );

  // Handle live incident alerts affecting this monitor
  const handleRealtimeIncident = useCallback(
    (event: SseIncidentAlertEvent) => {
      if (event.monitorId !== id || isDeletedRef.current) return;
      setMonitor((prev) =>
        prev
          ? {
              ...prev,
              status: event.status === 'ongoing' ? 'down' : 'up',
            }
          : prev
      );
      loadData();
    },
    [id, loadData]
  );

  const subscribePing = useRealtimeStore((state) => state.subscribePing);
  const subscribeIncident = useRealtimeStore((state) => state.subscribeIncident);

  useEffect(() => {
    const unsubPing = subscribePing(handleRealtimePing);
    const unsubIncident = subscribeIncident(handleRealtimeIncident);
    return () => {
      unsubPing();
      unsubIncident();
    };
  }, [handleRealtimePing, handleRealtimeIncident, subscribePing, subscribeIncident]);

  // Compute SVG line chart coordinates and percentage values from telemetry samples
  const chartData = useMemo(() => {
    if (metrics.length === 0) {
      return {
        points: '0,50 100,50',
        latestLatency: 'Pending',
        uptimePercentage: monitor?.status === 'up' ? '100%' : '0%',
      };
    }

    const sortedMetrics = [...metrics].reverse();
    const latencies = sortedMetrics.map((m) => m.latency);
    const maxLatency = Math.max(...latencies, 100);
    const minLatency = 0;

    const points = sortedMetrics
      .map((item, index) => {
        const x = (index / Math.max(1, sortedMetrics.length - 1)) * 100;
        const normalized = (item.latency - minLatency) / (maxLatency - minLatency);
        const y = 90 - normalized * 70;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    const upCount = sortedMetrics.filter((m) => m.isUp).length;
    const uptimePercentage = `${((upCount / sortedMetrics.length) * 100).toFixed(1)}%`;
    const latestLatency = `${sortedMetrics[sortedMetrics.length - 1].latency} ms`;

    return {
      points,
      latestLatency,
      uptimePercentage,
    };
  }, [metrics, monitor?.status]);

  const instantPing = useCallback(async () => {
    if (!monitor) return;
    setIsChecking(true);
    setCooldown(15);
    toast.info(`An instant check was queued for ${monitor.name}.`, 'Ping requested');

    try {
      const result = await monitorService.triggerInstantPing(monitor.id);
      if (result.isUp) {
        toast.success(
          `${monitor.name} check completed with HTTP ${result.statusCode} (${result.latency} ms).`,
          'Ping response'
        );
      } else {
        toast.error(
          `${monitor.name} check completed with HTTP ${result.statusCode} (${result.latency} ms).`,
          'Ping response'
        );
      }
      if (!isDeletedRef.current) {
        setMetrics((prev) => {
          const exists = prev.some(
            (m) => Math.abs(new Date(m.timestamp).getTime() - new Date(result.checkedAt).getTime()) < 1000
          );
          if (exists) return prev;
          return [
            {
              id: crypto.randomUUID(),
              monitorId: result.monitorId,
              timestamp: result.checkedAt,
              statusCode: result.statusCode,
              latency: result.latency,
              isUp: result.isUp,
              error: result.error ?? null,
            },
            ...prev.slice(0, 29),
          ];
        });
        setMonitor((prev) =>
          prev
            ? {
                ...prev,
                status: result.isUp ? 'up' : 'down',
                lastCheckedAt: result.checkedAt,
              }
            : prev
        );
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err), 'Instant check failed');
    } finally {
      setIsChecking(false);
    }
  }, [monitor]);

  const toggleMonitor = useCallback(async () => {
    if (!monitor) return;
    try {
      const updated = await monitorService.toggleMonitor(monitor.id);
      setMonitor(updated);
      if (updated.status === 'paused') {
        toast.warning(`${monitor.name} has been paused.`, 'Monitor paused');
      } else {
        toast.info(
          `${monitor.name} resumed and is waiting for its first check.`,
          'Monitor resumed'
        );
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err), 'Failed to toggle monitor');
    }
  }, [monitor]);

  const updateMonitor = useCallback(
    async (payload: UpdateMonitorPayload) => {
      if (!monitor) return;
      try {
        const updated = await monitorService.updateMonitor(monitor.id, payload);
        setMonitor(updated);
        toast.success(`${monitor.name} configuration was saved.`, 'Monitor updated');
      } catch (err) {
        toast.error(getApiErrorMessage(err), 'Failed to update monitor');
        throw err;
      }
    },
    [monitor]
  );

  const deleteMonitor = useCallback(async () => {
    if (!monitor) return;
    isDeletedRef.current = true;
    try {
      await monitorService.deleteMonitor(monitor.id);
      toast.error(`${monitor.name} was permanently removed.`, 'Monitor deleted');
      navigate('/monitors');
    } catch (err) {
      isDeletedRef.current = false;
      toast.error(getApiErrorMessage(err), 'Failed to delete monitor');
    }
  }, [monitor, navigate]);

  return {
    monitor,
    metrics,
    incidents,
    range,
    isLoading,
    isChecking,
    cooldown,
    chartData,
    setRange,
    instantPing,
    toggleMonitor,
    updateMonitor,
    deleteMonitor,
  };
}

