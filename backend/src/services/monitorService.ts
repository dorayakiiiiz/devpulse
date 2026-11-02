import { Types } from 'mongoose';
import { monitorRepository } from '../repositories/monitorRepository.js';
import { IMonitor, HttpMethod, MonitorStatus, ISslInfo } from '../models/monitorModel.js';
import { checkSslCertificate } from '../utils/sslChecker.js';
import { memoryCache } from '../utils/cache.js';
import { AppError } from '../utils/appError.js';
import { pingExecutor } from './pingExecutor.js';
import { pingEngine } from './pingEngine.js';

export interface CreateMonitorDto {
  name: string;
  url: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  interval: 30 | 60 | 300;
}

export interface UpdateMonitorDto {
  name?: string;
  url?: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  interval?: 30 | 60 | 300;
}

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

export interface InstantPingResponseDto {
  monitorId: string;
  statusCode: number;
  latency: number;
  isUp: boolean;
  checkedAt: string;
  error?: string;
}

// Service encapsulating monitor lifecycle management and network inspection routines
export class MonitorService {
  // Create a new monitor with initial SSL inspection for HTTPS targets
  async createMonitor(userId: string, data: CreateMonitorDto): Promise<MonitorResponseDto> {
    let sslInfo: ISslInfo | undefined;
    if (data.url.startsWith('https://')) {
      sslInfo = await checkSslCertificate(data.url);
    }

    const newMonitor = await monitorRepository.create({
      userId: new Types.ObjectId(userId),
      name: data.name.trim(),
      url: data.url.trim(),
      method: data.method || 'GET',
      headers: new Map(Object.entries(data.headers || {})),
      interval: data.interval,
      isActive: true,
      status: 'pending',
      sslInfo,
    });

    return this.mapToDto(newMonitor);
  }

  // Retrieve all monitors configured by a specific authenticated user
  async getMonitorsByUser(userId: string): Promise<MonitorResponseDto[]> {
    const monitors = await monitorRepository.findByUser(userId);
    return monitors.map((monitor) => this.mapToDto(monitor));
  }

  // Retrieve a single monitor scoped to the authenticated user
  async getMonitorById(userId: string, monitorId: string): Promise<MonitorResponseDto> {
    const monitor = await monitorRepository.findByIdAndUser(monitorId, userId);
    if (!monitor) {
      throw new AppError('Monitor not found', 404);
    }

    return this.mapToDto(monitor);
  }

  // Update configuration parameters for a designated monitor
  async updateMonitor(userId: string, monitorId: string, data: UpdateMonitorDto): Promise<MonitorResponseDto> {
    const monitor = await monitorRepository.findByIdAndUser(monitorId, userId);
    if (!monitor) {
      throw new AppError('Monitor not found', 404);
    }

    let updatedSslInfo = monitor.sslInfo;
    if (data.url && data.url !== monitor.url) {
      updatedSslInfo = data.url.startsWith('https://') ? await checkSslCertificate(data.url) : undefined;
    }

    if (data.name !== undefined) monitor.name = data.name.trim();
    if (data.url !== undefined) {
      monitor.url = data.url.trim();
      monitor.sslInfo = updatedSslInfo;
    }
    if (data.method !== undefined) monitor.method = data.method;
    if (data.headers !== undefined) monitor.headers = new Map(Object.entries(data.headers));
    if (data.interval !== undefined) monitor.interval = data.interval;

    await monitor.save();
    return this.mapToDto(monitor);
  }

  // Toggle monitor pause or resume status
  async toggleMonitor(userId: string, monitorId: string): Promise<MonitorResponseDto> {
    const monitor = await monitorRepository.findByIdAndUser(monitorId, userId);
    if (!monitor) {
      throw new AppError('Monitor not found', 404);
    }

    monitor.isActive = !monitor.isActive;
    monitor.status = monitor.isActive ? 'pending' : 'paused';

    await monitor.save();
    return this.mapToDto(monitor);
  }

  // Delete a monitor permanently using a single atomic scoped query
  async deleteMonitor(userId: string, monitorId: string): Promise<void> {
    const deleted = await monitorRepository.deleteByIdAndUser(monitorId, userId);
    if (!deleted) {
      throw new AppError('Monitor not found', 404);
    }
  }

  // Execute an instant on-demand ping verification subject to cooldown and rate limiting
  async triggerInstantPing(userId: string, monitorId: string): Promise<InstantPingResponseDto> {
    const monitor = await monitorRepository.findByIdAndUser(monitorId, userId);
    if (!monitor) {
      throw new AppError('Monitor not found', 404);
    }

    const cooldownKey = `ping_cooldown:${monitorId}`;
    if (memoryCache.has(cooldownKey)) {
      throw new AppError('Please wait 15 seconds before triggering another instant ping', 429);
    }

    memoryCache.set(cooldownKey, true, 15);

    // Execute probe using the shared ping executor with retry logic
    const result = await pingExecutor.pingTarget(monitor);

    // Update monitor document state
    monitor.lastCheckedAt = result.checkedAt;
    if (monitor.isActive) {
      monitor.status = result.isUp ? 'up' : 'down';
    }
    await monitor.save();

    // Delegate metric buffering and event publication to the ping engine ingestion pipeline
    await pingEngine.recordPingResult(monitor, result);

    return {
      monitorId: monitor._id.toString(),
      statusCode: result.statusCode,
      latency: result.latency,
      isUp: result.isUp,
      checkedAt: result.checkedAt.toISOString(),
      ...(result.error ? { error: result.error } : {}),
    };
  }

  // Transform internal Mongoose monitor document to client-safe response DTO
  private mapToDto(monitor: IMonitor): MonitorResponseDto {
    const rawHeaders = Object.fromEntries(monitor.headers);

    return {
      id: monitor._id.toString(),
      userId: monitor.userId.toString(),
      name: monitor.name,
      url: monitor.url,
      method: monitor.method,
      headers: rawHeaders,
      interval: monitor.interval,
      isActive: monitor.isActive,
      status: monitor.status,
      lastCheckedAt: monitor.lastCheckedAt ? monitor.lastCheckedAt.toISOString() : null,
      sslInfo: monitor.sslInfo
        ? {
            issuer: monitor.sslInfo.issuer,
            validTo: monitor.sslInfo.validTo.toISOString(),
            daysRemaining: monitor.sslInfo.daysRemaining,
            lastCheckedAt: monitor.sslInfo.lastCheckedAt.toISOString(),
          }
        : undefined,
      createdAt: monitor.createdAt.toISOString(),
      updatedAt: monitor.updatedAt.toISOString(),
    };
  }
}

export const monitorService = new MonitorService();

