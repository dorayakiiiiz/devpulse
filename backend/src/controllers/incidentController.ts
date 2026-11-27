import { Request, Response, NextFunction } from 'express';
import { incidentService, IncidentFilterOptions } from '../services/incidentService.js';
import { sendSuccess } from '../utils/response.js';

// Retrieve paginated incidents belonging to current authenticated user
export async function getIncidents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const incidents = await incidentService.getIncidents(req.user!.id, req.query as IncidentFilterOptions);
    sendSuccess(res, incidents);
  } catch (error) {
    next(error);
  }
}

// Retrieve single incident details by id ensuring tenant ownership
export async function getIncidentById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const incident = await incidentService.getIncidentById(req.params.id, req.user!.id);
    sendSuccess(res, incident);
  } catch (error) {
    next(error);
  }
}

// Retrieve incident history for a target monitor owned by user
export async function getMonitorIncidents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const incidents = await incidentService.getMonitorIncidents(req.params.id, req.user!.id);
    sendSuccess(res, incidents);
  } catch (error) {
    next(error);
  }
}

// Manually resolve an ongoing incident
export async function resolveIncident(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const incident = await incidentService.resolveIncidentManually(req.params.id, req.user!.id);
    sendSuccess(res, incident, 'Incident marked as resolved successfully');
  } catch (error) {
    next(error);
  }
}

// Re-run AI post-mortem diagnostic analysis on existing incident
export async function reanalyzeIncident(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const incident = await incidentService.reanalyzeIncident(req.params.id, req.user!.id);
    sendSuccess(res, incident, 'AI post-mortem report generated successfully');
  } catch (error) {
    next(error);
  }
}
