import React from 'react';

interface StatProps {
  label: string;
  value: string;
  note: string;
  color: string;
}

// Retro dashboard summary metric card
export const Stat: React.FC<StatProps> = ({ label, value, note, color }) => {
  return (
    <div
      className={`rounded-lg border-2 border-zinc-950 p-5 text-zinc-950 dark:border-[#737c91] dark:text-[#f3eadc] ${color}`}
    >
      <div className="text-xs font-bold uppercase tracking-wider opacity-75">
        {label}
      </div>
      <div className="mt-2 text-3xl font-black">{value}</div>
      <div className="mt-1 text-xs opacity-75">{note}</div>
    </div>
  );
};
