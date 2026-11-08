import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { statusPageService } from '../services/statusPageService';
import { PublicStatusPageResponse } from '../types/statusPage';
import { getApiErrorMessage } from '../lib/apiError';

// Custom hook fetching public status page telemetry by slug with automatic cache-aligned polling
export function usePublicStatus(slug: string | undefined) {
  const [data, setData] = useState<PublicStatusPageResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);

  const fetchStatus = useCallback(
    async (silent = false) => {
      if (!slug) {
        setError('Missing status page identifier');
        setIsNotFound(true);
        setIsLoading(false);
        return;
      }

      if (!silent) {
        setIsLoading(true);
      }

      try {
        const response = await statusPageService.getStatusPage(slug);
        setData(response);
        setError(null);
        setIsNotFound(false);
      } catch (err) {
        setError(getApiErrorMessage(err));
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          setIsNotFound(true);
        } else {
          setIsNotFound(false);
        }
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [slug]
  );

  useEffect(() => {
    fetchStatus();
    // Poll every 30 seconds matching backend node-cache TTL for public status pages
    const interval = setInterval(() => {
      fetchStatus(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const refresh = useCallback(() => fetchStatus(false), [fetchStatus]);

  const overallUptime = useMemo(() => {
    if (!data || data.monitors.length === 0) return '100.00';
    const sum = data.monitors.reduce((acc, monitor) => acc + monitor.uptimePercentage24h, 0);
    return (sum / data.monitors.length).toFixed(2);
  }, [data]);

  return {
    data,
    overallUptime,
    isLoading,
    error,
    isNotFound,
    refresh,
  };
}

