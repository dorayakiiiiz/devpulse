import { create } from 'zustand';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  message: string;
}

const toastTitles: Record<ToastType, string> = {
  success: 'Done',
  info: 'Updated',
  warning: 'Heads up',
  error: 'Couldn’t complete',
};

interface ToastState {
  toasts: ToastItem[];
  showToast: (message: string, type?: ToastType, title?: string) => void;
  removeToast: (id: number) => void;
}

// Global atomic toast notification store powered by Zustand
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  showToast: (message: string, type: ToastType = 'success', title?: string) => {
    const id = Date.now() + Math.random();
    const item: ToastItem = {
      id,
      type,
      title: title ?? toastTitles[type],
      message,
    };

    set((state) => ({
      toasts: [...state.toasts, item],
    }));

    window.setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 3200);
  },

  removeToast: (id: number) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

// Standalone imperative toast dispatcher callable from anywhere in the application
export const toast = {
  show(message: string, type: ToastType = 'success', title?: string) {
    useToastStore.getState().showToast(message, type, title);
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


