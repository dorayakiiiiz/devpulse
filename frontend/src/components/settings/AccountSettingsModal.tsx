import React, { useState, useEffect } from 'react';
import { X, KeyRound, Trash2, ArrowLeft } from 'lucide-react';
import { useAccountSettings } from '../../hooks/useAccountSettings';
import { RetroWindowBar } from '../common/RetroWindowBar';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalView = 'profile' | 'password' | 'delete';

// Modal dialog managing user profile details, password updates, and account removal
export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    user,
    name,
    slug,
    currentPassword,
    newPassword,
    confirmPassword,
    deletePassword,
    isSavingProfile,
    isChangingPassword,
    isDeletingAccount,
    setName,
    setSlug,
    setCurrentPassword,
    setNewPassword,
    setConfirmPassword,
    setDeletePassword,
    handleUpdateProfile,
    handleChangePassword,
    handleDeleteAccount,
  } = useAccountSettings();

  const [activeView, setActiveView] = useState<ModalView>('profile');

  // Reset modal sub-view and clear credential inputs when modal closes
  useEffect(() => {
    if (!isOpen) {
      setActiveView('profile');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setDeletePassword('');
    }
  }, [isOpen, setCurrentPassword, setNewPassword, setConfirmPassword, setDeletePassword]);

  if (!isOpen) return null;

  const handleProfileSubmit = async (e: React.FormEvent) => {
    await handleUpdateProfile(e);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    await handleChangePassword(e);
    setActiveView('profile');
  };

  const handleDeleteSubmit = async () => {
    await handleDeleteAccount();
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-zinc-950/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      {/* View 1: Delete Account Confirmation Sub-modal */}
      {activeView === 'delete' && (
        <div className="w-full max-w-md overflow-hidden rounded-lg border-2 border-zinc-950 bg-cream shadow-[8px_8px_0_#18181b] dark:border-[#737c91] dark:bg-retro-night dark:shadow-[8px_8px_0_#090b10]">
          <RetroWindowBar title="Confirm account deletion" tone="coral" />
          <div className="p-6">
            <div className="grid size-11 place-items-center rounded-md border-2 border-zinc-950 bg-coral-soft text-red-950 dark:border-red-400 dark:bg-red-950 dark:text-red-200">
              <Trash2 className="size-5" />
            </div>
            <h2 className="mt-5 text-xl font-black text-zinc-950 dark:text-[#f3eadc]">
              Delete your account?
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-slate-300">
              This permanently removes your profile and every monitor owned by this account. This action cannot be undone.
            </p>

            <div className="mt-5">
              <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-slate-300">
                Confirm your password
                <input
                  required
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter current password"
                  className="mt-2 w-full rounded-md border-2 border-zinc-950 bg-white px-3.5 py-2.5 text-sm outline-none focus:shadow-[3px_3px_0_#65d6c4] dark:border-[#737c91] dark:bg-retro-panel dark:text-[#f3eadc]"
                />
              </label>
            </div>

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={() => {
                  setDeletePassword('');
                  setActiveView('profile');
                }}
                className="rounded-md border-2 border-zinc-950 bg-white px-5 py-2.5 text-sm font-black transition-transform hover:-translate-y-0.5 active:translate-y-0 dark:border-[#737c91] dark:bg-retro-panel dark:text-[#f3eadc]"
              >
                Keep account
              </button>
              <button
                type="button"
                disabled={isDeletingAccount || !deletePassword}
                onClick={handleDeleteSubmit}
                className="rounded-md border-2 border-zinc-950 bg-coral px-5 py-2.5 text-sm font-black text-zinc-950 shadow-[3px_3px_0_#18181b] transition-transform hover:-translate-y-0.5 disabled:opacity-50 dark:border-red-300 dark:bg-red-400"
              >
                {isDeletingAccount ? 'Deleting...' : 'Delete account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View 2: Change Password Sub-modal */}
      {activeView === 'password' && (
        <form
          onSubmit={handlePasswordSubmit}
          className="w-full max-w-lg overflow-hidden rounded-lg border-2 border-zinc-950 bg-cream shadow-[8px_8px_0_#18181b] dark:border-[#737c91] dark:bg-retro-night dark:shadow-[8px_8px_0_#090b10]"
        >
          <RetroWindowBar title="Authentication credentials" tone="lilac" />
          <div className="flex items-start justify-between border-b border-zinc-300 p-5 dark:border-slate-700">
            <div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveView('profile')}
                  className="rounded p-1 hover:bg-zinc-200 dark:hover:bg-slate-700"
                  aria-label="Back to profile"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <h2 className="text-xl font-black text-zinc-950 dark:text-[#f3eadc]">
                  Change password
                </h2>
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-slate-400">
                Update your account security credentials with a strong password.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="grid size-9 place-items-center rounded-md border-2 border-zinc-950 bg-white dark:border-[#737c91] dark:bg-retro-panel"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="space-y-4 p-5">
            <label className="block text-sm font-bold text-zinc-950 dark:text-[#f3eadc]">
              Current password
              <input
                required
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="mt-2 w-full rounded-md border-2 border-zinc-950 bg-white px-4 py-2.5 text-sm outline-none focus:shadow-[3px_3px_0_#65d6c4] dark:border-[#737c91] dark:bg-retro-panel dark:text-[#f3eadc]"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-bold text-zinc-950 dark:text-[#f3eadc]">
                New password
                <input
                  required
                  type="password"
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="mt-2 w-full rounded-md border-2 border-zinc-950 bg-white px-4 py-2.5 text-sm outline-none focus:shadow-[3px_3px_0_#65d6c4] dark:border-[#737c91] dark:bg-retro-panel dark:text-[#f3eadc]"
                />
              </label>

              <label className="block text-sm font-bold text-zinc-950 dark:text-[#f3eadc]">
                Confirm password
                <input
                  required
                  type="password"
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="mt-2 w-full rounded-md border-2 border-zinc-950 bg-white px-4 py-2.5 text-sm outline-none focus:shadow-[3px_3px_0_#65d6c4] dark:border-[#737c91] dark:bg-retro-panel dark:text-[#f3eadc]"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-zinc-300 pt-5 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setActiveView('profile')}
                className="rounded-md border-2 border-zinc-950 bg-white px-4 py-2 text-sm font-black dark:border-[#737c91] dark:bg-retro-panel dark:text-[#f3eadc]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isChangingPassword}
                className="rounded-md border-2 border-zinc-950 bg-retro-lilac px-5 py-2 text-sm font-black text-zinc-950 shadow-[3px_3px_0_#18181b] transition-transform hover:-translate-y-0.5 disabled:opacity-50 dark:border-[#737c91] dark:bg-[#b8a1d9]"
              >
                {isChangingPassword ? 'Updating...' : 'Update password'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* View 3: Main Account Settings Modal (Profile & Actions) */}
      {activeView === 'profile' && (
        <form
          onSubmit={handleProfileSubmit}
          className="w-full max-w-xl overflow-hidden rounded-lg border-2 border-zinc-950 bg-cream shadow-[8px_8px_0_#18181b] dark:border-[#737c91] dark:bg-retro-night dark:shadow-[8px_8px_0_#090b10]"
        >
          <RetroWindowBar title="Account settings" tone="blue" />
          <div className="flex items-start justify-between border-b border-zinc-300 p-5 dark:border-slate-700">
            <div>
              <h2 className="text-xl font-black text-zinc-950 dark:text-[#f3eadc]">
                Your account
              </h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-slate-400">
                Update your profile and workspace identity.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close account settings"
              className="grid size-9 place-items-center rounded-md border-2 border-zinc-950 bg-white dark:border-[#737c91] dark:bg-retro-panel"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="space-y-6 p-5">
            <section>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-400">
                Profile
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-bold text-zinc-950 dark:text-[#f3eadc]">
                  Full name
                  <input
                    required
                    minLength={2}
                    maxLength={50}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-2 w-full rounded-md border-2 border-zinc-950 bg-white px-4 py-3 outline-none focus:shadow-[3px_3px_0_#65d6c4] dark:border-[#737c91] dark:bg-retro-panel dark:text-[#f3eadc]"
                  />
                </label>
                <label className="block text-sm font-bold text-zinc-950 dark:text-[#f3eadc]">
                  Email address
                  <input
                    disabled
                    value={user?.email ?? ''}
                    className="mt-2 w-full rounded-md border-2 border-zinc-400 bg-zinc-100 px-4 py-3 text-zinc-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  />
                </label>
                <label className="block text-sm font-bold text-zinc-950 dark:text-[#f3eadc] sm:col-span-2">
                  Public status slug
                  <div className="mt-2 flex rounded-md border-2 border-zinc-950 bg-white focus-within:shadow-[3px_3px_0_#65d6c4] dark:border-[#737c91] dark:bg-retro-panel">
                    <span className="flex items-center border-r border-zinc-300 px-3 text-xs text-zinc-400 dark:border-slate-600 dark:text-slate-500">
                      /status/
                    </span>
                    <input
                      required
                      minLength={3}
                      maxLength={48}
                      pattern="[a-z0-9-]+"
                      value={slug}
                      onChange={(e) =>
                        setSlug(
                          e.target.value
                            .toLowerCase()
                            .replace(/\s+/g, '-')
                            .replace(/[^a-z0-9-]/g, '')
                        )
                      }
                      className="min-w-0 flex-1 rounded-md bg-transparent px-3 py-3 font-mono text-sm outline-none dark:text-[#f3eadc]"
                      placeholder="acme-production"
                    />
                  </div>
                  <span className="mt-2 block text-xs font-normal text-zinc-500 dark:text-slate-400">
                    Public page: /status/{slug || 'your-slug'}
                  </span>
                </label>
              </div>
            </section>

            {/* Security shortcut section */}
            <section className="border-t border-zinc-300 pt-5 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500 dark:text-slate-400">
                    Security & Credentials
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-slate-400">
                    Manage sign-in credentials and access keys.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveView('password')}
                  className="inline-flex items-center gap-1.5 rounded-md border-2 border-zinc-950 bg-white px-3.5 py-2 text-xs font-black text-zinc-950 shadow-[2px_2px_0_#18181b] transition-transform hover:-translate-y-0.5 active:translate-y-0 dark:border-[#737c91] dark:bg-retro-panel dark:text-[#f3eadc]"
                >
                  <KeyRound className="size-3.5" />
                  <span>Change password...</span>
                </button>
              </div>
            </section>

            {/* Bottom Actions Bar */}
            <div className="flex flex-col-reverse gap-3 border-t border-zinc-300 pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
              <button
                type="button"
                onClick={() => setActiveView('delete')}
                className="rounded-md border-2 border-red-800 bg-coral-soft px-4 py-2.5 text-xs font-black text-red-950 transition-colors hover:bg-coral dark:border-red-400 dark:bg-red-950 dark:text-red-200"
              >
                Delete account
              </button>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border-2 border-zinc-950 bg-white px-4 py-2.5 text-xs font-black text-zinc-950 dark:border-[#737c91] dark:bg-retro-panel dark:text-[#f3eadc]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="rounded-md border-2 border-zinc-950 bg-coral px-5 py-2.5 text-xs font-black text-zinc-950 shadow-[3px_3px_0_#18181b] transition-transform hover:-translate-y-0.5 disabled:opacity-50 dark:border-[#737c91] dark:bg-[#ff8585] dark:shadow-[3px_3px_0_#090b10]"
                >
                  {isSavingProfile ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
