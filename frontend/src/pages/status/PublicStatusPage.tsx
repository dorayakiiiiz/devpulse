import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { RetroWindowBar } from '../../components/common/RetroWindowBar';
import { Logo } from '../../components/common/Logo';
import { ThemeToggle } from '../../components/common/ThemeToggle';

// Public status page view displaying real-time system uptime to external visitors
export const PublicStatusPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  return (
    <div className="min-h-screen bg-cream text-zinc-950 dark:bg-retro-night dark:text-[#f3eadc]">
      <header className="border-b-2 border-zinc-950 bg-cream/95 px-6 py-4 backdrop-blur dark:border-[#737c91] dark:bg-retro-night/95">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <Link
              to="/auth"
              className="rounded-md border-2 border-zinc-950 bg-white px-3.5 py-1.5 text-xs font-bold text-zinc-950 shadow-retro dark:border-[#737c91] dark:bg-retro-panel dark:text-[#f3eadc]"
            >
              Sign in
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-6 md:p-10 space-y-8">
        <div className="overflow-hidden rounded-lg border-2 border-zinc-950 bg-white shadow-retro-md dark:border-[#737c91] dark:bg-retro-panel dark:shadow-retro-dark">
          <RetroWindowBar title={`Public Telemetry: ${slug}`} tone="sage" />
          <div className="p-8 text-center">
            <h1 className="text-2xl font-black text-zinc-950 dark:text-[#f3eadc]">
              System Status for /{slug}
            </h1>
            <p className="mt-3 text-sm text-zinc-600 dark:text-slate-300">
              Live service component statuses, 90-day uptime bars, and ongoing maintenance bulletins will be rendered here.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

