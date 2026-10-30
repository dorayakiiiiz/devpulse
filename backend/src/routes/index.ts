import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';

const router = Router();

// Mount system health check endpoints
router.use('/health', healthRoutes);

// Mount authentication and account endpoints
router.use('/auth', authRoutes);

export default router;
