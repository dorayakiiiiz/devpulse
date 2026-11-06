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
          monitorId: metric.monitorId,
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

  // Delete all metrics associated with a specific monitor
  async deleteByMonitor(monitorId: string): Promise<number> {
    const result = await this.model.deleteMany({ monitorId: new Types.ObjectId(monitorId) }).exec();
    return result.deletedCount || 0;
  }

  // Delete all metrics associated with a list of monitors
  async deleteByMonitors(monitorIds: Types.ObjectId[]): Promise<number> {
    if (monitorIds.length === 0) return 0;
    const result = await this.model.deleteMany({ monitorId: { $in: monitorIds } }).exec();
    return result.deletedCount || 0;
  }

  // Calculate 24-hour uptime percentage across multiple monitors using an aggregation pipeline
  async calculateUptime24h(monitorIds: Types.ObjectId[]): Promise<Map<string, number>> {
    const uptimeMap = new Map<string, number>();
    if (monitorIds.length === 0) {
      return uptimeMap;
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const stats = await this.model.aggregate<{ _id: Types.ObjectId; total: number; up: number }>([
      {
        $match: {
          monitorId: { $in: monitorIds },
          timestamp: { $gte: twentyFourHoursAgo },
        },
      },
      {
        $group: {
          _id: '$monitorId',
          total: { $sum: 1 },
          up: { $sum: { $cond: ['$isUp', 1, 0] } },
        },
      },
    ]);

    for (const stat of stats) {
      const percentage = stat.total > 0 ? Math.round((stat.up / stat.total) * 10000) / 100 : 100;
      uptimeMap.set(stat._id.toString(), percentage);
    }

    return uptimeMap;
  }
}

export const pingMetricRepository = new PingMetricRepository();

