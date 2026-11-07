import React from 'react';

interface RetroWindowBarProps {
  title: string;
  tone?: 'sage' | 'coral' | 'blue';
}

const toneStyles: Record<'sage' | 'coral' | 'blue', string> = {
  sage: 'bg-[#d9ef9f] dark:bg-[#3f5a4f]',
  coral: 'bg-coral-soft dark:bg-[#663b43]',
  blue: 'bg-retro-blue dark:bg-[#394b67]',
};

// Retro mac-style window header bar
export const RetroWindowBar: React.FC<RetroWindowBarProps> = ({ title, tone = 'sage' }) => {
  return (
    <div
      className={`relative flex h-10 items-center border-b-2 border-zinc-950 px-4 dark:border-[#737c91] ${toneStyles[tone]}`}
    >
      <div className="flex items-center gap-1.5" aria-hidden="true">
        <span className="size-2.5 rounded-full border border-zinc-950 bg-coral" />
        <span className="size-2.5 rounded-full border border-zinc-950 bg-yellow-300" />
        <span className="size-2.5 rounded-full border border-zinc-950 bg-mint" />
      </div>
      <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-black uppercase tracking-[0.16em] text-zinc-700 dark:text-slate-100">
        {title}
      </span>
    </div>
  );
};

