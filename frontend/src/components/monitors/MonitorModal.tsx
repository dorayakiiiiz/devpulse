import React, { useState, FormEvent } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { RetroWindowBar } from '../common/RetroWindowBar';
import { MonitorResponseDto, CreateMonitorPayload, UpdateMonitorPayload, HttpMethod } from '../../types/monitor';

interface HeaderRow {
  id: string;
  key: string;
  value: string;
}

interface MonitorModalProps {
  monitor?: MonitorResponseDto;
  onClose: () => void;
  onSave: (payload: CreateMonitorPayload | UpdateMonitorPayload) => Promise<void>;
}

// Modal dialog configuring monitor endpoint target parameters and custom headers
export const MonitorModal: React.FC<MonitorModalProps> = ({ monitor, onClose, onSave }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>(() => {
    if (monitor?.headers && Object.keys(monitor.headers).length > 0) {
      return Object.entries(monitor.headers).map(([key, value]) => ({
        id: crypto.randomUUID(),
        key,
        value,
      }));
    }
    return [{ id: crypto.randomUUID(), key: '', value: '' }];
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const headers = Object.fromEntries(
      headerRows
        .filter((row) => row.key.trim().length > 0)
        .map((row) => [row.key.trim(), row.value.trim()])
    );

    const payload: CreateMonitorPayload = {
      name: String(data.get('name')),
      url: String(data.get('url')),
      method: data.get('method') as HttpMethod,
      interval: Number(data.get('interval')) as 30 | 60 | 300,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    };

    setIsSubmitting(true);
    try {
      await onSave(payload);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-zinc-950/65 p-4"
    >
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="monitor-dialog-title"
        className="mx-auto my-6 w-full max-w-xl overflow-hidden rounded-lg border-2 border-zinc-950 bg-cream shadow-[8px_8px_0_#18181b] dark:border-[#737c91] dark:bg-retro-night dark:shadow-[8px_8px_0_#090b10]"
      >
        <RetroWindowBar title="Monitor setup" />

        <div className="flex items-start justify-between border-b border-zinc-300 p-5 dark:border-slate-700">
          <div>
            <h2 id="monitor-dialog-title" className="text-xl font-black">
              {monitor ? 'Edit monitor' : 'Create a monitor'}
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-slate-400">
              We’ll start checking as soon as you save.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close monitor form"
            className="grid size-9 place-items-center rounded-md border-2 border-zinc-950 bg-white dark:border-[#737c91] dark:bg-retro-panel"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <label className="block text-sm font-bold">
            Monitor name
            <input
              required
              name="name"
              defaultValue={monitor?.name}
              placeholder="e.g. Production API"
              className="mt-2 w-full rounded-md border-2 border-zinc-950 bg-white px-4 py-3 outline-none focus:shadow-[3px_3px_0_#65d6c4] dark:border-[#737c91] dark:bg-retro-panel"
            />
          </label>

          <label className="block text-sm font-bold">
            Endpoint URL
            <input
              required
              name="url"
              type="url"
              defaultValue={monitor?.url}
              placeholder="https://api.example.com/health"
              className="mt-2 w-full rounded-md border-2 border-zinc-950 bg-white px-4 py-3 outline-none focus:shadow-[3px_3px_0_#65d6c4] dark:border-[#737c91] dark:bg-retro-panel"
            />
            <span className="mt-2 block text-xs font-normal text-zinc-500 dark:text-slate-400">
              HTTPS endpoints automatically monitor SSL certificate expiration.
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-bold">
              Method
              <select
                name="method"
                defaultValue={monitor?.method ?? 'GET'}
                className="mt-2 w-full rounded-md border-2 border-zinc-950 bg-white px-3 py-3 dark:border-[#737c91] dark:bg-retro-panel"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="HEAD">HEAD</option>
              </select>
            </label>

            <label className="block text-sm font-bold">
              Check interval
              <select
                name="interval"
                defaultValue={monitor?.interval ?? 60}
                className="mt-2 w-full rounded-md border-2 border-zinc-950 bg-white px-3 py-3 dark:border-[#737c91] dark:bg-retro-panel"
              >
                <option value={30}>Every 30 sec</option>
                <option value={60}>Every 60 sec</option>
                <option value={300}>Every 5 min</option>
              </select>
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-bold">
                Custom headers{' '}
                <span className="font-normal text-zinc-400 dark:text-slate-400">
                  (optional)
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setHeaderRows((rows) => [
                    ...rows,
                    { id: crypto.randomUUID(), key: '', value: '' },
                  ])
                }
                className="flex items-center gap-1.5 rounded-md border border-zinc-950 bg-yellow-200 px-3 py-2 text-xs font-black text-zinc-950 dark:border-[#737c91] dark:bg-[#665c2f] dark:text-[#fff8df]"
              >
                <Plus className="size-3.5" /> Add header
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {headerRows.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[1fr_1.3fr_auto] gap-2"
                >
                  <input
                    aria-label="Header name"
                    value={row.key}
                    onChange={(event) =>
                      setHeaderRows((rows) =>
                        rows.map((item) =>
                          item.id === row.id
                            ? { ...item, key: event.target.value }
                            : item
                        )
                      )
                    }
                    placeholder="Header name"
                    className="min-w-0 rounded-md border-2 border-zinc-950 bg-white px-3 py-2.5 font-mono text-xs outline-none dark:border-[#737c91] dark:bg-retro-panel"
                  />
                  <input
                    aria-label="Header value"
                    value={row.value}
                    onChange={(event) =>
                      setHeaderRows((rows) =>
                        rows.map((item) =>
                          item.id === row.id
                            ? { ...item, value: event.target.value }
                            : item
                        )
                      )
                    }
                    placeholder="Header value"
                    className="min-w-0 rounded-md border-2 border-zinc-950 bg-white px-3 py-2.5 font-mono text-xs outline-none dark:border-[#737c91] dark:bg-retro-panel"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setHeaderRows((rows) =>
                        rows.length === 1
                          ? [{ ...rows[0], key: '', value: '' }]
                          : rows.filter((item) => item.id !== row.id)
                      )
                    }
                    aria-label="Remove header"
                    className="grid size-10 place-items-center rounded-md border border-red-800 bg-coral-soft text-red-950 dark:border-red-400 dark:bg-red-950 dark:text-red-200"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-md border-2 border-zinc-950 bg-white px-5 py-3 text-sm font-black dark:border-[#737c91] dark:bg-retro-panel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md border-2 border-zinc-950 bg-coral px-5 py-3 text-sm font-black text-zinc-950 shadow-[3px_3px_0_#18181b] disabled:opacity-50 dark:border-[#737c91] dark:bg-[#ff8585] dark:shadow-[3px_3px_0_#090b10]"
            >
              {isSubmitting ? 'Saving...' : monitor ? 'Save changes' : 'Start monitoring'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

