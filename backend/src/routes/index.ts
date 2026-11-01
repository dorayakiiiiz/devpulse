import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';

const router = Router();

// Mount system health check endpoints
router.use('/health', healthRoutes);

// Mount authentication session endpoints
router.use('/auth', authRoutes);

// Mount user profile management endpoints
router.use('/users', userRoutes);

export default router;
