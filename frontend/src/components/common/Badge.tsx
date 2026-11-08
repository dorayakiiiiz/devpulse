import React from 'react';
import { MonitorStatus } from '../../types/monitor';
import { IncidentStatus } from '../../types/incident';

export type BadgeStatus =
  | MonitorStatus
  | IncidentStatus
  | 'operational'
  | 'all_operational'
  | 'partial_outage'
  | 'major_outage';

interface BadgeProps {
  status: BadgeStatus | string;
  label?: string;
}

const statusDisplayLabels: Record<string, string> = {
  up: 'Operational',
  operational: 'Operational',
  all_operational: 'All operational',
  partial_outage: 'Partial outage',
  major_outage: 'Major outage',
};

// Status indicator badge with retro styling
export const Badge: React.FC<BadgeProps> = ({ status, label }) => {
  const isUp =
    status === 'up' ||
    status === 'resolved' ||
    status === 'operational' ||
    status === 'all_operational';
  const isPaused = status === 'paused';
  const isPending = status === 'pending' || status === 'partial_outage';

  const displayText = label || statusDisplayLabels[status] || status;

  return (
    <span
      className={`inline-flex self-start items-center gap-1.5 rounded-full border border-zinc-900 px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
        isUp
          ? 'bg-mint text-zinc-950 dark:bg-[#356b63] dark:text-[#f3eadc]'
          : isPaused
            ? 'bg-zinc-100 dark:bg-slate-900 text-zinc-500 dark:text-slate-400'
            : isPending
              ? 'bg-yellow-200 dark:bg-[#665c2f] text-zinc-950 dark:text-[#fff8df]'
              : 'bg-coral-soft text-zinc-950 dark:bg-[#713f3b] dark:text-[#f3eadc]'
      }`}
    >
      <span
        className={`size-2 rounded-full ${
          isUp
            ? 'bg-emerald-600'
            : isPaused
              ? 'bg-zinc-400'
              : isPending
                ? 'bg-amber-600'
                : 'bg-red-600'
        }`}
      />
      {displayText}
    </span>
  );
};
