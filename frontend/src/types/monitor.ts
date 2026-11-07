export type MonitorStatus = 'up' | 'down' | 'pending' | 'paused';
export type HttpMethod = 'GET' | 'POST' | 'HEAD';

export interface SslInfoDto {
  issuer: string;
  validTo: string;
  daysRemaining: number;
  lastCheckedAt: string;
}

export interface MonitorResponseDto {
  id: string;
  userId: string;
  name: string;
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  interval: number;
  isActive: boolean;
  status: MonitorStatus;
  lastCheckedAt: string | null;
  sslInfo?: SslInfoDto;
  createdAt: string;
  updatedAt: string;
}

export interface MonitorMetricDto {
  id: string;
  monitorId: string;
  timestamp: string;
  statusCode: number;
  latency: number;
  isUp: boolean;
  error: string | null;
}

export interface InstantPingResponseDto {
  monitorId: string;
  statusCode: number;
  latency: number;
  isUp: boolean;
  checkedAt: string;
  error?: string;
}

export interface CreateMonitorPayload {
  name: string;
  url: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  interval: 30 | 60 | 300;
}

export interface UpdateMonitorPayload {
  name?: string;
  url?: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  interval?: 30 | 60 | 300;
}
