import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  Activity,
  AlertTriangle,
  Server,
  Globe,
  ExternalLink,
  Copy,
  Check,
  LogOut,
  X,
} from 'lucide-react';
import { Logo } from './Logo';
import { useAuthStore } from '../../stores/authStore';
import { authService } from '../../services/authService';
import { useToast } from '../../context/ToastContext';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

// Enterprise retro sidebar navigation with user account management and public link copy matching Figma
export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const { user, clearAuth } = useAuthStore();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [linkCopied, setLinkCopied] = useState(false);

  const navItems = [
    { to: '/', label: 'Overview', icon: LayoutGrid, exact: true },
    { to: '/monitors', label: 'Monitors', icon: Activity },
    { to: '/incidents', label: 'Incidents', icon: AlertTriangle },
    ...(user?.role === 'admin' ? [{ to: '/admin', label: 'System admin', icon: Server }] : []),
  ];

  const statusSlug = user?.slug || '';
  const accountName = user?.name || 'Account';
  const initials = accountName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleCopyStatusLink = async () => {
    try {
      const publicUrl = `${window.location.origin}/status/${statusSlug}`;
      await navigator.clipboard.writeText(publicUrl);
      setLinkCopied(true);
      showToast(`/status/${statusSlug} copied to clipboard.`, 'success', 'Public link copied');
      window.setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      showToast('Clipboard access was blocked by the browser.', 'error', 'Copy failed');
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {
      // Clear local session even if server request fails
    } finally {
      clearAuth();
      showToast('Your local session has been closed.', 'info', 'Signed out');
      navigate('/auth');
    }
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="flex h-18 h-[72px] shrink-0 items-center justify-between border-b-2 border-zinc-950 px-6 dark:border-[#737c91]">
          <Logo />
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close sidebar"
              className="grid size-8 place-items-center rounded-md border border-zinc-950 dark:border-[#737c91] lg:hidden"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <nav className="p-4">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 dark:text-slate-300">
            Workspace
          </p>

          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              onClick={onClose}
              className={({ isActive }) =>
                `mb-1 flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm font-bold transition-colors ${isActive
                  ? 'bg-retro-orange text-zinc-950 dark:bg-retro-orange dark:text-zinc-950'
                  : 'text-zinc-800 hover:bg-white/70 hover:text-zinc-950 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-amber-50'
                }`
              }
            >
              <item.icon className="size-[18px]" />
              <span>{item.label}</span>
            </NavLink>
          ))}

          <p className="mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 dark:text-slate-300">
            Public
          </p>

          <div className="flex items-center gap-1">
            <NavLink
              to={`/status/${statusSlug}`}
              onClick={onClose}
              className={({ isActive }) =>
                `flex min-w-0 flex-1 items-center gap-3 rounded-md px-3 py-3 text-sm font-bold transition-colors ${isActive
                  ? 'bg-retro-orange text-zinc-950 dark:bg-retro-orange dark:text-zinc-950'
                  : 'text-zinc-800 hover:bg-white/70 hover:text-zinc-950 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-amber-50'
                }`
              }
            >
              <Globe className="size-[18px]" />
              <span className="truncate">Status page</span>
              <ExternalLink className="ml-auto size-3.5 opacity-70" />
            </NavLink>

            <button
              type="button"
              onClick={handleCopyStatusLink}
              title={linkCopied ? 'Public link copied' : 'Copy public link'}
              aria-label={linkCopied ? 'Public link copied' : 'Copy public link'}
              className={`grid size-10 shrink-0 place-items-center rounded-md border border-zinc-950 transition-colors dark:border-[#737c91] ${linkCopied ? 'bg-mint text-zinc-950' : 'bg-white/70 hover:bg-white dark:bg-slate-800 dark:hover:bg-slate-700'
                }`}
            >
              {linkCopied ? <Check className="size-4 stroke-[3]" /> : <Copy className="size-4" />}
            </button>
          </div>
        </nav>
      </div>

      <div className="border-t-2 border-zinc-950 p-4 dark:border-[#737c91]">
        <div className="flex items-center gap-1">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-2">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-yellow-300 text-xs font-black text-zinc-950">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-zinc-950 dark:text-[#f3eadc]">
                {accountName}
              </div>
              <div className="truncate text-xs text-zinc-500 dark:text-slate-400">
                {'Account settings'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            title="Sign out"
            aria-label="Sign out"
            className="grid size-9 shrink-0 place-items-center rounded-md hover:bg-white/70 dark:hover:bg-slate-700 text-zinc-950 dark:text-[#f3eadc]"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r-2 border-zinc-950 bg-[#d9e8d1] text-zinc-800 dark:border-[#737c91] dark:bg-retro-panel dark:text-slate-200 lg:flex">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <aside className="relative z-10 flex w-72 flex-col border-r-2 border-zinc-950 bg-[#d9e8d1] shadow-2xl dark:border-[#737c91] dark:bg-retro-panel dark:text-slate-200">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
