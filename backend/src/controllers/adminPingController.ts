import { Request, Response, NextFunction } from 'express';
import { pingEngine } from '../services/pingEngine.js';
import { sendSuccess } from '../utils/response.js';

// Force an immediate manual flush of the in-memory metric buffer
export async function forceFlushBuffer(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const flushedCount = await pingEngine.flush();
    sendSuccess(res, { flushedCount }, 'Buffer flushed successfully');
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

