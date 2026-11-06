import { Request, Response, NextFunction } from 'express';
import { adminService } from '../services/adminService.js';
import { pingEngine } from '../services/pingEngine.js';
import { sendSuccess } from '../utils/response.js';

// Retrieve macro administrative statistics and system resource metrics
export async function getAdminOverview(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const overview = await adminService.getOverview();
    sendSuccess(res, overview, 'Admin overview retrieved successfully');
  } catch (error) {
    next(error);
  }
}

// Retrieve operational status and diagnostic statistics of the ping engine
export async function getEngineStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = await pingEngine.getStatus();
    sendSuccess(res, status, 'Ping engine status retrieved successfully');
  } catch (error) {
    next(error);
  }
}

// Force an immediate manual flush of the in-memory metric buffer
export async function forceFlushBuffer(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const flushedCount = await pingEngine.flush();
    sendSuccess(res, { flushedCount }, 'Buffer flushed successfully');
  } catch (error) {
    next(error);
  }
}

