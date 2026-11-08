import React, { useState } from 'react';
import { Sparkles, Check, ChevronDown } from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { useIncidents } from '../../hooks/useIncidents';
import { formatRelativeTime, formatDuration } from '../../lib/date';
import { IncidentStatus } from '../../types/incident';

// Incidents investigation view container displaying event timeline, root-cause diagnostics, and AI post-mortems
export const IncidentsPage: React.FC = () => {
  const {
    incidents,
    filteredIncidents,
    selectedIncident,
    selectedId,
    filter,
    isLoading,
    isResolving,
    isReanalyzing,
    setFilter,
    setSelectedId,
    resolveIncident,
    reanalyzeIncident,
  } = useIncidents();

  const [rawOpen, setRawOpen] = useState(false);

  const ongoingCount = incidents.filter((item) => item.status === 'ongoing').length;
  const resolvedCount = incidents.filter((item) => item.status === 'resolved').length;

  return (
    <div className="p-5 md:p-8 lg:p-10">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-400">
          Event history
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-[-0.045em]">
          Incidents
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-slate-400">
          What happened, why it happened, and what to do next.
        </p>
      </div>

      <div className="mt-8 grid items-stretch gap-6 xl:grid-cols-[.8fr_1.4fr]">
        {/* Left column: Incident timeline list with capped height and retro scrollbar */}
        <section className="flex flex-col self-stretch overflow-hidden rounded-lg border-2 border-zinc-950 bg-white shadow-retro dark:border-[#737c91] dark:bg-retro-panel max-h-[460px] xl:max-h-[460px]">
          <div className="shrink-0 border-b-2 border-zinc-950 p-3 dark:border-[#737c91]">
            <div className="px-1 text-xs font-black uppercase tracking-wider">
              Incident timeline
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1 rounded-md bg-zinc-100 p-1 dark:bg-slate-900">
              {(['ongoing', 'resolved'] as const).map((statusValue: IncidentStatus) => {
                const count = statusValue === 'ongoing' ? ongoingCount : resolvedCount;
                const isActive = filter === statusValue;
                return (
                  <button
                    type="button"
                    key={statusValue}
                    onClick={() => setFilter(statusValue)}
                    className={`rounded-md px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-colors ${
                      isActive
                        ? 'bg-yellow-300 text-zinc-950'
                        : 'text-zinc-500 hover:text-zinc-950 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    {statusValue} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          <div className="retro-scrollbar min-h-0 flex-1 divide-y divide-zinc-200 overflow-y-auto dark:divide-slate-700">
            {isLoading ? (
              <div className="p-6 text-center text-sm font-bold text-zinc-500 dark:text-slate-400">
                Loading incidents...
              </div>
            ) : filteredIncidents.length === 0 ? (
              <div className="p-6 text-center text-sm font-bold text-zinc-500 dark:text-slate-400">
                No {filter} incidents.
              </div>
            ) : (
              filteredIncidents.map((item) => {
                const isSelected = selectedId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full p-4 text-left transition-colors ${
                      isSelected
                        ? 'bg-yellow-200 text-zinc-950 dark:bg-amber-200 dark:text-zinc-950'
                        : 'hover:bg-yellow-50 dark:hover:bg-slate-700/60'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="font-black">{item.monitorName}</div>
                      <Badge status={item.status} />
                    </div>
                    <div
                      className={`mt-3 flex justify-between text-xs ${
                        isSelected
                          ? 'text-zinc-700 dark:text-zinc-700'
                          : 'text-zinc-500 dark:text-slate-400'
                      }`}
                    >
                      <span>Started: {formatRelativeTime(item.startedAt)}</span>
                      <span>
                        Duration: {formatDuration(item.startedAt, item.resolvedAt)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Right column: Selected incident inspection and AI post-mortem */}
        {selectedIncident ? (
          <section className="space-y-5">
            <div className="rounded-lg border-2 border-zinc-950 bg-retro-blue p-6 text-zinc-950 dark:border-[#737c91] dark:bg-[#394b67] dark:text-[#f3eadc]">
              <div className="flex flex-col justify-between gap-4 sm:flex-row">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge status={selectedIncident.status} />
                    <span className="font-mono text-xs font-bold text-zinc-700 dark:text-slate-300">
                      {selectedIncident.errorDetails.statusCode > 0
                        ? `HTTP ${selectedIncident.errorDetails.statusCode}`
                        : selectedIncident.errorDetails.errorMessage}
                    </span>
                  </div>
                  <h2 className="mt-4 text-2xl font-black">
                    {selectedIncident.monitorName} service interruption
                  </h2>
                  <p className="mt-1 font-mono text-xs text-zinc-700 dark:text-slate-300">
                    {selectedIncident.errorDetails.errorMessage}
                  </p>
                </div>

                <div className="flex flex-col items-start gap-4 sm:items-end">
                  {selectedIncident.status === 'ongoing' && (
                    <button
                      type="button"
                      disabled={isResolving}
                      onClick={() => resolveIncident(selectedIncident.id)}
                      className="flex items-center gap-2 rounded-md border-2 border-zinc-950 bg-mint px-4 py-2 text-xs font-black text-zinc-950 shadow-[3px_3px_0_#18181b] transition-transform hover:-translate-y-0.5 disabled:opacity-50 dark:border-[#737c91] dark:bg-[#356b63] dark:text-[#f3eadc]"
                    >
                      <Check className="size-4 stroke-[3]" />
                      {isResolving ? 'Resolving...' : 'Mark as resolved'}
                    </button>
                  )}
                  <div className="grid grid-cols-2 gap-5 text-sm">
                    <div>
                      <div className="text-xs text-zinc-700 dark:text-slate-400">
                        Started
                      </div>
                      <div className="mt-1 font-black">
                        {formatRelativeTime(selectedIncident.startedAt)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-700 dark:text-slate-400">
                        Duration
                      </div>
                      <div className="mt-1 font-black">
                        {formatDuration(selectedIncident.startedAt, selectedIncident.resolvedAt)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI post-mortem diagnostic section */}
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="grid size-7 place-items-center border border-zinc-950 bg-violet-300 text-zinc-950 dark:border-[#737c91]">
                  <Sparkles className="size-4" />
                </div>
                <h3 className="font-black">AI post-mortem</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-slate-400">
                  {selectedIncident.aiPostMortem?.generatedAt
                    ? `Generated ${formatRelativeTime(selectedIncident.aiPostMortem.generatedAt)}`
                    : 'Awaiting generation'}
                </span>
                <button
                  type="button"
                  onClick={() => reanalyzeIncident(selectedIncident.id)}
                  disabled={isReanalyzing}
                  className="ml-auto flex items-center gap-1.5 rounded-md border border-zinc-950 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-transform hover:-translate-y-0.5 disabled:opacity-50 dark:border-[#737c91] dark:bg-retro-panel"
                >
                  <Sparkles
                    className={`size-3.5 ${isReanalyzing ? 'animate-spin' : ''}`}
                  />
                  {isReanalyzing ? 'Analyzing...' : 'Regenerate'}
                </button>
              </div>

              {selectedIncident.aiPostMortem ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <article className="rounded-lg border-2 border-zinc-950 bg-retro-lilac p-4 text-zinc-950 dark:border-[#8f83a6] dark:bg-[#58486e] dark:text-[#fff8ed]">
                    <div className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-[#ded3ed]">
                      Summary
                    </div>
                    <p className="mt-3 text-sm leading-6">
                      {selectedIncident.aiPostMortem.summary}
                    </p>
                  </article>

                  <article className="rounded-lg border-2 border-zinc-950 bg-coral-soft p-4 text-zinc-950 dark:border-[#a96d72] dark:bg-[#663b43] dark:text-[#fff5ed]">
                    <div className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-[#ffd0c8]">
                      Root cause
                    </div>
                    <p className="mt-3 text-sm leading-6">
                      {selectedIncident.aiPostMortem.rootCause}
                    </p>
                  </article>

                  <article className="rounded-lg border-2 border-zinc-950 bg-mint p-4 text-zinc-950 dark:border-[#6b9b91] dark:bg-[#295b55] dark:text-[#f3fff9]">
                    <div className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-[#bce8de]">
                      Action items
                    </div>
                    <ul className="mt-3 space-y-2 text-sm">
                      {selectedIncident.aiPostMortem.actionItems.map((action, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <Check className="mt-0.5 size-4 shrink-0 stroke-[3]" />
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                </div>
              ) : (
                <div className="rounded-lg border-2 border-dashed border-zinc-400 p-6 text-center text-sm font-bold text-zinc-500 dark:border-slate-700 dark:text-slate-400">
                  AI post-mortem analysis pending or unavailable. Click &quot;Regenerate&quot; to run AI root-cause analysis.
                </div>
              )}
            </div>

            {/* Technical error data collapsible accordion */}
            <div className="overflow-hidden rounded-lg border-2 border-zinc-950 bg-white dark:border-[#737c91] dark:bg-retro-panel">
              <button
                type="button"
                onClick={() => setRawOpen((prev) => !prev)}
                className="flex w-full items-center justify-between p-4 text-sm font-black transition-colors hover:bg-zinc-50 dark:hover:bg-slate-800"
              >
                <span>Technical error data</span>
                <ChevronDown
                  className={`size-4 transition-transform duration-200 ${
                    rawOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {rawOpen && (
                <div className="border-t-2 border-zinc-950 bg-zinc-950 p-5 font-mono text-xs leading-6 text-zinc-300 dark:border-[#737c91]">
                  <div>
                    <span className="text-cyan-300">statusCode:</span>{' '}
                    {selectedIncident.errorDetails.statusCode}
                  </div>
                  <div>
                    <span className="text-cyan-300">targetUrl:</span>{' '}
                    {selectedIncident.monitorUrl}
                  </div>
                  <div>
                    <span className="text-cyan-300">errorMessage:</span>{' '}
                    <span className="text-coral">
                      {selectedIncident.errorDetails.errorMessage}
                    </span>
                  </div>
                  {selectedIncident.errorDetails.responseHeaders &&
                    Object.keys(selectedIncident.errorDetails.responseHeaders).length > 0 && (
                      <div className="mt-3 border-t border-zinc-800 pt-3">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                          Response Headers
                        </div>
                        {Object.entries(selectedIncident.errorDetails.responseHeaders).map(
                          ([key, value]) => (
                            <div key={key}>
                              <span className="text-yellow-300">{key}:</span> {value}
                            </div>
                          )
                        )}
                      </div>
                    )}
                  {selectedIncident.errorDetails.responseBody && (
                    <div className="mt-3 border-t border-zinc-800 pt-3">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                        Response Body
                      </div>
                      <pre className="mt-1 whitespace-pre-wrap break-all text-zinc-400">
                        {selectedIncident.errorDetails.responseBody}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-zinc-400 p-8 text-center text-sm font-bold text-zinc-500 dark:border-slate-700 dark:text-slate-400">
            Select an incident from the timeline to inspect diagnosis.
          </div>
        )}
      </div>
    </div>
  );
};
