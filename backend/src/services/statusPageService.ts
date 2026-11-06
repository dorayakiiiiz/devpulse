import { userRepository } from '../repositories/userRepository.js';
import { monitorRepository } from '../repositories/monitorRepository.js';
import { incidentRepository } from '../repositories/incidentRepository.js';
import { pingMetricRepository } from '../repositories/pingMetricRepository.js';
import { memoryCache } from '../utils/cache.js';
import { AppError } from '../utils/appError.js';
import { IMonitor, MonitorStatus } from '../models/monitorModel.js';

export interface PublicMonitorStatus {
  name: string;
  url: string;
  status: MonitorStatus;
  uptimePercentage24h: number;
  lastCheckedAt: string | null;
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

const STATUS_PAGE_DATA_PREFIX = 'status_page:data:';
const STATUS_PAGE_SLUG_PREFIX = 'status_page:slug:';
const DATA_CACHE_TTL_SECONDS = 30;
const SLUG_ROUTING_TTL_SECONDS = 86400;

// Service aggregating public status metrics with stampede-protected in-memory caching
export class StatusPageService {
  // Retrieve public status page data with 30s cache stampede mitigation and 2-tier routing cache
  async getStatusPageData(slug: string): Promise<PublicStatusPageResponse> {
    const normalizedSlug = slug.toLowerCase().trim();

    // Resolve userId mapping from routing pointer cache (24h TTL)
    const userId = await memoryCache.getOrSet(
      `${STATUS_PAGE_SLUG_PREFIX}${normalizedSlug}`,
      async () => {
        const user = await userRepository.findBySlug(normalizedSlug);
        if (!user) {
          throw new AppError('Status page not found', 404);
        }
        return user._id.toString();
      },
      SLUG_ROUTING_TTL_SECONDS
    );

    // Fetch or return status page data cached by primary entity userId (30s TTL)
    return memoryCache.getOrSet(
      `${STATUS_PAGE_DATA_PREFIX}${userId}`,
      () => this.fetchStatusPageData(userId),
      DATA_CACHE_TTL_SECONDS
    );
  }

  // Fetch aggregate status metrics directly from database
  private async fetchStatusPageData(userId: string): Promise<PublicStatusPageResponse> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('Status page not found', 404);
    }

    const activeMonitors = await monitorRepository.findActiveByUser(userId);
    const monitorIds = activeMonitors.map((m) => m._id);

    const [uptimeMap, recentIncidents] = await Promise.all([
      pingMetricRepository.calculateUptime24h(monitorIds),
      incidentRepository.findRecentForStatusPage(monitorIds, 5),
    ]);

    // Calculate overall system operational status
    let systemStatus: PublicStatusPageResponse['systemStatus'] = 'all_operational';
    if (activeMonitors.length > 0) {
      const downCount = activeMonitors.filter((m) => m.status === 'down').length;
      if (downCount === activeMonitors.length) {
        systemStatus = 'major_outage';
      } else if (downCount > 0) {
        systemStatus = 'partial_outage';
      }
    }

    const publicMonitors: PublicMonitorStatus[] = activeMonitors.map((monitor) => ({
      name: monitor.name,
      url: monitor.url,
      status: monitor.status,
      uptimePercentage24h: uptimeMap.get(monitor._id.toString()) ?? 100,
      lastCheckedAt: monitor.lastCheckedAt ? monitor.lastCheckedAt.toISOString() : null,
    }));

    const publicIncidents: PublicIncidentItem[] = recentIncidents.map((incident) => {
      const populatedMonitor = incident.monitorId as IMonitor;
      return {
        id: incident._id.toString(),
        monitorName: populatedMonitor.name,
        status: incident.status,
        startedAt: incident.startedAt.toISOString(),
        resolvedAt: incident.resolvedAt ? incident.resolvedAt.toISOString() : null,
        errorMessage: incident.errorDetails.errorMessage,
        aiSummary: incident.aiPostMortem?.summary,
      };
    });

    return {
      systemStatus,
      systemName: user.name,
      monitors: publicMonitors,
      recentIncidents: publicIncidents,
      cachedAt: new Date().toISOString(),
    };
  }

  // Invalidate cached status page data for designated user with 0 DB queries
  invalidateCache(userId: string): void {
    memoryCache.del(`${STATUS_PAGE_DATA_PREFIX}${userId}`);
  }

  // Invalidate routing pointer cache for designated slug
  invalidateSlug(slug: string): void {
    memoryCache.del(`${STATUS_PAGE_SLUG_PREFIX}${slug.toLowerCase().trim()}`);
  }
}

export const statusPageService = new StatusPageService();
