import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteMonitorModal } from '../../../src/components/monitors/DeleteMonitorModal';
import { MonitorResponseDto } from '../../../src/types/monitor';

// Component tests for DeleteMonitorModal
describe('DeleteMonitorModal Component', () => {
  const mockMonitor: MonitorResponseDto = {
    id: 'm-123',
    userId: 'u-123',
    name: 'Primary Database Target',
    url: 'https://db.example.com',
    method: 'GET',
    headers: {},
    interval: 60,
    status: 'up',
    isActive: true,
    lastCheckedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('should render confirmation title and target monitor name', () => {
    render(<DeleteMonitorModal monitor={mockMonitor} onClose={vi.fn()} onConfirm={vi.fn()} />);

    expect(screen.getByText('Delete Primary Database Target?')).toBeInTheDocument();
  });

  it('should trigger onClose when clicking outside on backdrop overlay', () => {
    const handleClose = vi.fn();
    const { container } = render(
      <DeleteMonitorModal monitor={mockMonitor} onClose={handleClose} onConfirm={vi.fn()} />
    );

    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('should call onConfirm when clicking Delete permanently button', async () => {
    const user = userEvent.setup();
    const handleConfirm = vi.fn().mockResolvedValue(undefined);

    render(<DeleteMonitorModal monitor={mockMonitor} onClose={vi.fn()} onConfirm={handleConfirm} />);

    const deleteBtn = screen.getByRole('button', { name: /delete permanently/i });
    await user.click(deleteBtn);

    await waitFor(() => {
      expect(handleConfirm).toHaveBeenCalledTimes(1);
    });
  });

  it('should call onClose when clicking Keep monitor button', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(<DeleteMonitorModal monitor={mockMonitor} onClose={handleClose} onConfirm={vi.fn()} />);

    const cancelBtn = screen.getByRole('button', { name: /keep monitor/i });
    await user.click(cancelBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
