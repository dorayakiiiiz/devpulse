import tls from 'tls';
import net from 'net';
import { URL } from 'url';
import { ISslInfo } from '../models/monitorModel.js';
import { isSafeMonitorUrl } from './urlValidator.js';

// Inspect SSL certificate properties for a given HTTPS URL
export async function checkSslCertificate(targetUrl: string, timeoutMs = 5000): Promise<ISslInfo | undefined> {
  if (!isSafeMonitorUrl(targetUrl)) {
    return undefined;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return undefined;
  }

  if (parsedUrl.protocol !== 'https:') {
    return undefined;
  }

  const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : 443;
  const host = parsedUrl.hostname;

  return new Promise((resolve) => {
    let timer: NodeJS.Timeout;
    let isSettled = false;

    // Deterministic resolution routine protected by isSettled guard
    const cleanupAndResolve = (result: ISslInfo): void => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(result);
    };

    // Establish direct TLS socket connection to inspect remote SSL certificate
    // Exclude SNI servername when target is a raw IP address per RFC 6066
    const socket = tls.connect(
      {
        host,
        port,
        servername: net.isIP(host) ? undefined : host,
        // Allow inspection of expired or self-signed certificates without aborting handshake
        rejectUnauthorized: false,
      },
      () => {
        // Retrieve peer certificate without recursive chain parsing
        const cert = socket.getPeerCertificate();
        const now = new Date();
        if (!cert || !cert.valid_to) {
          cleanupAndResolve({
            issuer: 'Unknown Issuer',
            validTo: new Date(0),
            daysRemaining: 0,
            lastCheckedAt: now,
          });
          return;
        }

        const validToDate = new Date(cert.valid_to);
        const diffMs = validToDate.getTime() - now.getTime();
        const ONE_DAY_MS = 1000 * 60 * 60 * 24;
        // Ceil for remaining active days so partial days count as 1 day; floor for overdue expired certs
        const daysRemaining = diffMs >= 0 ? Math.ceil(diffMs / ONE_DAY_MS) : Math.floor(diffMs / ONE_DAY_MS);
        const rawIssuer = cert.issuer?.O || cert.issuer?.CN;
        const issuerName = Array.isArray(rawIssuer) ? rawIssuer.join(', ') : rawIssuer || 'Unknown Certificate Authority';

        cleanupAndResolve({
          issuer: issuerName,
          validTo: validToDate,
          daysRemaining,
          lastCheckedAt: now,
        });
      }
    );

    // Handle TLS handshake and connection failures cleanly
    socket.on('error', (err) => {
      cleanupAndResolve({
        issuer: `Error: ${err.message || 'SSL Handshake Failed'}`,
        validTo: new Date(0),
        daysRemaining: 0,
        lastCheckedAt: new Date(),
      });
    });

    // Handle early connection termination by remote peer without waiting for timeout window
    socket.on('close', (hadError) => {
      if (!hadError) {
        cleanupAndResolve({
          issuer: 'Error: Connection closed by remote peer',
          validTo: new Date(0),
          daysRemaining: 0,
          lastCheckedAt: new Date(),
        });
      }
    });

    // Abort TLS socket and resolve fallback error if host does not respond within timeout window
    timer = setTimeout(() => {
      cleanupAndResolve({
        issuer: `Error: Connection Timeout (${timeoutMs}ms)`,
        validTo: new Date(0),
        daysRemaining: 0,
        lastCheckedAt: new Date(),
      });
    }, timeoutMs);
  });
}
