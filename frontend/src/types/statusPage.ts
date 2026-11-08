import { MonitorStatus } from './monitor';

export interface PublicMonitorStatus {
  name: string;
  url: string;
  status: MonitorStatus;
  uptimePercentage24h: number;
  lastCheckedAt: string | null;
  recentPings: Array<{
    isUp: boolean;
    latency: number;
    timestamp: string;
  }>;
}

export interface PublicIncidentItem {
  id: string;
  monitorName: string;
  status: 'ongoing' | 'resolved';
  startedAt: string;
  resolvedAt: string | null;
  errorMessage: string;
  aiSummary?: string;
}

export interface PublicStatusPageResponse {
  systemStatus: 'all_operational' | 'partial_outage' | 'major_outage';
  systemName: string;
  monitors: PublicMonitorStatus[];
  recentIncidents: PublicIncidentItem[];
  cachedAt: string;
}
