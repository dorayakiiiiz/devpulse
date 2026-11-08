import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AccountSettingsModal } from '../../../src/components/settings/AccountSettingsModal';
import { useAuthStore } from '../../../src/stores/authStore';

// Component tests for AccountSettingsModal dialog
describe('AccountSettingsModal Component', () => {
  beforeEach(() => {
    useAuthStore.getState().setAuth(
      {
        id: 'usr-456',
        name: 'Alice Developer',
        email: 'alice@example.com',
        slug: 'alice-dev',
        role: 'member',
        isVerified: true,
      },
      'token-xyz'
    );
  });

  const renderModal = (isOpen = true, onClose = vi.fn()) => {
    return render(
      <MemoryRouter>
        <AccountSettingsModal isOpen={isOpen} onClose={onClose} />
      </MemoryRouter>
    );
  };

  it('should render nothing when isOpen is false', () => {
    const { container } = renderModal(false);
    expect(container.firstChild).toBeNull();
  });

  it('should render Profile Settings view by default when isOpen is true', () => {
    renderModal(true);

    expect(screen.getByText('Your account')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Alice Developer')).toBeInTheDocument();
    expect(screen.getByDisplayValue('alice-dev')).toBeInTheDocument();
  });

  it('should switch to Change Password sub-view and allow navigating back', async () => {
    const user = userEvent.setup();
    renderModal(true);

    const passwordBtn = screen.getByRole('button', { name: /change password/i });
    await user.click(passwordBtn);

    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();

    const backBtn = screen.getByRole('button', { name: /back to profile/i });
    await user.click(backBtn);

    expect(screen.getByText('Your account')).toBeInTheDocument();
  });

  it('should switch to Delete Account sub-view', async () => {
    const user = userEvent.setup();
    renderModal(true);

    const deleteBtn = screen.getByRole('button', { name: /^delete account$/i });
    await user.click(deleteBtn);

    expect(screen.getByText('Delete your account?')).toBeInTheDocument();
  });

  it('should trigger onClose when clicking outside on backdrop overlay', () => {
    const handleClose = vi.fn();
    const { container } = renderModal(true, handleClose);

    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
