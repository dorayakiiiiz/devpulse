import { PingExecutor } from '../../src/services/pingExecutor.js';
import { IMonitor } from '../../src/models/monitorModel.js';

// Unit tests for HTTP PingExecutor service
describe('PingExecutor', () => {
  let executor: PingExecutor;

  const mockMonitor = {
    url: 'https://api.example.com/health',
    method: 'GET',
    headers: new Map([['User-Agent', 'DevPulse-Probe']]),
  } as unknown as IMonitor;

  beforeEach(() => {
    executor = new PingExecutor();
    vi.restoreAllMocks();
  });

  it('should return isUp = true and 200 status code on successful probe', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      status: 200,
    } as Response);

    const result = await executor.pingTarget(mockMonitor);
    expect(result.isUp).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.error).toBeUndefined();
  });

  it('should map DNS ENOTFOUND to HTTP 502 Bad Gateway', async () => {
    const error = new Error('getaddrinfo ENOTFOUND api.invalid');
    // @ts-expect-error Mocking code property
    error.code = 'ENOTFOUND';

    // Mock both first probe and retry probe
    vi.spyOn(global, 'fetch').mockRejectedValue(error);

    const result = await executor.pingTarget(mockMonitor);
    expect(result.isUp).toBe(false);
    expect(result.statusCode).toBe(502);
    expect(result.error).toBe('ENOTFOUND');
  });

  it('should map socket ETIMEDOUT to HTTP 504 Gateway Timeout', async () => {
    const error = new Error('Connection timed out');
    // @ts-expect-error Mocking code property
    error.code = 'ETIMEDOUT';

    vi.spyOn(global, 'fetch').mockRejectedValue(error);

    const result = await executor.pingTarget(mockMonitor);
    expect(result.isUp).toBe(false);
    expect(result.statusCode).toBe(504);
    expect(result.error).toBe('ETIMEDOUT');
  });

  it('should retry once when first attempt fails and succeed on second attempt', async () => {
    vi.spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('Transient blip'))
      .mockResolvedValueOnce({ status: 200 } as Response);

    const result = await executor.pingTarget(mockMonitor);
    expect(result.isUp).toBe(true);
    expect(result.statusCode).toBe(200);
  });
});
