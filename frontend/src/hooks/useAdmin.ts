import { useState, useEffect, useCallback } from 'react';
import { systemService } from '../services/systemService';
import { AdminOverviewResponse, PingEngineStatus, SystemHealthResponse } from '../types/system';
import { getApiErrorMessage } from '../lib/apiError';
import { toast } from '../stores/toastStore';

// Custom hook managing system administration metrics, health state, and ping buffer flush actions
export function useAdmin() {
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [engineStatus, setEngineStatus] = useState<PingEngineStatus | null>(null);
  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFlushing, setIsFlushing] = useState(false);

  const fetchAdminData = useCallback(async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
    }
    try {
      const [overviewData, engineData, healthData] = await Promise.all([
        systemService.getAdminOverview(),
        systemService.getPingEngineStatus(),
        systemService.getHealth(),
      ]);
      setOverview(overviewData);
      setEngineStatus(engineData);
      setHealth(healthData);
      setError(null);
    } catch (err) {
      const message = getApiErrorMessage(err);
      setError(message);
      if (!silent) {
        toast.error(message, 'Failed to load system admin data');
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchAdminData();
    // Poll administrative telemetry every 15 seconds to keep buffer and memory diagnostics fresh
    const interval = setInterval(() => {
      fetchAdminData(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchAdminData]);

  const refresh = useCallback(() => fetchAdminData(false), [fetchAdminData]);

  const flushBuffer = useCallback(async () => {
    if (isFlushing) return;
    setIsFlushing(true);
    try {
      const result = await systemService.flushPingEngineBuffer();
      toast.success(`${result.flushedCount} buffered metrics were written successfully.`, 'Buffer flushed');
      setEngineStatus((prev) => (prev ? { ...prev, bufferSize: 0, lastFlushAt: new Date().toISOString() } : null));
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              pingEngine: {
                ...prev.pingEngine,
                bufferSize: 0,
                lastFlushAt: new Date().toISOString(),
              },
            }
          : null
      );
      await fetchAdminData(true);
    } catch (err) {
      toast.error(getApiErrorMessage(err), 'Buffer flush failed');
    } finally {
      setIsFlushing(false);
    }
  }, [isFlushing, fetchAdminData]);

  return {
    overview,
    engineStatus,
    health,
    isLoading,
    error,
    isFlushing,
    flushBuffer,
    refresh,
  };
}

