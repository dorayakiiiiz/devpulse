import { Router } from 'express';
import { subscribeMonitors } from '../controllers/sseController.js';

const router = Router();

// Stream real-time monitor latency and alert events
router.get('/monitors', subscribeMonitors);

export default router;

