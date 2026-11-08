import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, AlertTriangle, Plus } from 'lucide-react';
import { useOverview } from '../../hooks/useOverview';
import { Stat } from '../../components/common/Stat';
import { Badge } from '../../components/common/Badge';
import { formatRelativeTime } from '../../lib/date';

// Central dashboard overview displaying macro system health, primary latency stream, and active incidents
export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    monitors,
    primaryMonitor,
    macroStats,
    chartData,
    ongoingIncident,
    isLoading,
    error,
    refresh,
  } = useOverview();

  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  if (isLoading && monitors.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-10">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 rounded-full border-4 border-zinc-950 border-t-retro-orange animate-spin dark:border-slate-700 dark:border-t-retro-orange" />
          <span className="text-sm font-black text-zinc-500 dark:text-slate-400">
            Loading overview telemetry...
          </span>
        </div>
      </div>
    );
  }

  if (error && monitors.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-10">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <div className="rounded-lg border-2 border-zinc-950 bg-coral-soft p-6 shadow-retro dark:border-red-400 dark:bg-red-950">
            <h2 className="text-lg font-black text-red-950 dark:text-red-200">
              Failed to load overview data
            </h2>
            <p className="mt-2 text-xs text-red-900 dark:text-red-300">{error}</p>
            <button
              type="button"
              onClick={refresh}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md border-2 border-zinc-950 bg-white px-4 py-2 text-xs font-black text-zinc-950 shadow-retro dark:border-[#737c91] dark:bg-retro-panel dark:text-[#f3eadc]"
            >
              <span>Retry</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasIncidents = ongoingIncident !== null;
  const headlineNotice = hasIncidents
    ? 'One or more incidents require attention.'
    : monitors.length === 0
      ? 'No monitor endpoints configured yet.'
      : 'All monitored services are healthy and operational.';

  return (
    <div className="p-5 md:p-8 lg:p-10">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-400">
            {todayFormatted}
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.045em] md:text-5xl">
            Everything, at a glance.
          </h1>
        </div>
        <p className="max-w-sm text-sm leading-6 text-zinc-500 dark:text-slate-400">
          {headlineNotice}
        </p>
      </div>

      {/* 4 Macro Stat Cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Global uptime"
          value={macroStats.globalUptime}
          note="Rolling 24h availability"
          color="bg-mint dark:bg-[#356b63]"
        />
        <Stat
          label="Avg. latency"
          value={macroStats.avgLatency}
          note={primaryMonitor ? `${primaryMonitor.name} recent latency` : 'Awaiting checks'}
          color="bg-retro-lilac dark:bg-[#64557a]"
        />
        <Stat
          label="Active monitors"
          value={`${macroStats.activeMonitorsCount} / ${macroStats.totalMonitorsCount}`}
          note={`${macroStats.totalMonitorsCount - macroStats.activeMonitorsCount} paused`}
          color="bg-yellow-200 dark:bg-[#665c2f]"
        />
        <Stat
          label="Open incidents"
          value={String(macroStats.openIncidentsCount)}
          note={hasIncidents ? ongoingIncident.monitorName : 'All clear'}
          color={hasIncidents ? 'bg-coral-soft dark:bg-[#713f3b]' : 'bg-mint dark:bg-[#356b63]'}
        />
      </div>

      {/* Primary Telemetry & Current Incident Split View */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        {/* Live Latency SVG Chart Card */}
        <section className="rounded-lg border-2 border-zinc-950 bg-white p-5 dark:border-[#737c91] dark:bg-retro-panel md:p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-black">Live latency</h2>
              <p className="mt-1 text-xs font-medium text-zinc-700 dark:text-slate-300">
                {primaryMonitor
                  ? `${primaryMonitor.name} · last 20 checks`
                  : 'No active monitors available'}
              </p>
            </div>
            {primaryMonitor && (
              <div className="text-right">
                <div className="text-xl font-black">{chartData.latestLatency}</div>
                <div
                  className={`text-xs font-bold ${
                    chartData.isHealthy
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-red-700 dark:text-red-400'
                  }`}
                >
                  {chartData.isHealthy ? 'Healthy' : 'Degraded'}
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 h-52 w-full">
            <svg
              className="h-full w-full overflow-visible"
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
                opacity=".22"
              />
              <polyline
                points={chartData.points}
                fill="none"
                stroke="#18181b"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>

          <div className="mt-2 flex justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-slate-400">
            {chartData.timeLabels.map((lbl, idx) => (
              <span key={idx}>{lbl}</span>
            ))}
          </div>
        </section>

        {/* Current Incident or Operational Status Card */}
        {hasIncidents ? (
          <section className="flex flex-col justify-between rounded-lg border-2 border-zinc-950 bg-retro-orange p-5 text-zinc-950 dark:border-[#737c91] dark:bg-[#713f3b] dark:text-[#f3eadc] md:p-6">
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black">Current incident</h2>
                  <p className="mt-1 text-xs text-zinc-700 dark:text-slate-300">
                    Detected {formatRelativeTime(ongoingIncident.startedAt)}
                  </p>
                </div>
                <Badge status="ongoing" />
              </div>

              <div className="my-5 border-y border-zinc-900/30 py-5 dark:border-white/20">
                <div className="text-base font-black">
                  {ongoingIncident.monitorName} service interruption
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-800 dark:text-slate-200">
                  {ongoingIncident.errorDetails.errorMessage}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-700 dark:text-slate-300">
                {ongoingIncident.aiPostMortem ? 'AI analysis ready' : 'Diagnosis in progress'}
              </span>
              <button
                type="button"
                onClick={() => navigate(`/incidents?id=${ongoingIncident.id}`)}
                className="flex items-center gap-1 font-black text-zinc-950 underline decoration-2 underline-offset-4 dark:text-cyan-200"
              >
                <span>View report</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </section>
        ) : (
          <section className="flex flex-col justify-between rounded-lg border-2 border-zinc-950 bg-mint p-5 text-zinc-950 dark:border-[#737c91] dark:bg-[#295b55] dark:text-[#f3fff9] md:p-6">
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black">All systems operational</h2>
                  <p className="mt-1 text-xs opacity-80">
                    No active service disruptions detected
                  </p>
                </div>
                <div className="grid size-9 place-items-center rounded-full border-2 border-zinc-950 bg-white text-zinc-950 dark:border-[#737c91] dark:bg-retro-panel">
                  <Check className="size-5 text-emerald-600 stroke-[3]" />
                </div>
              </div>

              <div className="my-5 border-y border-zinc-900/20 py-5 dark:border-white/20">
                <div className="text-base font-black">Normal state across all targets</div>
                <p className="mt-2 text-sm leading-6 opacity-85">
                  The automated ping engine is continuously monitoring response status, TLS certificate validity, and endpoint latency.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-bold">
              <span className="opacity-75">Checked continuously</span>
              <button
                type="button"
                onClick={() => navigate('/incidents')}
                className="flex items-center gap-1 underline decoration-2 underline-offset-4"
              >
                <span>Incident history</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </section>
        )}
      </div>

      {/* Recent Monitors List */}
      <section className="mt-6 overflow-hidden rounded-lg border-2 border-zinc-950 bg-white dark:border-[#737c91] dark:bg-retro-panel">
        <div className="flex items-center justify-between border-b-2 border-zinc-950 p-5 dark:border-[#737c91]">
          <div>
            <h2 className="text-lg font-black">Your monitors</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-slate-400">
              Realtime status across your monitored endpoints
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/monitors')}
            className="text-xs font-black underline decoration-2 underline-offset-4"
          >
            View all
          </button>
        </div>

        {monitors.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-full border-2 border-zinc-950 bg-yellow-200">
              <AlertTriangle className="size-6 text-zinc-950" />
            </div>
            <h3 className="mt-4 font-black">No monitors yet</h3>
            <p className="mt-1 text-xs text-zinc-500 dark:text-slate-400">
              Add your first endpoint to start tracking uptime and latency.
            </p>
            <button
              type="button"
              onClick={() => navigate('/monitors')}
              className="mt-5 inline-flex items-center gap-1.5 rounded-md border-2 border-zinc-950 bg-coral px-4 py-2 text-xs font-black text-zinc-950 shadow-retro transition-transform hover:-translate-y-0.5"
            >
              <Plus className="size-4 stroke-[3]" /> Add monitor
            </button>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-slate-700">
            {monitors.slice(0, 4).map((m) => (
              <div
                key={m.id}
                className="grid items-center gap-3 p-4 transition-colors hover:bg-yellow-50/60 dark:hover:bg-slate-800/60 sm:grid-cols-[1.5fr_.7fr_.7fr_auto] sm:px-5"
              >
                <div>
                  <button
                    type="button"
                    onClick={() => navigate(`/monitors/${m.id}`)}
                    className="text-left font-black underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
                  >
                    {m.name}
                  </button>
                  <div className="mt-1 max-w-sm truncate font-mono text-xs text-zinc-500 dark:text-slate-400">
                    {m.url}
                  </div>
                </div>

                <div>
                  <Badge status={m.status} />
                </div>

                <div>
                  <div className="text-xs font-bold text-zinc-500 dark:text-slate-400">
                    {formatRelativeTime(m.lastCheckedAt)}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-zinc-400 dark:text-slate-500">
                    Every {m.interval}s
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate(`/monitors/${m.id}`)}
                  title={`View ${m.name} telemetry`}
                  className="grid size-9 place-items-center rounded-md border border-zinc-950 bg-white transition-transform hover:-translate-y-0.5 dark:border-[#737c91] dark:bg-retro-panel"
                >
                  <ArrowRight className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
