import tls from 'tls';
import { URL } from 'url';
import { ISslInfo } from '../models/monitorModel.js';

// Inspect SSL certificate properties for a given HTTPS URL
export async function checkSslCertificate(targetUrl: string, timeoutMs = 5000): Promise<ISslInfo | undefined> {
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

    // Establish direct TLS socket connection to inspect remote SSL certificate
    const socket = tls.connect(
      {
        host,
        port,
        servername: host,
        // Allow inspection of expired or self-signed certificates without aborting handshake
        rejectUnauthorized: false,
      },
      () => {
        clearTimeout(timer);
        // Retrieve detailed peer certificate chain from established TLS connection
        const cert = socket.getPeerCertificate(true);
        // Destroy TLS socket immediately after reading metadata to prevent socket and memory leaks
        socket.destroy();

        const now = new Date();
        if (!cert || !cert.valid_to) {
          resolve({
            issuer: 'Unknown Issuer',
            validTo: new Date(0),
            daysRemaining: 0,
            lastCheckedAt: now,
          });
          return;
        }

        const validToDate = new Date(cert.valid_to);
        // Calculate remaining valid days by comparing expiration timestamp against current time
        const diffMs = validToDate.getTime() - now.getTime();
        const daysRemaining = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        const rawIssuer = cert.issuer?.O || cert.issuer?.CN;
        const issuerName = Array.isArray(rawIssuer) ? rawIssuer.join(', ') : rawIssuer || 'Unknown Certificate Authority';

        resolve({
          issuer: issuerName,
          validTo: validToDate,
          daysRemaining,
          lastCheckedAt: now,
        });
      }
    );

    // Handle TLS handshake and connection failures cleanly without throwing unhandled exceptions
    socket.on('error', (err) => {
      clearTimeout(timer);
      socket.destroy();
      resolve({
        issuer: `Error: ${err.message || 'SSL Handshake Failed'}`,
        validTo: new Date(0),
        daysRemaining: 0,
        lastCheckedAt: new Date(),
      });
    });

    // Abort TLS socket and resolve fallback error if host does not respond within timeout window
    timer = setTimeout(() => {
      socket.destroy();
      resolve({
        issuer: 'Error: Connection Timeout (5s)',
        validTo: new Date(0),
        daysRemaining: 0,
        lastCheckedAt: new Date(),
      });
    }, timeoutMs);
  });
}
