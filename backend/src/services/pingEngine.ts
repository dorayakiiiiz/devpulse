import cron, { ScheduledTask } from 'node-cron';
import pLimit from 'p-limit';
import { IMonitor } from '../models/monitorModel.js';
import { monitorRepository } from '../repositories/monitorRepository.js';
import { pingExecutor, PingExecutionResult } from './pingExecutor.js';
import { metricBuffer } from './metricBuffer.js';
import { eventBus } from '../utils/eventBus.js';

export interface PingEngineStatus {
  activeMonitorsCount: number;
  bufferSize: number;
  lastFlushAt: string | null;
  concurrencyLimit: number;
  isRunning: boolean;
}

// Core periodic scheduler executing distributed HTTP checks and managing concurrency throttling
export class PingEngine {
  private readonly concurrencyLimit = 5;
  private readonly pacingDelayMs = 100;
  private limit = pLimit(this.concurrencyLimit);
  private tasks: ScheduledTask[] = [];
  private isRunning = false;
  private activeRuns = new Map<number, boolean>();

  // Start periodic cron schedulers and metric buffer background flush timer
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    metricBuffer.startTimer();

    // 1. Interval 30 seconds (every 30s at :00 and :30)
    const task30s = cron.schedule('*/30 * * * * *', async () => {
      await this.runIntervalCycle(30);
    });

    // 2. Interval 60 seconds (every minute at :00)
    const task60s = cron.schedule('0 * * * * *', async () => {
      await this.runIntervalCycle(60);
    });

    // 3. Interval 300 seconds (every 5 minutes at :00)
    const task300s = cron.schedule('0 */5 * * * *', async () => {
      await this.runIntervalCycle(300);
    });

    this.tasks = [task30s, task60s, task300s];
    console.log('[PingEngine] Scheduler started with intervals: 30s, 60s, 300s.');
  }

  // Gracefully stop all scheduled cron tasks and buffer flush timer
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    for (const task of this.tasks) {
      task.stop();
    }
    this.tasks = [];

    metricBuffer.stopTimer();
    // Flush all pending metric items remaining in RAM before process termination
    await metricBuffer.flush();
    console.log('[PingEngine] Scheduler stopped and remaining metric buffer flushed.');
  }

  // Execute a full batch cycle for all active monitors configured with a specific interval
  private async runIntervalCycle(interval: 30 | 60 | 300): Promise<void> {
    // Prevent overlapping execution cycles if previous cycle is still ongoing
    if (this.activeRuns.get(interval)) {
      console.warn(`[PingEngine] Previous cycle for interval ${interval}s is still running. Skipping.`);
      return;
    }

    this.activeRuns.set(interval, true);

    try {
      const activeMonitors = await monitorRepository.findActiveByInterval(interval);
      if (activeMonitors.length === 0) {
        return;
      }

      // Wrapping with this.limit prevents all promises from running at once
      // It executes max 5 tasks concurrently, queuing remaining items until a slot frees up
      const pingPromises = activeMonitors.map((monitor) =>
        this.limit(async () => {
          // Pacing delay (100ms) pauses each dequeued task before firing the network probe
          await new Promise((resolve) => setTimeout(resolve, this.pacingDelayMs));
          await this.processSingleMonitor(monitor);
        })
      );

      // Await completion of all queued and active probe tasks across the current cycle
      await Promise.allSettled(pingPromises);
    } catch (error) {
      console.error(`[PingEngine] Error processing interval cycle ${interval}s:`, error);
    } finally {
      this.activeRuns.set(interval, false);
    }
  }

  // Probe target monitor, push metric to buffer, and publish completion event
  async processSingleMonitor(monitor: IMonitor): Promise<void> {
    try {
      const result = await pingExecutor.pingTarget(monitor);
      await this.recordPingResult(monitor, result);
    } catch (error) {
      console.error(`[PingEngine] Failed to process monitor ${monitor._id}:`, error);
    }
  }

  // Ingest probe result into memory buffer and broadcast completion event
  async recordPingResult(monitor: IMonitor, result: PingExecutionResult): Promise<void> {
    await metricBuffer.push({
      timestamp: result.checkedAt,
      monitorId: monitor._id,
      statusCode: result.statusCode,
      latency: result.latency,
      isUp: result.isUp,
      error: result.error,
    });

    // Emit ping completion event to all subscribers (onPingCompleted)
    eventBus.emitPingCompleted({
      monitorId: monitor._id.toString(),
      userId: monitor.userId.toString(),
      statusCode: result.statusCode,
      latency: result.latency,
      isUp: result.isUp,
      timestamp: result.checkedAt.toISOString(),
      error: result.error,
    });
  }

  // Trigger immediate manual flush of the metric buffer
  async flush(): Promise<number> {
    return metricBuffer.flush();
  }

  // Expose operational diagnostics for the administrative overview endpoint
  async getStatus(): Promise<PingEngineStatus> {
    const activeCount = await monitorRepository.countActive();
    const bufferStatus = metricBuffer.getStatus();

    return {
      activeMonitorsCount: activeCount,
      bufferSize: bufferStatus.bufferSize,
      lastFlushAt: bufferStatus.lastFlushAt ? bufferStatus.lastFlushAt.toISOString() : null,
      concurrencyLimit: this.concurrencyLimit,
      isRunning: this.isRunning,
    };
  }
}

export const pingEngine = new PingEngine();

