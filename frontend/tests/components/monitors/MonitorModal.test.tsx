import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MonitorModal } from '../../../src/components/monitors/MonitorModal';
import { MonitorResponseDto } from '../../../src/types/monitor';

// Component tests for Monitor creation and edit modal
describe('MonitorModal Component', () => {
  const mockMonitor: MonitorResponseDto = {
    id: 'mon-1',
    userId: 'usr-1',
    name: 'Production API',
    url: 'https://api.example.com/health',
    method: 'POST',
    headers: { Authorization: 'Bearer token-123' },
    interval: 60,
    status: 'up',
    isActive: true,
    lastCheckedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('should render create dialog title when no monitor prop is provided', () => {
    render(<MonitorModal onClose={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByText('Create a monitor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start monitoring/i })).toBeInTheDocument();
  });

  it('should pre-populate form fields when monitor prop is passed in edit mode', () => {
    render(<MonitorModal monitor={mockMonitor} onClose={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByText('Edit monitor')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Production API')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://api.example.com/health')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Authorization')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bearer token-123')).toBeInTheDocument();
  });

  it('should close modal when user clicks on outer backdrop overlay', () => {
    const handleClose = vi.fn();
    const { container } = render(<MonitorModal onClose={handleClose} onSave={vi.fn()} />);

    // Outer backdrop container
    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('should not close modal when user clicks inside the dialog form content', () => {
    const handleClose = vi.fn();
    render(<MonitorModal onClose={handleClose} onSave={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);

    expect(handleClose).not.toHaveBeenCalled();
  });

  it('should add a new custom header row when clicking Add header', async () => {
    const user = userEvent.setup();
    render(<MonitorModal onClose={vi.fn()} onSave={vi.fn()} />);

    const addHeaderButton = screen.getByRole('button', { name: /add header/i });
    await user.click(addHeaderButton);

    const nameInputs = screen.getAllByPlaceholderText('Header name');
    expect(nameInputs.length).toBeGreaterThanOrEqual(2);
  });

  it('should call onSave with form payload when valid data is submitted', async () => {
    const user = userEvent.setup();
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(<MonitorModal onClose={handleClose} onSave={handleSave} />);

    await user.type(screen.getByLabelText(/monitor name/i), 'Staging Service');
    await user.type(screen.getByLabelText(/endpoint url/i), 'https://staging.example.com');

    const submitBtn = screen.getByRole('button', { name: /start monitoring/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Staging Service',
          url: 'https://staging.example.com',
          method: 'GET',
          interval: 60,
        })
      );
    });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
