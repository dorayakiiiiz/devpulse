import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import monitorRoutes from './monitorRoutes.js';
import { authenticate } from '../middlewares/authMiddleware.js';

const router = Router();

// Public endpoints
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);

// Protected endpoints requiring authentication
router.use('/users', authenticate, userRoutes);
router.use('/monitors', authenticate, monitorRoutes);

export default router;
