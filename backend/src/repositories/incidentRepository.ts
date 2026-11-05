import { Types, FilterQuery } from 'mongoose';
import { BaseRepository } from './baseRepository.js';
import { Incident, IIncident, IncidentStatus, IAiPostMortem } from '../models/incidentModel.js';

export interface IncidentFilterOptions {
  status?: IncidentStatus;
  monitorId?: string;
  limit?: number;
  skip?: number;
}

// Data access repository for incident entities inheriting base CRUD operations
export class IncidentRepository extends BaseRepository<IIncident> {
  constructor() {
    super(Incident);
  }

  // Find active ongoing incident for a target monitor
  async findOngoingByMonitor(monitorId: string): Promise<IIncident | null> {
    return this.model
      .findOne({
        monitorId: new Types.ObjectId(monitorId),
        status: 'ongoing',
      })
      .exec();
  }

  // Find all active ongoing incidents across all monitors for cache warming on startup
  async findOngoing(): Promise<IIncident[]> {
    return this.model.find({ status: 'ongoing' }).exec();
  }

  // Find incidents scoped to user with optional status or monitor filter
  async findByUser(userId: string, options: IncidentFilterOptions = {}): Promise<IIncident[]> {
    const query: FilterQuery<IIncident> = {
      userId: new Types.ObjectId(userId),
    };

    if (options.status) {
      query.status = options.status;
    }

    if (options.monitorId) {
      query.monitorId = new Types.ObjectId(options.monitorId);
    }

    const limit = options.limit || 50;
    const skip = options.skip || 0;

    return this.model
      .find(query)
      .populate('monitorId', 'name url')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  // Find single incident by id scoped to owning user
  async findByIdAndUser(id: string, userId: string): Promise<IIncident | null> {
    return this.model
      .findOne({
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
      })
      .populate('monitorId', 'name url')
      .exec();
  }

  // Find incidents history for a specific monitor belonging to user
  async findByMonitorAndUser(monitorId: string, userId: string, limit = 20): Promise<IIncident[]> {
    return this.model
      .find({
        monitorId: new Types.ObjectId(monitorId),
        userId: new Types.ObjectId(userId),
      })
      .populate('monitorId', 'name url')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  // Find recent incidents for a monitor without user scoping (for public status page)
  async findRecentByMonitor(monitorId: string, limit = 5): Promise<IIncident[]> {
    return this.model
      .find({
        monitorId: new Types.ObjectId(monitorId),
      })
      .populate('monitorId', 'name url')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  // Delete all incidents associated with a target monitor
  async deleteByMonitor(monitorId: string): Promise<number> {
    const result = await this.model.deleteMany({ monitorId: new Types.ObjectId(monitorId) }).exec();
    return result.deletedCount || 0;
  }

  // Delete all incidents associated with a user
  async deleteByUser(userId: string): Promise<number> {
    const result = await this.model.deleteMany({ userId: new Types.ObjectId(userId) }).exec();
    return result.deletedCount || 0;
  }

  // Atomically mark incident resolved with recovery timestamp
  async resolveIncident(id: string, resolvedAt: Date): Promise<IIncident | null> {
    return this.model
      .findByIdAndUpdate(
        id,
        {
          $set: {
            status: 'resolved',
            resolvedAt,
          },
        },
        { new: true }
      )
      .exec();
  }

  // Update AI incident analysis post-mortem data
  async updateAiPostMortem(id: string, postMortem: IAiPostMortem): Promise<IIncident | null> {
    return this.model
      .findByIdAndUpdate(
        id,
        {
          $set: {
            aiPostMortem: postMortem,
          },
        },
        { new: true }
      )
      .exec();
  }

  // Count incidents for a user with optional status filter
  async countByUser(userId: string, status?: IncidentStatus): Promise<number> {
    const query: FilterQuery<IIncident> = {
      userId: new Types.ObjectId(userId),
    };

    if (status) {
      query.status = status;
    }

    return this.model.countDocuments(query).exec();
  }
}

export const incidentRepository = new IncidentRepository();

