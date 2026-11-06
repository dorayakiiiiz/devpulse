import { Request, Response, NextFunction } from 'express';
import { statusPageService } from '../services/statusPageService.js';
import { sendSuccess } from '../utils/response.js';

// Retrieve public status page data with HTTP edge caching headers
export async function getStatusPage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await statusPageService.getStatusPageData(req.params.slug);
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60');
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

// Clear in-memory status page cache entry for designated slug (Admin only)
export function clearStatusPageCache(req: Request, res: Response, next: NextFunction): void {
  try {
    statusPageService.clearCache(req.params.slug);
    sendSuccess(res, null, 'Status page cache cleared successfully');
  } catch (error) {
    next(error);
  }
}

