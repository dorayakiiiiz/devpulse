import { Router } from 'express';
import { getAdminOverview, getEngineStatus, forceFlushBuffer } from '../controllers/adminController.js';

const router = Router();

// Retrieve macro administrative statistics across all entities and memory metrics
router.get('/overview', getAdminOverview);

// Retrieve operational diagnostics and queue statistics for the ping engine
router.get('/ping-engine/status', getEngineStatus);

// Force immediate flush of queued in-memory ping metrics into persistent storage
router.post('/ping-engine/flush', forceFlushBuffer);

export default router;

