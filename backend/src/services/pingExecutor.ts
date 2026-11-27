import { IMonitor } from '../models/monitorModel.js';
import { isSafeMonitorUrl } from '../utils/urlValidator.js';

export interface PingExecutionResult {
  statusCode: number;
  latency: number;
  isUp: boolean;
  error?: string;
  checkedAt: Date;
}

// Low-level HTTP executor responsible for probing targets and measuring network response
export class PingExecutor {
  // Execute a single network probe with a strict 10-second timeout guard
  private async executeSingleProbe(monitor: IMonitor): Promise<PingExecutionResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const startTime = Date.now();

    const headersRecord = Object.fromEntries(monitor.headers);

    let statusCode = 0;
    let isUp = false;
    let errorMessage: string | undefined;

    if (!isSafeMonitorUrl(monitor.url)) {
      return {
        statusCode: 502,
        latency: 1,
        isUp: false,
        error: 'Blocked private or internal target URL',
        checkedAt: new Date(),
      };
    }

    try {
      const response = await fetch(monitor.url, {
        method: monitor.method || 'GET',
        headers: headersRecord,
        signal: controller.signal,
      });

      statusCode = response.status;
      // Release undici socket and response stream immediately since body is not consumed
      await response.body?.cancel();
      // 2xx and 3xx responses are classified as operational uptime
      isUp = statusCode >= 200 && statusCode < 400;

      if (!isUp) {
        errorMessage = `HTTP status code ${statusCode}`;
      }
    } catch (error: unknown) {
      isUp = false;
      if (error instanceof Error) {
        // Extract low-level system error code from root error or nested cause in Node.js fetch
        const cause = 'cause' in error && error.cause instanceof Error ? error.cause : null;
        const code = (cause && 'code' in cause && typeof cause.code === 'string')
          ? cause.code
          : ('code' in error && typeof error.code === 'string')
            ? error.code
            : undefined;

        if (error.name === 'AbortError' || code === 'ETIMEDOUT') {
          statusCode = 504;
          errorMessage = 'ETIMEDOUT';
        } else if (code === 'ENOTFOUND') {
          statusCode = 502;
          errorMessage = 'ENOTFOUND';
        } else if (code === 'ECONNREFUSED') {
          statusCode = 502;
          errorMessage = 'ECONNREFUSED';
        } else if (code === 'ECONNRESET') {
          statusCode = 502;
          errorMessage = 'ECONNRESET';
        } else if (code?.startsWith('CERT_') || code?.includes('SSL') || code?.includes('TLS')) {
          statusCode = 526;
          errorMessage = code;
        } else {
          statusCode = 502;
          errorMessage = code || error.message || 'Connection failure';
        }
      } else {
        statusCode = 502;
        errorMessage = 'Network connection failure';
      }
    } finally {
      clearTimeout(timeout);
    }

    const latency = Math.max(1, Date.now() - startTime);

    return {
      statusCode,
      latency,
      isUp,
      error: errorMessage,
      checkedAt: new Date(),
    };
  }

  // Probe target with a 2-second single-retry fallback against transient false positives
  async pingTarget(monitor: IMonitor): Promise<PingExecutionResult> {
    const firstAttempt = await this.executeSingleProbe(monitor);

    // If first attempt succeeded, return immediate verified status
    if (firstAttempt.isUp) {
      return firstAttempt;
    }

    // Pause 2 seconds before retrying to prevent transient network blips from raising false alerts
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const retryAttempt = await this.executeSingleProbe(monitor);
    return retryAttempt;
  }
}

export const pingExecutor = new PingExecutor();

