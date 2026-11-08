import { useToastStore, toast } from '../../../src/stores/toastStore';

// Unit tests for notification toast store
describe('toastStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.setState({ toasts: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should add toast notification with correct properties', () => {
    toast.success('Settings saved successfully');

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].type).toBe('success');
    expect(toasts[0].message).toBe('Settings saved successfully');
    expect(toasts[0].title).toBe('Done');
  });

  it('should support error and warning variants with custom titles', () => {
    toast.error('Failed to ping server', 'Custom Alert');

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].type).toBe('error');
    expect(toasts[0].title).toBe('Custom Alert');
    expect(toasts[0].message).toBe('Failed to ping server');
  });

  it('should manually remove toast by identifier', () => {
    toast.info('Temporary notice');
    const toastId = useToastStore.getState().toasts[0].id;

    useToastStore.getState().removeToast(toastId);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('should automatically dismiss toast after 3200ms timeout', () => {
    toast.success('Auto-dismiss notice');
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(3200);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
