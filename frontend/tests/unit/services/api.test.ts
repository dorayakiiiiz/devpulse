import axios, { AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '../../../src/services/api';
import { useAuthStore } from '../../../src/stores/authStore';

// Unit tests for Axios API client interceptors
describe('apiClient Interceptors', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
    vi.restoreAllMocks();
  });

  it('should inject Authorization header when access token exists in authStore', async () => {
    useAuthStore.getState().setAuth(
      {
        id: 'u-1',
        name: 'User',
        email: 'u@test.com',
        slug: 'user',
        role: 'member',
        isVerified: true,
      },
      'bearer-token-123'
    );

    const config: InternalAxiosRequestConfig = {
      headers: new AxiosHeaders(),
    };

    // Run request interceptor handler
    // @ts-expect-error accessing private interceptor handler
    const requestHandler = apiClient.interceptors.request.handlers[0].fulfilled;
    const modified = requestHandler(config);

    expect(modified.headers.Authorization).toBe('Bearer bearer-token-123');
  });

  it('should not add Authorization header when no access token exists', async () => {
    const config: InternalAxiosRequestConfig = {
      headers: new AxiosHeaders(),
    };

    // @ts-expect-error accessing private interceptor handler
    const requestHandler = apiClient.interceptors.request.handlers[0].fulfilled;
    const modified = requestHandler(config);

    expect(modified.headers.Authorization).toBeUndefined();
  });

  it('should not trigger refresh token flow for login and refresh endpoints', async () => {
    // @ts-expect-error accessing private interceptor handler
    const errorHandler = apiClient.interceptors.response.handlers[0].rejected;

    const mockLoginError = {
      config: { url: '/auth/login', headers: new AxiosHeaders() },
      response: { status: 401, data: { error: 'Invalid credentials' } },
    };

    await expect(errorHandler(mockLoginError)).rejects.toEqual(mockLoginError);
  });
});
