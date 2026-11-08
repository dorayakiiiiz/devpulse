import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Check, AlertTriangle, ArrowLeft } from 'lucide-react';
import { usePublicStatus } from '../../hooks/usePublicStatus';
import { useAuthStore } from '../../stores/authStore';
import { Logo } from '../../components/common/Logo';
import { ThemeToggle } from '../../components/common/ThemeToggle';
import { Badge } from '../../components/common/Badge';
import { formatRelativeTime, formatDate, formatDuration } from '../../lib/date';

// Public status page view rendering system component statuses, uptime bars, and incident bulletins
export const PublicStatusPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data, overallUptime, isLoading, error, isNotFound, refresh } = usePublicStatus(slug);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (isLoading && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream text-zinc-950 dark:bg-retro-night dark:text-[#f3eadc]">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 rounded-full border-4 border-zinc-950 border-t-retro-orange animate-spin dark:border-slate-700 dark:border-t-retro-orange" />
          <span className="text-sm font-black text-zinc-500 dark:text-slate-400">
            Loading public status page...
          </span>
        </div>
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="min-h-screen bg-cream text-zinc-950 dark:bg-retro-night dark:text-[#f3eadc]">
        <header className="border-b-2 border-zinc-950 bg-white px-6 py-4 dark:border-[#737c91] dark:bg-retro-panel">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <Logo />
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto max-w-lg p-6 pt-24 text-center">
          <div className="overflow-hidden rounded-lg border-2 border-zinc-950 bg-white p-8 shadow-retro-md dark:border-[#737c91] dark:bg-retro-panel dark:shadow-retro-dark">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-coral-soft text-zinc-950">
              <AlertTriangle className="size-6" />
            </div>
            <h1 className="mt-4 text-2xl font-black text-zinc-950 dark:text-[#f3eadc]">
              Status Page Not Found
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-slate-300">
              The public telemetry page for <span className="font-bold">/{slug}</span> does not exist or has been removed.
            </p>
            <div className="mt-6">
              <Link
                to={isAuthenticated ? '/' : '/auth'}
                className="inline-flex items-center gap-2 rounded-md border-2 border-zinc-950 bg-cyan-300 px-4 py-2.5 text-xs font-black text-zinc-950 shadow-retro transition-all hover:translate-x-[1px] hover:translate-y-[1px] dark:border-[#737c91] dark:bg-cyan-200"
              >
                <ArrowLeft className="size-4" />
                <span>{isAuthenticated ? 'Back to Dashboard' : 'Go to DevPulse'}</span>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-cream text-zinc-950 dark:bg-retro-night dark:text-[#f3eadc]">
        <header className="border-b-2 border-zinc-950 bg-white px-6 py-4 dark:border-[#737c91] dark:bg-retro-panel">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <Logo />
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto max-w-lg p-6 pt-24 text-center">
          <div className="overflow-hidden rounded-lg border-2 border-zinc-950 bg-white p-8 shadow-retro-md dark:border-[#737c91] dark:bg-retro-panel dark:shadow-retro-dark">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-coral-soft text-zinc-950">
              <AlertTriangle className="size-6" />
            </div>
            <h1 className="mt-4 text-2xl font-black text-zinc-950 dark:text-[#f3eadc]">
              Service Unavailable
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-slate-300">
              {error ?? 'Could not connect to the status service. Please try again later.'}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={refresh}
                className="inline-flex items-center gap-2 rounded-md border-2 border-zinc-950 bg-cyan-300 px-4 py-2.5 text-xs font-black text-zinc-950 shadow-retro transition-all hover:translate-x-[1px] hover:translate-y-[1px] dark:border-[#737c91] dark:bg-cyan-200"
              >
                Retry
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const isAllOperational = data.systemStatus === 'all_operational';
  const isPartialOutage = data.systemStatus === 'partial_outage';

  return (
    <div className="min-h-screen bg-cream text-zinc-950 dark:bg-retro-night dark:text-[#f3eadc]">
      <header className="border-b-2 border-zinc-950 bg-white dark:border-[#737c91] dark:bg-retro-panel">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-zinc-500 dark:text-slate-400 sm:block">
              Cached {formatRelativeTime(data.cachedAt)}
            </span>
            <ThemeToggle />
            {isAuthenticated && (
              <Link
                to="/"
                className="rounded-md border-2 border-zinc-950 bg-white px-3.5 py-2 text-xs font-black text-zinc-950 shadow-retro transition-all hover:translate-x-[1px] hover:translate-y-[1px] dark:border-[#737c91] dark:bg-retro-panel dark:text-[#f3eadc]"
              >
                Dashboard
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10 md:py-16 space-y-12">
        {/* Overall System Health Status Banner */}
        <div
          className={`rounded-lg border-2 border-zinc-950 p-6 text-zinc-950 shadow-[6px_6px_0_#18181b] dark:border-[#737c91] dark:shadow-[6px_6px_0_#090b10] md:flex md:items-center md:justify-between md:p-8 ${
            isAllOperational
              ? 'bg-mint dark:bg-[#295b55] dark:text-[#f3fff9]'
              : isPartialOutage
                ? 'bg-yellow-200 dark:bg-[#665c2f] dark:text-[#fff8df]'
                : 'bg-coral-soft dark:bg-[#713f3b] dark:text-[#f3eadc]'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="grid size-11 shrink-0 place-items-center border-2 border-zinc-950 bg-white dark:border-[#737c91] dark:bg-retro-panel">
              {isAllOperational ? (
                <Check className="size-6 text-zinc-950 dark:text-[#f3fff9]" />
              ) : (
                <AlertTriangle className="size-6 text-zinc-950 dark:text-[#f3eadc]" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">
                {isAllOperational
                  ? 'All systems operational'
                  : isPartialOutage
                    ? 'Partial system outage'
                    : 'Major system outage'}
              </h1>
              <p className="mt-2 text-sm text-zinc-700 dark:text-slate-200">
                {isAllOperational
                  ? `${data.systemName} services are running normally.`
                  : `${data.systemName} is experiencing service interruptions.`}
              </p>
            </div>
          </div>

          <div className="mt-5 text-sm font-black md:mt-0">
            {overallUptime}%{' '}
            <span className="font-normal text-zinc-700 dark:text-slate-300">
              overall uptime
            </span>
          </div>
        </div>

        {/* Live Services Availability Section */}
        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-400">
                Live availability
              </p>
              <h2 className="mt-2 text-2xl font-black text-zinc-950 dark:text-[#f3eadc]">
                Services
              </h2>
            </div>
            <span className="flex items-center gap-2 text-xs font-bold text-zinc-950 dark:text-[#f3eadc]">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" /> Live
            </span>
          </div>

          <div className="overflow-hidden rounded-lg border-2 border-zinc-950 bg-white dark:border-[#737c91] dark:bg-retro-panel">
            {data.monitors.length === 0 ? (
              <div className="p-8 text-center text-sm font-bold text-zinc-500 dark:text-slate-400">
                No active services are configured on this status page.
              </div>
            ) : (
              data.monitors.map((monitor, index) => {
                const totalSlots = 28;
                const pings = monitor.recentPings;
                const emptySlotsCount = Math.max(0, totalSlots - pings.length);

                return (
                  <div
                    key={monitor.name}
                    className={`p-5 ${
                      index < data.monitors.length - 1
                        ? 'border-b-2 border-zinc-950 dark:border-[#737c91]'
                        : ''
                    }`}
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <div className="font-black text-zinc-950 dark:text-[#f3eadc]">
                          {monitor.name}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500 dark:text-slate-400">
                          Checked {formatRelativeTime(monitor.lastCheckedAt)}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-black text-zinc-950 dark:text-[#f3eadc]">
                            {monitor.uptimePercentage24h}%
                          </div>
                          <div className="text-[10px] text-zinc-400 dark:text-slate-400">
                            24h uptime
                          </div>
                        </div>
                        <Badge status={monitor.status} />
                      </div>
                    </div>

                    {/* 28-Segment Real-time Heartbeat Blocks showing real probe checks */}
                    <div className="mt-4 flex gap-1">
                      {/* Empty slots for newly created monitors with fewer than 28 checks */}
                      {Array.from({ length: emptySlotsCount }, (_, emptyIdx) => (
                        <span
                          key={`empty-${emptyIdx}`}
                          title="No check data recorded yet"
                          className="h-6 flex-1 border border-dashed border-zinc-300 bg-zinc-100/60 dark:border-slate-700 dark:bg-slate-800/40"
                        />
                      ))}

                      {/* Real check blocks with precise hover telemetry */}
                      {pings.map((ping, pingIdx) => {
                        const timeStr = new Date(ping.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        });
                        const tooltip = `${timeStr} • ${ping.latency} ms • ${
                          ping.isUp ? 'UP' : 'Probe failed'
                        }`;

                        return (
                          <span
                            key={`ping-${pingIdx}-${ping.timestamp}`}
                            title={tooltip}
                            className={`h-6 flex-1 border border-zinc-950 transition-transform hover:scale-110 dark:border-[#737c91]/40 ${
                              ping.isUp
                                ? 'bg-emerald-400 hover:bg-emerald-300 dark:bg-emerald-500'
                                : 'bg-coral-soft hover:bg-red-400 dark:bg-[#ff8585]'
                            }`}
                          />
                        );
                      })}
                    </div>

                    <div className="mt-1.5 flex justify-between text-[10px] font-bold text-zinc-400 dark:text-slate-500">
                      <span>
                        {pings.length > 0
                          ? `Last ${pings.length} checks recorded`
                          : 'Awaiting first probe'}
                      </span>
                      <span>Latest check</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Incident History Past 7 Days Section */}
        <section>
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-400">
              Past 7 days
            </p>
            <h2 className="mt-2 text-2xl font-black text-zinc-950 dark:text-[#f3eadc]">
              Incident history
            </h2>
          </div>

          <div className="space-y-4">
            {data.recentIncidents.map((incident) => (
              <article
                key={incident.id}
                className="rounded-lg border-2 border-zinc-950 bg-retro-lilac p-5 dark:border-[#737c91] dark:bg-[#64557a]"
              >
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div>
                    <div className="font-black text-zinc-950 dark:text-[#f3eadc]">
                      {incident.monitorName}: {incident.errorMessage}
                    </div>
                    {incident.aiSummary && (
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-700 dark:text-slate-200">
                        {incident.aiSummary}
                      </p>
                    )}
                  </div>
                  <Badge status={incident.status} />
                </div>
                <div className="mt-4 text-xs font-medium text-zinc-600 dark:text-slate-300">
                  {formatDate(incident.startedAt)} •{' '}
                  {incident.status === 'resolved'
                    ? `Resolved after ${formatDuration(incident.startedAt, incident.resolvedAt)}`
                    : 'Ongoing incident'}
                </div>
              </article>
            ))}

            <div className="rounded-lg border border-dashed border-zinc-400 p-5 text-center text-sm font-medium text-zinc-500 dark:border-slate-600 dark:text-slate-400">
              {data.recentIncidents.length === 0
                ? 'No incidents reported in the last 7 days.'
                : 'No other incidents reported in the last 7 days.'}
            </div>
          </div>
        </section>

        <footer className="mt-16 flex flex-col justify-between gap-3 border-t-2 border-zinc-950 pt-6 text-xs text-zinc-500 dark:border-[#737c91] dark:text-slate-400 sm:flex-row">
          <span>Powered by DevPulse</span>
          <span>Cache refreshed every 30 seconds</span>
        </footer>
      </main>
    </div>
  );
};
