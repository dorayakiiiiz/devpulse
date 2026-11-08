import React from 'react';
import { useAdmin } from '../../hooks/useAdmin';
import { Stat } from '../../components/common/Stat';
import { formatRelativeTime } from '../../lib/date';
import { RefreshCw } from 'lucide-react';

// Format uptime seconds into human-readable days, hours, and minutes
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

// System administration console displaying infrastructure telemetry, ping engine metrics, and buffer controls
export const AdminPage: React.FC = () => {
  const { overview, engineStatus, health, isLoading, error, isFlushing, flushBuffer, refresh } = useAdmin();

  if (error && (!overview || !engineStatus || !health)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-10">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <div className="rounded-lg border-2 border-zinc-950 bg-coral-soft p-6 shadow-retro dark:border-red-400 dark:bg-red-950">
            <h2 className="text-lg font-black text-red-950 dark:text-red-200">
              Failed to load administrative telemetry
            </h2>
            <p className="mt-2 text-xs text-red-900 dark:text-red-300">{error}</p>
            <button
              type="button"
              onClick={refresh}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md border-2 border-zinc-950 bg-white px-4 py-2 text-xs font-black text-zinc-950 shadow-retro dark:border-[#737c91] dark:bg-retro-panel dark:text-[#f3eadc]"
            >
              <RefreshCw className="size-3.5" />
              <span>Retry connection</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !overview || !engineStatus || !health) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-10">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 rounded-full border-4 border-zinc-950 border-t-retro-orange animate-spin dark:border-slate-700 dark:border-t-retro-orange" />
          <span className="text-sm font-black text-zinc-500 dark:text-slate-400">
            Loading system administration telemetry...
          </span>
        </div>
      </div>
    );
  }

  const isHealthy = health.status === 'ok' && health.database.status === 'connected';
  const heapUsagePercent = Math.min(
    100,
    Math.round((overview.systemMemory.heapUsedMB / Math.max(overview.systemMemory.heapTotalMB, 1)) * 100)
  );
  const heapTotalDisplay =
    overview.systemMemory.heapTotalMB >= 1024
      ? `${(overview.systemMemory.heapTotalMB / 1024).toFixed(1)} GB`
      : `${overview.systemMemory.heapTotalMB} MB`;

  return (
    <div className="p-5 md:p-8 lg:p-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-400">
            Restricted area
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.045em] text-zinc-950 dark:text-[#f3eadc]">
            System admin
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-slate-400">
            Infrastructure health and ping engine control.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={refresh}
            title="Refresh administrative data"
            className="flex h-[42px] items-center gap-1.5 rounded-md border-2 border-zinc-950 bg-white px-3.5 text-xs font-black text-zinc-950 shadow-[2.5px_2.5px_0_#18181b] transition-all hover:translate-x-[1px] hover:translate-y-[1px] dark:border-[#737c91] dark:bg-retro-panel dark:text-[#f3eadc] dark:shadow-[2.5px_2.5px_0_#090b10]"
          >
            <RefreshCw className="size-3.5" />
            <span>Refresh</span>
          </button>

          <div
            className={`flex h-[42px] items-center gap-2 rounded-md border-2 border-zinc-950 px-4 text-xs font-black shadow-[2.5px_2.5px_0_#18181b] dark:border-[#737c91] dark:shadow-[2.5px_2.5px_0_#090b10] ${
              isHealthy
                ? 'bg-mint text-zinc-950 dark:bg-[#295b55] dark:text-[#f3fff9]'
                : 'bg-coral-soft text-zinc-950 dark:bg-[#713f3b] dark:text-[#f3eadc]'
            }`}
          >
            <span
              className={`size-2 rounded-full ${
                isHealthy ? 'bg-emerald-600 animate-pulse' : 'bg-red-600'
              }`}
            />
            {isHealthy ? 'All systems healthy' : 'System degraded'}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Registered users"
          value={overview.counts.totalUsers.toLocaleString()}
          note="Platform accounts"
          color="bg-retro-blue dark:bg-[#394b67]"
        />
        <Stat
          label="Active monitors"
          value={overview.counts.activeMonitors.toLocaleString()}
          note={`of ${overview.counts.totalMonitors.toLocaleString()} total`}
          color="bg-mint dark:bg-[#356b63]"
        />
        <Stat
          label="Buffer records"
          value={String(engineStatus.bufferSize)}
          note="flushes at 100 / 5 sec"
          color="bg-yellow-200 dark:bg-[#665c2f]"
        />
        <Stat
          label="Server memory"
          value={`${overview.systemMemory.heapUsedMB} MB`}
          note={`${heapUsagePercent}% of ${heapTotalDisplay} heap`}
          color="bg-coral-soft dark:bg-[#713f3b]"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {/* Ping Engine Diagnostics and Manual Buffer Flush Card */}
        <section className="overflow-hidden rounded-lg border-2 border-zinc-950 bg-white dark:border-[#737c91] dark:bg-retro-panel">
          <div className="border-b-2 border-zinc-950 p-5 dark:border-[#737c91]">
            <h2 className="font-black text-zinc-950 dark:text-[#f3eadc]">Ping engine</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-slate-400">
              Scheduler and ingestion pipeline
            </p>
          </div>

          <div className="grid grid-cols-2 gap-px bg-zinc-200 dark:bg-slate-700">
            <div className="bg-white p-5 dark:bg-retro-panel">
              <div className="text-xs text-zinc-500 dark:text-slate-400">Concurrency</div>
              <div className="mt-2 text-xl font-black text-zinc-950 dark:text-[#f3eadc]">
                {engineStatus.concurrencyLimit} / {engineStatus.concurrencyLimit}
              </div>
            </div>

            <div className="bg-white p-5 dark:bg-retro-panel">
              <div className="text-xs text-zinc-500 dark:text-slate-400">Pacing delay</div>
              <div className="mt-2 text-xl font-black text-zinc-950 dark:text-[#f3eadc]">100 ms</div>
            </div>

            <div className="bg-white p-5 dark:bg-retro-panel">
              <div className="text-xs text-zinc-500 dark:text-slate-400">Last flush</div>
              <div className="mt-2 text-xl font-black text-zinc-950 dark:text-[#f3eadc]">
                {formatRelativeTime(engineStatus.lastFlushAt)}
              </div>
            </div>

            <div className="bg-white p-5 dark:bg-retro-panel">
              <div className="text-xs text-zinc-500 dark:text-slate-400">Write mode</div>
              <div className="mt-2 text-xl font-black text-zinc-950 dark:text-[#f3eadc]">
                Unordered bulkWrite
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t-2 border-zinc-950 p-5 dark:border-[#737c91]">
            <span className="text-xs text-zinc-500 dark:text-slate-400">
              {engineStatus.bufferSize} metrics waiting in RAM
            </span>
            <button
              type="button"
              onClick={flushBuffer}
              disabled={engineStatus.bufferSize === 0 || isFlushing}
              className="rounded-md border-2 border-zinc-950 bg-cyan-300 px-4 py-2 text-xs font-black text-zinc-950 shadow-[3px_3px_0_#18181b] transition-all hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-40 disabled:pointer-events-none dark:border-[#737c91] dark:bg-cyan-200 dark:shadow-[3px_3px_0_#090b10]"
            >
              {isFlushing ? 'Flushing buffer...' : 'Flush buffer now'}
            </button>
          </div>
        </section>

        {/* Live Container Health and Resource Meter Section */}
        <section className="rounded-lg border-2 border-zinc-950 bg-[#d7dda7] p-6 text-zinc-950 dark:border-[#718d84] dark:bg-[#304b45] dark:text-[#f3eadc]">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="font-black text-base">Health endpoint</h2>
              <p className="mt-1 text-xs font-medium text-zinc-700 dark:text-slate-300">
                GET /api/health • {health.status === 'ok' ? '200 OK' : '503 Error'}
              </p>
            </div>
            <span
              className={`size-3 rounded-full ${
                health.status === 'ok'
                  ? 'bg-emerald-500 shadow-[0_0_0_5px_rgba(52,211,153,.2)]'
                  : 'bg-red-500 shadow-[0_0_0_5px_rgba(239,68,68,.2)]'
              }`}
            />
          </div>

          <div className="mt-7 space-y-5">
            <div>
              <div className="mb-2 flex justify-between text-xs">
                <span className="font-medium text-zinc-700 dark:text-slate-300">MongoDB</span>
                <span className="font-bold">
                  {health.database.status === 'connected'
                    ? `Connected • ${health.database.pingMs}ms`
                    : 'Disconnected'}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full border border-zinc-950/30 bg-black/10 dark:border-white/20 dark:bg-black/30">
                <div
                  className="h-full bg-zinc-950 transition-all dark:bg-[#f3eadc]"
                  style={{
                    width: health.database.status === 'connected' ? '96%' : '0%',
                  }}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex justify-between text-xs">
                <span className="font-medium text-zinc-700 dark:text-slate-300">Heap usage</span>
                <span className="font-bold">
                  {health.memory.heapUsedMB} / {health.memory.heapTotalMB} MB
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full border border-zinc-950/30 bg-black/10 dark:border-white/20 dark:bg-black/30">
                <div
                  className="h-full bg-zinc-950 transition-all dark:bg-[#f3eadc]"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((health.memory.heapUsedMB / Math.max(health.memory.heapTotalMB, 1)) * 100)
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex justify-between text-xs">
                <span className="font-medium text-zinc-700 dark:text-slate-300">RSS memory</span>
                <span className="font-bold">{health.memory.rssMB} MB</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full border border-zinc-950/30 bg-black/10 dark:border-white/20 dark:bg-black/30">
                <div
                  className="h-full bg-zinc-950 transition-all dark:bg-[#f3eadc]"
                  style={{
                    width: `${Math.min(100, Math.round((health.memory.rssMB / 512) * 100))}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-zinc-700 dark:text-slate-300">Server uptime</span>
                <span className="font-bold flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" />
                  {formatUptime(health.uptimeSeconds)}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
