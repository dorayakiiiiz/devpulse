import { Request, Response } from 'express';
import { healthService } from '../services/healthService.js';

// Controller handler delegating healthcheck retrieval to application service for Docker daemon
export async function getHealthStatus(_req: Request, res: Response): Promise<Response> {
  const healthData = await healthService.getHealthStatus();
  const statusCode = healthData.status === 'ok' ? 200 : 503;

  return res.status(statusCode).json(healthData);
}
