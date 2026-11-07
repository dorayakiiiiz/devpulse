import React from 'react';
import { useToastStore, ToastType } from '../../stores/toastStore';

const toastStyles: Record<ToastType, string> = {
  success: 'bg-mint text-zinc-950 dark:bg-[#356b63] dark:text-[#f3eadc]',
  info: 'bg-retro-blue text-zinc-950 dark:bg-[#394b67] dark:text-[#f3eadc]',
  warning: 'bg-yellow-200 text-zinc-950 dark:bg-[#665c2f] dark:text-[#fff8df]',
  error: 'bg-coral-soft text-red-950 dark:bg-[#713f3b] dark:text-[#fff0ea]',
};

// Presentational toast viewport consuming Zustand state with zero re-rendering impact on application tree
export const ToastContainer: React.FC = () => {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-20 z-[100] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-3"
    >
      {toasts.map((item) => (
        <div
          key={item.id}
          role="status"
          className={`pointer-events-auto overflow-hidden rounded-lg border-2 border-zinc-950 shadow-[5px_5px_0_#18181b] dark:border-[#737c91] dark:shadow-[5px_5px_0_#090b10] ${toastStyles[item.type]}`}
        >
          <div className="flex items-start gap-3 p-4">
            <span
              className={`mt-1 size-2.5 shrink-0 rounded-full border border-zinc-950 ${
                item.type === 'success'
                  ? 'bg-emerald-600'
                  : item.type === 'info'
                    ? 'bg-blue-700'
                    : item.type === 'warning'
                      ? 'bg-amber-600'
                      : 'bg-red-600'
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black">{item.title}</div>
              <p className="mt-1 text-xs font-medium leading-5 opacity-90">{item.message}</p>
            </div>
            <button
              type="button"
              onClick={() => removeToast(item.id)}
              aria-label="Dismiss notification"
              className="grid size-7 shrink-0 place-items-center rounded-md border border-current text-sm font-black hover:bg-black/10 dark:hover:bg-white/10"
            >
              ×
            </button>
          </div>
          <div className="toast-progress h-1 bg-zinc-950/55 dark:bg-white/55" />
        </div>
      ))}
    </div>
  );
};

