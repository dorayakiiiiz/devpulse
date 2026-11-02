import { Router } from 'express';
import { forceFlushBuffer, getEngineStatus } from '../controllers/adminPingController.js';

const router = Router();

// Administrative endpoints for ping engine diagnostics and buffer control
router.post('/flush', forceFlushBuffer);
router.get('/status', getEngineStatus);

export default router;

