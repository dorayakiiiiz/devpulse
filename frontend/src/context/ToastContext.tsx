import React, { createContext, useContext, useEffect, useState } from 'react';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  message: string;
}

type ToastListener = (toast: ToastItem) => void;

const listeners = new Set<ToastListener>();

const toastTitles: Record<ToastType, string> = {
  success: 'Done',
  info: 'Updated',
  warning: 'Heads up',
  error: 'Couldn’t complete',
};

// Standalone imperative toast dispatcher callable from ANYWHERE (services, Axios interceptors, React components)
export const toast = {
  show(message: string, type: ToastType = 'success', title = toastTitles[type]) {
    const item: ToastItem = {
      id: Date.now() + Math.random(),
      type,
      title,
      message,
    };
    listeners.forEach((listener) => listener(item));
  },
  success(message: string, title?: string) {
    this.show(message, 'success', title);
  },
  error(message: string, title?: string) {
    this.show(message, 'error', title);
  },
  info(message: string, title?: string) {
    this.show(message, 'info', title);
  },
  warning(message: string, title?: string) {
    this.show(message, 'warning', title);
  },
};

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, title?: string) => void;
  toast: typeof toast;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: (msg, type, title) => toast.show(msg, type, title),
  toast,
});

const toastStyles: Record<ToastType, string> = {
  success: 'bg-mint text-zinc-950 dark:bg-[#356b63] dark:text-[#f3eadc]',
  info: 'bg-retro-blue text-zinc-950 dark:bg-[#394b67] dark:text-[#f3eadc]',
  warning: 'bg-yellow-200 text-zinc-950 dark:bg-[#665c2f] dark:text-[#fff8df]',
  error: 'bg-coral-soft text-red-950 dark:bg-[#713f3b] dark:text-[#fff0ea]',
};

// Root provider rendering the Neo-Brutalism toast overlay
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handleNewToast = (item: ToastItem) => {
      setToasts((prev) => [...prev, item]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== item.id));
      }, 3200);
    };

    listeners.add(handleNewToast);
    return () => {
      listeners.delete(handleNewToast);
    };
  }, []);

  const value: ToastContextValue = {
    showToast: (msg, type, title) => toast.show(msg, type, title),
    toast,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
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
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== item.id))}
                aria-label="Dismiss notification"
                className="grid size-7 shrink-0 place-items-center rounded-md border border-current text-sm font-black"
              >
                ×
              </button>
            </div>
            <div className="toast-progress h-1 bg-zinc-950/50 dark:bg-white/50" />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
