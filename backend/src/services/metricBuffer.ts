import { CreatePingMetricDto } from '../models/pingMetricModel.js';
import { MonitorStatus } from '../models/monitorModel.js';
import { pingMetricRepository } from '../repositories/pingMetricRepository.js';
import { monitorRepository } from '../repositories/monitorRepository.js';

export interface BufferStatus {
  bufferSize: number;
  lastFlushAt: Date | null;
  isFlushing: boolean;
}

// In-memory metrics buffer aggregating high-frequency ping metrics before bulk persistence
export class MetricBuffer {
  private buffer: CreatePingMetricDto[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;
  private lastFlushAt: Date | null = null;
  private readonly batchSizeLimit = 100;
  private readonly flushIntervalMs = 5000;

  // Initialize background timer ticking every 5 seconds to flush accumulated metrics
  startTimer(): void {
    if (this.flushTimer) {
      return;
    }

    this.flushTimer = setInterval(async () => {
      await this.flush();
    }, this.flushIntervalMs);
  }

  // Clear timer when shutting down service
  stopTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  // Push metric item into memory buffer and trigger immediate flush if capacity limit is reached
  async push(metric: CreatePingMetricDto): Promise<void> {
    this.buffer.push(metric);

    if (this.buffer.length >= this.batchSizeLimit) {
      await this.flush();
    }
  }

  // Flush buffer to database using unordered bulk operations for both metrics and monitor states
  async flush(): Promise<number> {
    if (this.isFlushing || this.buffer.length === 0) {
      return 0;
    }

    this.isFlushing = true;
    // Atomically drain items currently in buffer to isolate current batch
    const itemsToFlush = this.buffer.splice(0);

    try {
      // 1. Bulk insert time-series metrics into MongoDB
      await pingMetricRepository.bulkInsert(itemsToFlush);

      // 2. Aggregate latest state per monitor to perform single bulk update on monitors collection via repository
      const latestUpdates = new Map<string, { status: MonitorStatus; lastCheckedAt: Date }>();
      for (const item of itemsToFlush) {
        const idStr = item.monitorId.toString();
        latestUpdates.set(idStr, {
          status: item.isUp ? 'up' : 'down',
          lastCheckedAt: item.timestamp,
        });
      }

      if (latestUpdates.size > 0) {
        await monitorRepository.bulkUpdateStatus(latestUpdates);
      }

      this.lastFlushAt = new Date();
      return itemsToFlush.length;
    } catch (error) {
      // Re-insert items at the beginning of buffer so no metric records are lost during network glitches
      this.buffer.unshift(...itemsToFlush);
      console.error('[MetricBuffer] Error during metric bulkWrite flush:', error);
      return 0;
    } finally {
      this.isFlushing = false;
    }
  }

  // Retrieve current operational state of the in-memory buffer
  getStatus(): BufferStatus {
    return {
      bufferSize: this.buffer.length,
      lastFlushAt: this.lastFlushAt,
      isFlushing: this.isFlushing,
    };
  }
}

export const metricBuffer = new MetricBuffer();

