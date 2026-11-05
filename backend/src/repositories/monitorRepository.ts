import { Types, UpdateQuery } from 'mongoose';
import { BaseRepository } from './baseRepository.js';
import { IMonitor, Monitor, MonitorStatus } from '../models/monitorModel.js';

// Repository handling persistence operations for the monitors collection
export class MonitorRepository extends BaseRepository<IMonitor> {
  constructor() {
    super(Monitor);
  }

  // Find all monitors belonging to a specific user ordered by creation date
  async findByUser(userId: string): Promise<IMonitor[]> {
    return this.model.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).exec();
  }

  // Find a monitor scoped strictly to its primary key and owning user ID
  async findByIdAndUser(id: string, userId: string): Promise<IMonitor | null> {
    return this.model.findOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) }).exec();
  }

  // Update a monitor scoped strictly to its primary key and owning user ID
  async updateByIdAndUser(id: string, userId: string, update: UpdateQuery<IMonitor>): Promise<IMonitor | null> {
    return this.model
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
        update,
        { new: true }
      )
      .exec();
  }

  // Delete a monitor scoped to its primary key and owning user ID
  async deleteByIdAndUser(id: string, userId: string): Promise<IMonitor | null> {
    return this.model.findOneAndDelete({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) }).exec();
  }

  // Delete all monitors belonging to a specific user
  async deleteByUser(userId: string): Promise<number> {
    const result = await this.model.deleteMany({ userId: new Types.ObjectId(userId) }).exec();
    return result.deletedCount || 0;
  }

  // Retrieve active monitors matching a designated execution interval
  async findActiveByInterval(interval: number): Promise<IMonitor[]> {
    return this.model.find({ isActive: true, interval }).exec();
  }

  // Count total active monitors configured across the system
  async countActive(): Promise<number> {
    return this.model.countDocuments({ isActive: true }).exec();
  }

  // Bulk update status and lastCheckedAt for multiple monitors in a single database round-trip
  async bulkUpdateStatus(updates: Map<string, { status: MonitorStatus; lastCheckedAt: Date }>): Promise<number> {
    if (updates.size === 0) {
      return 0;
    }

    const operations = Array.from(updates.entries()).map(([id, update]) => ({
      updateOne: {
        filter: { _id: new Types.ObjectId(id), isActive: true },
        update: {
          $set: {
            status: update.status,
            lastCheckedAt: update.lastCheckedAt,
          },
        },
      },
    }));

    const result = await this.model.bulkWrite(operations, { ordered: false });
    return result.modifiedCount || 0;
  }
}

export const monitorRepository = new MonitorRepository();
