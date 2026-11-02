import { Types } from 'mongoose';
import { BaseRepository } from './baseRepository.js';
import { IPingMetric, PingMetric, CreatePingMetricDto } from '../models/pingMetricModel.js';

export class PingMetricRepository extends BaseRepository<IPingMetric> {
  constructor() {
    super(PingMetric);
  }

  // Insert a batch of metrics into the time-series collection using an unordered bulkWrite
  async bulkInsert(metrics: CreatePingMetricDto[]): Promise<number> {
    if (metrics.length === 0) {
      return 0;
    }

    const operations = metrics.map((metric) => ({
      insertOne: {
        document: {
          timestamp: metric.timestamp,
          monitorId: typeof metric.monitorId === 'string' ? new Types.ObjectId(metric.monitorId) : metric.monitorId,
          statusCode: metric.statusCode,
          latency: metric.latency,
          isUp: metric.isUp,
          error: metric.error || null,
        },
      },
    }));

    const result = await this.model.bulkWrite(operations, { ordered: false });
    return result.insertedCount || 0;
  }

  // Retrieve the latest ping metrics for a specific monitor
  async findRecentByMonitor(monitorId: string, limit = 50): Promise<IPingMetric[]> {
    return this.model
      .find({ monitorId: new Types.ObjectId(monitorId) })
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }
}

export const pingMetricRepository = new PingMetricRepository();

