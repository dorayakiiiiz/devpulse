import { useState, useEffect, useCallback, useMemo } from 'react';
import { incidentService } from '../services/incidentService';
import { IncidentResponseDto, IncidentStatus } from '../types/incident';
import { getApiErrorMessage } from '../lib/apiError';
import { toast } from '../stores/toastStore';
import { useRealtimeStore } from '../stores/realtimeStore';
import { SseIncidentAlertEvent } from '../types/api';

// Central custom hook managing incident event timelines, active item selection, and AI post-mortem diagnosis
export function useIncidents() {
  const [incidents, setIncidents] = useState<IncidentResponseDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<IncidentStatus>('ongoing');
  const [isLoading, setIsLoading] = useState(true);
  const [isResolving, setIsResolving] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  const fetchIncidents = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await incidentService.getIncidents();
      setIncidents(data);
    } catch (err) {
      toast.error(getApiErrorMessage(err), 'Failed to load incidents');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  // Handle incoming realtime incident updates dispatched via Server-Sent Events
  const handleRealtimeIncident = useCallback(
    (event: SseIncidentAlertEvent) => {
      setIncidents((prev) => {
        const exists = prev.some((item) => item.id === event.incidentId);
        if (exists) {
          return prev.map((item) =>
            item.id === event.incidentId
              ? {
                ...item,
                status: event.status,
                resolvedAt: event.resolvedAt ?? item.resolvedAt,
                aiPostMortem: event.aiPostMortem ?? item.aiPostMortem,
              }
              : item
          );
        }
        // Fetch fresh state to populate relational monitor names and full error logs
        fetchIncidents();
        return prev;
      });
    },
    [fetchIncidents]
  );

  const subscribeIncident = useRealtimeStore((state) => state.subscribeIncident);

  useEffect(() => {
    const unsubIncident = subscribeIncident(handleRealtimeIncident);
    return unsubIncident;
  }, [handleRealtimeIncident, subscribeIncident]);

  const filteredIncidents = useMemo(
    () => incidents.filter((item) => item.status === filter),
    [incidents, filter]
  );

  // Automatically select the first visible incident when switching filter or loading initial data
  useEffect(() => {
    if (filteredIncidents.length > 0) {
      const isSelectedPresent = filteredIncidents.some((item) => item.id === selectedId);
      if (!isSelectedPresent) {
        setSelectedId(filteredIncidents[0].id);
      }
    } else {
      setSelectedId(null);
    }
  }, [filteredIncidents, selectedId]);

  const selectedIncident = useMemo(
    () => incidents.find((item) => item.id === selectedId) ?? null,
    [incidents, selectedId]
  );

  const resolveIncident = useCallback(
    async (id: string): Promise<void> => {
      setIsResolving(true);
      try {
        const updated = await incidentService.resolveIncident(id);
        setIncidents((prev) => prev.map((item) => (item.id === id ? updated : item)));
        toast.success(
          `${updated.monitorName} incident was marked as resolved.`,
          'Incident resolved'
        );
      } catch (err) {
        toast.error(getApiErrorMessage(err), 'Failed to resolve incident');
      } finally {
        setIsResolving(false);
      }
    },
    []
  );

  const reanalyzeIncident = useCallback(
    async (id: string): Promise<void> => {
      setIsReanalyzing(true);
      try {
        const updated = await incidentService.reanalyzeIncident(id);
        setIncidents((prev) => prev.map((item) => (item.id === id ? updated : item)));
        toast.success(
          'The AI post-mortem was regenerated using the latest error data.',
          'Analysis updated'
        );
      } catch (err) {
        toast.error(getApiErrorMessage(err), 'Failed to reanalyze incident');
      } finally {
        setIsReanalyzing(false);
      }
    },
    []
  );

  return {
    incidents,
    filteredIncidents,
    selectedIncident,
    selectedId,
    filter,
    isLoading,
    isResolving,
    isReanalyzing,
    setFilter,
    setSelectedId,
    resolveIncident,
    reanalyzeIncident,
    fetchIncidents,
  };
}

