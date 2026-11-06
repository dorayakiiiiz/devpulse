import { Types } from 'mongoose';
import { userRepository } from '../repositories/userRepository.js';
import { monitorRepository } from '../repositories/monitorRepository.js';
import { incidentRepository } from '../repositories/incidentRepository.js';
import { pingMetricRepository } from '../repositories/pingMetricRepository.js';
import { memoryCache } from '../utils/cache.js';
import { AppError } from '../utils/appError.js';
import { IMonitor } from '../models/monitorModel.js';

export interface PublicMonitorStatus {
  name: string;
  url: string;
  status: 'up' | 'down';
  uptimePercentage24h: number;
  lastCheckedAt: string | null;
}

export interface PublicIncidentItem {
  id: string;
  monitorName: string;
  status: 'ongoing' | 'resolved';
  startedAt: string;
  resolvedAt: string | null;
  summary: string;
}

export interface PublicStatusPageResponse {
  systemStatus: 'all_operational' | 'partial_outage' | 'major_outage';
  systemName: string;
  monitors: PublicMonitorStatus[];
  recentIncidents: PublicIncidentItem[];
  cachedAt: string;
}

const STATUS_PAGE_CACHE_PREFIX = 'status_page:';
const CACHE_TTL_SECONDS = 30;

// Type guard identifying populated monitor documents safely
function isPopulatedMonitor(monitor: Types.ObjectId | IMonitor): monitor is IMonitor {
  return typeof monitor === 'object' && monitor !== null && 'name' in monitor;
}

// Service aggregating public status metrics with stampede-protected in-memory caching
export class StatusPageService {
  // Retrieve public status page data with 30s cache stampede mitigation
  async getStatusPageData(slug: string): Promise<PublicStatusPageResponse> {
    const normalizedSlug = slug.toLowerCase().trim();
    const cacheKey = `${STATUS_PAGE_CACHE_PREFIX}${normalizedSlug}`;

    return memoryCache.getOrSet(
      cacheKey,
      async () => {
        const user = await userRepository.findBySlug(normalizedSlug);
        if (!user) {
          throw new AppError('Status page not found', 404);
        }

        const userIdStr = user._id.toString();
        const activeMonitors = await monitorRepository.findActiveByUser(userIdStr);
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
          status: monitor.status === 'down' ? 'down' : 'up',
          uptimePercentage24h: uptimeMap.get(monitor._id.toString()) ?? 100,
          lastCheckedAt: monitor.lastCheckedAt ? monitor.lastCheckedAt.toISOString() : null,
        }));

        const publicIncidents: PublicIncidentItem[] = recentIncidents.map((incident) => {
          const monitorName = isPopulatedMonitor(incident.monitorId)
            ? incident.monitorId.name
            : 'Target Service';

          const summary =
            incident.aiPostMortem?.summary ||
            incident.errorDetails.errorMessage ||
            'Service disruption detected';

          return {
            id: incident._id.toString(),
            monitorName,
            status: incident.status,
            startedAt: incident.startedAt.toISOString(),
            resolvedAt: incident.resolvedAt ? incident.resolvedAt.toISOString() : null,
            summary,
          };
        });

        return {
          systemStatus,
          systemName: user.name,
          monitors: publicMonitors,
          recentIncidents: publicIncidents,
          cachedAt: new Date().toISOString(),
        };
      },
      CACHE_TTL_SECONDS
    );
  }

  // Clear cached status page entry for a given slug
  clearCache(slug: string): void {
    const normalizedSlug = slug.toLowerCase().trim();
    memoryCache.del(`${STATUS_PAGE_CACHE_PREFIX}${normalizedSlug}`);
  }

  // Invalidate cache entry associated with a user
  async invalidateCacheForUser(userId: string): Promise<void> {
    const user = await userRepository.findById(userId);
    if (user) {
      this.clearCache(user.slug);
    }
  }
}

export const statusPageService = new StatusPageService();

