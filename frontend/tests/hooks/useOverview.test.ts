import { renderHook, waitFor, act } from '@testing-library/react';
import { useOverview } from '../../src/hooks/useOverview';
import { monitorService } from '../../src/services/monitorService';
import { incidentService } from '../../src/services/incidentService';
import { MonitorResponseDto, MonitorMetricDto } from '../../src/types/monitor';
import { IncidentResponseDto } from '../../src/types/incident';

// Hook integration tests for useOverview
describe('useOverview Custom Hook', () => {
  const mockMonitors: MonitorResponseDto[] = [
    {
      id: 'mon-1',
      userId: 'u-1',
      name: 'API Gateway',
      url: 'https://gateway.example.com',
      method: 'GET',
      headers: {},
      interval: 60,
      status: 'up',
      isActive: true,
      lastCheckedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'mon-2',
      userId: 'u-1',
      name: 'Worker Service',
      url: 'https://worker.example.com',
      method: 'GET',
      headers: {},
      interval: 300,
      status: 'down',
      isActive: true,
      lastCheckedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockIncidents: IncidentResponseDto[] = [
    {
      id: 'inc-1',
      monitorId: 'mon-2',
      monitorName: 'Worker Service',
      monitorUrl: 'https://worker.example.com',
      status: 'ongoing',
      startedAt: new Date().toISOString(),
      resolvedAt: null,
      errorDetails: {
        statusCode: 500,
        errorMessage: 'Crash',
        responseBody: '',
        responseHeaders: {},
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockMetrics: MonitorMetricDto[] = [
    {
      id: 'met-1',
      monitorId: 'mon-1',
      timestamp: new Date().toISOString(),
      statusCode: 200,
      latency: 48,
      isUp: true,
      error: null,
    },
    {
      id: 'met-2',
      monitorId: 'mon-1',
      timestamp: new Date().toISOString(),
      statusCode: 200,
      latency: 52,
      isUp: true,
      error: null,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch monitors, ongoing incidents, and primary metrics on mount', async () => {
    vi.spyOn(monitorService, 'getMonitors').mockResolvedValue(mockMonitors);
    vi.spyOn(incidentService, 'getIncidents').mockResolvedValue(mockIncidents);
    vi.spyOn(monitorService, 'getMetrics').mockResolvedValue(mockMetrics);

    const { result } = renderHook(() => useOverview());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.monitors).toHaveLength(2);
    expect(result.current.ongoingIncident).not.toBeNull();
    expect(result.current.ongoingIncident?.monitorName).toBe('Worker Service');
    expect(result.current.macroStats.totalMonitorsCount).toBe(2);
    expect(result.current.macroStats.activeMonitorsCount).toBe(2);
    expect(result.current.macroStats.openIncidentsCount).toBe(1);
  });

  it('should calculate global uptime and average latency correctly', async () => {
    vi.spyOn(monitorService, 'getMonitors').mockResolvedValue(mockMonitors);
    vi.spyOn(incidentService, 'getIncidents').mockResolvedValue(mockIncidents);
    vi.spyOn(monitorService, 'getMetrics').mockResolvedValue(mockMetrics);

    const { result } = renderHook(() => useOverview());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // 1 monitor up, 1 monitor down out of 2 active monitors -> 50.00%
    expect(result.current.macroStats.globalUptime).toBe('50.00%');
    // Latencies: 48 and 52 -> Average: 50 ms
    expect(result.current.macroStats.avgLatency).toBe('50 ms');
  });

  it('should handle service errors gracefully without unhandled crashes', async () => {
    vi.spyOn(monitorService, 'getMonitors').mockRejectedValue(new Error('Network error'));
    vi.spyOn(incidentService, 'getIncidents').mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useOverview());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
  });
});
