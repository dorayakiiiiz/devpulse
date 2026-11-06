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

