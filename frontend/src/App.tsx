import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from './components/common/ToastContainer';
import { AppRoutes } from './routes/AppRoutes';
import { useAuthStore } from './stores/authStore';
import { authService } from './services/authService';

// Root application component handling session hydration, global routing, and toast notifications
export const App: React.FC = () => {
  const { setAuth, clearAuth, setInitializing } = useAuthStore();

  useEffect(() => {
    // Attempt silent session hydration from HttpOnly refresh cookie on application startup
    const hydrateSession = async () => {
      try {
        const result = await authService.refreshToken();
        if (result.user && result.accessToken) {
          setAuth(result.user, result.accessToken);
        } else {
          clearAuth();
        }
      } catch {
        clearAuth();
      } finally {
        setInitializing(false);
      }
    };

    hydrateSession();
  }, [setAuth, clearAuth, setInitializing]);

  return (
    <BrowserRouter>
      <AppRoutes />
      <ToastContainer />
    </BrowserRouter>
  );
};
