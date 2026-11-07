// Format timestamp string into human-friendly relative elapsed time matching Figma
export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (diffSeconds < 60) return 'Just now';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// Calculate and format duration between incident start and resolution or current time
export function formatDuration(startedAt: string, resolvedAt?: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
  const diffSeconds = Math.max(0, Math.floor((end - start) / 1000));

  if (diffSeconds < 60) return `${diffSeconds}s`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  const remainingMinutes = diffMinutes % 60;
  if (diffHours < 24) {
    return remainingMinutes > 0 ? `${diffHours}h ${remainingMinutes}m` : `${diffHours}h`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

// Format timestamp string into standard short calendar date
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}


