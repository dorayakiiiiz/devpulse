import { Request, Response, NextFunction } from 'express';
import { monitorService } from '../services/monitorService.js';
import { sendSuccess } from '../utils/response.js';

// Retrieve all monitors for the authenticated user
export async function listMonitors(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const monitors = await monitorService.getMonitorsByUser(req.user!.id);
    sendSuccess(res, monitors);
  } catch (error) {
    next(error);
  }
}

// Create a new monitor target
export async function createMonitor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const monitor = await monitorService.createMonitor(req.user!.id, req.body);
    sendSuccess(res, monitor, 'Monitor created successfully', 201);
  } catch (error) {
    next(error);
  }
}

// Retrieve single monitor details
export async function getMonitor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const monitor = await monitorService.getMonitorById(req.user!.id, req.params.id);
    sendSuccess(res, monitor);
  } catch (error) {
    next(error);
  }
}

// Retrieve historical ping metrics for a specific monitor
export async function getMonitorMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { limit, range } = req.query as { limit?: number; range?: '1h' | '24h' | '7d' };
    const metrics = await monitorService.getMonitorMetrics(req.user!.id, req.params.id, { limit, range });
    sendSuccess(res, metrics);
  } catch (error) {
    next(error);
  }
}

// Update monitor configuration
export async function updateMonitor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const monitor = await monitorService.updateMonitor(req.user!.id, req.params.id, req.body);
    sendSuccess(res, monitor, 'Monitor updated successfully');
  } catch (error) {
    next(error);
  }
}

// Toggle monitor pause or resume status
export async function toggleMonitor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const monitor = await monitorService.toggleMonitor(req.user!.id, req.params.id);
    const message = monitor.isActive ? 'Monitor resumed successfully' : 'Monitor paused successfully';
    sendSuccess(res, monitor, message);
  } catch (error) {
    next(error);
  }
}

// Trigger instant manual ping verification
export async function triggerInstantPing(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await monitorService.triggerInstantPing(req.user!.id, req.params.id);
    sendSuccess(res, result, 'Instant ping executed successfully');
  } catch (error) {
    next(error);
  }
}

// Delete monitor configuration permanently
export async function deleteMonitor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await monitorService.deleteMonitor(req.user!.id, req.params.id);
    sendSuccess(res, null, 'Monitor deleted successfully');
  } catch (error) {
    next(error);
  }
}

