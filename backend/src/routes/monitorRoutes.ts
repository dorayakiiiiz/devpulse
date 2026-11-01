import { Router } from 'express';
import { validateRequest } from '../middlewares/validateRequest.js';
import { instantPingLimiter } from '../middlewares/rateLimitMiddleware.js';
import {
  createMonitorSchema,
  updateMonitorSchema,
  monitorIdParamSchema,
} from '../schemas/monitorSchemas.js';
import {
  listMonitors,
  createMonitor,
  getMonitor,
  updateMonitor,
  toggleMonitor,
  triggerInstantPing,
  deleteMonitor,
} from '../controllers/monitorController.js';

const router = Router();

// List user monitors and create new monitor
router.get('/', listMonitors);
router.post('/', validateRequest(createMonitorSchema), createMonitor);

// Specific monitor operations scoped by ID
router.get('/:id', validateRequest(monitorIdParamSchema), getMonitor);
router.put('/:id', validateRequest(updateMonitorSchema), updateMonitor);
router.patch('/:id/toggle', validateRequest(monitorIdParamSchema), toggleMonitor);
router.post('/:id/ping', instantPingLimiter, validateRequest(monitorIdParamSchema), triggerInstantPing);
router.delete('/:id', validateRequest(monitorIdParamSchema), deleteMonitor);

export default router;

