import { Request, Response } from 'express';
import { healthService } from '../services/healthService.js';

// Controller handler delegating healthcheck retrieval to application service
export function getHealthStatus(_req: Request, res: Response): Response {
  const healthData = healthService.getHealthStatus();
  const statusCode = healthData.status === 'healthy' ? 200 : 503;

  return res.status(statusCode).json(healthData);
}
