import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import statusPageRoutes from './statusPageRoutes.js';
import userRoutes from './userRoutes.js';
import monitorRoutes from './monitorRoutes.js';
import incidentRoutes from './incidentRoutes.js';
import sseRoutes from './sseRoutes.js';
import adminRoutes from './adminRoutes.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { requireAdmin } from '../middlewares/roleMiddleware.js';

const router = Router();

// Public endpoints
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/status', statusPageRoutes);

// Protected endpoints requiring authentication
router.use('/users', authenticate, userRoutes);
router.use('/monitors', authenticate, monitorRoutes);
router.use('/incidents', authenticate, incidentRoutes);
router.use('/sse', authenticate, sseRoutes);

// Administrative endpoints requiring authentication and admin role
router.use('/admin', authenticate, requireAdmin, adminRoutes);

export default router;
