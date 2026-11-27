import net from 'net';

// Check whether an IPv4 address belongs to private, loopback, link-local, or reserved ranges
function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }

  const [a, b] = parts;
  // 0.0.0.0/8 (current network), 10.0.0.0/8 (RFC1918), 127.0.0.0/8 (loopback)
  if (a === 0 || a === 10 || a === 127) {
    return true;
  }
  // 100.64.0.0/10 (Carrier-Grade NAT)
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }
  // 169.254.0.0/16 (link-local & cloud metadata 169.254.169.254)
  if (a === 169 && b === 254) {
    return true;
  }
  // 172.16.0.0/12 (RFC1918 & Docker bridge subnets)
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  // 192.168.0.0/16 (RFC1918)
  if (a === 192 && b === 168) {
    return true;
  }
  // 224.0.0.0/4 (multicast) and 240.0.0.0/4 (reserved)
  if (a >= 224) {
    return true;
  }

  return false;
}

// Check whether an IPv6 address belongs to loopback, link-local, ULA, or mapped private IPv4 ranges
function isPrivateIpv6(rawIp: string): boolean {
  const ip = rawIp.toLowerCase();
  if (ip === '::' || ip === '::1') {
    return true;
  }

  // Handle IPv4-mapped IPv6 addresses in both dotted (::ffff:127.0.0.1) and URL-normalized hex (::ffff:7f00:1) forms
  if (ip.startsWith('::ffff:')) {
    const mappedPart = ip.slice(7);
    if (net.isIPv4(mappedPart)) {
      return isPrivateIpv4(mappedPart);
    }
    const hexGroups = mappedPart.split(':');
    if (hexGroups.length === 2) {
      const high = parseInt(hexGroups[0], 16);
      const low = parseInt(hexGroups[1], 16);
      if (!Number.isNaN(high) && !Number.isNaN(low)) {
        const ipv4 = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
        return isPrivateIpv4(ipv4);
      }
    }
    return true;
  }

  // Unique local addresses (fc00::/7) and link-local (fe80::/10)
  if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb')) {
    return true;
  }

  return false;
}

// Validate that a monitor target URL points strictly to a public HTTP/HTTPS host (SSRF protection)
export function isSafeMonitorUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  const rawHost = parsed.hostname.toLowerCase();
  // Strip IPv6 brackets if present in URL.hostname
  const host = rawHost.startsWith('[') && rawHost.endsWith(']') ? rawHost.slice(1, -1) : rawHost;

  if (!host) {
    return false;
  }

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return false;
  }

  const ipVersion = net.isIP(host);
  if (ipVersion === 4) {
    return !isPrivateIpv4(host);
  }
  if (ipVersion === 6) {
    return !isPrivateIpv6(host);
  }

  // Block single-label hostnames (e.g. Docker internal service names like devpulse-database)
  if (!host.includes('.')) {
    return false;
  }

  return true;
}
