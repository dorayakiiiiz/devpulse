import mongoose from 'mongoose';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  uptimeSeconds: number;
  timestamp: string;
  database: {
    status: 'connected' | 'disconnected';
  };
  memory: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
  };
}

// Service responsible for collecting system runtime health metrics
export class HealthService {
  // Collect process memory and database connectivity status
  getHealthStatus(): HealthCheckResult {
    const isDbConnected = mongoose.connection.readyState === 1;
    const memoryUsage = process.memoryUsage();

    return {
      status: isDbConnected ? 'healthy' : 'unhealthy',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      database: {
        status: isDbConnected ? 'connected' : 'disconnected',
      },
      memory: {
        heapUsedMB: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalMB: Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100,
        rssMB: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
      },
    };
  }
}

export const healthService = new HealthService();

