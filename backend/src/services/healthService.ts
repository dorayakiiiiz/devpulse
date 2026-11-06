import mongoose from 'mongoose';

export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptimeSeconds: number;
  database: {
    status: 'connected' | 'disconnected';
    pingMs: number;
  };
  memory: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
  };
}

// Service collecting runtime system health metrics and database latency for Docker monitoring
export class HealthService {
  // Collect process health status and verify MongoDB connectivity with ping measurement
  async getHealthStatus(): Promise<HealthCheckResponse> {
    const isDbConnected = mongoose.connection.readyState === 1;
    let pingMs = 0;
    let dbStatus: 'connected' | 'disconnected' = 'disconnected';

    if (isDbConnected && mongoose.connection.db) {
      try {
        const start = Date.now();
        await mongoose.connection.db.admin().ping();
        pingMs = Date.now() - start;
        dbStatus = 'connected';
      } catch {
        dbStatus = 'disconnected';
      }
    }

    const memoryUsage = process.memoryUsage();
    const isHealthy = dbStatus === 'connected';

    return {
      status: isHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        status: dbStatus,
        pingMs,
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
