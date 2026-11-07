export interface SystemHealthResponse {
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

export interface PingEngineStatus {
  activeMonitorsCount: number;
  bufferSize: number;
  lastFlushAt: string | null;
  concurrencyLimit: number;
  isRunning: boolean;
}

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
