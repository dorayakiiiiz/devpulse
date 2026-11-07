import React from 'react';

interface LogoProps {
  light?: boolean;
}

// Brand logo component matching Figma 100%
export const Logo: React.FC<LogoProps> = ({ light = false }) => {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`grid size-9 place-items-center border-2 border-zinc-950 dark:border-[#737c91] ${
          light ? 'bg-cyan-300 text-zinc-950' : 'bg-coral text-zinc-950'
        } shadow-[3px_3px_0_#18181b]`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
        >
          <path d="M3 12h4l2-7 4 14 2-7h6" />
        </svg>
      </div>
      <span
        className={`text-lg font-black tracking-tight ${
          light ? 'text-white' : 'text-zinc-950 dark:text-[#f3eadc]'
        }`}
      >
        DevPulse
      </span>
    </div>
  );
};
