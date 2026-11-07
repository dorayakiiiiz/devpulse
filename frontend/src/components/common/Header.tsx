import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Plus } from 'lucide-react';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { useAuthStore } from '../../stores/authStore';
import { useRealtimeStore } from '../../stores/realtimeStore';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
}

function getHeaderTitle(pathname: string): string {
  if (pathname === '/') return 'Overview';
  if (pathname === '/monitors') return 'Monitors';
  if (pathname.startsWith('/monitors/')) return 'Monitor details';
  if (pathname === '/incidents') return 'Incidents';
  if (pathname === '/admin') return 'System admin';
  return 'Dashboard';
}

// Global dashboard header bar containing breadcrumbs, stream status, theme toggle, and creation shortcut
export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isConnected = useRealtimeStore((state) => state.isConnected);

  const title = getHeaderTitle(location.pathname);
  const workspaceName = user?.name || 'Workspace';

  return (
    <header className="sticky top-0 z-20 flex h-18 h-[72px] items-center justify-between border-b-2 border-zinc-950 bg-cream px-5 backdrop-blur dark:border-[#737c91] dark:bg-retro-night/95 md:px-8 lg:px-10">
      <div className="flex items-center gap-3 lg:hidden">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation menu"
            className="grid size-10 place-items-center rounded-md border-2 border-zinc-950 bg-white text-zinc-950 shadow-retro dark:border-[#737c91] dark:bg-retro-panel dark:text-[#f3eadc]"
          >
            <Menu className="size-5" />
          </button>
        )}
        <Logo />
      </div>

      <div className="hidden lg:block">
        <span className="text-sm font-black">{title}</span>
        <span className="ml-2 text-xs text-zinc-400 dark:text-slate-400">
          / {workspaceName}'s Workspace
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-md border border-zinc-950 bg-white px-3 py-2 text-xs font-bold dark:border-[#737c91] dark:bg-retro-panel sm:flex">
          <span
            className={`size-2 rounded-full ${
              isConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
            }`}
          />
          <span>{isConnected ? 'Live stream connected' : 'Connecting stream...'}</span>
        </div>

        <ThemeToggle />

        <button
          type="button"
          onClick={() => navigate('/monitors')}
          className="flex items-center gap-2 rounded-md border-2 border-zinc-950 bg-yellow-300 px-3.5 py-2 text-xs font-black text-zinc-950 shadow-[3px_3px_0_#18181b] transition-transform hover:-translate-y-0.5 active:translate-y-0 dark:border-[#737c91] dark:bg-amber-300 dark:shadow-[3px_3px_0_#090b10]"
        >
          <Plus className="size-4 stroke-[3]" />
          <span className="hidden sm:inline">New monitor</span>
        </button>
      </div>
    </header>
  );
};
