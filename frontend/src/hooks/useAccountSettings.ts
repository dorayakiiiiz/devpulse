import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService } from '../services/userService';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';
import { getApiErrorMessage } from '../lib/apiError';

// Custom hook managing user profile modifications, credential updates, and account deletion
export function useAccountSettings() {
  const navigate = useNavigate();
  const { user, setUser, clearAuth } = useAuthStore();

  const [name, setName] = useState(user?.name ?? '');
  const [slug, setSlug] = useState(user?.slug ?? '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [deletePassword, setDeletePassword] = useState('');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setSlug(user.slug);
    }
  }, [user]);

  const handleUpdateProfile = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!name.trim()) {
        toast.warning('Full name cannot be empty.', 'Validation error');
        return;
      }
      if (!slug.trim()) {
        toast.warning('Public slug cannot be empty.', 'Validation error');
        return;
      }

      setIsSavingProfile(true);
      try {
        const updated = await userService.updateProfile({
          name: name.trim(),
          slug: slug.trim().toLowerCase(),
        });
        setUser(updated);
        toast.success('Your profile details were updated.', 'Profile saved');
      } catch (err) {
        toast.error(getApiErrorMessage(err), 'Failed to update profile');
      } finally {
        setIsSavingProfile(false);
      }
    },
    [name, slug, setUser]
  );

  const handleChangePassword = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!currentPassword) {
        toast.warning('Current password is required.', 'Validation error');
        return;
      }
      if (newPassword.length < 8) {
        toast.warning('New password must be at least 8 characters long.', 'Validation error');
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error('New password and confirmation do not match.', 'Password mismatch');
        return;
      }

      setIsChangingPassword(true);
      try {
        await userService.changePassword({ currentPassword, newPassword });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        toast.success('Your account password was updated successfully.', 'Password changed');
      } catch (err) {
        toast.error(getApiErrorMessage(err), 'Failed to change password');
      } finally {
        setIsChangingPassword(false);
      }
    },
    [currentPassword, newPassword, confirmPassword]
  );

  const handleDeleteAccount = useCallback(async () => {
    if (!deletePassword) {
      toast.warning('Please enter your password to confirm account deletion.', 'Password required');
      return;
    }

    setIsDeletingAccount(true);
    try {
      await userService.deleteAccount(deletePassword);
      clearAuth();
      toast.info('Your account has been permanently removed.', 'Account deleted');
      navigate('/auth');
    } catch (err) {
      toast.error(getApiErrorMessage(err), 'Account deletion failed');
    } finally {
      setIsDeletingAccount(false);
    }
  }, [deletePassword, clearAuth, navigate]);

  return {
    user,
    name,
    slug,
    currentPassword,
    newPassword,
    confirmPassword,
    deletePassword,
    isConfirmingDelete,
    isSavingProfile,
    isChangingPassword,
    isDeletingAccount,
    setName,
    setSlug,
    setCurrentPassword,
    setNewPassword,
    setConfirmPassword,
    setDeletePassword,
    setIsConfirmingDelete,
    handleUpdateProfile,
    handleChangePassword,
    handleDeleteAccount,
  };
}

