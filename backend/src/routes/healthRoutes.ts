import { Router } from 'express';
import { getHealthStatus } from '../controllers/healthController.js';

const router = Router();

// Endpoint for Docker container health check and system status
router.get('/', getHealthStatus);

export default router;

