import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Activity,
  Play,
  Pause,
  Edit3,
  Trash2,
  Shield,
} from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Stat } from '../../components/common/Stat';
import { MonitorModal } from '../../components/monitors/MonitorModal';
import { DeleteMonitorModal } from '../../components/monitors/DeleteMonitorModal';
import { monitorService } from '../../services/monitorService';
import { useToast } from '../../context/ToastContext';
import { formatRelativeTime, formatDate } from '../../lib/date';
import { getApiErrorMessage } from '../../lib/apiError';
import {
  MonitorResponseDto,
  MonitorMetricDto,
  UpdateMonitorPayload,
} from '../../types/monitor';
import { IncidentResponseDto } from '../../types/incident';

// Detailed monitor telemetry dashboard displaying live latency, SSL health, recent checks, and incident logs
export const MonitorDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [monitor, setMonitor] = useState<MonitorResponseDto | null>(null);
  const [metrics, setMetrics] = useState<MonitorMetricDto[]>([]);
  const [incidents, setIncidents] = useState<IncidentResponseDto[]>([]);
  const [range, setRange] = useState<'1h' | '24h' | '7d'>('1h');
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [monitorData, incidentsData] = await Promise.all([
        monitorService.getMonitorById(id),
        monitorService.getMonitorIncidents(id),
      ]);
      setMonitor(monitorData);
      setIncidents(incidentsData);
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error', 'Failed to load monitor');
      navigate('/monitors');
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate, showToast]);

  const loadMetrics = useCallback(async () => {
    if (!id) return;
    try {
      const metricsData = await monitorService.getMetrics(id, { range, limit: 30 });
      setMetrics(metricsData);
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error', 'Failed to load metrics');
    }
  }, [id, range, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const chartData = useMemo(() => {
    if (metrics.length === 0) {
      return {
        points: '0,50 100,50',
        latestLatency: 'Pending',
        uptimePercentage: monitor?.status === 'up' ? '100%' : '0%',
      };
    }

    const sortedMetrics = [...metrics].reverse();
    const latencies = sortedMetrics.map((m) => m.latency);
    const maxLatency = Math.max(...latencies, 100);
    const minLatency = 0;

    const points = sortedMetrics
      .map((item, index) => {
        const x = (index / Math.max(1, sortedMetrics.length - 1)) * 100;
        const normalized = (item.latency - minLatency) / (maxLatency - minLatency);
        const y = 90 - normalized * 70;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    const upCount = sortedMetrics.filter((m) => m.isUp).length;
    const uptimePercentage = `${((upCount / sortedMetrics.length) * 100).toFixed(1)}%`;
    const latestLatency = `${sortedMetrics[sortedMetrics.length - 1].latency} ms`;

    return {
      points,
      latestLatency,
      uptimePercentage,
    };
  }, [metrics, monitor?.status]);

  const handleInstantPing = async () => {
    if (!monitor) return;
    setIsChecking(true);
    showToast(`An instant check was queued for ${monitor.name}.`, 'info', 'Ping requested');

    try {
      const result = await monitorService.triggerInstantPing(monitor.id);
      showToast(
        `${monitor.name} responded successfully with status ${result.statusCode} in ${result.latency} ms.`,
        result.isUp ? 'success' : 'error',
        'Check completed'
      );
      loadMetrics();
      const updated = await monitorService.getMonitorById(monitor.id);
      setMonitor(updated);
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error', 'Instant check failed');
    } finally {
      setIsChecking(false);
    }
  };

  const handleToggle = async () => {
    if (!monitor) return;
    try {
      const updated = await monitorService.toggleMonitor(monitor.id);
      setMonitor(updated);
      showToast(
        updated.status === 'paused'
          ? `${monitor.name} has been paused.`
          : `${monitor.name} resumed and is waiting for its first check.`,
        updated.status === 'paused' ? 'warning' : 'info',
        updated.status === 'paused' ? 'Monitor paused' : 'Monitor resumed'
      );
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error', 'Failed to toggle monitor');
    }
  };

  const handleUpdate = async (payload: UpdateMonitorPayload) => {
    if (!monitor) return;
    try {
      const updated = await monitorService.updateMonitor(monitor.id, payload);
      setMonitor(updated);
      showToast(`${monitor.name} configuration was saved.`, 'success', 'Monitor updated');
      setEditing(false);
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error', 'Failed to update monitor');
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!monitor) return;
    try {
      await monitorService.deleteMonitor(monitor.id);
      showToast(`${monitor.name} was permanently removed.`, 'error', 'Monitor deleted');
      navigate('/monitors');
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error', 'Failed to delete monitor');
    }
  };

  if (isLoading || !monitor) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-10">
        <div className="text-sm font-black text-zinc-500 dark:text-slate-400">
          Loading monitor details...
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 md:p-8 lg:p-10">
      <button
        type="button"
        onClick={() => navigate('/monitors')}
        className="flex items-center gap-1.5 text-xs font-black underline decoration-2 underline-offset-4 transition-transform hover:-translate-x-0.5"
      >
        <ArrowLeft className="size-3.5" /> Back to monitors
      </button>

      <div className="mt-5 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-black tracking-[-0.045em]">
              {monitor.name}
            </h1>
            <span className="flex self-center">
              <Badge status={monitor.status} />
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-slate-400">
            <span className="rounded-full border border-zinc-400 bg-white px-2.5 py-1 font-mono text-[10px] font-black dark:border-slate-600 dark:bg-retro-panel">
              {monitor.method}
            </span>
            <span className="font-mono text-xs">{monitor.url}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleInstantPing}
            disabled={isChecking || monitor.status === 'paused'}
            className="flex items-center gap-2 rounded-md border-2 border-zinc-950 bg-yellow-200 px-4 py-2.5 text-xs font-black text-zinc-950 shadow-[3px_3px_0_#18181b] transition-transform hover:-translate-y-0.5 disabled:opacity-45 dark:border-[#737c91] dark:bg-[#665c2f] dark:text-[#fff8df]"
          >
            <Activity className="size-4" />
            {isChecking ? 'Checking...' : 'Check now'}
          </button>
          <button
            type="button"
            onClick={handleToggle}
            className="flex items-center gap-2 rounded-md border-2 border-zinc-950 bg-retro-blue px-4 py-2.5 text-xs font-black text-zinc-950 shadow-[3px_3px_0_#18181b] transition-transform hover:-translate-y-0.5 dark:border-[#737c91] dark:bg-[#394b67] dark:text-slate-100"
          >
            {monitor.status === 'paused' ? (
              <Play className="size-4 fill-current" />
            ) : (
              <Pause className="size-4 fill-current" />
            )}
            {monitor.status === 'paused' ? 'Resume' : 'Pause'}
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 rounded-md border-2 border-zinc-950 bg-white px-4 py-2.5 text-xs font-black text-zinc-950 shadow-[3px_3px_0_#18181b] transition-transform hover:-translate-y-0.5 dark:border-[#737c91] dark:bg-retro-panel dark:text-[#f3eadc]"
          >
            <Edit3 className="size-4" /> Edit
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="grid size-10 place-items-center rounded-md border-2 border-red-800 bg-coral-soft text-red-950 transition-transform hover:-translate-y-0.5 dark:border-red-400 dark:bg-red-950 dark:text-red-200"
            aria-label="Delete monitor"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Last checked"
          value={formatRelativeTime(monitor.lastCheckedAt)}
          note={`${monitor.interval}s check interval`}
          color="bg-mint dark:bg-[#356b63]"
        />
        <Stat
          label="Latest latency"
          value={chartData.latestLatency}
          note="Most recent check"
          color="bg-retro-blue dark:bg-[#394b67]"
        />
        <Stat
          label="24h Availability"
          value={chartData.uptimePercentage}
          note="Rolling availability"
          color="bg-retro-lilac dark:bg-[#64557a]"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_.7fr]">
        <section className="rounded-lg border-2 border-zinc-950 bg-white p-5 dark:border-[#737c91] dark:bg-retro-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-black">Live latency</h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-slate-400">
                Response time history for this endpoint
              </p>
            </div>
            <div className="flex gap-1 rounded-md border border-zinc-950 bg-zinc-100 p-1 dark:border-[#737c91] dark:bg-slate-900">
              {(['1h', '24h', '7d'] as const).map((value) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setRange(value)}
                  className={`rounded-md px-3 py-1.5 text-[10px] font-black uppercase transition-colors ${
                    range === value
                      ? 'bg-yellow-300 text-zinc-950'
                      : 'text-zinc-500 dark:text-slate-400'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <svg
            className="mt-6 h-56 w-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {[20, 45, 70, 95].map((y) => (
              <line
                key={y}
                x1="0"
                x2="100"
                y1={y}
                y2={y}
                stroke="#d4d4d8"
                strokeWidth=".4"
                strokeDasharray="2 2"
              />
            ))}
            <polygon
              points={`0,100 ${chartData.points} 100,100`}
              fill="#65d6c4"
              opacity=".24"
            />
            <polyline
              points={chartData.points}
              fill="none"
              stroke="#18181b"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className="mt-2 flex justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-slate-400">
            <span>
              {range === '1h'
                ? '60 min ago'
                : range === '24h'
                  ? 'Yesterday'
                  : '7 days ago'}
            </span>
            <span>Now</span>
          </div>
        </section>

        <section className="rounded-lg border-2 border-zinc-950 bg-[#d7dda7] p-5 text-zinc-950 dark:border-[#718d84] dark:bg-[#304b45] dark:text-[#f3eadc]">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-black">SSL certificate</h2>
              <p className="mt-1 text-xs text-zinc-700 dark:text-slate-300">
                Automatic TLS inspection
              </p>
            </div>
            <Shield className="size-5" />
          </div>

          {!monitor.sslInfo ? (
            <div className="mt-8 rounded-md border-2 border-dashed border-zinc-700 p-5 text-center">
              <div className="font-black">
                {monitor.url.startsWith('http://') ? 'No SSL' : 'Scan pending'}
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-700 dark:text-slate-300">
                {monitor.url.startsWith('http://')
                  ? 'This endpoint uses HTTP and has no TLS certificate.'
                  : 'Certificate details will appear after the first check.'}
              </p>
            </div>
          ) : (
            <div className="mt-7 space-y-5">
              <div>
                <div className="text-xs text-zinc-700 dark:text-slate-300">
                  Issuer
                </div>
                <div className="mt-1 font-black">{monitor.sslInfo.issuer}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-700 dark:text-slate-300">
                  Valid to
                </div>
                <div className="mt-1 font-black">{formatDate(monitor.sslInfo.validTo)}</div>
              </div>
              <div>
                <div className="mb-2 flex justify-between text-xs">
                  <span>Time remaining</span>
                  <span className="font-black">{monitor.sslInfo.daysRemaining} days</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-950/20">
                  <div
                    style={{
                      width: `${Math.min(100, Math.max(5, (monitor.sslInfo.daysRemaining / 90) * 100))}%`,
                    }}
                    className={`h-full rounded-full ${
                      monitor.sslInfo.daysRemaining < 7
                        ? 'bg-red-600'
                        : monitor.sslInfo.daysRemaining < 30
                          ? 'bg-amber-600'
                          : 'bg-emerald-700'
                    }`}
                  />
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="mt-6 overflow-hidden rounded-lg border-2 border-zinc-950 bg-white dark:border-[#737c91] dark:bg-retro-panel">
        <div className="border-b-2 border-zinc-950 p-5 dark:border-[#737c91]">
          <h2 className="font-black">Recent pings</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-slate-400">
            Latest checks from the ping engine
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left">
            <thead className="bg-zinc-100 text-[10px] uppercase tracking-wider text-zinc-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="p-4">Timestamp</th>
                <th className="p-4">Status</th>
                <th className="p-4">Code</th>
                <th className="p-4">Latency</th>
                <th className="p-4">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-slate-700">
              {metrics.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sm font-bold text-zinc-500 dark:text-slate-400">
                    No recent checks recorded for this endpoint yet.
                  </td>
                </tr>
              ) : (
                metrics.slice(0, 10).map((metric) => (
                  <tr key={metric.id}>
                    <td className="p-4 font-mono text-xs">{formatRelativeTime(metric.timestamp)}</td>
                    <td className="p-4">
                      <Badge status={metric.isUp ? 'up' : 'down'} />
                    </td>
                    <td className="p-4 text-sm font-black">{metric.statusCode}</td>
                    <td className="p-4 text-sm font-mono">{metric.latency} ms</td>
                    <td className="p-4 text-xs text-zinc-500 dark:text-slate-400">
                      {metric.error ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-black">Incident history</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {incidents.length > 0 ? (
            incidents.map((item) => (
              <article
                key={item.id}
                className="rounded-lg border-2 border-zinc-950 bg-retro-lilac p-4 dark:border-[#737c91] dark:bg-[#58486e]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="font-black">
                    HTTP {item.errorDetails?.statusCode ?? 500} interruption
                  </div>
                  <Badge status={item.status} />
                </div>
                <div className="mt-4 flex justify-between text-xs text-zinc-600 dark:text-slate-300">
                  <span>{formatDate(item.startedAt)}</span>
                  <span>{item.resolvedAt ? `Resolved at ${formatDate(item.resolvedAt)}` : 'Ongoing outage'}</span>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-400 p-6 text-sm text-zinc-500 dark:text-slate-400">
              No incidents have been recorded for this monitor.
            </div>
          )}
        </div>
      </section>

      {editing && (
        <MonitorModal
          monitor={monitor}
          onClose={() => setEditing(false)}
          onSave={handleUpdate}
        />
      )}

      {confirmDelete && (
        <DeleteMonitorModal
          monitor={monitor}
          onClose={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
};
