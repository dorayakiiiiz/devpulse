import { apiClient } from './api';
import { ApiSuccessResponse } from '../types/api';
import {
  CreateMonitorPayload,
  InstantPingResponseDto,
  MonitorMetricDto,
  MonitorResponseDto,
  UpdateMonitorPayload,
} from '../types/monitor';

export const monitorService = {
  // Fetch user monitors
  async getMonitors(): Promise<MonitorResponseDto[]> {
    const response = await apiClient.get<ApiSuccessResponse<MonitorResponseDto[]>>('/monitors');
    return response.data.data;
  },

  // Fetch single monitor by id
  async getMonitorById(id: string): Promise<MonitorResponseDto> {
    const response = await apiClient.get<ApiSuccessResponse<MonitorResponseDto>>(`/monitors/${id}`);
    return response.data.data;
  },

  // Create new monitor
  async createMonitor(payload: CreateMonitorPayload): Promise<MonitorResponseDto> {
    const response = await apiClient.post<ApiSuccessResponse<MonitorResponseDto>>('/monitors', payload);
    return response.data.data;
  },

  // Update existing monitor
  async updateMonitor(id: string, payload: UpdateMonitorPayload): Promise<MonitorResponseDto> {
    const response = await apiClient.put<ApiSuccessResponse<MonitorResponseDto>>(`/monitors/${id}`, payload);
    return response.data.data;
  },

  // Toggle monitor active state
  async toggleMonitor(id: string): Promise<MonitorResponseDto> {
    const response = await apiClient.patch<ApiSuccessResponse<MonitorResponseDto>>(`/monitors/${id}/toggle`);
    return response.data.data;
  },

  // Fetch monitor metric latency history matching backend query param 'range'
  async getMetrics(
    id: string,
    options?: { range?: '1h' | '24h' | '7d'; limit?: number }
  ): Promise<MonitorMetricDto[]> {
    const response = await apiClient.get<ApiSuccessResponse<MonitorMetricDto[]>>(`/monitors/${id}/metrics`, {
      params: options,
    });
    return response.data.data;
  },

  // Trigger manual instant ping check
  async triggerInstantPing(id: string): Promise<InstantPingResponseDto> {
    const response = await apiClient.post<ApiSuccessResponse<InstantPingResponseDto>>(`/monitors/${id}/ping`);
    return response.data.data;
  },

  // Delete monitor by id
  async deleteMonitor(id: string): Promise<void> {
    await apiClient.delete<ApiSuccessResponse<null>>(`/monitors/${id}`);
  },
};
