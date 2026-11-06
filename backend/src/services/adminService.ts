import { userRepository } from '../repositories/userRepository.js';
import { monitorRepository } from '../repositories/monitorRepository.js';
import { incidentRepository } from '../repositories/incidentRepository.js';
import { pingEngine } from './pingEngine.js';

export interface AdminOverviewResponse {
  counts: {
    totalUsers: number;
    totalMonitors: number;
    activeMonitors: number;
    ongoingIncidents: number;
  };
  pingEngine: {
    bufferSize: number;
    lastFlushAt: string | null;
    concurrencyLimit: number;
  };
  systemMemory: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
  };
  serverUptimeSeconds: number;
}

// Service collecting system-wide administrative statistics and runtime telemetry
export class AdminService {
  // Aggregate system-wide macro statistics across all data sources
  async getOverview(): Promise<AdminOverviewResponse> {
    const [totalUsers, totalMonitors, activeMonitors, ongoingIncidents, pingEngineStatus] =
      await Promise.all([
        userRepository.count(),
        monitorRepository.count(),
        monitorRepository.countActive(),
        incidentRepository.count({ status: 'ongoing' }),
        pingEngine.getStatus(),
      ]);

    const memoryUsage = process.memoryUsage();

    return {
      counts: {
        totalUsers,
        totalMonitors,
        activeMonitors,
        ongoingIncidents,
      },
      pingEngine: {
        bufferSize: pingEngineStatus.bufferSize,
        lastFlushAt: pingEngineStatus.lastFlushAt,
        concurrencyLimit: pingEngineStatus.concurrencyLimit,
      },
      systemMemory: {
        heapUsedMB: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalMB: Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100,
        rssMB: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
      },
      serverUptimeSeconds: Math.floor(process.uptime()),
    };
  }
}

export const adminService = new AdminService();

