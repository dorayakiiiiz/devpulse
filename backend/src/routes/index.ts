import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import monitorRoutes from './monitorRoutes.js';
import adminPingRoutes from './adminPingRoutes.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { requireAdmin } from '../middlewares/roleMiddleware.js';

const router = Router();

// Public endpoints
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);

// Protected endpoints requiring authentication
router.use('/users', authenticate, userRoutes);
router.use('/monitors', authenticate, monitorRoutes);

// Administrative endpoints requiring authentication and admin role
router.use('/admin/ping-engine', authenticate, requireAdmin, adminPingRoutes);

export default router;
