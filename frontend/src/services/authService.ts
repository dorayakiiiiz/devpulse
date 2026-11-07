import { apiClient } from './api';
import { ApiSuccessResponse } from '../types/api';
import {
  AuthSessionResponse,
  AuthUser,
  LoginCredentials,
  RegisterCredentials,
  ResetPasswordPayload,
  VerifyOtpPayload,
} from '../types/auth';

export const authService = {
  // Authenticate user with email and password
  async login(payload: LoginCredentials): Promise<AuthSessionResponse> {
    const response = await apiClient.post<ApiSuccessResponse<AuthSessionResponse>>('/auth/login', payload);
    return response.data.data;
  },

  // Initiate user registration and trigger email OTP
  async register(payload: RegisterCredentials): Promise<{ email: string }> {
    const response = await apiClient.post<ApiSuccessResponse<{ email: string }>>('/auth/register', payload);
    return response.data.data;
  },

  // Confirm email OTP to activate account and establish authenticated session
  async verifyEmail(payload: VerifyOtpPayload): Promise<AuthSessionResponse> {
    const response = await apiClient.post<ApiSuccessResponse<AuthSessionResponse>>('/auth/verify-email', payload);
    return response.data.data;
  },

  // Resend 6-digit registration OTP code to email
  async resendVerificationOtp(email: string): Promise<void> {
    await apiClient.post<ApiSuccessResponse<null>>('/auth/resend-verification', { email });
  },

  // Request password reset verification code
  async forgotPassword(email: string): Promise<void> {
    await apiClient.post<ApiSuccessResponse<null>>('/auth/forgot-password', { email });
  },

  // Confirm password reset with OTP code and set new password
  async resetPassword(payload: ResetPasswordPayload): Promise<void> {
    await apiClient.post<ApiSuccessResponse<null>>('/auth/reset-password', payload);
  },

  // Terminate authenticated session and clear server cookie
  async logout(): Promise<void> {
    await apiClient.post<ApiSuccessResponse<null>>('/auth/logout');
  },

  // Retrieve current authenticated user profile
  async getCurrentUser(): Promise<AuthUser> {
    const response = await apiClient.get<ApiSuccessResponse<AuthUser>>('/auth/me');
    return response.data.data;
  },

  // Manually refresh access token from HttpOnly cookie
  async refreshToken(): Promise<AuthSessionResponse> {
    const response = await apiClient.post<ApiSuccessResponse<AuthSessionResponse>>('/auth/refresh-token');
    return response.data.data;
  },
};
