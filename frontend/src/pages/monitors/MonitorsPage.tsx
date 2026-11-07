import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Clock, Shield, Play, Pause, Edit3, Trash2, Activity, ArrowLeft, ArrowRight } from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { MonitorModal } from '../../components/monitors/MonitorModal';
import { DeleteMonitorModal } from '../../components/monitors/DeleteMonitorModal';
import { useMonitors } from '../../hooks/useMonitors';
import { formatRelativeTime } from '../../lib/date';
import {
  MonitorResponseDto,
  CreateMonitorPayload,
  UpdateMonitorPayload,
} from '../../types/monitor';

// Central monitor targets dashboard displaying live endpoints, SSL health, and quick actions
export const MonitorsPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    monitors,
    isLoading,
    cooldowns,
    createMonitor,
    updateMonitor,
    toggleMonitor,
    deleteMonitor,
    instantPing,
  } = useMonitors();

  const [editing, setEditing] = useState<MonitorResponseDto | null | 'new'>(null);
  const [deleting, setDeleting] = useState<MonitorResponseDto | null>(null);
  const [monitorPage, setMonitorPage] = useState(1);

  const monitorsPerPage = 8;
  const monitorPageCount = Math.max(1, Math.ceil(monitors.length / monitorsPerPage));
  const visibleMonitors = monitors.slice(
    (monitorPage - 1) * monitorsPerPage,
    monitorPage * monitorsPerPage
  );

  const operationalCount = monitors.filter((m) => m.status === 'up').length;
  const degradedCount = monitors.filter((m) => m.status === 'down').length;
  const pausedCount = monitors.filter((m) => m.status === 'paused').length;
  const pendingCount = monitors.filter((m) => m.status === 'pending').length;

  // Re-align pagination index if the monitor list shrinks below the current page offset
  useEffect(() => {
    if (monitorPage > monitorPageCount) {
      setMonitorPage(monitorPageCount);
    }
  }, [monitorPage, monitorPageCount]);

  const handleSave = async (payload: CreateMonitorPayload | UpdateMonitorPayload) => {
    if (editing === 'new') {
      await createMonitor(payload as CreateMonitorPayload);
    } else if (editing) {
      await updateMonitor(editing.id, payload as UpdateMonitorPayload);
    }
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await deleteMonitor(deleting.id, deleting.name);
    setDeleting(null);
  };

  return (
    <div className="p-5 md:p-8 lg:p-10">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-400">
            Endpoint management
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.045em]">
            Monitors
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-slate-400">
            Configure and inspect every service you care about.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="flex items-center justify-center gap-2 rounded-md border-2 border-zinc-950 bg-coral px-5 py-3 text-sm font-black text-zinc-950 shadow-[4px_4px_0_#18181b] transition-transform hover:-translate-y-0.5 active:translate-y-0 dark:border-[#737c91] dark:bg-[#ff8585] dark:shadow-[4px_4px_0_#090b10]"
        >
          <Plus className="size-4 stroke-[3]" /> Add monitor
        </button>
      </div>

      <div className="retro-scrollbar mt-8 max-h-[520px] overflow-auto rounded-lg border-2 border-zinc-950 bg-white dark:border-[#737c91] dark:bg-retro-panel">
        <table className="w-full min-w-[850px] text-left">
          <thead className="sticky top-0 z-10 border-b-2 border-zinc-950 bg-zinc-100 text-[10px] uppercase tracking-[0.14em] text-zinc-500 dark:border-[#737c91] dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="p-4">Monitor</th>
              <th className="p-4">Status</th>
              <th className="p-4">SSL Certificate</th>
              <th className="p-4">Interval</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-slate-700">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-sm font-bold text-zinc-500 dark:text-slate-400">
                  Loading monitors...
                </td>
              </tr>
            ) : visibleMonitors.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-sm font-bold text-zinc-500 dark:text-slate-400">
                  No monitors found. Click &quot;Add monitor&quot; to configure your first endpoint.
                </td>
              </tr>
            ) : (
              visibleMonitors.map((m) => {
                const cooldown = cooldowns[m.id] ?? 0;
                return (
                  <tr
                    key={m.id}
                    className="hover:bg-yellow-50 dark:hover:bg-slate-800/60"
                  >
                    <td className="p-4">
                      <button
                        type="button"
                        onClick={() => navigate(`/monitors/${m.id}`)}
                        className="text-left font-black underline decoration-2 decoration-transparent underline-offset-4 hover:decoration-current"
                      >
                        {m.name}
                      </button>
                      <div className="mt-1 max-w-56 truncate font-mono text-xs text-zinc-500 dark:text-slate-400">
                        {m.method} · {m.url}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 dark:text-slate-500">
                        <Clock className="size-3" />
                        Last checked: {formatRelativeTime(m.lastCheckedAt)}
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge status={m.status} />
                    </td>
                    <td className="p-4">
                      {!m.sslInfo ? (
                        <span className="inline-flex rounded-full border border-zinc-400 bg-zinc-100 px-2.5 py-1 text-[10px] font-black uppercase text-zinc-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          {m.url.startsWith('http://') ? 'No SSL' : 'Scan pending'}
                        </span>
                      ) : (
                        <div
                          className={`flex items-center gap-2 text-xs font-bold ${
                            m.sslInfo.daysRemaining < 7
                              ? 'text-red-700 dark:text-red-300'
                              : m.sslInfo.daysRemaining < 30
                                ? 'text-amber-700 dark:text-amber-300'
                                : ''
                          }`}
                        >
                          <Shield className="size-4" />
                          {m.sslInfo.daysRemaining} days
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-sm font-mono">{m.interval}s</td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={cooldown > 0 || m.status === 'paused'}
                          onClick={() => instantPing(m)}
                          title="Ping now"
                          className="rounded-md border border-zinc-950 bg-yellow-200 p-2 transition-transform hover:-translate-y-0.5 disabled:opacity-40 dark:border-[#737c91] dark:bg-slate-900 dark:text-slate-400"
                        >
                          {cooldown > 0 ? (
                            <span className="block min-w-4 text-[10px] font-black">
                              {cooldown}s
                            </span>
                          ) : (
                            <Activity className="size-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleMonitor(m)}
                          title={m.status === 'paused' ? 'Resume monitor' : 'Pause monitor'}
                          aria-label={m.status === 'paused' ? 'Resume monitor' : 'Pause monitor'}
                          className={`rounded-md border p-2 transition-transform hover:-translate-y-0.5 ${
                            m.status === 'paused'
                              ? 'border-emerald-800 bg-mint text-emerald-950 dark:border-emerald-400 dark:bg-[#295b55] dark:text-emerald-100'
                              : 'border-zinc-950 bg-retro-blue text-zinc-950 dark:border-[#737c91] dark:bg-[#394b67] dark:text-slate-100'
                          }`}
                        >
                          {m.status === 'paused' ? (
                            <Play className="size-4 fill-current" />
                          ) : (
                            <Pause className="size-4 fill-current" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(m)}
                          title="Edit"
                          className="rounded-md border border-zinc-950 bg-white p-2 transition-transform hover:-translate-y-0.5 dark:border-[#737c91] dark:bg-retro-panel"
                        >
                          <Edit3 className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(m)}
                          title="Delete"
                          className="rounded-md border border-zinc-950 bg-coral-soft p-2 text-red-950 transition-transform hover:-translate-y-0.5 dark:border-red-400 dark:bg-red-950 dark:text-red-200"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-4 text-xs text-zinc-500 dark:text-slate-400">
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500" />
            {operationalCount} operational
          </span>
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-red-500" />
            {degradedCount} degraded
          </span>
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-zinc-400" />
            {pausedCount} paused
          </span>
          <span className="flex items-center gap-2">
            <span className="size-2 animate-pulse rounded-full bg-amber-500" />
            {pendingCount} pending
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="mr-2 text-xs text-zinc-500 dark:text-slate-400">
            {monitors.length === 0
              ? '0 of 0'
              : `${(monitorPage - 1) * monitorsPerPage + 1}–${Math.min(
                  monitorPage * monitorsPerPage,
                  monitors.length
                )} of ${monitors.length}`}
          </span>
          <button
            type="button"
            disabled={monitorPage === 1}
            onClick={() => setMonitorPage((page) => page - 1)}
            aria-label="Previous monitor page"
            className="grid size-9 place-items-center rounded-md border-2 border-zinc-950 bg-white disabled:opacity-35 dark:border-[#737c91] dark:bg-retro-panel"
          >
            <ArrowLeft className="size-4" />
          </button>
          {Array.from({ length: monitorPageCount }, (_, index) => index + 1).map((page) => (
            <button
              type="button"
              key={page}
              onClick={() => setMonitorPage(page)}
              aria-current={monitorPage === page ? 'page' : undefined}
              className={`grid size-9 place-items-center rounded-md border-2 border-zinc-950 text-xs font-black dark:border-[#737c91] ${
                monitorPage === page
                  ? 'bg-yellow-300 text-zinc-950'
                  : 'bg-white dark:bg-retro-panel'
              }`}
            >
              {page}
            </button>
          ))}
          <button
            type="button"
            disabled={monitorPage === monitorPageCount}
            onClick={() => setMonitorPage((page) => page + 1)}
            aria-label="Next monitor page"
            className="grid size-9 place-items-center rounded-md border-2 border-zinc-950 bg-white disabled:opacity-35 dark:border-[#737c91] dark:bg-retro-panel"
          >
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>

      {editing && (
        <MonitorModal
          monitor={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      {deleting && (
        <DeleteMonitorModal
          monitor={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
};
