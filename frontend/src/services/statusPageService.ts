import { apiClient } from './api';
import { ApiSuccessResponse } from '../types/api';
import { PublicStatusPageResponse } from '../types/statusPage';

export const statusPageService = {
  // Fetch public status page telemetry by user slug
  async getStatusPage(slug: string): Promise<PublicStatusPageResponse> {
    const response = await apiClient.get<ApiSuccessResponse<PublicStatusPageResponse>>(`/status/${slug}`);
    return response.data.data;
  },
};

