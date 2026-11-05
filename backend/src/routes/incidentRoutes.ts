import { Router } from 'express';
import { validateRequest } from '../middlewares/validateRequest.js';
import {
  incidentIdParamSchema,
  queryIncidentsSchema,
} from '../schemas/incidentSchemas.js';
import {
  getIncidents,
  getIncidentById,
  resolveIncident,
  reanalyzeIncident,
} from '../controllers/incidentController.js';

const router = Router();

// List user incidents with optional status or monitor filter
router.get('/', validateRequest(queryIncidentsSchema), getIncidents);

// Specific incident operations scoped by ID
router.get('/:id', validateRequest(incidentIdParamSchema), getIncidentById);
router.patch('/:id/resolve', validateRequest(incidentIdParamSchema), resolveIncident);
router.post('/:id/reanalyze', validateRequest(incidentIdParamSchema), reanalyzeIncident);

export default router;

