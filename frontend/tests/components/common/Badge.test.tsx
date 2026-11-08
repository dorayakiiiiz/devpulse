import React from 'react';
import { render, screen } from '@testing-library/react';
import { Badge } from '../../../src/components/common/Badge';

// Component tests for Badge indicator
describe('Badge Component', () => {
  it('should render uppercase UP for up status', () => {
    render(<Badge status="up" />);
    expect(screen.getByText('UP')).toBeInTheDocument();
  });

  it('should render uppercase DOWN for down status', () => {
    render(<Badge status="down" />);
    expect(screen.getByText('DOWN')).toBeInTheDocument();
  });

  it('should render PAUSED, PENDING, ONGOING, and RESOLVED status badges', () => {
    const { rerender } = render(<Badge status="paused" />);
    expect(screen.getByText('PAUSED')).toBeInTheDocument();

    rerender(<Badge status="pending" />);
    expect(screen.getByText('PENDING')).toBeInTheDocument();

    rerender(<Badge status="ongoing" />);
    expect(screen.getByText('ONGOING')).toBeInTheDocument();

    rerender(<Badge status="resolved" />);
    expect(screen.getByText('RESOLVED')).toBeInTheDocument();
  });

  it('should render custom label override if passed as prop', () => {
    render(<Badge status="up" label="Healthy" />);
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });
});
