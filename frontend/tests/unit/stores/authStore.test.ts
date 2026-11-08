import { useAuthStore } from '../../../src/stores/authStore';
import { AuthUser } from '../../../src/types/auth';

// Unit tests for authentication state store
describe('authStore', () => {
  const mockUser: AuthUser = {
    id: 'user-123',
    name: 'Test Member',
    email: 'member@example.com',
    slug: 'test-member',
    role: 'member',
    isVerified: true,
  };

  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it('should initialize with empty credentials', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should update state when setAuth is invoked', () => {
    useAuthStore.getState().setAuth(mockUser, 'mock-jwt-token-xyz');

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.accessToken).toBe('mock-jwt-token-xyz');
    expect(state.isAuthenticated).toBe(true);
    expect(state.isInitializing).toBe(false);
  });

  it('should update access token independently', () => {
    useAuthStore.getState().setAuth(mockUser, 'old-token');
    useAuthStore.getState().setAccessToken('rotated-token-abc');

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('rotated-token-abc');
    expect(state.isAuthenticated).toBe(true);
  });

  it('should update user profile independently', () => {
    useAuthStore.getState().setAuth(mockUser, 'token');
    useAuthStore.getState().setUser({ ...mockUser, name: 'Renamed Member' });

    const state = useAuthStore.getState();
    expect(state.user?.name).toBe('Renamed Member');
  });

  it('should reset all state upon clearAuth', () => {
    useAuthStore.getState().setAuth(mockUser, 'token');
    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });
});
