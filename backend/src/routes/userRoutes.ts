import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
} from '../controllers/userController.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import {
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,
} from '../schemas/userSchemas.js';

const router = Router();

// Retrieve authenticated user profile
router.get('/profile', authenticate, getProfile);

// Update user display name
router.put('/profile', authenticate, validateRequest(updateProfileSchema), updateProfile);

// Change user password requiring current password verification
router.put('/change-password', authenticate, validateRequest(changePasswordSchema), changePassword);

// Permanently delete user account confirming with current password
router.delete('/account', authenticate, validateRequest(deleteAccountSchema), deleteAccount);

export default router;

