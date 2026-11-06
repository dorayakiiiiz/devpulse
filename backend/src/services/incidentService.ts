import { Types } from 'mongoose';
import { incidentRepository, IncidentFilterOptions } from '../repositories/incidentRepository.js';
import { monitorRepository } from '../repositories/monitorRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { aiService } from './aiService.js';
import { emailService } from './emailService.js';
import { statusPageService } from './statusPageService.js';
import { eventBus, PingCompletedEvent } from '../utils/eventBus.js';
import { memoryCache } from '../utils/cache.js';
import { IIncident, IncidentStatus } from '../models/incidentModel.js';
import { IMonitor } from '../models/monitorModel.js';
import { AppError } from '../utils/appError.js';

// Type guard identifying populated monitor documents safely without loose casting
function isPopulatedMonitor(monitor: Types.ObjectId | IMonitor): monitor is IMonitor {
  return typeof monitor === 'object' && monitor !== null && 'name' in monitor;
}

const ONGOING_INCIDENT_CACHE_PREFIX = 'ongoing_incident:';

export interface IncidentResponseDto {
  id: string;
  monitorId: string;
  monitorName: string;
  monitorUrl: string;
  status: IncidentStatus;
  startedAt: string;
  resolvedAt: string | null;
  errorDetails: {
    statusCode: number;
    errorMessage: string;
    responseBody: string;
    responseHeaders: Record<string, string>;
  };
  aiPostMortem?: {
    summary: string;
    rootCause: string;
    actionItems: string[];
    generatedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Incident lifecycle service managing outage detection, automated post-mortem, and resolution workflows
export class IncidentService {
  constructor() {
    this.registerEventBusListeners();
  }

  // Warm in-memory cache with ongoing incidents from database on startup
  async init(): Promise<void> {
    const ongoingIncidents = await incidentRepository.findOngoing();
    for (const incident of ongoingIncidents) {
      memoryCache.set(
        `${ONGOING_INCIDENT_CACHE_PREFIX}${incident.monitorId.toString()}`,
        incident._id.toString(),
        0
      );
    }
  }

  // Subscribe to internal PingCompleted events from Ping Engine
  private registerEventBusListeners(): void {
    eventBus.onPingCompleted(async (payload: PingCompletedEvent) => {
      await this.handlePingCompleted(payload);
    });
  }

  // Process completed probe result, creating or resolving incidents accordingly
  async handlePingCompleted(payload: PingCompletedEvent): Promise<void> {
    if (!payload.isUp) {
      await this.handleTargetFailure(payload);
    } else {
      await this.handleTargetRecovery(payload);
    }
  }

  // Handle failed probe: create new ongoing incident if none exists in cache
  private async handleTargetFailure(payload: PingCompletedEvent): Promise<void> {
    const cacheKey = `${ONGOING_INCIDENT_CACHE_PREFIX}${payload.monitorId}`;
    if (memoryCache.has(cacheKey)) {
      return;
    }

    const monitor = await monitorRepository.findById(payload.monitorId);
    if (!monitor) {
      return;
    }

    const startedDate = new Date(payload.timestamp);
    const incident = await incidentRepository.create({
      monitorId: monitor._id,
      userId: monitor.userId,
      status: 'ongoing',
      startedAt: startedDate,
      resolvedAt: null,
      errorDetails: {
        statusCode: payload.statusCode,
        errorMessage: payload.error || 'Health check probe failed',
        responseBody: '',
        responseHeaders: new Map(),
      },
    });

    // Cache ongoing incident id indefinitely until resolved (TTL = 0)
    memoryCache.set(cacheKey, incident._id.toString(), 0);

    // Broadcast initial failure alert immediately so dashboard reflects outage with pending AI state
    eventBus.emitIncidentAlert({
      incidentId: incident._id.toString(),
      monitorId: payload.monitorId,
      userId: payload.userId,
      status: 'ongoing',
      startedAt: payload.timestamp,
      errorMessage: payload.error,
    });

    // Invalidate public status page cache immediately upon outage detection
    void statusPageService.invalidateCacheForUser(payload.userId);

    // Push task into AI background queue for automated diagnosis and email alert
    aiService.queueIncidentAnalysis({
      incidentId: incident._id.toString(),
      monitorId: monitor._id.toString(),
      userId: monitor.userId.toString(),
      monitorName: monitor.name,
      monitorUrl: monitor.url,
      startedAt: payload.timestamp,
      statusCode: payload.statusCode,
      errorMessage: payload.error || 'Health check probe failed',
    });
  }

  // Handle successful probe: resolve ongoing incident if one exists in cache
  private async handleTargetRecovery(payload: PingCompletedEvent): Promise<void> {
    const cacheKey = `${ONGOING_INCIDENT_CACHE_PREFIX}${payload.monitorId}`;
    const ongoingIncidentId = memoryCache.get<string>(cacheKey);
    if (!ongoingIncidentId) {
      return;
    }

    const resolvedDate = new Date(payload.timestamp);
    const resolvedIncident = await incidentRepository.resolveIncident(
      ongoingIncidentId,
      resolvedDate
    );

    // Evict ongoing incident from memory cache
    memoryCache.del(cacheKey);

    if (!resolvedIncident) {
      return;
    }

    eventBus.emitIncidentAlert({
      incidentId: resolvedIncident._id.toString(),
      monitorId: payload.monitorId,
      userId: payload.userId,
      status: 'resolved',
      startedAt: resolvedIncident.startedAt.toISOString(),
      resolvedAt: payload.timestamp,
    });

    // Invalidate public status page cache upon target recovery
    void statusPageService.invalidateCacheForUser(payload.userId);

    const monitor = await monitorRepository.findById(payload.monitorId);
    const user = await userRepository.findById(payload.userId);

    if (monitor && user) {
      const durationMs = resolvedDate.getTime() - resolvedIncident.startedAt.getTime();
      const downtimeDuration = this.formatDuration(durationMs);

      emailService.sendIncidentResolvedEmail(
        user.email,
        monitor.name,
        monitor.url,
        resolvedIncident.startedAt.toISOString(),
        resolvedDate.toISOString(),
        downtimeDuration
      );
    }
  }

  // Retrieve user incidents formatted as client DTOs
  async getIncidents(userId: string, options: IncidentFilterOptions = {}): Promise<IncidentResponseDto[]> {
    const incidents = await incidentRepository.findByUser(userId, options);
    return incidents.map((incident) => this.mapToDto(incident));
  }

  // Retrieve single incident details by id verifying tenant ownership
  async getIncidentById(id: string, userId: string): Promise<IncidentResponseDto> {
    const incident = await incidentRepository.findByIdAndUser(id, userId);
    if (!incident) {
      throw new AppError('Incident not found', 404);
    }
    return this.mapToDto(incident);
  }

  // Retrieve incident history for a monitor owned by user
  async getMonitorIncidents(monitorId: string, userId: string): Promise<IncidentResponseDto[]> {
    const monitor = await monitorRepository.findByIdAndUser(monitorId, userId);
    if (!monitor) {
      throw new AppError('Monitor not found', 404);
    }
    const incidents = await incidentRepository.findByMonitorAndUser(monitorId, userId);
    return incidents.map((incident) => this.mapToDto(incident));
  }

  // Manually mark an ongoing incident resolved
  async resolveIncidentManually(id: string, userId: string): Promise<IncidentResponseDto> {
    const incident = await incidentRepository.findByIdAndUser(id, userId);
    if (!incident) {
      throw new AppError('Incident not found', 404);
    }

    if (incident.status === 'resolved') {
      return this.mapToDto(incident);
    }

    const resolvedDate = new Date();
    const updated = await incidentRepository.resolveIncident(id, resolvedDate);
    if (!updated) {
      throw new AppError('Failed to resolve incident', 500);
    }

    // Evict ongoing incident from memory cache so subsequent failures can register new incidents
    const cacheKey = `${ONGOING_INCIDENT_CACHE_PREFIX}${incident.monitorId}`;
    memoryCache.del(cacheKey);

    eventBus.emitIncidentAlert({
      incidentId: incident._id.toString(),
      monitorId: incident.monitorId.toString(),
      userId,
      status: 'resolved',
      startedAt: incident.startedAt.toISOString(),
      resolvedAt: resolvedDate.toISOString(),
    });

    // Invalidate public status page cache upon manual incident resolution
    void statusPageService.invalidateCacheForUser(userId);

    return this.mapToDto(updated);
  }

  // Re-run automated AI post-mortem analysis on existing incident
  async reanalyzeIncident(id: string, userId: string): Promise<IncidentResponseDto> {
    const incident = await incidentRepository.findByIdAndUser(id, userId);
    if (!incident) {
      throw new AppError('Incident not found', 404);
    }

    const monitor = await monitorRepository.findById(incident.monitorId.toString());
    const targetUrl = monitor ? monitor.url : 'Unknown target';

    const postMortem = await aiService.generatePostMortem({
      targetUrl,
      statusCode: incident.errorDetails.statusCode,
      errorMessage: incident.errorDetails.errorMessage,
      responseBody: incident.errorDetails.responseBody,
    });

    if (!postMortem) {
      throw new AppError('AI analysis unavailable. Please check LLM configuration.', 503);
    }

    const updated = await incidentRepository.updateAiPostMortem(id, {
      summary: postMortem.summary,
      rootCause: postMortem.rootCause,
      actionItems: postMortem.actionItems,
      generatedAt: new Date(),
    });

    if (!updated) {
      throw new AppError('Failed to update incident analysis', 500);
    }

    eventBus.emitIncidentAlert({
      incidentId: incident._id.toString(),
      monitorId: incident.monitorId.toString(),
      userId,
      status: 'ongoing',
      startedAt: incident.startedAt.toISOString(),
      errorMessage: incident.errorDetails.errorMessage,
      aiPostMortem: {
        summary: postMortem.summary,
        rootCause: postMortem.rootCause,
        actionItems: postMortem.actionItems,
        generatedAt: updated.aiPostMortem!.generatedAt.toISOString(),
      },
    });

    return this.mapToDto(updated);
  }

  // Format millisecond duration into concise human-readable representation
  private formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    if (totalSeconds < 60) {
      return `${totalSeconds} seconds`;
    }

    const totalMinutes = Math.floor(totalSeconds / 60);
    if (totalMinutes < 60) {
      return `${totalMinutes} minute${totalMinutes > 1 ? 's' : ''}`;
    }

    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    if (remainingMinutes === 0) {
      return `${totalHours} hour${totalHours > 1 ? 's' : ''}`;
    }

    return `${totalHours} hour${totalHours > 1 ? 's' : ''} ${remainingMinutes} min`;
  }

  // Format database document to client DTO representation
  private mapToDto(incident: IIncident): IncidentResponseDto {
    let monitorId = incident.monitorId.toString();
    let monitorName = 'Unknown Target';
    let monitorUrl = '';

    if (isPopulatedMonitor(incident.monitorId)) {
      monitorId = incident.monitorId._id.toString();
      monitorName = incident.monitorId.name;
      monitorUrl = incident.monitorId.url;
    }

    return {
      id: incident._id.toString(),
      monitorId,
      monitorName,
      monitorUrl,
      status: incident.status,
      startedAt: incident.startedAt.toISOString(),
      resolvedAt: incident.resolvedAt ? incident.resolvedAt.toISOString() : null,
      errorDetails: {
        statusCode: incident.errorDetails.statusCode,
        errorMessage: incident.errorDetails.errorMessage,
        responseBody: incident.errorDetails.responseBody,
        responseHeaders: Object.fromEntries(incident.errorDetails.responseHeaders),
      },
      aiPostMortem: incident.aiPostMortem
        ? {
            summary: incident.aiPostMortem.summary,
            rootCause: incident.aiPostMortem.rootCause,
            actionItems: incident.aiPostMortem.actionItems,
            generatedAt: incident.aiPostMortem.generatedAt.toISOString(),
          }
        : undefined,
      createdAt: incident.createdAt.toISOString(),
      updatedAt: incident.updatedAt.toISOString(),
    };
  }
}

export const incidentService = new IncidentService();
