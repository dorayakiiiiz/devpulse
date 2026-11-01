import { Types, UpdateQuery } from 'mongoose';
import { BaseRepository } from './baseRepository.js';
import { IMonitor, Monitor } from '../models/monitorModel.js';

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

  // Retrieve active monitors matching a designated execution interval
  async findActiveByInterval(interval: number): Promise<IMonitor[]> {
    return this.model.find({ isActive: true, interval }).exec();
  }
}

export const monitorRepository = new MonitorRepository();
