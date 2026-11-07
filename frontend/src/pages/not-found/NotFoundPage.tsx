import React from 'react';
import { Link } from 'react-router-dom';
import { RetroWindowBar } from '../../components/common/RetroWindowBar';

// 404 Route Not Found page
export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-4 text-zinc-950 dark:bg-retro-night dark:text-[#f3eadc]">
      <div className="w-full max-w-md overflow-hidden rounded-lg border-2 border-zinc-950 bg-white shadow-retro-lg dark:border-[#737c91] dark:bg-retro-panel dark:shadow-retro-dark">
        <RetroWindowBar title="404 - Not Found" tone="coral" />
        <div className="p-8 text-center space-y-4">
          <div className="text-5xl font-black text-coral">404</div>
          <h1 className="text-xl font-black">Page Not Found</h1>
          <p className="text-sm text-zinc-600 dark:text-slate-300">
            The page you are looking for does not exist or has been relocated.
          </p>
          <Link
            to="/"
            className="inline-block rounded-md border-2 border-zinc-950 bg-retro-orange px-5 py-2.5 text-xs font-black text-zinc-950 shadow-retro transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

