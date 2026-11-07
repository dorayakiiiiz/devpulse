import React, { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutGrid, Activity, AlertTriangle, Server } from 'lucide-react';
import { Sidebar } from '../components/common/Sidebar';
import { Header } from '../components/common/Header';
import { useAuthStore } from '../stores/authStore';
import { useRealtimeStore } from '../stores/realtimeStore';

// Standard dashboard shell containing responsive navigation, header bar, and main page outlet
export const DashboardLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, accessToken } = useAuthStore();
  const connect = useRealtimeStore((state) => state.connect);
  const disconnect = useRealtimeStore((state) => state.disconnect);

  // Maintain single background SSE streaming connection across active dashboard session
  useEffect(() => {
    if (accessToken) {
      connect(accessToken);
    }
    return () => {
      disconnect();
    };
  }, [accessToken, connect, disconnect]);

  const mobileNavItems = [
    { to: '/', icon: LayoutGrid, exact: true },
    { to: '/monitors', icon: Activity },
    { to: '/incidents', icon: AlertTriangle },
    ...(user?.role === 'admin' ? [{ to: '/admin', icon: Server }] : []),
  ];

  return (
    <div className="min-h-screen bg-cream text-zinc-950 dark:bg-retro-night dark:text-[#f3eadc]">
      <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      <div className="flex min-h-screen flex-col lg:pl-64">
        <Header onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        <main className="flex-1">
          <Outlet />
        </main>

        {/* Mobile bottom navigation */}
        <nav
          className={`fixed inset-x-0 bottom-0 z-40 grid ${mobileNavItems.length === 4 ? 'grid-cols-4' : 'grid-cols-3'
            } border-t-2 border-zinc-950 bg-white dark:border-[#737c91] dark:bg-retro-panel lg:hidden`}
        >
          {mobileNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `grid place-items-center py-3 ${isActive ? 'bg-cyan-300 dark:bg-cyan-950' : ''}`
              }
            >
              <item.icon className="size-5" />
            </NavLink>
          ))}
        </nav>
        <div className="h-14 lg:hidden" />
      </div>
    </div>
  );
};
