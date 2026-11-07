import { apiClient } from './api';
import { ApiSuccessResponse } from '../types/api';
import { AdminOverviewResponse, PingEngineStatus, SystemHealthResponse } from '../types/system';

export const systemService = {
  // Fetch system health status directly returned as JSON from GET /health
  async getHealth(): Promise<SystemHealthResponse> {
    const response = await apiClient.get<SystemHealthResponse>('/health');
    return response.data;
  },

  // Fetch admin dashboard overview metrics
  async getAdminOverview(): Promise<AdminOverviewResponse> {
    const res = await apiClient.get<ApiSuccessResponse<AdminOverviewResponse>>('/admin/overview');
    return res.data.data;
  },

  // Retrieve ping engine operational diagnostics and buffer stats
  async getPingEngineStatus(): Promise<PingEngineStatus> {
    const response = await apiClient.get<ApiSuccessResponse<PingEngineStatus>>('/admin/ping-engine/status');
    return response.data.data;
  },

  // Force flush of in-memory metric buffer
  async flushPingEngineBuffer(): Promise<{ flushedCount: number }> {
    const response = await apiClient.post<ApiSuccessResponse<{ flushedCount: number }>>('/admin/ping-engine/flush');
    return response.data.data;
  },
};
