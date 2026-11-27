import { apiClient } from './api';
import { ApiSuccessResponse } from '../types/api';
import { AuthUser, ChangePasswordPayload, UpdateProfilePayload } from '../types/auth';

export const userService = {
  // Retrieve authenticated user profile
  async getProfile(): Promise<AuthUser> {
    const response = await apiClient.get<ApiSuccessResponse<AuthUser>>('/users/profile');
    return response.data.data;
  },

  // Update user name or slug matching backend PUT /users/profile
  async updateProfile(payload: UpdateProfilePayload): Promise<AuthUser> {
    const response = await apiClient.put<ApiSuccessResponse<AuthUser>>('/users/profile', payload);
    return response.data.data;
  },

  // Change user password matching backend PUT /users/change-password
  async changePassword(payload: ChangePasswordPayload): Promise<void> {
    await apiClient.put<ApiSuccessResponse<null>>('/users/change-password', payload);
  },

  // Delete user account permanently matching backend DELETE /users/account
  async deleteAccount(password: string): Promise<void> {
    await apiClient.delete<ApiSuccessResponse<null>>('/users/account', {
      data: { password },
    });
  },
};

