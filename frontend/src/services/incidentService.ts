import { apiClient } from './api';
import { ApiSuccessResponse } from '../types/api';
import { IncidentResponseDto, IncidentStatus } from '../types/incident';

export const incidentService = {
  // Fetch incidents list with optional query filters matching queryIncidentsSchema
  async getIncidents(query?: {
    status?: IncidentStatus;
    monitorId?: string;
    limit?: number;
    skip?: number;
  }): Promise<IncidentResponseDto[]> {
    const response = await apiClient.get<ApiSuccessResponse<IncidentResponseDto[]>>('/incidents', {
      params: query,
    });
    return response.data.data;
  },

  // Fetch incident by id
  async getIncidentById(id: string): Promise<IncidentResponseDto> {
    const response = await apiClient.get<ApiSuccessResponse<IncidentResponseDto>>(`/incidents/${id}`);
    return response.data.data;
  },

  // Fetch incidents for a specific monitor
  async getIncidentsByMonitor(monitorId: string): Promise<IncidentResponseDto[]> {
    const response = await apiClient.get<ApiSuccessResponse<IncidentResponseDto[]>>(`/monitors/${monitorId}/incidents`);
    return response.data.data;
  },

  // Manually resolve an ongoing incident
  async resolveIncident(id: string): Promise<IncidentResponseDto> {
    const response = await apiClient.patch<ApiSuccessResponse<IncidentResponseDto>>(`/incidents/${id}/resolve`);
    return response.data.data;
  },

  // Re-run AI post-mortem diagnostic analysis matching backend endpoint POST /:id/reanalyze
  async reanalyzeIncident(id: string): Promise<IncidentResponseDto> {
    const response = await apiClient.post<ApiSuccessResponse<IncidentResponseDto>>(`/incidents/${id}/reanalyze`);
    return response.data.data;
  },
};
