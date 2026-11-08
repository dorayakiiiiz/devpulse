import tls from 'tls';
import { EventEmitter } from 'events';
import { checkSslCertificate } from '../../src/utils/sslChecker.js';

// Unit tests for SSL certificate inspector
describe('sslChecker', () => {
  it('should return undefined if URL protocol is http://', async () => {
    const result = await checkSslCertificate('http://example.com');
    expect(result).toBeUndefined();
  });

  it('should return undefined if URL is malformed', async () => {
    const result = await checkSslCertificate('not-a-valid-url');
    expect(result).toBeUndefined();
  });

  it('should parse valid certificate from tls socket', async () => {
    const mockSocket = new EventEmitter() as unknown as tls.TLSSocket & EventEmitter;
    mockSocket.destroy = vi.fn();
    mockSocket.getPeerCertificate = vi.fn().mockReturnValue({
      valid_to: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      issuer: { O: "Let's Encrypt" },
    });

    vi.spyOn(tls, 'connect').mockImplementation((_opts: unknown, cb?: () => void) => {
      setTimeout(() => cb?.(), 10);
      return mockSocket;
    });

    const result = await checkSslCertificate('https://my-domain.com');
    expect(result).toBeDefined();
    expect(result?.issuer).toBe("Let's Encrypt");
    expect(result?.daysRemaining).toBe(10);
  });

  it('should return fallback result when socket encounters error', async () => {
    const mockSocket = new EventEmitter() as unknown as tls.TLSSocket & EventEmitter;
    mockSocket.destroy = vi.fn();

    vi.spyOn(tls, 'connect').mockImplementation(() => {
      setTimeout(() => mockSocket.emit('error', new Error('ECONNREFUSED')), 10);
      return mockSocket;
    });

    const result = await checkSslCertificate('https://unreachable-domain.com');
    expect(result).toBeDefined();
    expect(result?.daysRemaining).toBe(0);
    expect(result?.issuer).toContain('ECONNREFUSED');
  });
});
