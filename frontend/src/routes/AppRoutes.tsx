import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicRoute } from './PublicRoute';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { AuthPage } from '../pages/auth/AuthPage';
import { OverviewPage } from '../pages/dashboard/OverviewPage';
import { MonitorsPage } from '../pages/monitors/MonitorsPage';
import { MonitorDetailPage } from '../pages/monitors/MonitorDetailPage';
import { IncidentsPage } from '../pages/incidents/IncidentsPage';
import { AdminPage } from '../pages/admin/AdminPage';
import { PublicStatusPage } from '../pages/status/PublicStatusPage';
import { NotFoundPage } from '../pages/not-found/NotFoundPage';

// Central routing tree for authentication, dashboard, and public views
export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Guest Routes */}
      <Route element={<PublicRoute />}>
        <Route path="/auth" element={<AuthPage />} />
      </Route>

      {/* Public Status Page (Accessible to everyone) */}
      <Route path="/status/:slug" element={<PublicStatusPage />} />

      {/* Protected Dashboard Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/monitors" element={<MonitorsPage />} />
          <Route path="/monitors/:id" element={<MonitorDetailPage />} />
          <Route path="/incidents" element={<IncidentsPage />} />

          {/* Admin Restricted Route */}
          <Route element={<ProtectedRoute adminOnly />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>
      </Route>

      {/* Fallback 404 Route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

