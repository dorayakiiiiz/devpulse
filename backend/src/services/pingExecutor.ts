import { IMonitor } from '../models/monitorModel.js';

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

    try {
      const response = await fetch(monitor.url, {
        method: monitor.method || 'GET',
        headers: headersRecord,
        signal: controller.signal,
      });

      statusCode = response.status;
      // 2xx and 3xx responses are classified as operational uptime
      isUp = statusCode >= 200 && statusCode < 400;

      if (!isUp) {
        errorMessage = `HTTP status code ${statusCode}`;
      }
    } catch (error: unknown) {
      isUp = false;
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          statusCode = 408;
          errorMessage = 'ETIMEDOUT';
        } else if ('code' in error && typeof error.code === 'string') {
          errorMessage = error.code;
        } else {
          errorMessage = error.message;
        }
      } else {
        errorMessage = 'Network connection failure';
      }
    } finally {
      clearTimeout(timeout);
    }

    // Set latency to 0 for unestablished connections (DNS failure or connection refused) per system spec
    const latency = statusCode === 0 ? 0 : Math.max(1, Date.now() - startTime);

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

