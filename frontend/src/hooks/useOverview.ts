import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { monitorService } from '../services/monitorService';
import { incidentService } from '../services/incidentService';
import { MonitorResponseDto, MonitorMetricDto } from '../types/monitor';
import { IncidentResponseDto } from '../types/incident';
import { SseIncidentAlertEvent, SseMonitorPingEvent } from '../types/api';
import { useRealtimeStore } from '../stores/realtimeStore';
import { getApiErrorMessage } from '../lib/apiError';
import { toast } from '../stores/toastStore';

export interface OverviewMacroStats {
  globalUptime: string;
  avgLatency: string;
  activeMonitorsCount: number;
  totalMonitorsCount: number;
  openIncidentsCount: number;
}

export interface OverviewChartData {
  points: string;
  latestLatency: string;
  isHealthy: boolean;
  timeLabels: string[];
}

// Custom hook managing aggregated overview telemetry, primary target charts, and real-time delta updates
export function useOverview() {
  const [monitors, setMonitors] = useState<MonitorResponseDto[]>([]);
  const [ongoingIncidents, setOngoingIncidents] = useState<IncidentResponseDto[]>([]);
  const [primaryMetrics, setPrimaryMetrics] = useState<MonitorMetricDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const primaryMonitor = useMemo(
    () => monitors.find((m) => m.isActive) ?? monitors[0] ?? null,
    [monitors]
  );

  const primaryMonitorRef = useRef<MonitorResponseDto | null>(primaryMonitor);
  primaryMonitorRef.current = primaryMonitor;

  const fetchOverviewData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [monitorsData, incidentsData] = await Promise.all([
        monitorService.getMonitors(),
        incidentService.getIncidents({ status: 'ongoing' }),
      ]);
      setMonitors(monitorsData);
      setOngoingIncidents(incidentsData);
      setError(null);

      const target = monitorsData.find((m) => m.isActive) ?? monitorsData[0];
      if (target) {
        try {
          const metrics = await monitorService.getMetrics(target.id, { range: '1h', limit: 20 });
          setPrimaryMetrics(metrics);
        } catch {
          setPrimaryMetrics([]);
        }
      } else {
        setPrimaryMetrics([]);
      }
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setError(msg);
      toast.error(msg, 'Failed to load overview data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverviewData();
  }, [fetchOverviewData]);

  // Handle incoming realtime ping events to update target status and metrics
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

    if (primaryMonitorRef.current && primaryMonitorRef.current.id === event.monitorId) {
      setPrimaryMetrics((prev) => {
        const exists = prev.some(
          (item) => Math.abs(new Date(item.timestamp).getTime() - new Date(event.timestamp).getTime()) < 1000
        );
        if (exists) return prev;
        return [
          {
            id: `sse-${event.monitorId}-${event.timestamp}`,
            monitorId: event.monitorId,
            timestamp: event.timestamp,
            statusCode: event.statusCode,
            latency: event.latency,
            isUp: event.isUp,
            error: event.error ?? null,
          },
          ...prev.slice(0, 19),
        ];
      });
    }
  }, []);

  // Handle incoming realtime incident alerts to refresh open incidents count
  const handleRealtimeIncident = useCallback((event: SseIncidentAlertEvent) => {
    if (event.status === 'ongoing') {
      incidentService
        .getIncidents({ status: 'ongoing' })
        .then(setOngoingIncidents)
        .catch((err) => {
          console.error('[Overview] Failed to refresh ongoing incidents:', err);
        });
    } else {
      setOngoingIncidents((prev) => prev.filter((item) => item.id !== event.incidentId));
    }
  }, []);

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

  // Aggregate macro statistics
  const macroStats: OverviewMacroStats = useMemo(() => {
    const total = monitors.length;
    const active = monitors.filter((m) => m.isActive).length;
    const upCount = monitors.filter((m) => m.status === 'up').length;

    const globalUptime = total > 0 ? `${((upCount / total) * 100).toFixed(2)}%` : '100.00%';

    const activeWithLatency = primaryMetrics.filter((m) => m.isUp);
    const avgLatencyNumber =
      activeWithLatency.length > 0
        ? Math.round(
            activeWithLatency.reduce((acc, m) => acc + m.latency, 0) / activeWithLatency.length
          )
        : 0;

    return {
      globalUptime,
      avgLatency: avgLatencyNumber > 0 ? `${avgLatencyNumber} ms` : '—',
      activeMonitorsCount: active,
      totalMonitorsCount: total,
      openIncidentsCount: ongoingIncidents.length,
    };
  }, [monitors, ongoingIncidents, primaryMetrics]);

  // Compute SVG line chart points for primary target
  const chartData: OverviewChartData = useMemo(() => {
    if (primaryMetrics.length === 0) {
      return {
        points: '0,50 100,50',
        latestLatency: 'Pending',
        isHealthy: primaryMonitor?.status === 'up',
        timeLabels: ['45m ago', '30m ago', '15m ago', 'Now'],
      };
    }

    const sorted = [...primaryMetrics].reverse();
    const latencies = sorted.map((m) => m.latency);
    const maxLatency = Math.max(...latencies, 100);
    const minLatency = 0;

    const points = sorted
      .map((item, index) => {
        const x = (index / Math.max(1, sorted.length - 1)) * 100;
        const normalized = (item.latency - minLatency) / (maxLatency - minLatency);
        const y = 90 - normalized * 70;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    const last = sorted[sorted.length - 1];
    const isHealthy = last?.isUp ?? true;
    const latestLatency = last ? `${last.latency} ms` : '—';

    return {
      points,
      latestLatency,
      isHealthy,
      timeLabels: ['45m ago', '30m ago', '15m ago', 'Now'],
    };
  }, [primaryMetrics, primaryMonitor]);

  const ongoingIncident = ongoingIncidents[0] ?? null;

  return {
    monitors,
    primaryMonitor,
    macroStats,
    chartData,
    ongoingIncident,
    isLoading,
    error,
    refresh: fetchOverviewData,
  };
}

