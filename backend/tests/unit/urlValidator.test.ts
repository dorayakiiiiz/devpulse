import { isSafeMonitorUrl } from '../../src/utils/urlValidator.js';

// Unit tests for SSRF URL validation guard
describe('urlValidator', () => {
  it('should allow valid public HTTP and HTTPS URLs', () => {
    expect(isSafeMonitorUrl('https://api.example.com/health')).toBe(true);
    expect(isSafeMonitorUrl('http://8.8.8.8')).toBe(true);
    expect(isSafeMonitorUrl('https://devpulse.dorayakiiiiz.site')).toBe(true);
  });

  it('should block loopback, private RFC1918, and cloud metadata IPs', () => {
    expect(isSafeMonitorUrl('http://127.0.0.1:5000/api/health')).toBe(false);
    expect(isSafeMonitorUrl('http://localhost:3000')).toBe(false);
    expect(isSafeMonitorUrl('http://169.254.169.254/latest/meta-data/')).toBe(false);
    expect(isSafeMonitorUrl('http://10.0.0.1')).toBe(false);
    expect(isSafeMonitorUrl('http://172.17.0.2:27017')).toBe(false);
    expect(isSafeMonitorUrl('http://192.168.1.1')).toBe(false);
  });

  it('should block IPv6 loopback, ULA, link-local, and mapped IPv4 loopback', () => {
    expect(isSafeMonitorUrl('http://[::1]:5000')).toBe(false);
    expect(isSafeMonitorUrl('http://[::ffff:127.0.0.1]:5000')).toBe(false);
    expect(isSafeMonitorUrl('http://[fc00::1]')).toBe(false);
    expect(isSafeMonitorUrl('http://[fe80::1]')).toBe(false);
  });

  it('should block internal Docker single-label hostnames and non-HTTP schemes', () => {
    expect(isSafeMonitorUrl('http://devpulse-database:27017')).toBe(false);
    expect(isSafeMonitorUrl('http://devpulse-backend:5000/api/health')).toBe(false);
    expect(isSafeMonitorUrl('http://service.internal/metrics')).toBe(false);
    expect(isSafeMonitorUrl('ftp://files.example.com')).toBe(false);
  });
});
