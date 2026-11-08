import { formatRelativeTime, formatDuration, formatDate } from '../../../src/lib/date';

// Unit tests for date and duration formatting helpers
describe('date utility helpers', () => {
  describe('formatRelativeTime', () => {
    it('should return Never when timestamp is null or undefined', () => {
      expect(formatRelativeTime(null)).toBe('Never');
      expect(formatRelativeTime(undefined)).toBe('Never');
    });

    it('should return Just now when timestamp is less than 60 seconds ago', () => {
      const now = new Date(Date.now() - 30 * 1000).toISOString();
      expect(formatRelativeTime(now)).toBe('Just now');
    });

    it('should format minutes ago accurately', () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(formatRelativeTime(fiveMinAgo)).toBe('5 min ago');
    });

    it('should format hours ago accurately', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
      expect(formatRelativeTime(threeHoursAgo)).toBe('3h ago');
    });

    it('should format days ago accurately', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
      expect(formatRelativeTime(twoDaysAgo)).toBe('2d ago');
    });
  });

  describe('formatDuration', () => {
    it('should format durations under one minute as seconds', () => {
      const started = new Date(Date.now() - 45 * 1000).toISOString();
      expect(formatDuration(started)).toBe('45s');
    });

    it('should format durations under one hour as minutes', () => {
      const started = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      expect(formatDuration(started)).toBe('15 min');
    });

    it('should format multi-hour durations with hours and minutes', () => {
      const started = new Date(Date.now() - (2 * 3600 + 10 * 60) * 1000).toISOString();
      expect(formatDuration(started)).toBe('2h 10m');
    });

    it('should calculate duration between startedAt and resolvedAt timestamps', () => {
      const started = '2026-11-08T10:00:00.000Z';
      const resolved = '2026-11-08T10:30:00.000Z';
      expect(formatDuration(started, resolved)).toBe('30 min');
    });
  });

  describe('formatDate', () => {
    it('should return placeholder dash when date is absent', () => {
      expect(formatDate(null)).toBe('—');
      expect(formatDate(undefined)).toBe('—');
    });

    it('should format valid ISO date string into readable calendar format', () => {
      const formatted = formatDate('2026-11-08T00:00:00.000Z');
      expect(formatted).toContain('2026');
      expect(formatted).toContain('Nov');
    });
  });
});
