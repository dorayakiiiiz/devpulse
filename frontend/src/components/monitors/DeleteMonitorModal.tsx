import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { RetroWindowBar } from '../common/RetroWindowBar';
import { MonitorResponseDto } from '../../types/monitor';

interface DeleteMonitorModalProps {
  monitor: MonitorResponseDto;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

// Confirmation modal verifying permanent monitor deletion
export const DeleteMonitorModal: React.FC<DeleteMonitorModalProps> = ({
  monitor,
  onClose,
  onConfirm,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
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
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        className="w-full max-w-md overflow-hidden rounded-lg border-2 border-zinc-950 bg-cream shadow-[8px_8px_0_#18181b] dark:border-[#737c91] dark:bg-retro-night dark:shadow-[8px_8px_0_#090b10]"
      >
        <RetroWindowBar title="Confirm deletion" tone="coral" />
        <div className="p-6">
          <div className="grid size-11 place-items-center rounded-md border-2 border-zinc-950 bg-coral-soft text-red-950 dark:border-red-400 dark:bg-red-950 dark:text-red-200">
            <Trash2 className="size-5" />
          </div>
          <h2 id="delete-dialog-title" className="mt-5 text-xl font-black">
            Delete {monitor.name}?
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-slate-300">
            This permanently removes the monitor and stops all scheduled checks. Historical incidents remain available.
          </p>
          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="rounded-md border-2 border-zinc-950 bg-white px-5 py-3 text-sm font-black dark:border-[#737c91] dark:bg-retro-panel"
            >
              Keep monitor
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isDeleting}
              className="rounded-md border-2 border-zinc-950 bg-coral px-5 py-3 text-sm font-black text-zinc-950 disabled:opacity-50 dark:border-red-300 dark:bg-red-400"
            >
              {isDeleting ? 'Deleting...' : 'Delete permanently'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

